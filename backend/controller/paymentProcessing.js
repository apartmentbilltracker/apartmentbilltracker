// Payment Processing Controller - Phase 3
const express = require("express");
const router = express.Router();
const PaymentTransaction = require("../model/paymentTransaction");
const Room = require("../model/room");
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

// Helper: Check if all members have paid all bills, and clear billing if so
const checkAndClearBillingIfComplete = async (room) => {
  if (!room.memberPayments || !room.billing) return;

  const allBillsPaid = room.memberPayments.every((mp) => {
    // Check if this member needs to pay rent
    if (room.billing.rent > 0 && mp.rentStatus !== "paid") return false;
    // Check if this member needs to pay electricity
    if (room.billing.electricity > 0 && mp.electricityStatus !== "paid")
      return false;
    // Check if this member needs to pay water
    if (room.billing.water > 0 && mp.waterStatus !== "paid") return false;
    return true;
  });

  if (allBillsPaid) {
    console.log("✅ All members have paid! Closing billing cycle...");

    // Log what we're about to archive
    console.log("   📦 ARCHIVING CYCLE WITH:");
    console.log("      Rent:", room.billing.rent);
    console.log("      Electricity:", room.billing.electricity);
    console.log("      Water:", room.billing.water, "<-- CHECK THIS");

    // Archive current billing cycle to history BEFORE clearing
    const completedCycle = {
      startDate: room.billing.start,
      endDate: room.billing.end,
      rent: room.billing.rent,
      electricity: room.billing.electricity,
      water: room.billing.water,
      currentReading: room.billing.currentReading,
      previousReading: room.billing.previousReading,
      completedDate: new Date(),
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

    // Clear the current billing cycle and reset member payment statuses
    room.billing = {
      rent: 0,
      electricity: 0,
      water: 0,
      start: null,
      end: null,
      currentReading: null,
      previousReading: null,
    };

    // Reset all member payment statuses to "pending" for next cycle
    room.memberPayments = room.memberPayments.map((mp) => ({
      ...mp,
      rentStatus: "pending",
      electricityStatus: "pending",
      waterStatus: "pending",
      rentPaidDate: null,
      electricityPaidDate: null,
      waterPaidDate: null,
    }));

    console.log(
      "🔄 Billing cycle cleared and member statuses reset for next cycle",
    );
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
      });

      await transaction.save();

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

        console.log("   Found memberPayment:", memberPayment);
        console.log("   Bill type:", transaction.billType);

        if (memberPayment) {
          console.log("   ✅ Member payment found, updating status...");
          if (transaction.billType === "total") {
            // When paying total (all bills), mark all statuses as paid for THIS member
            memberPayment.rentStatus = "paid";
            memberPayment.rentPaidDate = new Date();
            memberPayment.electricityStatus = "paid";
            memberPayment.electricityPaidDate = new Date();
            memberPayment.waterStatus = "paid";
            memberPayment.waterPaidDate = new Date();
            // DO NOT modify room.billing amounts - keep original for other members' calculations
            console.log("   Updated all statuses to: paid (TOTAL payment)");
            console.log(
              "   ⚠️  NOT modifying billing amounts - keep original for other members",
            );
          } else if (transaction.billType === "rent") {
            memberPayment.rentStatus = "paid";
            memberPayment.rentPaidDate = new Date();
            // DO NOT modify room.billing - keep original
            console.log("   Updated rentStatus to: paid");
          } else if (transaction.billType === "electricity") {
            memberPayment.electricityStatus = "paid";
            memberPayment.electricityPaidDate = new Date();
            // DO NOT modify room.billing - keep original
            console.log("   Updated electricityStatus to: paid");
          } else if (transaction.billType === "water") {
            memberPayment.waterStatus = "paid";
            memberPayment.waterPaidDate = new Date();
            // DO NOT modify room.billing - keep original
            console.log("   Updated waterStatus to: paid");
          }
        } else {
          console.log("   ❌ Member payment NOT found!");
        }

        // Check if all members have paid - if so, clear billing cycle
        await checkAndClearBillingIfComplete(room);

        // Log state BEFORE save
        console.log(
          "   📊 Member payments BEFORE save:",
          JSON.stringify(
            room.memberPayments.map((mp) => ({
              member: mp.member,
              memberName: mp.memberName,
              rentStatus: mp.rentStatus,
              electricityStatus: mp.electricityStatus,
              waterStatus: mp.waterStatus,
            })),
          ),
        );

        await room.save();

        // Log state AFTER save to confirm persistence
        console.log("   ✅ Room saved! Final state:");
        const savedRoom = await Room.findById(room._id);
        console.log(
          "   📊 Member payments AFTER save:",
          JSON.stringify(
            savedRoom.memberPayments.map((mp) => ({
              member: mp.member,
              memberName: mp.memberName,
              rentStatus: mp.rentStatus,
              electricityStatus: mp.electricityStatus,
              waterStatus: mp.waterStatus,
            })),
          ),
        );
        console.log(
          "   💧 BILLING STATE - Rent:",
          savedRoom.billing?.rent,
          "| Electricity:",
          savedRoom.billing?.electricity,
          "| Water:",
          savedRoom.billing?.water,
        );
        console.log(
          "   📚 BILLING HISTORY:",
          savedRoom.billingHistory?.length || 0,
          "cycles archived",
        );
      }

      res.status(200).json({
        success: true,
        message: "GCash payment verified and completed",
        transaction,
      });
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
      });

      await transaction.save();

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
        console.log(
          "💳 Bank Transfer Payment - Processing payment for user:",
          transaction.payer,
        );
        console.log("   Room memberPayments:", room.memberPayments);

        const memberPayment = room.memberPayments.find(
          (mp) => mp.member.toString() === transaction.payer.toString(),
        );

        console.log("   Found memberPayment:", memberPayment);
        console.log("   Bill type:", transaction.billType);

        if (memberPayment) {
          console.log("   ✅ Member payment found, updating status...");
          if (transaction.billType === "total") {
            // When paying total (all bills), mark all statuses as paid for THIS member
            memberPayment.rentStatus = "paid";
            memberPayment.rentPaidDate = new Date();
            memberPayment.electricityStatus = "paid";
            memberPayment.electricityPaidDate = new Date();
            memberPayment.waterStatus = "paid";
            memberPayment.waterPaidDate = new Date();
            // DO NOT modify room.billing amounts - keep original for other members' calculations
            console.log("   Updated all statuses to: paid (TOTAL payment)");
            console.log(
              "   ⚠️  NOT modifying billing amounts - keep original for other members",
            );
          } else if (transaction.billType === "rent") {
            memberPayment.rentStatus = "paid";
            memberPayment.rentPaidDate = new Date();
            // DO NOT modify room.billing - keep original
            console.log("   Updated rentStatus to: paid");
          } else if (transaction.billType === "electricity") {
            memberPayment.electricityStatus = "paid";
            memberPayment.electricityPaidDate = new Date();
            // DO NOT modify room.billing - keep original
            console.log("   Updated electricityStatus to: paid");
          } else if (transaction.billType === "water") {
            memberPayment.waterStatus = "paid";
            memberPayment.waterPaidDate = new Date();
            // DO NOT modify room.billing - keep original
            console.log("   Updated waterStatus to: paid");
          }
        } else {
          console.log("   ❌ Member payment NOT found!");
        }

        // Check if all members have paid - if so, clear billing cycle
        await checkAndClearBillingIfComplete(room);

        // Log state BEFORE save
        console.log(
          "   📊 Member payments BEFORE save:",
          JSON.stringify(
            room.memberPayments.map((mp) => ({
              member: mp.member,
              memberName: mp.memberName,
              rentStatus: mp.rentStatus,
              electricityStatus: mp.electricityStatus,
              waterStatus: mp.waterStatus,
            })),
          ),
        );

        await room.save();

        // Log state AFTER save to confirm persistence
        console.log("   ✅ Room saved! Final state:");
        const savedRoom = await Room.findById(room._id);
        console.log(
          "   📊 Member payments AFTER save:",
          JSON.stringify(
            savedRoom.memberPayments.map((mp) => ({
              member: mp.member,
              memberName: mp.memberName,
              rentStatus: mp.rentStatus,
              electricityStatus: mp.electricityStatus,
              waterStatus: mp.waterStatus,
            })),
          ),
        );
        console.log(
          "   💧 BILLING STATE - Rent:",
          savedRoom.billing?.rent,
          "| Electricity:",
          savedRoom.billing?.electricity,
          "| Water:",
          savedRoom.billing?.water,
        );
        console.log(
          "   📚 BILLING HISTORY:",
          savedRoom.billingHistory?.length || 0,
          "cycles archived",
        );
      }

      res.status(200).json({
        success: true,
        message: "Bank transfer payment confirmed",
        transaction,
      });
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
      });

      await transaction.save();

      // Update room payment status and deduct from billing
      console.log(
        "💳 Cash Payment - Processing payment for user:",
        req.user._id,
      );
      console.log("   Room memberPayments:", room.memberPayments);

      const memberPayment = room.memberPayments.find(
        (mp) => mp.member.toString() === req.user._id.toString(),
      );

      console.log("   Found memberPayment:", memberPayment);
      console.log("   Bill type:", billType);

      if (memberPayment) {
        console.log("   ✅ Member payment found, updating status...");
        if (billType === "total") {
          // When paying total (all bills), mark all statuses as paid for THIS member
          memberPayment.rentStatus = "paid";
          memberPayment.rentPaidDate = new Date();
          memberPayment.electricityStatus = "paid";
          memberPayment.electricityPaidDate = new Date();
          memberPayment.waterStatus = "paid";
          memberPayment.waterPaidDate = new Date();
          // DO NOT modify room.billing amounts - keep original for other members' calculations
          console.log("   Updated all statuses to: paid (TOTAL payment)");
          console.log(
            "   ⚠️  NOT modifying billing amounts - keep original for other members",
          );
        } else if (billType === "rent") {
          memberPayment.rentStatus = "paid";
          memberPayment.rentPaidDate = new Date();
          // DO NOT modify room.billing - keep original
          console.log("   Updated rentStatus to: paid");
        } else if (billType === "electricity") {
          memberPayment.electricityStatus = "paid";
          memberPayment.electricityPaidDate = new Date();
          // DO NOT modify room.billing - keep original
          console.log("   Updated electricityStatus to: paid");
        } else if (billType === "water") {
          memberPayment.waterStatus = "paid";
          memberPayment.waterPaidDate = new Date();
          // DO NOT modify room.billing - keep original
          console.log("   Updated waterStatus to: paid");
        }
      } else {
        console.log("   ❌ Member payment NOT found!");
      }

      // Check if all members have paid - if so, clear billing cycle
      await checkAndClearBillingIfComplete(room);

      // Log state BEFORE save
      console.log(
        "   📊 Member payments BEFORE save:",
        JSON.stringify(
          room.memberPayments.map((mp) => ({
            member: mp.member,
            memberName: mp.memberName,
            rentStatus: mp.rentStatus,
            electricityStatus: mp.electricityStatus,
            waterStatus: mp.waterStatus,
          })),
        ),
      );

      await room.save();

      // Log state AFTER save to confirm persistence
      console.log("   ✅ Room saved! Final state:");
      const savedRoom = await Room.findById(room._id);
      console.log(
        "   📊 Member payments AFTER save:",
        JSON.stringify(
          savedRoom.memberPayments.map((mp) => ({
            member: mp.member,
            memberName: mp.memberName,
            rentStatus: mp.rentStatus,
            electricityStatus: mp.electricityStatus,
            waterStatus: mp.waterStatus,
          })),
        ),
      );
      console.log(
        "   💧 BILLING STATE - Rent:",
        savedRoom.billing?.rent,
        "| Electricity:",
        savedRoom.billing?.electricity,
        "| Water:",
        savedRoom.billing?.water,
      );
      console.log(
        "   📚 BILLING HISTORY:",
        savedRoom.billingHistory?.length || 0,
        "cycles archived",
      );

      res.status(200).json({
        success: true,
        message: "Cash payment recorded",
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
        query.status = status;
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
