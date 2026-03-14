// Payment Processing Controller - Supabase
// Simplified version focusing on core payment operations
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdminOrHost } = require("../middleware/auth");
const { checkAndAutoCloseCycle } = require("../utils/autoCloseCycle");
const { sendPushNotification } = require("../utils/sendPushNotification");

// Helper: get payment settings for a specific room, falling back to host-level settings
const getSettingsForRoom = async (roomId, hostUserId) => {
  try {
    // PRIORITY 1: Room-specific settings
    if (roomId) {
      const roomRows = await SupabaseService.selectAll(
        "app_settings",
        "room_id",
        roomId,
      );
      if (roomRows && roomRows.length > 0) return roomRows[0];
    }
    // PRIORITY 2: Host-level settings (only rows belonging to this host)
    if (!hostUserId) return {};
    const hostRows = await SupabaseService.selectAll(
      "app_settings",
      "user_id",
      hostUserId,
    );
    // Filter to host-level rows (no room_id) to avoid picking another room's overrides
    const hostLevel = hostRows
      ? hostRows.find((r) => !r.room_id) || hostRows[0]
      : null;
    return hostLevel || {};
  } catch {
    return {};
  }
};

// Helper: check if a payment method is enabled for a specific room/host
const isPaymentMethodEnabled = async (method, hostUserId, roomId) => {
  const settings = await getSettingsForRoom(roomId, hostUserId);
  if (method === "gcash") return settings.gcash_enabled !== false;
  if (method === "bank_transfer")
    return settings.bank_transfer_enabled !== false;
  return true;
};

const getMaintenanceMessage = async (method, hostUserId, roomId) => {
  const settings = await getSettingsForRoom(roomId, hostUserId);
  if (method === "gcash") return settings.gcash_maintenance_message || "";
  if (method === "bank_transfer")
    return settings.bank_transfer_maintenance_message || "";
  return "";
};

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
        (p) => p.status === "completed" || p.status === "verified",
      );

      const paymentStatus = members
        .filter((m) => m.is_payer !== false)
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

