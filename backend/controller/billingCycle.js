const BillingCycle = require("../model/billingCycle");
const Room = require("../model/room");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

// Create a new billing cycle
exports.createBillingCycle = catchAsyncErrors(async (req, res, next) => {
  const {
    roomId,
    startDate,
    endDate,
    rent,
    electricity,
    previousMeterReading,
    currentMeterReading,
    waterBillAmount,
    internet,
  } = req.body;

  // Validation
  if (!roomId || !startDate || !endDate) {
    return next(
      new ErrorHandler("Room ID, start date, and end date are required", 400),
    );
  }

  // Check if dates are valid
  if (new Date(startDate) >= new Date(endDate)) {
    return next(new ErrorHandler("Start date must be before end date", 400));
  }

  try {
    // Get the room
    const room = await Room.findById(roomId);
    if (!room) {
      return next(new ErrorHandler("Room not found", 404));
    }

    // Get next cycle number
    const lastCycle = await BillingCycle.findOne({ room: roomId }).sort({
      cycleNumber: -1,
    });
    const cycleNumber = (lastCycle?.cycleNumber || 0) + 1;

    // Check for overlapping cycles and auto-archive them
    const overlappingCycles = await BillingCycle.find({
      room: roomId,
      status: "active",
      $or: [{ startDate: { $lt: endDate }, endDate: { $gt: startDate } }],
    });

    if (overlappingCycles.length > 0) {
      // Archive overlapping cycles so new cycle can be created
      for (const cycle of overlappingCycles) {
        cycle.status = "archived";
        await cycle.save();
      }
    }

    // Prepare snapshot and member charges
    // Prefer values from request body; fall back to current room.billing values if not provided
    const rentAmount = Number(
      rent !== undefined && rent !== null ? rent : (room.billing?.rent ?? 0),
    );
    const electricityAmount = Number(
      electricity !== undefined && electricity !== null
        ? electricity
        : (room.billing?.electricity ?? 0),
    );
    const waterAmount = Number(
      waterBillAmount !== undefined && waterBillAmount !== null
        ? waterBillAmount
        : (room.billing?.waterBillAmount ?? room.billing?.water ?? 0),
    );
    const internetAmount = Number(
      internet !== undefined && internet !== null
        ? internet
        : (room.billing?.internet ?? 0),
    );

    console.log("🔍 Billing values received in backend:");
    console.log("  Internet from request.body:", internet);
    console.log("  Internet as Number:", internetAmount);
    console.log("  room.billing object:", room.billing);
    console.log("  room.billing?.internet:", room.billing?.internet);
    console.log("  Full req.body:", req.body);

    const prevReading =
      previousMeterReading !== undefined && previousMeterReading !== null
        ? previousMeterReading
        : room.billing?.previousReading;
    const currReading =
      currentMeterReading !== undefined && currentMeterReading !== null
        ? currentMeterReading
        : room.billing?.currentReading;

    // Compute presence days for each member within the cycle date range
    const members = room.members || [];
    const memberCharges = [];
    let totalPresenceDays = 0;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    members.forEach((m) => {
      const presenceArray = Array.isArray(m.presence) ? m.presence : [];
      const presenceDays = presenceArray.reduce((count, d) => {
        const dt = new Date(d);
        dt.setHours(0, 0, 0, 0);
        return dt >= start && dt <= end ? count + 1 : count;
      }, 0);
      totalPresenceDays += presenceDays;
      // store temporary presenceDays in member object for later use
      m._presenceDays = presenceDays;
    });

    // Compute payor count for rent/electricity splits
    const payorCount = members.filter((m) => m.isPayer !== false).length || 1;

    // Compute total presence days ONLY for payor members (for water split)
    let totalPayorPresenceDays = 0;
    members.forEach((m) => {
      if (m.isPayer !== false) {
        totalPayorPresenceDays += m._presenceDays || 0;
      }
    });

    // Compute total presence days for non-payors (to split among payors)
    let totalNonPayorPresenceDays = 0;
    members.forEach((m) => {
      if (m.isPayer === false) {
        totalNonPayorPresenceDays += m._presenceDays || 0;
      }
    });
    const WATER_BILL_PER_DAY = 5; // ₱5 per day
    const nonPayorWaterAmount = totalNonPayorPresenceDays * WATER_BILL_PER_DAY;

    console.log("💰 CALCULATION DEBUG:");
    console.log("  payorCount:", payorCount);
    console.log("  rentAmount:", rentAmount);
    console.log("  electricityAmount:", electricityAmount);
    console.log("  internetAmount:", internetAmount);
    console.log("  waterBillAmount:", waterAmount);

    members.forEach((m) => {
      const presenceDays = m._presenceDays || 0;

      // Water share: For payors, own consumption + split of non-payors' water
      // For non-payors, always 0
      let waterShare = 0;
      if (m.isPayer !== false) {
        // Payor's own water consumption
        const ownWater = presenceDays * WATER_BILL_PER_DAY;
        // Split non-payors' water equally among payors
        const sharedNonPayorWater =
          payorCount > 0 ? nonPayorWaterAmount / payorCount : 0;
        waterShare = ownWater + sharedNonPayorWater;
      }

      const rentShare =
        payorCount > 0 && m.isPayer ? rentAmount / payorCount : 0;
      const electricityShare =
        payorCount > 0 && m.isPayer ? electricityAmount / payorCount : 0;
      const internetShare =
        payorCount > 0 && m.isPayer ? internetAmount / payorCount : 0;
      const totalDue =
        rentShare + electricityShare + waterShare + internetShare;

      console.log(`  📋 Member ${m.name || m.user}:`);
      console.log(`    isPayer: ${m.isPayer}, presenceDays: ${presenceDays}`);
      console.log(
        `    rentShare: ${rentShare}, electricityShare: ${electricityShare}, internetShare: ${internetShare}`,
      );
      console.log(`    waterShare: ${waterShare}, totalDue: ${totalDue}`);

      memberCharges.push({
        userId: m.user,
        name: m.name || undefined,
        isPayer: m.isPayer !== false,
        presenceDays,
        waterBillShare: Number(waterShare.toFixed(2)),
        rentShare: Number(rentShare.toFixed(2)),
        electricityShare: Number(electricityShare.toFixed(2)),
        internetShare: Number(internetShare.toFixed(2)),
        totalDue: Number(totalDue.toFixed(2)),
      });
    });

    const totalBilledAmount = Number(
      (rentAmount + electricityAmount + waterAmount + internetAmount).toFixed(
        2,
      ),
    );

    // Create new billing cycle
    const billingCycle = new BillingCycle({
      room: roomId,
      cycleNumber,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      rent: rentAmount,
      electricity: electricityAmount,
      waterBillAmount: waterAmount,
      internet: internetAmount,
      previousMeterReading: prevReading,
      currentMeterReading: currReading,
      createdBy: req.user._id,
      status: "active",
      totalBilledAmount,
      membersCount: members.length,
      billBreakdown: {
        rent: rentAmount,
        electricity: electricityAmount,
        water: waterAmount,
        internet: internetAmount,
        other: 0,
      },
      memberCharges,
    });

    await billingCycle.save();

    // Build the reset memberPayments array - create fresh records for each member
    const resetMemberPayments = room.members
      .filter((m) => m.user) // Only include members with valid user references
      .map((member) => ({
        member: member.user,
        memberName: member.name || undefined,
        rentStatus: "pending",
        electricityStatus: "pending",
        waterStatus: "pending",
        internetStatus: "pending",
        rentPaidDate: null,
        electricityPaidDate: null,
        waterPaidDate: null,
        internetPaidDate: null,
      }));

    // Also reset members' presence array for fresh water calculation in new cycle
    const updatedRoom = await Room.findById(roomId);
    console.log(
      `[CREATE CYCLE] Clearing presence for ${updatedRoom.members.length} members`,
    );
    if (updatedRoom && updatedRoom.members) {
      updatedRoom.members.forEach((m) => {
        const beforeCount = (m.presence || []).length;
        m.presence = []; // Clear presence data for fresh cycle
        console.log(
          `[CREATE CYCLE] Member ${m.name}: presence ${beforeCount} → 0`,
        );
      });
      // Mark the members array as modified so Mongoose knows to save it
      updatedRoom.markModified("members");
    }

    // Update billing cycle reference and payment statuses
    updatedRoom.billingCycles.push(billingCycle._id);
    updatedRoom.currentCycleId = billingCycle._id;
    updatedRoom.billing.start = startDate;
    updatedRoom.billing.end = endDate;
    updatedRoom.billing.rent = rentAmount;
    updatedRoom.billing.electricity = electricityAmount;
    updatedRoom.billing.water = waterAmount;
    updatedRoom.billing.internet = internetAmount;
    updatedRoom.billing.previousReading = prevReading;
    updatedRoom.billing.currentReading = currReading;
    updatedRoom.memberPayments = resetMemberPayments;

    const result = await updatedRoom.save();

    console.log(
      `[CREATE CYCLE] After update - Room presence check:`,
      result.members.map((m) => ({
        name: m.name,
        presenceCount: (m.presence || []).length,
      })),
    );

    res.status(201).json({
      success: true,
      message: "Billing cycle created successfully",
      data: billingCycle,
    });
  } catch (error) {
    console.error("Error creating billing cycle:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      validationErrors: error.errors
        ? Object.keys(error.errors).map(
            (k) => `${k}: ${error.errors[k].message}`,
          )
        : null,
    });
    next(new ErrorHandler("Failed to create billing cycle", 500));
  }
});

