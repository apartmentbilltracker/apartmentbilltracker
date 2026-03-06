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

  const payingMembers = members.filter((m) => m.is_payer);
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
    // per_person: each payor is charged waterFixedAmount individually
    // by_room:    one total (waterFixedAmount) split equally among payors
    const totalFixedWater =
      waterFixedType === "per_person"
        ? r2(waterFixedAmount * payerCount)
        : waterFixedAmount;
    const fixedWaterPerPayor =
      waterFixedType === "per_person"
        ? waterFixedAmount // each person always pays the full per-person rate
        : payerCount > 0
          ? r2(waterFixedAmount / payerCount)
          : 0;
    let waterAssignedFixed = 0;
    let fixedPayerIndex = 0;

    const memberCharges = members.map((member) => {
      const presenceArr = Array.isArray(member.presence) ? member.presence : [];
      const presenceDays = presenceArr.filter((day) => {
        const d = new Date(day);
        return d >= cycleStart && d <= cycleEnd;
      }).length;

      let memberRentShare = 0;
      let memberElecShare = 0;
      let memberInternetShare = 0;
      let waterBillShare = 0;

      if (member.is_payer) {
        fixedPayerIndex++;
        // Last payer absorbs rounding remainder for rent/elec/internet
        if (fixedPayerIndex === payerCount) {
          memberRentShare = r2(rent - rentAssigned);
          memberElecShare = r2(electricity - elecAssigned);
          memberInternetShare = r2(internet - internetAssigned);
          waterBillShare =
            waterFixedType === "per_person"
              ? waterFixedAmount
              : r2(totalFixedWater - waterAssignedFixed);
        } else {
          memberRentShare = rentShare;
          memberElecShare = electricityShare;
          memberInternetShare = internetShare;
          waterBillShare =
            waterFixedType === "per_person"
              ? waterFixedAmount
              : fixedWaterPerPayor;
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
        water_own: waterBillShare,
        water_shared_nonpayor: 0,
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
    const payerCharges = memberCharges.filter((c) => c.is_payer);
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
      return d >= cycleStart && d <= cycleEnd;
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

  // For presence-based mode, always use live presence data as the target.
  // The stored water_bill_amount becomes stale as members mark presence after the
  // cycle was first saved, so scaling against it produces incorrect per-member shares.
  // No scaling is needed — each member's share is computed from their own presence.
  const waterScale = 1;

  // Target water total = sum of all members' own presence-based water
  const targetWaterTotal = rawTotalWater;

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

  // For presence-based mode, always use live presence total as water_bill_amount.
  // The stored value becomes stale once members mark more presence after the cycle was saved.
  const allMembersWater = rawTotalWater;
  cycle.water_bill_amount = allMembersWater;

  // Recalculate total_billed_amount to include computed water
  cycle.total_billed_amount = r2(
    rent + electricity + allMembersWater + internet,
  );

  // ── Final pass: correct last payer's total_due so sum matches total_billed_amount ──
  const payerCharges = memberCharges.filter((c) => c.is_payer);
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
