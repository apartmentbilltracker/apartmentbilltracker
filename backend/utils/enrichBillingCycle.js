/**
 * Shared utility to enrich a billing cycle with presence-based water bill data.
 *
 * The billing_cycles table stores water_bill_amount and member_charges, but these
 * may be empty/zero when the cycle is first created. Water bills are computed
 * dynamically from member presence data (₱5/day per member).
 *
 * This function applies that enrichment so that any controller returning billing
 * cycle data includes accurate water charges.
 */
const SupabaseService = require("../db/SupabaseService");

const WATER_RATE_PER_DAY = 5; // ₱5 per day

/** Round to 2 decimal places (cents) */
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * Enrich a single billing cycle with computed member charges from presence data.
 * Mutates the cycle object in-place and also returns it.
 *
 * @param {Object} cycle - Raw billing cycle from DB
 * @param {Array}  [members] - Room members array (fetched if not provided)
 * @returns {Object} The enriched cycle
 */
async function enrichBillingCycle(cycle, members, roomData) {
  if (!cycle) return cycle;

  // Fetch members if not provided
  if (!members) {
    members = await SupabaseService.getRoomMembers(cycle.room_id);
  }

  // ── COMPLETED / CLOSED CYCLES ──
  // Use the snapshotted member_charges persisted at close time (preserves
  // the original presence-based water split). Only fall back to equal split
  // if no snapshot was stored (legacy cycles closed before this fix).
  if (cycle.status === "completed" || cycle.status === "closed") {
    // Parse stored member_charges if it's a JSON string
    let stored = cycle.member_charges;
    if (typeof stored === "string") {
      try {
        stored = JSON.parse(stored);
      } catch (_) {
        stored = null;
      }
    }
    if (Array.isArray(stored) && stored.length > 0) {
      cycle.member_charges = stored;
      return cycle;
    }

    // Legacy fallback: no snapshot — split stored totals evenly among payers
    const rent = parseFloat(cycle.rent || 0);
    const electricity = parseFloat(cycle.electricity || 0);
    const internet = parseFloat(cycle.internet || 0);
    const water = parseFloat(cycle.water_bill_amount || 0);

    const payingMembers = members.filter((m) => m.is_payer !== false);
    const payerCount = payingMembers.length;

    const rentShare = payerCount > 0 ? r2(rent / payerCount) : 0;
    const elecShare = payerCount > 0 ? r2(electricity / payerCount) : 0;
    const internetShare = payerCount > 0 ? r2(internet / payerCount) : 0;
    const waterShare = payerCount > 0 ? r2(water / payerCount) : 0;

    let rentAssigned = 0,
      elecAssigned = 0,
      internetAssigned = 0,
      waterAssigned = 0;
    let pidx = 0;

    const memberCharges = members.map((member) => {
      let memberRent = 0,
        memberElec = 0,
        memberInternet = 0,
        memberWater = 0;

      if (member.is_payer !== false) {
        pidx++;
        if (pidx === payerCount) {
          memberRent = r2(rent - rentAssigned);
          memberElec = r2(electricity - elecAssigned);
          memberInternet = r2(internet - internetAssigned);
          memberWater = r2(water - waterAssigned);
        } else {
          memberRent = rentShare;
          memberElec = elecShare;
          memberInternet = internetShare;
          memberWater = waterShare;
        }
        rentAssigned = r2(rentAssigned + memberRent);
        elecAssigned = r2(elecAssigned + memberElec);
        internetAssigned = r2(internetAssigned + memberInternet);
        waterAssigned = r2(waterAssigned + memberWater);
      }

      return {
        user_id: member.user_id,
        name: member.name || "Unknown",
        is_payer: member.is_payer,
        presence_days: 0,
        rent_share: memberRent,
        electricity_share: memberElec,
        water_bill_share: memberWater,
        water_own: memberWater,
        water_shared_nonpayor: 0,
        internet_share: memberInternet,
        total_due: r2(memberRent + memberElec + memberWater + memberInternet),
      };
    });

    cycle.member_charges = memberCharges;
    cycle.total_billed_amount = r2(rent + electricity + water + internet);
    return cycle;
  }

  // Use provided roomData to avoid a DB round-trip when caller already has it
  let waterBillingMode = "presence";
  let waterFixedAmount = 0;
  let waterFixedType = "by_room"; // "by_room" | "per_person"
  try {
    const room =
      roomData || (await SupabaseService.findById("rooms", cycle.room_id));
    waterBillingMode = room?.water_billing_mode || "presence";
    waterFixedAmount = parseFloat(room?.water_fixed_amount || 0) || 0;
    waterFixedType = room?.water_fixed_type || "by_room";
  } catch (_) {}

  const cycleStart = new Date(cycle.start_date);
  const cycleEnd = new Date(cycle.end_date);
  // For active cycles that have run past their end date, count any presence
  // dates logged after end_date (members still in the cycle) up to today.
  const isActiveCycle = cycle.status === "active";
  const effectiveEnd =
    isActiveCycle && new Date() > cycleEnd ? new Date() : cycleEnd;

  const payingMembers = members.filter((m) => m.is_payer !== false);
  const payerCount = payingMembers.length;

  // Per-payer even splits for rent, electricity, internet — rounded to 2dp
  const rent = parseFloat(cycle.rent || 0);
  const electricity = parseFloat(cycle.electricity || 0);
  const internet = parseFloat(cycle.internet || 0);
  const rentShare = payerCount > 0 ? r2(rent / payerCount) : 0;
  const electricityShare = payerCount > 0 ? r2(electricity / payerCount) : 0;
  const internetShare = payerCount > 0 ? r2(internet / payerCount) : 0;

  // Track running totals for penny-remainder handling
  let rentAssigned = 0;
  let elecAssigned = 0;
  let internetAssigned = 0;
  let payerIndex = 0;

  // ── FIXED MONTHLY WATER ──
  if (waterBillingMode === "fixed_monthly") {
    // per_person: every member is allocated waterFixedAmount; non-payer
    //   shares are redistributed equally to payers.
    // by_room:    one total (waterFixedAmount) split equally among payors
    const allMembersCount = members.length || 1;
    const nonPayerCount = allMembersCount - payerCount;
    const totalFixedWater =
      waterFixedType === "per_person"
        ? r2(waterFixedAmount * allMembersCount)
        : waterFixedAmount;
    // For per_person payers absorb non-payer water equally
    const nonPayorWaterPerPayor =
      waterFixedType === "per_person" && payerCount > 0
        ? r2((nonPayerCount * waterFixedAmount) / payerCount)
        : 0;
    const fixedWaterPerPayor =
      waterFixedType === "per_person"
        ? r2(waterFixedAmount + nonPayorWaterPerPayor)
        : payerCount > 0
          ? r2(waterFixedAmount / payerCount)
          : 0;
    let waterAssignedFixed = 0;
    let fixedPayerIndex = 0;

    const memberCharges = members.map((member) => {
      const presenceArr = Array.isArray(member.presence) ? member.presence : [];
      const presenceDays = presenceArr.filter((day) => {
        const d = new Date(day);
        return d >= cycleStart && d <= effectiveEnd;
      }).length;

      let memberRentShare = 0;
      let memberElecShare = 0;
      let memberInternetShare = 0;
      let waterBillShare = 0;

      if (member.is_payer !== false) {
        fixedPayerIndex++;
        // Last payer absorbs rounding remainder for rent/elec/internet
        if (fixedPayerIndex === payerCount) {
          memberRentShare = r2(rent - rentAssigned);
          memberElecShare = r2(electricity - elecAssigned);
          memberInternetShare = r2(internet - internetAssigned);
          waterBillShare = r2(totalFixedWater - waterAssignedFixed);
        } else {
          memberRentShare = rentShare;
          memberElecShare = electricityShare;
          memberInternetShare = internetShare;
          waterBillShare = fixedWaterPerPayor;
        }
        rentAssigned = r2(rentAssigned + memberRentShare);
        elecAssigned = r2(elecAssigned + memberElecShare);
        internetAssigned = r2(internetAssigned + memberInternetShare);
        waterAssignedFixed = r2(waterAssignedFixed + waterBillShare);
      }

      const totalDue = r2(
        memberRentShare +
          memberElecShare +
          waterBillShare +
          memberInternetShare,
      );

      return {
        user_id: member.user_id,
        name: member.name || "Unknown",
        is_payer: member.is_payer,
        presence_days: presenceDays,
        rent_share: memberRentShare,
        electricity_share: memberElecShare,
        water_bill_share: waterBillShare,
        water_own:
          waterFixedType === "per_person" ? waterFixedAmount : waterBillShare,
        water_shared_nonpayor:
          member.is_payer !== false && waterFixedType === "per_person"
            ? r2(waterBillShare - waterFixedAmount)
            : 0,
        internet_share: memberInternetShare,
        total_due: totalDue,
      };
    });

    cycle.member_charges = memberCharges;
    cycle.water_bill_amount = totalFixedWater;
    cycle.total_billed_amount = r2(
      rent + electricity + totalFixedWater + internet,
    );

    // Correct last payer total_due for any rounding
    const payerCharges = memberCharges.filter((c) => c.is_payer !== false);
    if (payerCharges.length > 0) {
      const sumPayerTotals = payerCharges.reduce(
        (s, c) => r2(s + c.total_due),
        0,
      );
      const diff = r2(cycle.total_billed_amount - sumPayerTotals);
      if (diff !== 0) {
        payerCharges[payerCharges.length - 1].total_due = r2(
          payerCharges[payerCharges.length - 1].total_due + diff,
        );
      }
    }
    return cycle;
  }

  // ── PASS 1: Compute each member's individual water consumption ──
  let nonPayorWaterTotal = 0;
  const memberWaterOwn = members.map((member) => {
    const presenceArr = Array.isArray(member.presence) ? member.presence : [];
    const presenceDays = presenceArr.filter((day) => {
      const d = new Date(day);
      return d >= cycleStart && d <= effectiveEnd;
    }).length;

    const ownWater = r2(presenceDays * WATER_RATE_PER_DAY);
    if (!member.is_payer) {
      nonPayorWaterTotal = r2(nonPayorWaterTotal + ownWater);
    }
    return { member, presenceDays, ownWater };
  });

  // Non-payor water split evenly among payors
  const nonPayorWaterPerPayor =
    payerCount > 0 ? r2(nonPayorWaterTotal / payerCount) : 0;

  const rawTotalWater = memberWaterOwn.reduce(
    (sum, m) => r2(sum + m.ownWater),
    0,
  );

  // For presence-based water (active cycles): live presence is the truth.
  // The stored water_bill_amount may be stale (e.g. set at cycle creation
  // before members logged presence). Always use the live-computed total
  // so member shares reflect actual presence days without distortion.
  const storedWaterAmount = parseFloat(cycle.water_bill_amount || 0);

  // Active presence-based cycles: trust live computation, no scaling
  const targetWaterTotal = rawTotalWater;
  const waterScale = 1;

  // console.log(
  //   "[enrichBillingCycle] WATER DEBUG:",
  //   JSON.stringify({
  //     storedWaterAmount,
  //     rawTotalWater,
  //     waterScale,
  //     targetWaterTotal,
  //     nonPayorWaterTotal,
  //     payerCount,
  //     members: memberWaterOwn.map((m) => ({
  //       name: m.member.name,
  //       is_payer: m.member.is_payer,
  //       presenceDays: m.presenceDays,
  //       ownWater: m.ownWater,
  //     })),
  //   }),
  // );

  // ── PASS 2: Build final member charges (with non-payor water distributed) ──
  let totalWater = 0;
  let waterAssigned = 0;
  const memberCharges = memberWaterOwn.map(
    ({ member, presenceDays, ownWater }) => {
      let memberRentShare = 0;
      let memberElecShare = 0;
      let memberInternetShare = 0;
      // Scale the raw water to match admin-set bill
      const scaledOwnWater = r2(ownWater * waterScale);
      let waterBillShare = scaledOwnWater; // non-payors keep their own scaled consumption

      if (member.is_payer) {
        payerIndex++;
        // Scaled non-payor water per payor
        const scaledNonPayorPerPayor =
          payerCount > 0
            ? r2((nonPayorWaterTotal * waterScale) / payerCount)
            : 0;
        waterBillShare = r2(scaledOwnWater + scaledNonPayorPerPayor);

        if (payerIndex === payerCount) {
          // Last payer gets the remainder to ensure sum == total exactly
          memberRentShare = r2(rent - rentAssigned);
          memberElecShare = r2(electricity - elecAssigned);
          memberInternetShare = r2(internet - internetAssigned);
          // Water remainder: ensure payer water sums to target total
          waterBillShare = r2(targetWaterTotal - waterAssigned);
        } else {
          memberRentShare = rentShare;
          memberElecShare = electricityShare;
          memberInternetShare = internetShare;
        }
        rentAssigned = r2(rentAssigned + memberRentShare);
        elecAssigned = r2(elecAssigned + memberElecShare);
        internetAssigned = r2(internetAssigned + memberInternetShare);
        waterAssigned = r2(waterAssigned + waterBillShare);
        totalWater = r2(totalWater + waterBillShare);
      }

      const totalDue = r2(
        memberRentShare +
          memberElecShare +
          waterBillShare +
          memberInternetShare,
      );

      return {
        user_id: member.user_id,
        name: member.name || "Unknown",
        is_payer: member.is_payer,
        presence_days: presenceDays,
        rent_share: memberRentShare,
        electricity_share: memberElecShare,
        water_bill_share: waterBillShare,
        water_own: scaledOwnWater,
        water_shared_nonpayor: member.is_payer
          ? r2(waterBillShare - scaledOwnWater)
          : 0,
        internet_share: memberInternetShare,
        total_due: totalDue,
      };
    },
  );

  cycle.member_charges = memberCharges;

  // For presence-based active cycles, always update water_bill_amount to the
  // live-computed total so the DB stays in sync with actual presence data.
  cycle.water_bill_amount = targetWaterTotal;

  // Recalculate total_billed_amount to include the (possibly scaled) target water
  cycle.total_billed_amount = r2(
    rent + electricity + targetWaterTotal + internet,
  );

  // ── Final pass: correct last payer's total_due so sum matches total_billed_amount ──
  const payerCharges = memberCharges.filter((c) => c.is_payer !== false);
  if (payerCharges.length > 0) {
    const sumPayerTotals = payerCharges.reduce(
      (s, c) => r2(s + c.total_due),
      0,
    );
    const diff = r2(cycle.total_billed_amount - sumPayerTotals);
    if (diff !== 0) {
      const lastPayer = payerCharges[payerCharges.length - 1];
      lastPayer.total_due = r2(lastPayer.total_due + diff);
    }
  }

  return cycle;
}

/**
 * Enrich multiple billing cycles.
 *
 * @param {Array}  cycles - Array of raw billing cycles
 * @param {string} roomId - The room ID (used to fetch members once)
 * @returns {Array} Enriched cycles
 */
async function enrichBillingCycles(cycles, roomId) {
  if (!cycles || cycles.length === 0) return cycles || [];

  const rid = roomId || cycles[0].room_id;
  const [members, roomData] = await Promise.all([
    SupabaseService.getRoomMembers(rid),
    SupabaseService.findById("rooms", rid).catch(() => null),
  ]);

  for (const cycle of cycles) {
    await enrichBillingCycle(cycle, members, roomData);
  }

  return cycles;
}

module.exports = {
  enrichBillingCycle,
  enrichBillingCycles,
  WATER_RATE_PER_DAY,
};