// Helper: recalculate water amount for a cycle based on current member presence
// Get all billing cycles for a room
exports.getBillingCycles = catchAsyncErrors(async (req, res, next) => {
  const { roomId } = req.params;
  const { status } = req.query;

  try {
    const room = await Room.findById(roomId);
    if (!room) {
      return next(new ErrorHandler("Room not found", 404));
    }

    const query = { room: roomId };
    if (status) {
      query.status = status;
    }

    const cycles = await BillingCycle.find(query)
      .sort({ cycleNumber: -1 })
      .populate("createdBy", "name email")
      .populate("closedBy", "name email");

    // Ensure waterBillAmount is always present (for old cycles that might not have it)
    const enrichedCycles = cycles.map((cycle) => {
      const cycleObj = cycle.toObject();
      // If waterBillAmount is missing, try to use water field, otherwise default to 0
      if (
        cycleObj.waterBillAmount === undefined ||
        cycleObj.waterBillAmount === null
      ) {
        cycleObj.waterBillAmount =
          cycleObj.water || cycleObj.billBreakdown?.water || 0;
      }
      return cycleObj;
    });

    console.log(
      `📚 getBillingCycles: Returning ${enrichedCycles.length} cycles with waterBillAmount`,
    );
    enrichedCycles.forEach((c, i) => {
      console.log(
        `   Cycle ${i + 1}: id=${c._id}, status=${c.status}, water=${c.waterBillAmount}, rent=${c.rent}`,
      );
    });

    res.status(200).json({
      success: true,
      data: enrichedCycles,
    });
  } catch (error) {
    console.error("Error fetching billing cycles:", error);
    next(new ErrorHandler("Failed to fetch billing cycles", 500));
  }
});

