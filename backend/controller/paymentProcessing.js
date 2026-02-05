// Payment Processing Controller - Phase 3
const express = require("express");
const router = express.Router();
const PaymentTransaction = require("../model/paymentTransaction");
const Room = require("../model/room");
const BillingCycle = require("../model/billingCycle");
const User = require("../model/user");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");
const crypto = require("crypto");

// Helper: Generate QR code data for GCash
const generateGCashQRData = (amount, referenceNumber, merchantId) => {
  // Format: gcash|{amount}|{reference}|{merchantId}
  return `gcash|${amount}|${referenceNumber}|${merchantId}`;
};

// Helper: Calculate water charges from presence marking
// Water is calculated: marked_days × daily_rate
const recalculateWaterFromPresence = (room) => {
  if (!room.members || room.members.length === 0) {
    console.log("   💧 No members found, water = 0");
    return 0; // No members, no water
  }

  const WATER_RATE_PER_DAY = 5; // ₱5 per day (can be configurable)

  // Get unique presence days across all members
  const allPresenceDays = new Set();
  room.members.forEach((member) => {
    if (Array.isArray(member.presence)) {
      member.presence.forEach((day) => {
        allPresenceDays.add(String(day)); // Store as string to avoid duplication
      });
    }
  });

  const totalPresenceDays = allPresenceDays.size;
  const calculatedWater = totalPresenceDays * WATER_RATE_PER_DAY;

  console.log(
    `   💧 Recalculating water from presence: ${totalPresenceDays} days × ₱${WATER_RATE_PER_DAY}/day = ₱${calculatedWater}`,
  );

  return calculatedWater;
};