// Verify payment
router.post(
  "/verify/:paymentId",
  isAuthenticated,
  isAdminOrHost,
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
        status: "completed",
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

// Reject payment
router.post(
  "/reject/:paymentId",
  isAuthenticated,
  isAdminOrHost,
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
        status: "pending",
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
      const { roomId, amount, billType, billingCycleId } = req.body;

      if (!roomId || !amount || !billType) {
        return next(
          new ErrorHandler("roomId, amount, and billType are required", 400),
        );
      }

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Check if GCash is enabled for this room (room-specific first, then host-level)
      const enabled = await isPaymentMethodEnabled(
        "gcash",
        room.created_by,
        roomId,
      );
      if (!enabled) {
        const msg = await getMaintenanceMessage(
          "gcash",
          room.created_by,
          roomId,
        );
        return next(
          new ErrorHandler(
            msg ||
              "GCash payments are temporarily unavailable due to scheduled maintenance. Please try again later or use another payment method.",
            503,
          ),
        );
      }

      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      const targetCycle = billingCycleId
        ? cycles.find((c) => String(c.id) === String(billingCycleId))
        : cycles.find((c) => c.status === "active");
      if (!targetCycle) {
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
        status: "pending",
        billing_cycle_start: targetCycle.start_date,
        billing_cycle_end: targetCycle.end_date,
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

// Verify GCash payment - mark as submitted (awaiting host verification)
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

      // Mark as submitted — host must verify before it becomes completed
      const updateData = { status: "submitted" };
      if (mobileNumber && payment.reference) {
        updateData.reference = `${payment.reference} (${mobileNumber})`;
      }
      await SupabaseService.updatePayment(transactionId, updateData);

      // Notify host that a GCash payment was submitted
      try {
        const room = await SupabaseService.findRoomById(payment.room_id);
        if (room) {
          const hostUser = await SupabaseService.findUserById(room.created_by);
          if (hostUser?.expo_push_token) {
            await sendPushNotification(hostUser.expo_push_token, {
              title: "GCash Payment Submitted",
              body: `${req.user.name || "A tenant"} submitted a GCash payment for ${room.name}. Please verify.`,
            });
          }
        }
      } catch (_) {
        /* non-critical */
      }

      res.status(200).json({
        success: true,
        message: "GCash payment submitted. Awaiting host verification.",
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
      const { roomId, amount, billType, billingCycleId } = req.body;

      if (!roomId || !amount || !billType) {
        return next(
          new ErrorHandler("roomId, amount, and billType are required", 400),
        );
      }

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Check if Bank Transfer is enabled for this room (room-specific first, then host-level)
      const enabled = await isPaymentMethodEnabled(
        "bank_transfer",
        room.created_by,
        roomId,
      );
      if (!enabled) {
        const msg = await getMaintenanceMessage(
          "bank_transfer",
          room.created_by,
          roomId,
        );
        return next(
          new ErrorHandler(
            msg ||
              "Bank Transfer payments are temporarily unavailable due to scheduled maintenance. Please try again later or use another payment method.",
            503,
          ),
        );
      }

      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      const targetCycle = billingCycleId
        ? cycles.find((c) => String(c.id) === String(billingCycleId))
        : cycles.find((c) => c.status === "active");
      if (!targetCycle) {
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
        status: "pending",
        billing_cycle_start: targetCycle.start_date,
        billing_cycle_end: targetCycle.end_date,
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

// Confirm bank transfer - mark as submitted (awaiting host verification)
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

      // Mark as submitted — host must verify before it becomes completed
      const updateData = { status: "submitted" };
      if (bankReferenceNumber && payment.reference) {
        updateData.reference = `${payment.reference} | Bank: ${bankReferenceNumber}`;
      }
      await SupabaseService.updatePayment(transactionId, updateData);

      // Notify host that a bank transfer was submitted
      try {
        const room = await SupabaseService.findRoomById(payment.room_id);
        if (room) {
          const hostUser = await SupabaseService.findUserById(room.created_by);
          if (hostUser?.expo_push_token) {
            await sendPushNotification(hostUser.expo_push_token, {
              title: "Bank Transfer Submitted",
              body: `${req.user.name || "A tenant"} submitted a bank transfer for ${room.name}. Please verify.`,
            });
          }
        }
      } catch (_) {
        /* non-critical */
      }

      res.status(200).json({
        success: true,
        message: "Bank transfer submitted. Awaiting host verification.",
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
        billingCycleId,
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
      const targetCycle = billingCycleId
        ? cycles.find((c) => String(c.id) === String(billingCycleId))
        : cycles.find((c) => c.status === "active");
      if (!targetCycle) {
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
        status: "completed",
        billing_cycle_start: targetCycle.start_date,
        billing_cycle_end: targetCycle.end_date,
      });

      const createdPayment = Array.isArray(payment) ? payment[0] : payment;

      // Notify host that cash was received
      try {
        const hostUser = await SupabaseService.findUserById(room.created_by);
        if (hostUser?.expo_push_token) {
          await sendPushNotification(hostUser.expo_push_token, {
            title: "Cash Payment Received",
            body: `${req.user.name || "A tenant"} recorded a cash payment of ₱${Number(amount).toFixed(2)} for ${room.name}.`,
          });
        }
      } catch (_) {
        /* non-critical */
      }

      // Auto-close cycle if all payors have paid
      const autoClose = await checkAndAutoCloseCycle(roomId);

      res.status(201).json({
        success: true,
        message: "Cash payment recorded",
        cycleClosed: autoClose.closed,
        transaction: {
          id: createdPayment.id,
          referenceNumber,
          amount: Number(amount),
          billType,
          status: "completed",
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
      const allPayments = await SupabaseService.getRoomPayments(roomId);

      // Non-admin/host users only see their own payments
      const role = (req.user.role || "").toLowerCase();
      const payments =
        req.user.is_admin || role === "host"
          ? allPayments
          : (allPayments || []).filter((p) => p.paid_by === req.user.id);

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
        .filter((p) => p.status === "completed")
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