// Get single billing cycle
exports.getBillingCycleById = catchAsyncErrors(async (req, res, next) => {
  const { cycleId } = req.params;

  try {
    // Validate cycleId format
    if (!cycleId || cycleId.length !== 24) {
      return next(new ErrorHandler("Invalid billing cycle ID", 400));
    }

    const cycle = await BillingCycle.findById(cycleId)
      .populate("room")
      .populate("createdBy", "name email")
      .populate("closedBy", "name email");
    // Note: Removed populate for "bills" and "expenses" as these models may not exist

    if (!cycle) {
      return next(new ErrorHandler("Billing cycle not found", 404));
    }

    // Ensure waterBillAmount is always present (for old cycles that might not have it)
    const cycleObj = cycle.toObject();
    if (
      cycleObj.waterBillAmount === undefined ||
      cycleObj.waterBillAmount === null
    ) {
      cycleObj.waterBillAmount =
        cycleObj.water || cycleObj.billBreakdown?.water || 0;
    }

    res.status(200).json({
      success: true,
      data: cycleObj,
    });
  } catch (error) {
    console.error("Error fetching billing cycle:", error);
    next(new ErrorHandler("Failed to fetch billing cycle", 500));
  }
});

// Helper: recompute the snapshot (memberCharges, totalBilledAmount, billBreakdown) for a cycle using room and cycle data
const recomputeCycleSnapshot = async (cycle) => {
  const room = await Room.findById(cycle.room);
  if (!room) return null;

  const members = room.members || [];
  const start = new Date(cycle.startDate || cycle.start);
  start.setHours(0, 0, 0, 0);
  const end = new Date(cycle.endDate || cycle.end);
  end.setHours(0, 0, 0, 0);

  // Ensure numeric values
  const rentAmount = Number(cycle.rent || cycle.rent || 0);
  const electricityAmount = Number(cycle.electricity || 0);
  const waterAmount = Number(cycle.waterBillAmount || cycle.water || 0);
  const internetAmount = Number(cycle.internet || 0);

  // Build presence totals
  let totalPresenceDays = 0;
  members.forEach((m) => {
    const presenceArray = Array.isArray(m.presence) ? m.presence : [];
    const presenceDays = presenceArray.reduce((count, d) => {
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      return dt >= start && dt <= end ? count + 1 : count;
    }, 0);
    m._presenceDays = presenceDays;
    totalPresenceDays += presenceDays;
  });

  // Payor count
  const payorCount = members.filter((m) => m.isPayer !== false).length || 1;

  // Compute total presence days ONLY for payor members (for water split)
  let totalPayorPresenceDays = 0;
  members.forEach((m) => {
    if (m.isPayer !== false) {
      totalPayorPresenceDays += m._presenceDays || 0;
    }
  });

  // Calculate non-payor water (to be split among payors)
  let totalNonPayorPresenceDays = 0;
  members.forEach((m) => {
    if (m.isPayer === false) {
      totalNonPayorPresenceDays += m._presenceDays || 0;
    }
  });
  const WATER_BILL_PER_DAY = 5;
  const nonPayorWaterAmount = totalNonPayorPresenceDays * WATER_BILL_PER_DAY;

  const memberCharges = members.map((m) => {
    const presenceDays = m._presenceDays || 0;

    // Water share: For payors, own consumption + split of non-payors' water
    // For non-payors, always 0
    let waterShare = 0;
    if (m.isPayer !== false) {
      // Payor's own water consumption
      const ownWater = presenceDays * WATER_BILL_PER_DAY;
      // Split non-payors' water equally among payors
      const sharedNonPayorWater =
        payorCount > 0 ? nonPayorWaterAmount / payorCount : 0;
      waterShare = ownWater + sharedNonPayorWater;
    }

    const rentShare = payorCount > 0 && m.isPayer ? rentAmount / payorCount : 0;
    const electricityShare =
      payorCount > 0 && m.isPayer ? electricityAmount / payorCount : 0;
    const internetShare =
      payorCount > 0 && m.isPayer ? internetAmount / payorCount : 0;
    const totalDue = rentShare + electricityShare + waterShare + internetShare;

    return {
      userId: m.user,
      name: m.name || undefined,
      isPayer: m.isPayer !== false,
      presenceDays,
      waterBillShare: Number(waterShare.toFixed(2)),
      rentShare: Number(rentShare.toFixed(2)),
      electricityShare: Number(electricityShare.toFixed(2)),
      internetShare: Number(internetShare.toFixed(2)),
      totalDue: Number(totalDue.toFixed(2)),
    };
  });

  const totalBilledAmount = Number(
    (rentAmount + electricityAmount + waterAmount + internetAmount).toFixed(2),
  );

  // Apply to cycle
  cycle.memberCharges = memberCharges;
  cycle.totalBilledAmount = totalBilledAmount;
  cycle.billBreakdown = {
    rent: rentAmount,
    electricity: electricityAmount,
    water: waterAmount,
    other: cycle.billBreakdown?.other || 0,
  };
  cycle.membersCount = members.length;

  await cycle.save();

  return cycle;
};