// Helper: Check if all members have paid all bills, and clear billing if so
const checkAndClearBillingIfComplete = async (room) => {
  if (!room.memberPayments || !room.billing) return;

  // IMPORTANT: Recalculate water from presence marking BEFORE checking if all bills are paid
  const calculatedWater = recalculateWaterFromPresence(room);
  room.billing.water = calculatedWater;

  // Debug: Log all member payment statuses
  console.log("🔍 Checking if all members have paid:");
  console.log(
    "   Billing amounts - Rent:",
    room.billing.rent,
    "| Electricity:",
    room.billing.electricity,
    "| Water:",
    room.billing.water,
    "| Internet:",
    room.billing.internet,
  );
  room.memberPayments.forEach((mp, idx) => {
    console.log(
      `   Member ${idx} (${mp.memberName}): Rent=${mp.rentStatus}, Electricity=${mp.electricityStatus}, Water=${mp.waterStatus}, Internet=${mp.internetStatus}`,
    );
  });

  const allBillsPaid = room.memberPayments.every((mp) => {
    // Check if this member needs to pay rent
    if (room.billing.rent > 0 && mp.rentStatus !== "paid") return false;
    // Check if this member needs to pay electricity
    if (room.billing.electricity > 0 && mp.electricityStatus !== "paid")
      return false;
    // Check if this member needs to pay water
    if (room.billing.water > 0 && mp.waterStatus !== "paid") return false;
    // Check if this member needs to pay internet
    if (room.billing.internet > 0 && mp.internetStatus !== "paid") return false;
    return true;
  });

  console.log("   Result: allBillsPaid =", allBillsPaid);

  if (allBillsPaid) {
    console.log(`[CLEAR-BILLING] Closing billing cycle for room ${room.name}`);

    // Ensure water is numeric (normalize undefined to 0 from admin setup)
    const waterAmount =
      typeof room.billing.water === "number" ? room.billing.water : 0;
    if (room.billing.water !== waterAmount) {
      room.billing.water = waterAmount;
    }

    // Log what we're about to archive
    console.log("   📦 ARCHIVING CYCLE WITH:");
    console.log("      Rent:", room.billing.rent);
    console.log("      Electricity:", room.billing.electricity);
    console.log("      Water:", waterAmount);

    // Archive current billing cycle to history BEFORE clearing
    const completedCycle = {
      // Use field names that match the Room.billingHistory schema (start/end)
      start: room.billing.start,
      end: room.billing.end,
      rent: room.billing.rent || 0,
      electricity: room.billing.electricity || 0,
      // Use normalized water amount
      water: waterAmount,
      currentReading: room.billing.currentReading || null,
      previousReading: room.billing.previousReading || null,
      createdAt: new Date(),
      memberPayments: room.memberPayments.map((mp) => ({
        member: mp.member,
        memberName: mp.memberName,
        rentStatus: mp.rentStatus,
        electricityStatus: mp.electricityStatus,
        waterStatus: mp.waterStatus,
        rentPaidDate: mp.rentPaidDate,
        electricityPaidDate: mp.electricityPaidDate,
        waterPaidDate: mp.waterPaidDate,
      })),
    };

    // Add to billing history
    if (!room.billingHistory) {
      room.billingHistory = [];
    }
    room.billingHistory.push(completedCycle);
    console.log("📋 Billing cycle archived to history");

    // Mark the BillingCycle document (if present) as completed
    try {
      let cycleUpdated = false;

      // First try: use currentCycleId if available
      if (room.currentCycleId) {
        const updated = await BillingCycle.findByIdAndUpdate(
          room.currentCycleId,
          {
            status: "completed",
            closedAt: new Date(),
          },
          { new: true },
        );
        if (updated) {
          console.log(
            "📌 BillingCycle document marked as completed via currentCycleId:",
            room.currentCycleId,
          );
          cycleUpdated = true;
        }
      }

      // Fallback: try to find an active cycle matching dates and room
      if (!cycleUpdated && room.billing.start && room.billing.end) {
        const foundCycle = await BillingCycle.findOne({
          room: room._id,
          status: "active",
        });
        if (foundCycle) {
          foundCycle.status = "completed";
          foundCycle.closedAt = new Date();
          await foundCycle.save();
          console.log(
            "📌 BillingCycle document marked as completed via fallback search:",
            foundCycle._id,
          );
          cycleUpdated = true;
        }
      }

      // If no cycle found, create one for archival purposes
      if (!cycleUpdated && room.billing.start && room.billing.end) {
        const cycleNumber = (room.billingHistory?.length || 0) + 1;
        const rentAmount = room.billing.rent || 0;
        const electricityAmount = room.billing.electricity || 0;
        const waterAmount = room.billing.water || 0;
        const internetAmount = room.billing.internet || 0;

        // Calculate member charges based on equal split (all members split equally)
        // OR by presence days if available
        const totalMembers = room.memberPayments?.length || 1;
        const rentShare = rentAmount / totalMembers;
        const electricityShare = electricityAmount / totalMembers;
        const waterShare = waterAmount / totalMembers;
        const internetShare = internetAmount / totalMembers;

        const memberCharges =
          room.memberPayments?.map((mp) => ({
            userId: mp.member,
            name: mp.memberName,
            isPayer: true,
            presenceDays: 0,
            waterBillShare: Number(waterShare.toFixed(2)),
            rentShare: Number(rentShare.toFixed(2)),
            electricityShare: Number(electricityShare.toFixed(2)),
            internetShare: Number(internetShare.toFixed(2)),
            totalDue: Number(
              (
                rentShare +
                electricityShare +
                waterShare +
                internetShare
              ).toFixed(2),
            ),
          })) || [];

        const newCycle = new BillingCycle({
          room: room._id,
          cycleNumber,
          startDate: room.billing.start,
          endDate: room.billing.end,
          rent: rentAmount,
          electricity: electricityAmount,
          waterBillAmount: waterAmount,
          internet: internetAmount,
          status: "completed",
          closedAt: new Date(),
          totalBilledAmount:
            rentAmount + electricityAmount + waterAmount + internetAmount,
          membersCount: totalMembers,
          billBreakdown: {
            rent: rentAmount,
            electricity: electricityAmount,
            water: waterAmount,
            internet: internetAmount,
            other: 0,
          },
          memberCharges,
        });
        await newCycle.save();
        console.log(
          "🆕 Created new BillingCycle document (completed):",
          newCycle._id,
        );
        cycleUpdated = true;

        // Update room with reference
        room.currentCycleId = newCycle._id;
        if (!room.billingCycles) room.billingCycles = [];
        room.billingCycles.push(newCycle._id);
      }

      if (!cycleUpdated) {
        console.log(
          "⚠️  Could not mark or create BillingCycle (missing dates?)",
        );
      }
    } catch (err) {
      console.error("Error marking/creating BillingCycle:", err);
    }

    // Clear the current billing cycle (but DON'T reset member payment statuses yet)
    room.billing = {
      rent: 0,
      electricity: 0,
      water: 0,
      start: null,
      end: null,
      currentReading: null,
      previousReading: null,
    };

    // DO NOT reset member payment statuses here!
    // Keep statuses as "paid" so users see "Already Paid All Bills" on PresenceScreen
    // Statuses will only reset when admin creates a NEW billing cycle
    console.log(
      "🔄 Billing cycle cleared. Member statuses kept as 'paid' until next cycle is created by admin",
    );

    // Clear presence dates for all members (reset for next billing cycle)
    room.members = room.members.map((member) => ({
      ...member,
      presence: [],
    }));
    console.log("📅 Presence dates cleared for all members");
  }
};

