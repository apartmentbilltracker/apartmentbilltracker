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
async function enrichBillingCycle(cycle, members) {
  if (!cycle) return cycle;

  // Fetch members if not provided
  if (!members) {
    members = await SupabaseService.getRoomMembers(cycle.room_id);
  }

  // Fetch room to check water billing mode
  let waterBillingMode = "presence";
  let waterFixedAmount = 0;
  try {
    const room = await SupabaseService.findById("rooms", cycle.room_id);
    waterBillingMode = room?.water_billing_mode || "presence";
    waterFixedAmount = parseFloat(room?.water_fixed_amount || 0) || 0;
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

  // ── FIXED MONTHLY WATER: split equally among payors, skip presence math ──
  if (waterBillingMode === "fixed_monthly") {
    const fixedWaterPerPayor =
      payerCount > 0 ? r2(waterFixedAmount / payerCount) : 0;
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
        if (fixedPayerIndex === payerCount) {
          // Last payer absorbs rounding remainder
          memberRentShare = r2(rent - rentAssigned);
          memberElecShare = r2(electricity - elecAssigned);
          memberInternetShare = r2(internet - internetAssigned);
          waterBillShare = r2(waterFixedAmount - waterAssignedFixed);
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
        water_own: waterBillShare,
        water_shared_nonpayor: 0,
        internet_share: memberInternetShare,
        total_due: totalDue,
      };
    });

    cycle.member_charges = memberCharges;
    cycle.water_bill_amount = waterFixedAmount;
    cycle.total_billed_amount = r2(
      rent + electricity + waterFixedAmount + internet,
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

  // Check if admin set a specific water bill amount — if so, we'll scale charges
  const adminWater = cycle.water_bill_amount
    ? parseFloat(cycle.water_bill_amount)
    : 0;
  const rawTotalWater = memberWaterOwn.reduce(
    (sum, m) => r2(sum + m.ownWater),
    0,
  );
  // Scale factor: if admin set 505 but raw presence totals 530, scale = 505/530
  // If rawTotalWater is 0 (no presence in this cycle), water is 0 regardless of stored amount
  const waterScale =
    adminWater > 0 && rawTotalWater > 0 ? adminWater / rawTotalWater : 1;

  // Target water total that all payors collectively must cover
  // If no presence data in cycle range, target is 0 (fresh cycle, no water yet)
  const targetWaterTotal =
    rawTotalWater === 0 ? 0 : adminWater > 0 ? adminWater : rawTotalWater;

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

  // Set water_bill_amount from presence if not manually set
  // If no presence in cycle range AND cycle is still active, water should be 0 (fresh cycle)
  const allMembersWater = memberWaterOwn.reduce(
    (sum, m) => r2(sum + m.ownWater),
    0,
  );
  if (allMembersWater === 0 && cycle.status === "active") {
    // No presence data in this active cycle's range — override any stale stored water
    cycle.water_bill_amount = 0;
  } else if (
    !cycle.water_bill_amount ||
    parseFloat(cycle.water_bill_amount) === 0
  ) {
    cycle.water_bill_amount = allMembersWater;
  }

  // Recalculate total_billed_amount to include computed water
  cycle.total_billed_amount = r2(
    rent + electricity + parseFloat(cycle.water_bill_amount || 0) + internet,
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

  const members = await SupabaseService.getRoomMembers(
    roomId || cycles[0].room_id,
  );

  for (const cycle of cycles) {
    await enrichBillingCycle(cycle, members);
  }

  return cycles;
}

module.exports = {
  enrichBillingCycle,
  enrichBillingCycles,
  WATER_RATE_PER_DAY,
};