// Close a billing cycle
exports.closeBillingCycle = catchAsyncErrors(async (req, res, next) => {
  const { cycleId } = req.params;
  const { notes } = req.body;

  try {
    const cycle = await BillingCycle.findById(cycleId);
    if (!cycle) {
      return next(new ErrorHandler("Billing cycle not found", 404));
    }

    if (cycle.status === "completed") {
      return next(
        new ErrorHandler("This billing cycle is already closed", 409),
      );
    }

    // Ensure snapshot is present before closing
    if (
      !cycle.totalBilledAmount ||
      !cycle.billBreakdown ||
      (Array.isArray(cycle.memberCharges) && cycle.memberCharges.length === 0)
    ) {
      console.log("Recomputing missing cycle snapshot for cycle", cycleId);
      await recomputeCycleSnapshot(cycle);
    }

    // Update cycle to completed
    cycle.status = "completed";
    cycle.closedAt = new Date();
    cycle.closedBy = req.user._id;
    if (notes) cycle.notes = notes;

    await cycle.save();

    // Update room - clear current cycle
    await Room.findByIdAndUpdate(cycle.room, { currentCycleId: null });

    res.status(200).json({
      success: true,
      message: "Billing cycle closed successfully",
      data: cycle,
    });
  } catch (error) {
    console.error("Error closing billing cycle:", error);
    next(new ErrorHandler("Failed to close billing cycle", 500));
  }
});

