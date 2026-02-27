// Billing Cycle Controller (Supabase Version)
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");
const {
  enrichBillingCycle,
  enrichBillingCycles,
} = require("../utils/enrichBillingCycle");

// Helper to normalize a billing cycle charge for mobile compatibility
const normalizeCharge = (charge) => {
  if (!charge) return charge;
  return {
    ...charge,
    userId: charge.user_id,
    billingCycleId: charge.billing_cycle_id,
    isPayer: charge.is_payer,
    presenceDays: charge.presence_days,
    rentShare: charge.rent_share,
    electricityShare: charge.electricity_share,
    waterBillShare: charge.water_bill_share,
    waterOwn: charge.water_own,
    waterSharedNonpayor: charge.water_shared_nonpayor,
    internetShare: charge.internet_share,
    totalDue: charge.total_due,
  };
};

// Helper to normalize snake_case Supabase fields to camelCase for mobile clients
const normalizeBillingCycle = (cycle) => {
  if (!cycle) return cycle;
  return {
    ...cycle,
    startDate: cycle.start_date,
    endDate: cycle.end_date,
    waterBillAmount: cycle.water_bill_amount,
    totalBilledAmount: cycle.total_billed_amount,
    createdAt: cycle.created_at,
    createdBy: cycle.created_by,
    roomId: cycle.room_id,
    cycleNumber: cycle.cycle_number,
    previousMeterReading: cycle.previous_meter_reading ?? null,
    currentMeterReading: cycle.current_meter_reading ?? null,
    memberCharges: (cycle.member_charges || []).map(normalizeCharge),
  };
};

// ============================================================
// HELPERS — server-side stats derived from live DB data
// ============================================================

/**
 * Fetch the room's current members and compute:
 *   membersCount    — number of approved members
 *   waterBillAmount — total water charge based on billing mode
 *
 * For "fixed_monthly" rooms the caller-supplied fixedWaterAmount is used
 * as-is.  For presence-based rooms the water is recomputed from actual
 * presence records stored in Supabase (₱5 / member presence-day).
 */
const computeCycleStats = async (
  roomId,
  startDate,
  endDate,
  fixedWaterAmount,
  waterBillingMode,
) => {
  try {
    const members = (await SupabaseService.getRoomMembers(roomId)) || [];
    const approvedMembers = members.filter(
      (m) => !m.status || m.status === "approved",
    );
    const membersCount = approvedMembers.length;

    let waterBillAmount;
    if (waterBillingMode === "fixed_monthly" && Number(fixedWaterAmount) > 0) {
      // Fixed monthly — respect the admin-set amount
      waterBillAmount = Number(fixedWaterAmount);
    } else {
      // Presence-based — recompute from DB presence records
      const sd = new Date(startDate);
      const ed = new Date(endDate);
      waterBillAmount = approvedMembers.reduce((total, member) => {
        const presence = Array.isArray(member.presence) ? member.presence : [];
        const days = presence.filter((dateStr) => {
          const d = new Date(dateStr);
          return d >= sd && d <= ed;
        }).length;
        return total + days * 5;
      }, 0);
      // Fallback: if presence yields 0 but admin sent a value, keep it
      if (!waterBillAmount && Number(fixedWaterAmount) > 0) {
        waterBillAmount = Number(fixedWaterAmount);
      }
    }

    return { membersCount, waterBillAmount };
  } catch (_err) {
    return { membersCount: 0, waterBillAmount: Number(fixedWaterAmount) || 0 };
  }
};