// Helper: Check if all bills for a room's current billing cycle are paid via PaymentTransaction
// If yes, automatically close the billing cycle
const checkAndAutoCloseCycle = async (roomId) => {
  try {
    // Get the room and its active billing cycle
    const room = await Room.findById(roomId).populate("currentCycleId");
    if (!room || !room.currentCycleId) {
      return;
    }

    const cycle = room.currentCycleId;

    // Query all completed PaymentTransaction records for THIS SPECIFIC CYCLE using billingCycleId
    const completedPayments = await PaymentTransaction.find({
      billingCycleId: cycle._id,
      status: "completed",
    });

    const totalCollected = completedPayments.reduce(
      (sum, t) => sum + t.amount,
      0,
    );

    console.log(
      `[AUTO-CLOSE] Room: ${room.name}, Cycle: ${cycle._id}, Billed: ₱${cycle.totalBilledAmount}, Collected: ₱${totalCollected}`,
    );

    // Check if all bills have been paid
    if (totalCollected >= cycle.totalBilledAmount) {
      console.log(
        `[AUTO-CLOSE] ✅ Closing cycle - all bills paid for ${room.name}`,
      );

      // Update the BillingCycle status to completed
      const updatedCycle = await BillingCycle.findByIdAndUpdate(
        cycle._id,
        {
          status: "completed",
          closedAt: new Date(),
          closedBy: null, // System auto-closed
        },
        { new: true },
      );

      if (updatedCycle) {
        // Clear currentCycleId from room
        await Room.findByIdAndUpdate(roomId, { currentCycleId: null });

        return {
          success: true,
          message: "Billing cycle auto-closed successfully",
          cycle: updatedCycle,
        };
      }
    } else {
      const remaining = cycle.totalBilledAmount - totalCollected;
      console.log(
        `[AUTO-CLOSE] ⏳ Not ready to close - Remaining: ₱${remaining}`,
      );
    }

    return {
      success: false,
      message: "Billing cycle still has outstanding balance",
    };
  } catch (error) {
    console.error("❌ [AUTO-CLOSE] Error checking/closing cycle:", error);
    return { success: false, error: error.message };
  }
};