// Update billing cycle (add member charges, update bills, etc.)
exports.updateBillingCycle = catchAsyncErrors(async (req, res, next) => {
  const { cycleId } = req.params;
  const {
    memberCharges,
    totalBilledAmount,
    billBreakdown,
    rent,
    electricity,
    waterBillAmount,
    internet,
  } = req.body;

  try {
    const cycle = await BillingCycle.findById(cycleId);
    if (!cycle) {
      return next(new ErrorHandler("Billing cycle not found", 404));
    }

    if (cycle.status !== "active") {
      return next(
        new ErrorHandler("Can only update active billing cycles", 409),
      );
    }

    // Update billing amounts if provided
    if (rent !== undefined) {
      cycle.rent = Number(rent);
    }
    if (electricity !== undefined) {
      cycle.electricity = Number(electricity);
    }
    if (waterBillAmount !== undefined) {
      cycle.waterBillAmount = Number(waterBillAmount);
    }
    if (internet !== undefined) {
      cycle.internet = Number(internet);
    }

    // If billing amounts were updated, recalculate member charges using existing presence
    if (
      rent !== undefined ||
      electricity !== undefined ||
      waterBillAmount !== undefined ||
      internet !== undefined
    ) {
      console.log(
        `[UPDATE-CYCLE] Recalculating charges from existing presence (rent=${rent}, elec=${electricity}, water=${waterBillAmount}, inet=${internet})`,
      );
      await recomputeCycleSnapshot(cycle);
    } else if (memberCharges) {
      // Direct charge update (if provided)
      cycle.memberCharges = memberCharges;
    }

    if (totalBilledAmount !== undefined) {
      cycle.totalBilledAmount = totalBilledAmount;
    }
    if (billBreakdown) {
      cycle.billBreakdown = billBreakdown;
    }

    cycle.updatedAt = new Date();
    await cycle.save();

    res.status(200).json({
      success: true,
      message: "Billing cycle updated successfully",
      data: cycle,
    });
  } catch (error) {
    console.error("Error updating billing cycle:", error);
    next(new ErrorHandler("Failed to update billing cycle", 500));
  }
});