// ============================================================
// CREATE A NEW BILLING CYCLE
// ============================================================
router.post("/", isAuthenticated, async (req, res, next) => {
  try {
    const {
      roomId,
      startDate,
      endDate,
      rent,
      electricity,
      previousMeterReading,
      currentMeterReading,
      water,
      waterBillAmount,
      internet,
    } = req.body;

    // Validation
    if (!roomId || !startDate || !endDate) {
      return next(
        new ErrorHandler("Room ID, start date, and end date are required", 400),
      );
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return next(new ErrorHandler("Start date must be before end date", 400));
    }

    const room = await SupabaseService.findRoomById(roomId);
    if (!room) {
      return next(new ErrorHandler("Room not found", 404));
    }

    // Get existing cycles for this room
    const existingCycles = await SupabaseService.getRoomBillingCycles(roomId);

    // Safety: If an active cycle already exists, update it instead of creating a duplicate
    const activeCycle = existingCycles?.find((c) => c.status === "active");
    if (activeCycle) {
      const updRent = rent || activeCycle.rent || 0;
      const updElec = electricity || activeCycle.electricity || 0;
      const updWaterRaw =
        waterBillAmount || water || activeCycle.water_bill_amount || 0;
      const updInternet = internet || activeCycle.internet || 0;

      // Recompute members_count and water from live DB data
      const { membersCount: updMembersCount, waterBillAmount: updWater } =
        await computeCycleStats(
          roomId,
          startDate,
          endDate,
          updWaterRaw,
          room.water_billing_mode,
        );

      const updatePayload = {
        start_date: new Date(startDate),
        end_date: new Date(endDate),
        rent: updRent,
        electricity: updElec,
        water_bill_amount: updWater,
        internet: updInternet,
        members_count: updMembersCount,
        total_billed_amount:
          parseFloat(updRent) +
          parseFloat(updElec) +
          parseFloat(updWater) +
          parseFloat(updInternet),
      };
      if (previousMeterReading != null)
        updatePayload.previous_meter_reading = previousMeterReading;
      else if (activeCycle.previous_meter_reading != null)
        updatePayload.previous_meter_reading =
          activeCycle.previous_meter_reading;
      if (currentMeterReading != null)
        updatePayload.current_meter_reading = currentMeterReading;
      else if (activeCycle.current_meter_reading != null)
        updatePayload.current_meter_reading = activeCycle.current_meter_reading;
      const updatedCycle = await SupabaseService.update(
        "billing_cycles",
        activeCycle.id,
        updatePayload,
      );

      return res.status(200).json({
        success: true,
        message: "Active billing cycle updated (already existed)",
        billingCycle: normalizeBillingCycle(updatedCycle),
      });
    }

    // Get next cycle number
    const cycleNumber = (existingCycles?.length || 0) + 1;

    // Create new billing cycle
    const rentVal = rent || 0;
    const elecVal = electricity || 0;
    const waterValRaw = waterBillAmount || water || 0;
    const internetVal = internet || 0;

    // Recompute members_count and water from live DB data
    const { membersCount: newMembersCount, waterBillAmount: waterVal } =
      await computeCycleStats(
        roomId,
        startDate,
        endDate,
        waterValRaw,
        room.water_billing_mode,
      );

    const totalAmount =
      parseFloat(rentVal) +
      parseFloat(elecVal) +
      parseFloat(waterVal) +
      parseFloat(internetVal);

    const billingCycle = await SupabaseService.createBillingCycle({
      room_id: roomId,
      cycle_number: cycleNumber,
      start_date: new Date(startDate),
      end_date: new Date(endDate),
      rent: rentVal,
      electricity: elecVal,
      water_bill_amount: waterVal,
      internet: internetVal,
      members_count: newMembersCount,
      previous_meter_reading:
        previousMeterReading != null ? previousMeterReading : null,
      current_meter_reading:
        currentMeterReading != null ? currentMeterReading : null,
      total_billed_amount: totalAmount,
      status: "active",
      created_by: req.user.id,
    });

    // Auto-create a pinned announcement banner for all room members
    try {
      const fmt = (d) =>
        new Date(d).toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      const lines = [`📅 Period: ${fmt(startDate)} – ${fmt(endDate)}`];
      if (parseFloat(rentVal) > 0)
        lines.push(`🏠 Rent: ₱${parseFloat(rentVal).toFixed(2)}`);
      if (parseFloat(elecVal) > 0)
        lines.push(`⚡ Electricity: ₱${parseFloat(elecVal).toFixed(2)}`);
      if (parseFloat(waterVal) > 0)
        lines.push(`💧 Water: ₱${parseFloat(waterVal).toFixed(2)}`);
      if (parseFloat(internetVal) > 0)
        lines.push(`📶 Internet: ₱${parseFloat(internetVal).toFixed(2)}`);
      lines.push(`\n💰 Total: ₱${totalAmount.toFixed(2)}`);

      // Unpin any existing pinned cycle announcements first
      const existing = await SupabaseService.selectAll(
        "announcements",
        "room_id",
        roomId,
      );
      const prevPinned = (existing || []).filter(
        (a) => a.is_pinned && a.notification_type === "billing_cycle",
      );
      await Promise.all(
        prevPinned.map((a) =>
          SupabaseService.update("announcements", a.id, { is_pinned: false }),
        ),
      );

      await SupabaseService.insert("announcements", {
        room_id: roomId,
        title: `New Billing Cycle #${cycleNumber} – ${room.name || "Your Room"}`,
        content: lines.join("\n"),
        created_by: req.user.id,
        is_pinned: true,
        target_user_id: null,
        notification_type: "billing_cycle",
        created_at: new Date(),
      });
    } catch (bannerErr) {
      // Non-fatal: don't fail the cycle creation if banner insert fails
      console.error("[auto-banner] failed:", bannerErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Billing cycle created successfully",
      billingCycle: normalizeBillingCycle(billingCycle),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET ACTIVE BILLING CYCLE FOR ROOM
// ============================================================
router.get("/room/:roomId/active", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const room = await SupabaseService.findRoomById(roomId);
    if (!room) {
      return next(new ErrorHandler("Room not found", 404));
    }

    const activeCycle = await SupabaseService.getActiveBillingCycle(roomId);

    if (!activeCycle) {
      return res.status(200).json({
        success: true,
        billingCycle: null,
        message: "No active billing cycle",
      });
    }

    res.status(200).json({
      success: true,
      billingCycle: normalizeBillingCycle(activeCycle),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET ALL BILLING CYCLES FOR A ROOM
// ============================================================
router.get("/room/:roomId", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const room = await SupabaseService.findRoomById(roomId);
    if (!room) {
      return next(new ErrorHandler("Room not found", 404));
    }

    const billingCycles = await SupabaseService.getRoomBillingCycles(roomId);

    // Enrich cycles using shared utility (handles rounding & penny remainder)
    const enrichedCycles = await enrichBillingCycles(billingCycles, roomId);

    res.status(200).json({
      success: true,
      billingCycles: enrichedCycles.map(normalizeBillingCycle),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET LATEST BILLING CYCLE STATS
// (Must be BEFORE /:cycleId to avoid Express matching "totals" as a cycleId)
// ============================================================
router.get("/totals/latest", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId } = req.query;

    // Get all billing cycles
    const cycles = await SupabaseService.selectAllRecords(
      "billing_cycles",
      "*",
    );

    // Filter to only cycles belonging to rooms created by the current admin
    const allRooms = await SupabaseService.selectAllRecords("rooms", "*");
    let adminRoomIds = (allRooms || [])
      .filter((r) => r.created_by === req.user.id)
      .map((r) => r.id);

    // If roomId provided, narrow down to that single room
    if (roomId && adminRoomIds.includes(roomId)) {
      adminRoomIds = [roomId];
    }

    const adminCycles = (cycles || []).filter((c) =>
      adminRoomIds.includes(c.room_id),
    );

    if (!adminCycles || adminCycles.length === 0) {
      return res.status(200).json({
        success: true,
        stats: {
          activeCycles: 0,
          totalBilled: 0,
          totalCollected: 0,
          totalPending: 0,
          collectionRate: 0,
        },
      });
    }

    // Sort by created_at descending to get latest
    const sortedCycles = adminCycles.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );

    const latestCycle = sortedCycles[0];

    // Enrich with presence-based water charges
    await enrichBillingCycle(latestCycle);

    // Calculate totalBilled from enriched values
    const totalBilled = latestCycle.total_billed_amount
      ? parseFloat(latestCycle.total_billed_amount)
      : parseFloat(latestCycle.rent || 0) +
        parseFloat(latestCycle.electricity || 0) +
        parseFloat(latestCycle.water_bill_amount || 0) +
        parseFloat(latestCycle.internet || 0);

    // Get payments matched by billing cycle columns (not payment_date)
    const cyclePayments =
      (await SupabaseService.getPaymentsForCycle(
        latestCycle.room_id,
        latestCycle.start_date,
        latestCycle.end_date,
      )) || [];

    const rawCollected = cyclePayments
      .filter((p) => p.status === "completed" || p.status === "verified")
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    // Cap collected at totalBilled to prevent rounding overshoot
    const totalCollected = Math.min(rawCollected, totalBilled);
    const totalPending = Math.max(0, totalBilled - totalCollected);
    const collectionRate =
      totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      stats: {
        activeCycles: 1,
        totalBilled,
        totalCollected,
        totalPending,
        collectionRate: parseFloat(collectionRate),
        latestCycleId: latestCycle.id,
        startDate: latestCycle.start_date,
        endDate: latestCycle.end_date,
        cycleStatus: latestCycle.status || "active",
      },
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET BILLING TOTALS BY MONTH
// (Must be BEFORE /:cycleId to avoid Express matching "totals" as a cycleId)
// ============================================================
router.get("/totals/month", isAuthenticated, async (req, res, next) => {
  try {
    const { months = 6, roomId } = req.query;
    const monthCount = parseInt(months) || 6;

    // Get all billing cycles
    const allCycles = await SupabaseService.selectAllRecords(
      "billing_cycles",
      "*",
    );

    // Filter to only cycles belonging to rooms created by the current admin
    const allRooms = await SupabaseService.selectAllRecords("rooms", "*");
    let adminRoomIds = (allRooms || [])
      .filter((r) => r.created_by === req.user.id)
      .map((r) => r.id);

    // If roomId provided, narrow down to that single room
    if (roomId && adminRoomIds.includes(roomId)) {
      adminRoomIds = [roomId];
    }

    const adminCycles = (allCycles || []).filter((c) =>
      adminRoomIds.includes(c.room_id),
    );

    // Filter to rooms that have at least one member
    const allMembers = await SupabaseService.selectAllRecords(
      "room_members",
      "*",
    );
    const roomsWithMembers = new Set((allMembers || []).map((m) => m.room_id));

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthCount);

    const relevantCycles = (adminCycles || [])
      .filter((cycle) => {
        const cycleDate = new Date(cycle.created_at);
        return cycleDate >= cutoffDate && roomsWithMembers.has(cycle.room_id);
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const monthlyStats = [];
    for (const cycle of relevantCycles) {
      // Enrich with presence-based water charges
      await enrichBillingCycle(cycle);

      // Get payments matched by billing cycle columns (not payment_date)
      const cyclePayments =
        (await SupabaseService.getPaymentsForCycle(
          cycle.room_id,
          cycle.start_date,
          cycle.end_date,
        )) || [];

      const totalBilled = cycle.total_billed_amount
        ? parseFloat(cycle.total_billed_amount)
        : parseFloat(cycle.rent || 0) +
          parseFloat(cycle.electricity || 0) +
          parseFloat(cycle.water_bill_amount || 0) +
          parseFloat(cycle.internet || 0);
      const rawCollected = cyclePayments
        .filter((p) => p.status === "completed" || p.status === "verified")
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const totalCollected = Math.min(rawCollected, totalBilled);

      monthlyStats.push({
        cycleId: cycle.id,
        cycleNumber: cycle.cycle_number,
        month: new Date(cycle.start_date).toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
        totalBilled,
        totalCollected,
        totalPending: totalBilled - totalCollected,
      });
    }

    res.status(200).json({
      success: true,
      months: monthCount,
      data: monthlyStats,
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET SINGLE BILLING CYCLE
// ============================================================
router.get("/:cycleId", isAuthenticated, async (req, res, next) => {
  try {
    const { cycleId } = req.params;

    const cycle = await SupabaseService.selectByColumn(
      "billing_cycles",
      "id",
      cycleId,
    );

    if (!cycle) {
      return next(new ErrorHandler("Billing cycle not found", 404));
    }

    // Enrich with presence-based water charges
    await enrichBillingCycle(cycle);

    res.status(200).json({
      success: true,
      billingCycle: normalizeBillingCycle(cycle),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// UPDATE BILLING CYCLE
// ============================================================
router.put("/:cycleId", isAuthenticated, async (req, res, next) => {
  try {
    const { cycleId } = req.params;
    const {
      rent,
      electricity,
      water,
      waterBillAmount,
      internet,
      status,
      previousMeterReading,
      currentMeterReading,
    } = req.body;

    const updateData = {};
    if (rent !== undefined) updateData.rent = rent;
    if (electricity !== undefined) updateData.electricity = electricity;
    if (waterBillAmount !== undefined)
      updateData.water_bill_amount = waterBillAmount;
    else if (water !== undefined) updateData.water_bill_amount = water;
    if (internet !== undefined) updateData.internet = internet;
    if (status) updateData.status = status;
    if (previousMeterReading != null)
      updateData.previous_meter_reading = previousMeterReading;
    if (currentMeterReading != null)
      updateData.current_meter_reading = currentMeterReading;

    // Recalculate total_billed_amount if any amount field changed
    if (
      rent !== undefined ||
      electricity !== undefined ||
      waterBillAmount !== undefined ||
      water !== undefined ||
      internet !== undefined
    ) {
      // Fetch current cycle to get existing values for fields not being updated
      const currentCycle = await SupabaseService.selectByColumn(
        "billing_cycles",
        "id",
        cycleId,
      );
      const r = parseFloat(updateData.rent ?? currentCycle?.rent ?? 0);
      const e = parseFloat(
        updateData.electricity ?? currentCycle?.electricity ?? 0,
      );
      const i = parseFloat(updateData.internet ?? currentCycle?.internet ?? 0);

      // Recompute members_count and water from live DB presence data
      const cycleRoomId = currentCycle?.room_id;
      const cycleRoom = cycleRoomId
        ? await SupabaseService.findRoomById(cycleRoomId)
        : null;
      const waterRaw = parseFloat(
        updateData.water_bill_amount ?? currentCycle?.water_bill_amount ?? 0,
      );
      const { membersCount: updMembersCount, waterBillAmount: computedWater } =
        cycleRoomId
          ? await computeCycleStats(
              cycleRoomId,
              currentCycle.start_date,
              currentCycle.end_date,
              waterRaw,
              cycleRoom?.water_billing_mode,
            )
          : { membersCount: 0, waterBillAmount: waterRaw };

      const w = computedWater;
      updateData.water_bill_amount = w;
      updateData.members_count = updMembersCount;
      updateData.total_billed_amount = r + e + w + i;
    }

    const updatedCycle = await SupabaseService.update(
      "billing_cycles",
      cycleId,
      updateData,
    );

    res.status(200).json({
      success: true,
      message: "Billing cycle updated successfully",
      billingCycle: normalizeBillingCycle(updatedCycle),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// BACKFILL — recalculate members_count & water_bill_amount
//            for all existing billing cycles in the DB
// POST /api/v1/billing-cycles/backfill-stats
// ============================================================
router.post("/backfill-stats", isAuthenticated, async (req, res, next) => {
  try {
    const allCycles =
      (await SupabaseService.selectAllRecords(
        "billing_cycles",
        "id, room_id, status, start_date, end_date, rent, electricity, water_bill_amount, internet, members_count",
      )) || [];

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const cycle of allCycles) {
      try {
        const room = await SupabaseService.findRoomById(cycle.room_id);
        if (!room) {
          skipped++;
          continue;
        }

        const { membersCount, waterBillAmount } = await computeCycleStats(
          cycle.room_id,
          cycle.start_date,
          cycle.end_date,
          cycle.water_bill_amount,
          room.water_billing_mode,
        );

        const r = parseFloat(cycle.rent || 0);
        const e = parseFloat(cycle.electricity || 0);
        const w = parseFloat(waterBillAmount || 0);
        const i = parseFloat(cycle.internet || 0);

        await SupabaseService.update("billing_cycles", cycle.id, {
          members_count: membersCount,
          water_bill_amount: w,
          total_billed_amount: r + e + w + i,
        });
        updated++;
      } catch (err) {
        errors.push({ cycleId: cycle.id, error: err.message });
        skipped++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Backfill complete. Updated: ${updated}, Skipped: ${skipped}.`,
      updated,
      skipped,
      errors,
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// CLOSE/ARCHIVE BILLING CYCLE
// ============================================================
router.post("/:cycleId/close", isAuthenticated, async (req, res, next) => {
  try {
    const { cycleId } = req.params;

    const updatedCycle = await SupabaseService.update(
      "billing_cycles",
      cycleId,
      {
        status: "closed",
        closed_at: new Date(),
        closed_by: req.user.id,
      },
    );

    res.status(200).json({
      success: true,
      message: "Billing cycle closed successfully",
      billingCycle: normalizeBillingCycle(updatedCycle),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET CHARGES FOR A BILLING CYCLE
// ============================================================
router.get("/:cycleId/charges", isAuthenticated, async (req, res, next) => {
  try {
    const { cycleId } = req.params;

    const charges =
      (await SupabaseService.selectAll(
        "billing_cycle_charges",
        "billing_cycle_id",
        cycleId,
      )) || [];

    // Enrich with user details
    for (let charge of charges) {
      const user = await SupabaseService.findUserById(charge.user_id);
      charge.user = user;
    }

    res.status(200).json({
      success: true,
      charges: (charges || []).map(normalizeCharge),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// DELETE BILLING CYCLE
// ============================================================
router.delete("/:cycleId", isAuthenticated, async (req, res, next) => {
  try {
    const { cycleId } = req.params;

    await SupabaseService.deleteRecord("billing_cycles", cycleId);

    res.status(200).json({
      success: true,
      message: "Billing cycle deleted successfully",
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

module.exports = router;