// 1. Initiate GCash Payment
router.post(
  "/initiate-gcash",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, amount, billType } = req.body;

      if (!roomId || !amount || !billType) {
        return next(
          new ErrorHandler("Room ID, Amount, and Bill Type are required", 400),
        );
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Generate unique reference number
      const referenceNumber = `GCASH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create payment transaction record
      const transaction = new PaymentTransaction({
        room: roomId,
        payer: req.user._id,
        amount,
        billType,
        paymentMethod: "gcash",
        status: "pending",
        gcash: {
          referenceNumber,
          merchantId: process.env.GCASH_MERCHANT_ID || "ABT-MERCHANT-001",
        },
        billingCycleStart: room.billing.start,
        billingCycleEnd: room.billing.end,
        billingCycleId: room.currentCycleId, // Store direct reference to cycle
      });

      await transaction.save();

      console.log(
        `[GCASH-PAYMENT] Saved: room=${room.name}, amount=₱${amount}, cycleId=${transaction.billingCycleId}`,
      );

      // Generate QR code data
      const qrData = generateGCashQRData(
        amount,
        referenceNumber,
        transaction.gcash.merchantId,
      );

      res.status(200).json({
        success: true,
        message: "GCash payment initiated",
        transaction: {
          _id: transaction._id,
          referenceNumber,
          amount,
          billType,
          status: "pending",
        },
        qrData, // Client will generate QR code from this
        instructions: `Send ₱${amount} to GCash with reference: ${referenceNumber}`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 2. Verify GCash Payment (Webhook or manual verification)
router.post(
  "/verify-gcash",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { transactionId, gcashReferenceNumber, mobileNumber } = req.body;

      if (!transactionId) {
        return next(new ErrorHandler("Transaction ID is required", 400));
      }

      const transaction = await PaymentTransaction.findById(transactionId);
      if (!transaction) {
        return next(new ErrorHandler("Transaction not found", 404));
      }

      if (transaction.status !== "pending") {
        return next(new ErrorHandler("Transaction is already processed", 400));
      }

      // Update GCash details
      transaction.gcash.transactionId = gcashReferenceNumber;
      transaction.gcash.mobileNumber = mobileNumber;
      transaction.status = "completed";
      transaction.completionDate = new Date();

      await transaction.save();

      // Update room payment status and deduct from billing
      const room = await Room.findById(transaction.room);
      if (room) {
        console.log(
          "💳 GCash Payment - Processing payment for user:",
          transaction.payer,
        );
        console.log("   Room memberPayments:", room.memberPayments);

        const memberPayment = room.memberPayments.find(
          (mp) => mp.member.toString() === transaction.payer.toString(),
        );

        if (memberPayment) {
          if (transaction.billType === "total") {
            // When paying total (all bills), mark all statuses as paid for THIS member
            memberPayment.rentStatus = "paid";
            memberPayment.rentPaidDate = new Date();
            memberPayment.electricityStatus = "paid";
            memberPayment.electricityPaidDate = new Date();
            memberPayment.waterStatus = "paid";
            memberPayment.waterPaidDate = new Date();
            memberPayment.internetStatus = "paid";
            memberPayment.internetPaidDate = new Date();
            // DO NOT modify room.billing amounts - keep original for other members' calculations
          } else if (transaction.billType === "rent") {
            memberPayment.rentStatus = "paid";
            memberPayment.rentPaidDate = new Date();
            // DO NOT modify room.billing - keep original
          } else if (transaction.billType === "electricity") {
            memberPayment.electricityStatus = "paid";
            memberPayment.electricityPaidDate = new Date();
            // DO NOT modify room.billing - keep original
          } else if (transaction.billType === "water") {
            memberPayment.waterStatus = "paid";
            memberPayment.waterPaidDate = new Date();
            // DO NOT modify room.billing - keep original
          } else if (transaction.billType === "internet") {
            memberPayment.internetStatus = "paid";
            memberPayment.internetPaidDate = new Date();
            // DO NOT modify room.billing - keep original
          }
        }

        // Check if all members have paid - if so, clear billing cycle
        await checkAndClearBillingIfComplete(room);

        await room.save();

        // Verify payment was saved
        const savedRoom = await Room.findById(room._id);
        const updatedMemberPayment = savedRoom.memberPayments.find(
          (mp) => mp.member.toString() === transaction.payer.toString(),
        );
        console.log(
          `[GCASH-VERIFY] Updated ${transaction.payer}: ${transaction.billType}=${updatedMemberPayment[transaction.billType + "Status"]}`,
        );

        // Check if billing cycle should be auto-closed based on PaymentTransaction
        const closeResult = await checkAndAutoCloseCycle(transaction.room);

        // Return response with cycle close status
        const response = {
          success: true,
          message: "GCash payment verified and completed",
          transaction,
        };

        // If cycle was closed, include that info so frontend can refresh
        if (closeResult && closeResult.success) {
          response.cycleClosed = true;
          response.message =
            "GCash payment verified and billing cycle automatically closed!";
        }

        res.status(200).json(response);
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 3. Initiate Bank Transfer Payment
router.post(
  "/initiate-bank-transfer",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, amount, billType, bankName } = req.body;

      if (!roomId || !amount || !billType) {
        return next(
          new ErrorHandler("Room ID, Amount, and Bill Type are required", 400),
        );
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Generate reference number
      const referenceNumber = `BT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create payment transaction
      const transaction = new PaymentTransaction({
        room: roomId,
        payer: req.user._id,
        amount,
        billType,
        paymentMethod: "bank_transfer",
        status: "pending",
        bankTransfer: {
          referenceNumber,
          bankName: bankName || process.env.BANK_NAME || "BPI",
          accountName:
            process.env.BANK_ACCOUNT_NAME || "Apartment Bill Tracker",
          accountNumber: process.env.BANK_ACCOUNT_NUMBER || "XXXX-XXXX-XXXX",
        },
        billingCycleStart: room.billing.start,
        billingCycleEnd: room.billing.end,
        billingCycleId: room.currentCycleId, // Store direct reference to cycle
      });

      await transaction.save();

      console.log(
        `[BANK-PAYMENT] Saved: room=${room.name}, amount=₱${amount}, cycleId=${transaction.billingCycleId}`,
      );

      res.status(200).json({
        success: true,
        message: "Bank transfer initiated",
        transaction: {
          _id: transaction._id,
          referenceNumber,
          amount,
          billType,
          status: "pending",
        },
        bankDetails: transaction.bankTransfer,
        instructions: `Transfer ₱${amount} using reference: ${referenceNumber}. Bank: ${transaction.bankTransfer.bankName}, Account: ${transaction.bankTransfer.accountName}`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 4. Confirm Bank Transfer Payment (with proof upload)
router.post(
  "/confirm-bank-transfer",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { transactionId, depositDate, proofImageUrl, bankName } = req.body;

      if (!transactionId) {
        return next(new ErrorHandler("Transaction ID is required", 400));
      }

      const transaction = await PaymentTransaction.findById(transactionId);
      if (!transaction) {
        return next(new ErrorHandler("Transaction not found", 404));
      }

      if (transaction.status !== "pending") {
        return next(new ErrorHandler("Transaction is already processed", 400));
      }

      // Update bank transfer details
      if (bankName) {
        transaction.bankTransfer.bankName = bankName;
      }
      if (depositDate) {
        transaction.bankTransfer.depositDate = new Date(depositDate);
      }
      if (proofImageUrl) {
        transaction.bankTransfer.depositProof = proofImageUrl;
      }
      transaction.status = "completed";
      transaction.completionDate = new Date();

      await transaction.save();

      // Update room payment status and deduct from billing
      const room = await Room.findById(transaction.room);
      if (room) {
        const memberPayment = room.memberPayments.find(
          (mp) => mp.member.toString() === transaction.payer.toString(),
        );

        if (memberPayment) {
          if (transaction.billType === "total") {
            // When paying total (all bills), mark all statuses as paid for THIS member
            memberPayment.rentStatus = "paid";
            memberPayment.rentPaidDate = new Date();
            memberPayment.electricityStatus = "paid";
            memberPayment.electricityPaidDate = new Date();
            memberPayment.waterStatus = "paid";
            memberPayment.waterPaidDate = new Date();
            memberPayment.internetStatus = "paid";
            memberPayment.internetPaidDate = new Date();
            // DO NOT modify room.billing amounts - keep original for other members' calculations
          } else if (transaction.billType === "rent") {
            memberPayment.rentStatus = "paid";
            memberPayment.rentPaidDate = new Date();
            // DO NOT modify room.billing - keep original
          } else if (transaction.billType === "electricity") {
            memberPayment.electricityStatus = "paid";
            memberPayment.electricityPaidDate = new Date();
            // DO NOT modify room.billing - keep original
          } else if (transaction.billType === "water") {
            memberPayment.waterStatus = "paid";
            memberPayment.waterPaidDate = new Date();
            // DO NOT modify room.billing - keep original
          } else if (transaction.billType === "internet") {
            memberPayment.internetStatus = "paid";
            memberPayment.internetPaidDate = new Date();
            // DO NOT modify room.billing - keep original
          }
        }

        // Check if all members have paid - if so, clear billing cycle
        await checkAndClearBillingIfComplete(room);

        await room.save();

        // Verify payment was saved
        const savedRoom = await Room.findById(room._id);
        const updatedMemberPayment = savedRoom.memberPayments.find(
          (mp) => mp.member.toString() === transaction.payer.toString(),
        );
        console.log(
          `[BANK-CONFIRM] Updated ${transaction.payer}: ${transaction.billType}=${updatedMemberPayment[transaction.billType + "Status"]}`,
        );

        // Check if billing cycle should be auto-closed based on PaymentTransaction
        const closeResult = await checkAndAutoCloseCycle(transaction.room);

        // Return response with cycle close status
        const response = {
          success: true,
          message: "Bank transfer payment confirmed",
          transaction,
        };

        // If cycle was closed, include that info so frontend can refresh
        if (closeResult && closeResult.success) {
          response.cycleClosed = true;
          response.message =
            "Bank transfer payment confirmed and billing cycle automatically closed!";
        }

        res.status(200).json(response);
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 5. Record Cash Payment
router.post(
  "/record-cash",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const {
        roomId,
        amount,
        billType,
        receiptNumber,
        receivedBy,
        witnessName,
        notes,
      } = req.body;

      if (!roomId || !amount || !billType || !receivedBy) {
        return next(
          new ErrorHandler(
            "Room ID, Amount, Bill Type, and Received By are required",
            400,
          ),
        );
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Create payment transaction
      const transaction = new PaymentTransaction({
        room: roomId,
        payer: req.user._id,
        amount,
        billType,
        paymentMethod: "cash",
        status: "completed",
        completionDate: new Date(),
        cash: {
          receiptNumber: receiptNumber || `CASH-${Date.now()}`,
          receivedBy,
          witnessName,
          notes,
        },
        billingCycleStart: room.billing.start,
        billingCycleEnd: room.billing.end,
        billingCycleId: room.currentCycleId, // Store direct reference to cycle
      });

      await transaction.save();

      console.log(
        `[CASH-PAYMENT] Saved: room=${room.name}, amount=₱${amount}, cycleId=${transaction.billingCycleId}`,
      );

      // Update room payment status and deduct from billing
      const memberPayment = room.memberPayments.find(
        (mp) => mp.member.toString() === req.user._id.toString(),
      );

      if (memberPayment) {
        if (billType === "total") {
          // When paying total (all bills), mark all statuses as paid for THIS member
          memberPayment.rentStatus = "paid";
          memberPayment.rentPaidDate = new Date();
          memberPayment.electricityStatus = "paid";
          memberPayment.electricityPaidDate = new Date();
          memberPayment.waterStatus = "paid";
          memberPayment.waterPaidDate = new Date();
          memberPayment.internetStatus = "paid";
          memberPayment.internetPaidDate = new Date();
          // DO NOT modify room.billing amounts - keep original for other members' calculations
        } else if (billType === "rent") {
          memberPayment.rentStatus = "paid";
          memberPayment.rentPaidDate = new Date();
          // DO NOT modify room.billing - keep original
        } else if (billType === "electricity") {
          memberPayment.electricityStatus = "paid";
          memberPayment.electricityPaidDate = new Date();
          // DO NOT modify room.billing - keep original
        } else if (billType === "water") {
          memberPayment.waterStatus = "paid";
          memberPayment.waterPaidDate = new Date();
          // DO NOT modify room.billing - keep original
        } else if (billType === "internet") {
          memberPayment.internetStatus = "paid";
          memberPayment.internetPaidDate = new Date();
          // DO NOT modify room.billing - keep original
        }
      }

      // Check if all members have paid - if so, clear billing cycle
      await checkAndClearBillingIfComplete(room);

      await room.save();

      // Verify payment was saved
      const savedRoom = await Room.findById(room._id);
      const updatedMemberPayment = savedRoom.memberPayments.find(
        (mp) => mp.member.toString() === req.user._id.toString(),
      );
      console.log(
        `[CASH-CONFIRM] Updated ${req.user._id}: ${billType}=${updatedMemberPayment[billType + "Status"]}`,
      );

      // Check if billing cycle should be auto-closed based on PaymentTransaction
      const closeResult = await checkAndAutoCloseCycle(roomId);

      // Return response with cycle close status
      const response = {
        success: true,
        message: "Cash payment recorded",
        transaction,
      };

      // If cycle was closed, include that info so frontend can refresh
      if (closeResult && closeResult.success) {
        response.cycleClosed = true;
        response.message =
          "Cash payment recorded and billing cycle automatically closed!";
      }

      res.status(200).json(response);
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 5.5 Cancel a Pending Transaction (user-initiated cancel)
router.post(
  "/cancel-transaction",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { transactionId } = req.body;
      if (!transactionId) {
        return next(new ErrorHandler("Transaction ID is required", 400));
      }

      const transaction = await PaymentTransaction.findById(transactionId);
      if (!transaction) {
        return next(new ErrorHandler("Transaction not found", 404));
      }

      // Only the payer may cancel their own pending transaction
      if (transaction.payer.toString() !== req.user._id.toString()) {
        return next(
          new ErrorHandler("Unauthorized to cancel this transaction", 403),
        );
      }

      if (transaction.status !== "pending") {
        return next(
          new ErrorHandler("Cannot cancel a processed transaction", 400),
        );
      }

      console.log(
        "🔁 Cancelling transaction:",
        transactionId,
        "by",
        req.user._id,
      );
      transaction.status = "cancelled";
      transaction.cancellationDate = new Date();

      await transaction.save();
      console.log(`[CANCEL-TRANSACTION] ${transaction._id}`);

      res.status(200).json({
        success: true,
        message: "Transaction cancelled",
        transaction,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 6. Get Payment Transactions (for member)
router.get(
  "/transactions/:roomId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const { status, paymentMethod } = req.query;

      // Filter to show only current user's transactions (their own payment history)
      let query = {
        room: roomId,
        payer: req.user._id, // Only show payments made by current user
      };

      if (status) {
        // Allow explicit status filter. Use status=all to include cancelled if needed.
        if (status !== "all") {
          query.status = status;
        }
      } else {
        // By default exclude cancelled transactions from user's history
        query.status = { $ne: "cancelled" };
      }

      if (paymentMethod) {
        query.paymentMethod = paymentMethod;
      }

      const transactions = await PaymentTransaction.find(query)
        .populate("payer", "name email")
        .populate("room", "name")
        .sort({ transactionDate: -1 });

      res.status(200).json({
        success: true,
        transactions,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 7. Get Single Transaction
router.get(
  "/transaction/:transactionId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { transactionId } = req.params;

      const transaction = await PaymentTransaction.findById(transactionId)
        .populate("payer", "name email")
        .populate("room", "name");

      if (!transaction) {
        return next(new ErrorHandler("Transaction not found", 404));
      }

      res.status(200).json({
        success: true,
        transaction,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 8. Get Transaction Statistics (for analytics)
router.get(
  "/analytics/:roomId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;

      const transactions = await PaymentTransaction.find({
        room: roomId,
        status: "completed",
      });

      // Calculate stats
      const totalPaid = transactions.reduce((sum, t) => sum + t.amount, 0);
      const totalPending = await PaymentTransaction.countDocuments({
        room: roomId,
        status: "pending",
      });

      // By payment method
      const byMethod = {
        gcash: transactions
          .filter((t) => t.paymentMethod === "gcash")
          .reduce((sum, t) => sum + t.amount, 0),
        bank_transfer: transactions
          .filter((t) => t.paymentMethod === "bank_transfer")
          .reduce((sum, t) => sum + t.amount, 0),
        cash: transactions
          .filter((t) => t.paymentMethod === "cash")
          .reduce((sum, t) => sum + t.amount, 0),
      };

      // By bill type
      const byBillType = {
        rent: transactions
          .filter((t) => t.billType === "rent")
          .reduce((sum, t) => sum + t.amount, 0),
        electricity: transactions
          .filter((t) => t.billType === "electricity")
          .reduce((sum, t) => sum + t.amount, 0),
        water: transactions
          .filter((t) => t.billType === "water")
          .reduce((sum, t) => sum + t.amount, 0),
      };

      // By payer (per member contribution)
      const byPayer = {};
      for (const transaction of transactions) {
        const payerName = transaction.payer.name || "Unknown";
        if (!byPayer[payerName]) {
          byPayer[payerName] = 0;
        }
        byPayer[payerName] += transaction.amount;
      }

      res.status(200).json({
        success: true,
        analytics: {
          totalPaid,
          totalPending,
          byMethod,
          byBillType,
          byPayer,
          transactionCount: transactions.length,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 9. Get Billing History for a Room
router.get(
  "/billing-history/:roomId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId).select("billingHistory");

      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const history = (room.billingHistory || []).map((cycle) => ({
        _id: cycle._id || `${cycle.completedDate}-${cycle.startDate}`,
        startDate: cycle.startDate || cycle.start,
        endDate: cycle.endDate || cycle.end,
        rent: cycle.rent || 0,
        electricity: cycle.electricity || 0,
        water: cycle.water || cycle.waterBillAmount || 0,
        previousReading: cycle.previousReading || cycle.previousMeterReading,
        currentReading: cycle.currentReading || cycle.currentMeterReading,
        completedDate: cycle.completedDate || cycle.createdAt,
        status: "completed",
        memberPayments: cycle.memberPayments || [],
      }));

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 10. Get Billing Cycles (alias for billing history)
router.get(
  "/billing-cycles/room/:roomId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId).select(
        "billing billingHistory memberPayments",
      );

      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const cycles = [];

      // Add current billing cycle if active
      if (room.billing && room.billing.start && room.billing.end) {
        cycles.push({
          _id: `active-${roomId}`,
          startDate: room.billing.start,
          endDate: room.billing.end,
          rent: room.billing.rent || 0,
          electricity: room.billing.electricity || 0,
          waterBillAmount: room.billing.water || 0,
          previousMeterReading: room.billing.previousReading,
          currentMeterReading: room.billing.currentReading,
          status: "active",
          membersCount: room.memberPayments?.length || 0,
          totalBilledAmount:
            (room.billing.rent || 0) +
            (room.billing.electricity || 0) +
            (room.billing.water || 0),
        });
      }

      // Add completed cycles from history
      if (room.billingHistory && room.billingHistory.length > 0) {
        room.billingHistory.forEach((cycle) => {
          cycles.push({
            _id: cycle._id || `${cycle.completedDate}-${cycle.startDate}`,
            startDate: cycle.startDate || cycle.start,
            endDate: cycle.endDate || cycle.end,
            rent: cycle.rent || 0,
            electricity: cycle.electricity || 0,
            waterBillAmount: cycle.water || cycle.waterBillAmount || 0,
            previousMeterReading:
              cycle.previousReading || cycle.previousMeterReading,
            currentMeterReading:
              cycle.currentReading || cycle.currentMeterReading,
            closedAt: cycle.completedDate || cycle.createdAt,
            status: "completed",
            membersCount: cycle.memberPayments?.length || 0,
            totalBilledAmount:
              (cycle.rent || 0) +
              (cycle.electricity || 0) +
              (cycle.water || cycle.waterBillAmount || 0),
          });
        });
      }

      res.status(200).json({
        success: true,
        data: cycles,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

module.exports = router;