// Repair a cycle (admin only) - recompute totals and member charges
exports.repairBillingCycle = catchAsyncErrors(async (req, res, next) => {
  const { cycleId } = req.params;

  try {
    const cycle = await BillingCycle.findById(cycleId);
    if (!cycle) return next(new ErrorHandler("Billing cycle not found", 404));

    const updated = await recomputeCycleSnapshot(cycle);

    res.status(200).json({
      success: true,
      message: "Billing cycle repaired",
      data: updated,
    });
  } catch (error) {
    console.error("Error repairing billing cycle:", error);
    next(new ErrorHandler("Failed to repair billing cycle", 500));
  }
});

// Repair all cycles with missing totals/member charges (admin only)
exports.repairMissingCycles = catchAsyncErrors(async (req, res, next) => {
  try {
    // Find cycles that have zero total or missing memberCharges
    const cycles = await BillingCycle.find({
      $or: [
        { totalBilledAmount: { $in: [0, null, undefined] } },
        { memberCharges: { $exists: true, $size: 0 } },
        { membersCount: { $in: [0, null, undefined] } },
      ],
    });

    const repaired = [];

    for (const cycle of cycles) {
      try {
        const updated = await recomputeCycleSnapshot(cycle);
        repaired.push(updated._id);
      } catch (err) {
        console.error("Failed to repair cycle", cycle._id, err);
      }
    }

    res.status(200).json({
      success: true,
      message: `Repaired ${repaired.length} cycles`,
      data: repaired,
    });
  } catch (error) {
    console.error("Error repairing missing cycles:", error);
    next(new ErrorHandler("Failed to repair missing cycles", 500));
  }
});

// Add bills to a billing cycle
exports.addBillsToCycle = catchAsyncErrors(async (req, res, next) => {
  const { cycleId } = req.params;
  const { billIds } = req.body;

  try {
    const cycle = await BillingCycle.findById(cycleId);
    if (!cycle) {
      return next(new ErrorHandler("Billing cycle not found", 404));
    }

    if (billIds && Array.isArray(billIds)) {
      cycle.bills.push(...billIds);
      await cycle.save();
    }

    res.status(200).json({
      success: true,
      message: "Bills added to cycle",
      data: cycle,
    });
  } catch (error) {
    console.error("Error adding bills to cycle:", error);
    next(new ErrorHandler("Failed to add bills to cycle", 500));
  }
});

// Get current active cycle for a room
exports.getActiveCycle = catchAsyncErrors(async (req, res, next) => {
  const { roomId } = req.params;

  try {
    const cycle = await BillingCycle.findOne({
      room: roomId,
      status: "active",
    }).populate("createdBy", "name email");

    if (!cycle) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "No active billing cycle found",
      });
    }

    res.status(200).json({
      success: true,
      data: cycle,
    });
  } catch (error) {
    console.error("Error fetching active cycle:", error);
    next(new ErrorHandler("Failed to fetch active cycle", 500));
  }
});

