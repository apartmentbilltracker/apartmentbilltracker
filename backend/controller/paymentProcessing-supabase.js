// Payment Processing Controller - Supabase
// Simplified version focusing on core payment operations
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

// Helper: Calculate water charges from presence marking
const recalculateWaterFromPresence = (members) => {
  if (!members || members.length === 0) {
    return 0;
  }

  const WATER_RATE_PER_DAY = 5; // ₱5 per day

  // Get unique presence days across all members
  const allPresenceDays = new Set();
  members.forEach((member) => {
    if (Array.isArray(member.presence)) {
      member.presence.forEach((day) => {
        allPresenceDays.add(String(day));
      });
    }
  });

  const totalPresenceDays = allPresenceDays.size;
  const calculatedWater = totalPresenceDays * WATER_RATE_PER_DAY;

  return calculatedWater;
};

// Get payment status for active cycle
router.get(
  "/status/:roomId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      const activeCycle = cycles.find((c) => c.status === "active");

      if (!activeCycle) {
        return res.status(200).json({
          success: true,
          message: "No active billing cycle",
          paymentStatus: [],
        });
      }

      const members = await SupabaseService.getRoomMembers(roomId);
      const payments =
        (await SupabaseService.getPaymentsForCycle(
          roomId,
          activeCycle.start_date,
          activeCycle.end_date,
        )) || [];

      const completedPayments = payments.filter(
        (p) => p.status === "completed",
      );

      const paymentStatus = members
        .filter((m) => m.is_payer)
        .map((member) => {
          const charge =
            activeCycle.member_charges?.find(
              (c) => c.user_id === member.user_id,
            ) || {};
          const memberPayments = completedPayments.filter(
            (p) => p.paid_by === member.user_id,
          );

          const rentPayment = memberPayments.find(
            (p) => p.bill_type === "rent",
          );
          const electricityPayment = memberPayments.find(
            (p) => p.bill_type === "electricity",
          );
          const waterPayment = memberPayments.find(
            (p) => p.bill_type === "water",
          );
          const internetPayment = memberPayments.find(
            (p) => p.bill_type === "internet",
          );
          const totalPayment = memberPayments.find(
            (p) => p.bill_type === "total",
          );

          return {
            memberId: member.user_id,
            memberName: member.name,
            rentPaid: !!rentPayment || !!totalPayment,
            electricityPaid: !!electricityPayment || !!totalPayment,
            waterPaid: !!waterPayment || !!totalPayment,
            internetPaid: !!internetPayment || !!totalPayment,
            totalDue: charge.total_due || 0,
            totalPaid: memberPayments.reduce(
              (sum, p) => sum + (p.amount || 0),
              0,
            ),
            allPaid:
              (!!rentPayment || !!totalPayment) &&
              (!!electricityPayment || !!totalPayment) &&
              (!!waterPayment || !!totalPayment) &&
              (!!internetPayment || !!totalPayment),
          };
        });

      res.status(200).json({
        success: true,
        cycleId: activeCycle.id,
        paymentStatus,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Verify payment (admin only)
router.post(
  "/verify/:paymentId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const { verifiedBy } = req.body;

      const payment = await SupabaseService.selectByColumn(
        "payments",
        "id",
        paymentId,
      );

      if (!payment) {
        return next(new ErrorHandler("Payment not found", 404));
      }

      const updated = await SupabaseService.update("payments", paymentId, {
        status: "verified",
        verified_by: verifiedBy || req.user.id,
        verified_at: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        payment: updated[0],
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Reject payment (admin only)
router.post(
  "/reject/:paymentId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;

      const payment = await SupabaseService.selectByColumn(
        "payments",
        "id",
        paymentId,
      );

      if (!payment) {
        return next(new ErrorHandler("Payment not found", 404));
      }

      const updated = await SupabaseService.update("payments", paymentId, {
        status: "rejected",
        rejection_reason: reason,
        rejected_by: req.user.id,
        rejected_at: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        message: "Payment rejected",
        payment: updated[0],
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get water calculation for cycle
router.get(
  "/water-calculation/:cycleId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { cycleId } = req.params;

      const cycles = await SupabaseService.selectByColumn(
        "billing_cycles",
        "id",
        cycleId,
      );
      if (!cycles) {
        return next(new ErrorHandler("Billing cycle not found", 404));
      }

      const cycle = cycles;
      const room = await SupabaseService.findRoomById(cycle.room_id);
      const members = await SupabaseService.getRoomMembers(cycle.room_id);

      const WATER_RATE_PER_DAY = 5;
      const waterCalculation = {};

      (cycle.member_charges || []).forEach((charge) => {
        const member = members.find((m) => m.user_id === charge.user_id);
        const presenceDays = charge.presence_days || 0;
        const ownWater = presenceDays * WATER_RATE_PER_DAY;
        const waterBillShare = charge.water_bill_share || 0;
        const sharedNonPayorWater = Math.max(0, waterBillShare - ownWater);

        waterCalculation[member?.name || charge.user_id] = {
          presenceDays,
          ownWater: Number(ownWater.toFixed(2)),
          waterBillShare: Number(waterBillShare.toFixed(2)),
          sharedNonPayorWater: Number(sharedNonPayorWater.toFixed(2)),
        };
      });

      res.status(200).json({
        success: true,
        cycleId,
        totalWater: cycle.water_bill_amount || 0,
        waterPerDay: WATER_RATE_PER_DAY,
        calculation: waterCalculation,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Helper: Generate reference number
const generateReferenceNumber = (prefix) => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

// Record payment (user or admin)
router.post(
  "/record",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, billType, amount, referenceNumber, paymentMethod } =
        req.body;

      if (!roomId || !billType || !amount) {
        return next(
          new ErrorHandler("roomId, billType, and amount are required", 400),
        );
      }

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      const activeCycle = cycles.find((c) => c.status === "active");

      if (!activeCycle) {
        return next(new ErrorHandler("No active billing cycle", 400));
      }

      const payment = await SupabaseService.createPayment({
        room_id: roomId,
        paid_by: req.user.id,
        bill_type: billType,
        amount: Number(amount),
        reference: referenceNumber,
        payment_method: paymentMethod || "cash",
        billing_cycle_start: activeCycle.start_date,
        billing_cycle_end: activeCycle.end_date,
      });

      res.status(201).json({
        success: true,
        message: "Payment recorded successfully",
        payment: payment[0],
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// ============ GCash Payment Flow ============

// Initiate GCash payment - creates pending payment + returns QR data & reference
router.post(
  "/initiate-gcash",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, amount, billType } = req.body;

      if (!roomId || !amount || !billType) {
        return next(
          new ErrorHandler("roomId, amount, and billType are required", 400),
        );
      }

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      const activeCycle = cycles.find((c) => c.status === "active");
      if (!activeCycle) {
        return next(new ErrorHandler("No active billing cycle", 400));
      }

      const referenceNumber = generateReferenceNumber("GC");

      const payment = await SupabaseService.createPayment({
        room_id: roomId,
        paid_by: req.user.id,
        bill_type: billType,
        amount: Number(amount),
        reference: referenceNumber,
        payment_method: "gcash",
        billing_cycle_start: activeCycle.start_date,
        billing_cycle_end: activeCycle.end_date,
      });

      const createdPayment = Array.isArray(payment) ? payment[0] : payment;

      res.status(201).json({
        success: true,
        qrData: {
          type: "gcash",
          amount: Number(amount),
          reference: referenceNumber,
        },
        transaction: {
          id: createdPayment.id,
          referenceNumber,
          amount: Number(amount),
          billType,
          status: "pending",
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Verify GCash payment - mark as submitted (awaiting admin verification)
router.post(
  "/verify-gcash",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { transactionId, mobileNumber } = req.body;

      if (!transactionId) {
        return next(new ErrorHandler("transactionId is required", 400));
      }

      const payment = await SupabaseService.findPaymentById(transactionId);
      if (!payment) {
        return next(new ErrorHandler("Payment not found", 404));
      }

      // Append mobile number to reference if provided
      if (mobileNumber && payment.reference) {
        await SupabaseService.updatePayment(transactionId, {
          reference: `${payment.reference} (${mobileNumber})`,
        });
      }

      res.status(200).json({
        success: true,
        message: "GCash payment recorded. Awaiting admin verification.",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// ============ Bank Transfer Payment Flow ============

// Initiate bank transfer - creates pending payment + returns reference
router.post(
  "/initiate-bank-transfer",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, amount, billType } = req.body;

      if (!roomId || !amount || !billType) {
        return next(
          new ErrorHandler("roomId, amount, and billType are required", 400),
        );
      }

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      const activeCycle = cycles.find((c) => c.status === "active");
      if (!activeCycle) {
        return next(new ErrorHandler("No active billing cycle", 400));
      }

      const referenceNumber = generateReferenceNumber("BT");

      const payment = await SupabaseService.createPayment({
        room_id: roomId,
        paid_by: req.user.id,
        bill_type: billType,
        amount: Number(amount),
        reference: referenceNumber,
        payment_method: "bank_transfer",
        billing_cycle_start: activeCycle.start_date,
        billing_cycle_end: activeCycle.end_date,
      });

      const createdPayment = Array.isArray(payment) ? payment[0] : payment;

      res.status(201).json({
        success: true,
        qrData: {
          type: "bank_transfer",
          amount: Number(amount),
          reference: referenceNumber,
        },
        transaction: {
          id: createdPayment.id,
          referenceNumber,
          amount: Number(amount),
          billType,
          status: "pending",
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Confirm bank transfer - mark as submitted
router.post(
  "/confirm-bank-transfer",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { transactionId, bankReferenceNumber } = req.body;

      if (!transactionId) {
        return next(new ErrorHandler("transactionId is required", 400));
      }

      const payment = await SupabaseService.findPaymentById(transactionId);
      if (!payment) {
        return next(new ErrorHandler("Payment not found", 404));
      }

      // Append bank reference to our reference if provided
      if (bankReferenceNumber && payment.reference) {
        await SupabaseService.updatePayment(transactionId, {
          reference: `${payment.reference} | Bank: ${bankReferenceNumber}`,
        });
      }

      res.status(200).json({
        success: true,
        message: "Bank transfer recorded. Awaiting admin verification.",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// ============ Cash Payment Flow ============

// Record cash payment
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

      if (!roomId || !amount || !billType) {
        return next(
          new ErrorHandler("roomId, amount, and billType are required", 400),
        );
      }

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      const activeCycle = cycles.find((c) => c.status === "active");
      if (!activeCycle) {
        return next(new ErrorHandler("No active billing cycle", 400));
      }

      const referenceNumber = receiptNumber || generateReferenceNumber("CASH");

      // Build reference with extra info
      const extraInfo = [
        receivedBy ? `Rcvd: ${receivedBy}` : null,
        witnessName ? `Witness: ${witnessName}` : null,
        notes || null,
      ]
        .filter(Boolean)
        .join(". ");

      const fullReference = extraInfo
        ? `${referenceNumber} | ${extraInfo}`
        : referenceNumber;

      const payment = await SupabaseService.createPayment({
        room_id: roomId,
        paid_by: req.user.id,
        bill_type: billType,
        amount: Number(amount),
        reference: fullReference,
        payment_method: "cash",
        billing_cycle_start: activeCycle.start_date,
        billing_cycle_end: activeCycle.end_date,
      });

      const createdPayment = Array.isArray(payment) ? payment[0] : payment;

      res.status(201).json({
        success: true,
        message: "Cash payment recorded",
        transaction: {
          id: createdPayment.id,
          referenceNumber,
          amount: Number(amount),
          billType,
          status: "pending",
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// ============ Transaction Management ============

// Cancel a pending transaction
router.post(
  "/cancel-transaction",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { transactionId } = req.body;

      if (!transactionId) {
        return next(new ErrorHandler("transactionId is required", 400));
      }

      const payment = await SupabaseService.findPaymentById(transactionId);
      if (!payment) {
        // Already deleted or doesn't exist — treat as success
        return res.status(200).json({
          success: true,
          message: "Payment already cancelled",
        });
      }

      // Delete the pending payment record
      await SupabaseService.deleteRecord("payments", transactionId);

      res.status(200).json({
        success: true,
        message: "Payment cancelled",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get transactions for a room
router.get(
  "/transactions/:roomId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const payments = await SupabaseService.getRoomPayments(roomId);

      // Filter out cancelled/deleted payments and normalize snake_case to camelCase
      const transactions = (payments || [])
        .filter((p) => p.status !== "cancelled" && p.status !== "deleted")
        .map((p) => ({
          ...p,
          billType: p.bill_type || "total",
          paymentMethod: p.payment_method || "cash",
          paidBy: p.paid_by,
          roomId: p.room_id,
          billingCycleStart: p.billing_cycle_start,
          billingCycleEnd: p.billing_cycle_end,
          transactionDate: p.payment_date || p.created_at,
          status: p.status || "pending",
          amount: parseFloat(p.amount) || 0,
        }));

      res.status(200).json({
        success: true,
        transactions,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get a single transaction
router.get(
  "/transaction/:transactionId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { transactionId } = req.params;
      const payment = await SupabaseService.findPaymentById(transactionId);

      if (!payment) {
        return next(new ErrorHandler("Transaction not found", 404));
      }

      res.status(200).json({
        success: true,
        transaction: payment,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get payment analytics for a room
router.get(
  "/analytics/:roomId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const payments = await SupabaseService.getRoomPayments(roomId);

      const totalPaid = payments
        .filter((p) => p.status === "verified")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const totalPending = payments
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const methodBreakdown = {};
      payments.forEach((p) => {
        const method = p.payment_method || "unknown";
        if (!methodBreakdown[method]) {
          methodBreakdown[method] = { count: 0, total: 0 };
        }
        methodBreakdown[method].count++;
        methodBreakdown[method].total += Number(p.amount || 0);
      });

      res.status(200).json({
        success: true,
        analytics: {
          totalPayments: payments.length,
          totalPaid,
          totalPending,
          methodBreakdown,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

module.exports = router;
