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
  const nonPayorWaterPerPayor = payerCount > 0 ? r2(nonPayorWaterTotal / payerCount) : 0;

  // ── PASS 2: Build final member charges (with non-payor water distributed) ──
  let totalWater = 0;
  const memberCharges = memberWaterOwn.map(({ member, presenceDays, ownWater }) => {
    let memberRentShare = 0;
    let memberElecShare = 0;
    let memberInternetShare = 0;
    let waterBillShare = ownWater; // non-payors keep their own consumption as display

    if (member.is_payer) {
      payerIndex++;
      // Water for payors = own consumption + share of non-payor water
      waterBillShare = r2(ownWater + nonPayorWaterPerPayor);
      totalWater = r2(totalWater + waterBillShare);

      if (payerIndex === payerCount) {
        // Last payer gets the remainder to ensure sum == total exactly
        memberRentShare = r2(rent - rentAssigned);
        memberElecShare = r2(electricity - elecAssigned);
        memberInternetShare = r2(internet - internetAssigned);
      } else {
        memberRentShare = rentShare;
        memberElecShare = electricityShare;
        memberInternetShare = internetShare;
      }
      rentAssigned = r2(rentAssigned + memberRentShare);
      elecAssigned = r2(elecAssigned + memberElecShare);
      internetAssigned = r2(internetAssigned + memberInternetShare);
    }

    const totalDue = r2(
      memberRentShare + memberElecShare + waterBillShare + memberInternetShare,
    );

    return {
      user_id: member.user_id,
      name: member.name || "Unknown",
      is_payer: member.is_payer,
      presence_days: presenceDays,
      rent_share: memberRentShare,
      electricity_share: memberElecShare,
      water_bill_share: waterBillShare,
      water_own: ownWater,
      water_shared_nonpayor: member.is_payer ? nonPayorWaterPerPayor : 0,
      internet_share: memberInternetShare,
      total_due: totalDue,
    };
  });

  cycle.member_charges = memberCharges;

  // Set water_bill_amount from presence if not manually set
  // totalWater = sum of all payers' waterBillShare (which includes non-payor split)
  // Add non-payor own water for the total room water amount
  const allMembersWater = memberWaterOwn.reduce((sum, m) => r2(sum + m.ownWater), 0);
  if (!cycle.water_bill_amount || parseFloat(cycle.water_bill_amount) === 0) {
    cycle.water_bill_amount = allMembersWater;
  }

  // Recalculate total_billed_amount to include computed water
  cycle.total_billed_amount = r2(
    rent + electricity + parseFloat(cycle.water_bill_amount || 0) + internet,
  );

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