// Admin: billing totals by month
exports.getBillingTotalsByMonth = catchAsyncErrors(async (req, res, next) => {
  const months = Math.max(1, Number(req.query.months) || 6);
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  try {
    const results = await BillingCycle.aggregate([
      { $match: { status: "completed", closedAt: { $gte: since } } },
      {
        $group: {
          _id: {
            year: { $year: "$startDate" },
            month: { $month: "$startDate" },
          },
          total: { $sum: "$totalBilledAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Build map for months
    const map = {};
    results.forEach((r) => {
      const key = `${r._id.year}-${String(r._id.month).padStart(2, "0")}`;
      map[key] = Number((r.total || 0).toFixed(2));
    });

    // Build month list in chronological order
    const data = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      data.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleString("en-US", { month: "short" }),
        total: map[key] || 0,
      });
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error computing billing totals by month:", error);
    next(new ErrorHandler("Failed to compute billing totals", 500));
  }
});

// Get latest billing cycle with payment stats
exports.getLatestBillingCycleStats = catchAsyncErrors(async (req, res, next) => {
  try {
    console.log("🔍 [getLatestBillingCycleStats] Starting endpoint call...");
    
    // Get the latest billing cycle (most recent by creation date)
    const latestCycle = await BillingCycle.findOne()
      .sort({ createdAt: -1 })
      .populate("room");
    
    console.log("📦 [getLatestBillingCycleStats] Latest cycle found:", latestCycle ? latestCycle._id : "NONE");

    if (!latestCycle) {
      console.log("❌ [getLatestBillingCycleStats] No cycle found");
      return res.status(200).json({ success: true, data: null });
    }

    console.log("✅ [getLatestBillingCycleStats] Cycle found, memberCharges count:", latestCycle.memberCharges?.length || 0);

    // Get the room to access memberPayments
    const room = await Room.findById(latestCycle.room);
    console.log("📦 [getLatestBillingCycleStats] Room memberPayments:", room?.memberPayments);

    // Calculate payment stats for this cycle
    let totalBilledAmount = latestCycle.totalBilledAmount || 0;
    let totalCollected = 0;
    let totalPending = 0;

    if (latestCycle.memberCharges && latestCycle.memberCharges.length > 0) {
      latestCycle.memberCharges.forEach((charge) => {
        const chargeAmount =
          (charge.rentShare || 0) +
          (charge.electricityShare || 0) +
          (charge.waterBillShare || 0) +
          (charge.internetShare || 0);

        // Check if member has paid all bills
        const memberPayment = room?.memberPayments?.find(
          (mp) =>
            String(mp.member?._id || mp.member) ===
            String(charge.userId),
        );

        // Member is considered paid only if all bill types are paid
        const allBillsPaid =
          memberPayment &&
          memberPayment.rentStatus === "paid" &&
          memberPayment.electricityStatus === "paid" &&
          memberPayment.waterStatus === "paid" &&
          memberPayment.internetStatus === "paid";

        if (allBillsPaid) {
          totalCollected += chargeAmount;
        } else {
          totalPending += chargeAmount;
        }
      });
    }

    const collectionRate =
      totalBilledAmount > 0
        ? Math.round((totalCollected / totalBilledAmount) * 100)
        : 0;

    const data = {
      _id: latestCycle._id,
      startDate: latestCycle.startDate,
      endDate: latestCycle.endDate,
      room: latestCycle.room?.name,
      roomId: latestCycle.room?._id,
      status: latestCycle.status,
      totalBilledAmount: Number(totalBilledAmount.toFixed(2)),
      totalCollected: Number(totalCollected.toFixed(2)),
      totalPending: Number(totalPending.toFixed(2)),
      collectionRate,
    };

    console.log("✅ [getLatestBillingCycleStats] Response data:", data);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("❌ [getLatestBillingCycleStats] Error:", error);
    next(
      new ErrorHandler("Failed to get latest billing cycle stats", 500),
    );
  }
});

// Delete a billing cycle (admin only, only if no bills exist)
exports.deleteBillingCycle = catchAsyncErrors(async (req, res, next) => {
  const { cycleId } = req.params;

  try {
    const cycle = await BillingCycle.findById(cycleId);
    if (!cycle) {
      return next(new ErrorHandler("Billing cycle not found", 404));
    }

    if (cycle.bills.length > 0 || cycle.expenses.length > 0) {
      return next(
        new ErrorHandler("Cannot delete a cycle with bills or expenses", 409),
      );
    }

    await BillingCycle.findByIdAndDelete(cycleId);

    // Remove from room
    await Room.findByIdAndUpdate(cycle.room, {
      $pull: { billingCycles: cycleId },
    });

    res.status(200).json({
      success: true,
      message: "Billing cycle deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting billing cycle:", error);
    next(new ErrorHandler("Failed to delete billing cycle", 500));
  }
});
