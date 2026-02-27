// Payment and Settlement Controller (Supabase Version)
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdminOrHost } = require("../middleware/auth");
const { checkAndAutoCloseCycle } = require("../utils/autoCloseCycle");
const sendMail = require("../utils/sendMail");

/**
 * Build a styled HTML email for payment status notifications
 */
const buildPaymentEmail = ({
  userName,
  status,
  billType,
  amount,
  note,
  reason,
}) => {
  const isVerified = status === "completed";
  const accentColor = isVerified ? "#2e7d32" : "#c62828";
  const icon = isVerified ? "✅" : "❌";
  const headline = isVerified ? "Payment Verified" : "Payment Rejected";
  const bodyText = isVerified
    ? `Your <strong>${(billType || "").toUpperCase()}</strong> payment of <strong>₱${Number(amount || 0).toFixed(2)}</strong> has been <strong style="color:${accentColor}">verified and confirmed</strong> by your host.${note ? `<br/><br/>Note from host: <em>${note}</em>` : ""}`
    : `Your <strong>${(billType || "").toUpperCase()}</strong> payment of <strong>₱${Number(amount || 0).toFixed(2)}</strong> has been <strong style="color:${accentColor}">rejected</strong> by your host.${reason ? `<br/><br/>Reason: <em>${reason}</em>` : ""}<br/><br/>Please resubmit your payment with the correct details.`;

  return `
    <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#333;">
      <div style="background-color:${accentColor};padding:30px 0;text-align:center;">
        <h2 style="color:white;margin:0;">${icon} ${headline}</h2>
      </div>
      <div style="background-color:#ffffff;padding:30px;border-radius:8px;margin:20px 0;border:1px solid #eee;">
        <p style="font-size:16px;">Hi <strong>${userName}</strong>,</p>
        <p style="font-size:15px;line-height:1.6;">${bodyText}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="color:#888;font-size:13px;">Apartment Bill Tracker</p>
      </div>
    </div>
  `;
};

/**
 * Send in-app notification + optional email to a user about their payment status
 */
const sendPaymentStatusNotification = async ({
  userId,
  status,
  billType,
  amount,
  note,
  reason,
  verifierName,
}) => {
  try {
    const isVerified = status === "completed";
    const title = isVerified ? "Payment Verified ✅" : "Payment Rejected ❌";
    const inAppMessage = isVerified
      ? `Your ${(billType || "").toUpperCase()} payment of ₱${Number(amount || 0).toFixed(2)} has been verified by ${verifierName || "your host"}.${note ? ` Note: ${note}` : ""}`
      : `Your ${(billType || "").toUpperCase()} payment of ₱${Number(amount || 0).toFixed(2)} was rejected by ${verifierName || "your host"}.${reason ? ` Reason: ${reason}` : ""} Please resubmit.`;

    // 1) In-app notification
    await SupabaseService.insertMany("notifications", [
      {
        recipient_id: userId,
        notification_type: isVerified ? "payment_verified" : "payment_rejected",
        title,
        message: inAppMessage,
        is_read: false,
        related_data: {
          bill_type: billType,
          amount,
          status,
          note: note || null,
          reason: reason || null,
        },
        created_at: new Date().toISOString(),
      },
    ]);

    // 2) Email (non-blocking)
    const user = await SupabaseService.findUserById(userId);
    if (user?.email) {
      const html = buildPaymentEmail({
        userName: user.name || "Tenant",
        status,
        billType,
        amount,
        note,
        reason,
      });
      sendMail({ email: user.email, subject: title, message: html }).catch(
        () => {},
      );
    }
  } catch (err) {
    console.error("[sendPaymentStatusNotification] error:", err.message);
  }
};

// Helper to normalize settlement for mobile compatibility
const normalizeSettlement = (s) => ({
  ...s,
  createdAt: s.created_at,
  debtorId: s.debtor_id,
  creditorId: s.creditor_id,
  roomId: s.room_id,
  settlementAmount: s.settlement_amount,
  settlementDate: s.settlement_date,
});

// ============================================================
// 1. MARK BILL AS PAID
// ============================================================
router.post("/mark-bill-paid", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId, memberId, billType, amount, paymentMethod, reference } =
      req.body;

    if (!roomId || !memberId || !billType || !amount) {
      return next(
        new ErrorHandler(
          "Room ID, Member ID, Bill Type, and Amount are required",
          400,
        ),
      );
    }

    const room = await SupabaseService.findRoomById(roomId);
    if (!room) {
      return next(new ErrorHandler("Room not found", 404));
    }

    // Record payment in payments table
    const payment = await SupabaseService.createPayment({
      room_id: roomId,
      paid_by: memberId,
      amount,
      billing_cycle_start: room.start,
      billing_cycle_end: room.end,
      bill_type: billType,
      payment_method: paymentMethod || "cash",
      reference,
      status: "completed",
    });

    // Auto-close cycle if all payors have paid
    const autoClose = await checkAndAutoCloseCycle(roomId);

    res.status(200).json({
      success: true,
      message: "Bill marked as paid successfully",
      cycleClosed: autoClose.closed,
      payment,
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// 2. GET PAYMENT HISTORY FOR A ROOM
// ============================================================
router.get(
  "/payment-history/:roomId",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { roomId } = req.params;

      const allPayments = await SupabaseService.getRoomPayments(roomId);

      // Non-admin/host users only see their own payments
      const role = (req.user.role || "").toLowerCase();
      const payments =
        req.user.is_admin || role === "host"
          ? allPayments
          : (allPayments || []).filter((p) => p.paid_by === req.user.id);

      // Enrich with user details
      for (let payment of payments) {
        const paidByUser = await SupabaseService.findUserById(payment.paid_by);
        payment.paidBy = paidByUser;
      }

      res.status(200).json({
        success: true,
        payments: payments.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at),
        ),
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// 3. GET PAYMENT HISTORY FOR A SPECIFIC MEMBER
// ============================================================
router.get(
  "/member-payment-history/:roomId/:memberId",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { roomId, memberId } = req.params;

      const allPayments = await SupabaseService.getRoomPayments(roomId);
      const memberPayments = allPayments.filter((p) => p.paid_by === memberId);

      // Enrich with user details
      for (let payment of memberPayments) {
        const paidByUser = await SupabaseService.findUserById(payment.paid_by);
        payment.paidBy = paidByUser;
      }

      res.status(200).json({
        success: true,
        payments: memberPayments.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at),
        ),
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// 4. CALCULATE SETTLEMENTS (who owes whom)
// ============================================================
router.post(
  "/calculate-settlements",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { roomId } = req.body;

      if (!roomId) {
        return next(new ErrorHandler("Room ID is required", 400));
      }

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Get room members
      const members =
        (await SupabaseService.selectAll(
          "room_members",
          "room_id",
          roomId,
          "*",
          "joined_at",
        )) || [];

      const payers = members.filter((m) => m.is_payer !== false);
      const nonPayers = members.filter((m) => m.is_payer === false);

      // Calculate total bills
      const totalRent = room.rent || 0;
      const totalElectricity = room.electricity || 0;
      const totalWater = nonPayers.length * 5; // ₱5 per person per day

      // Calculate per-person share for payers
      const payerCount = payers.length;

      const perPayerShare = {
        rent: totalRent / (payerCount || 1),
        electricity: totalElectricity / (payerCount || 1),
      };

      // Create settlements list
      const settlements = [];
      for (const nonPayer of nonPayers) {
        for (const payer of payers) {
          if (nonPayer.presence && nonPayer.presence.length > 0) {
            settlements.push({
              debtor_id: nonPayer.user_id,
              debtor_name: nonPayer.user_id, // Will be enriched
              creditor_id: payer.user_id,
              creditor_name: payer.user_id, // Will be enriched
              amount: nonPayer.presence.length * 5, // Water bill
              bill_type: "water",
            });
          }
        }
      }

      res.status(200).json({
        success: true,
        settlements,
        billingSummary: {
          totalRent,
          totalElectricity,
          totalWater,
          payerCount,
          perPayerShare,
        },
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// 5. RECORD SETTLEMENT
// ============================================================
router.post("/record-settlement", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId, debtorId, creditorId, amount, settlementAmount, notes } =
      req.body;

    if (
      !roomId ||
      !debtorId ||
      !creditorId ||
      amount === undefined ||
      settlementAmount === undefined
    ) {
      return next(
        new ErrorHandler(
          "Room ID, Debtor ID, Creditor ID, Amount, and Settlement Amount are required",
          400,
        ),
      );
    }

    const status =
      settlementAmount >= amount
        ? "settled"
        : settlementAmount > 0
          ? "partial"
          : "pending";

    const settlement = await SupabaseService.createSettlement({
      room_id: roomId,
      debtor_id: debtorId,
      creditor_id: creditorId,
      amount,
      settlement_amount: settlementAmount,
      status,
      settlement_date: settlementAmount > 0 ? new Date() : null,
      notes,
    });

    res.status(200).json({
      success: true,
      message: "Settlement recorded successfully",
      settlement: normalizeSettlement(settlement),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// 6. GET SETTLEMENTS FOR A ROOM
// ============================================================
router.get("/settlements/:roomId", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { status } = req.query;

    const allSettlements = await SupabaseService.getRoomSettlements(roomId);

    let settlements = allSettlements;
    if (status) {
      settlements = settlements.filter((s) => s.status === status);
    }

    // Enrich with user details
    for (let settlement of settlements) {
      const debtor = await SupabaseService.findUserById(settlement.debtor_id);
      const creditor = await SupabaseService.findUserById(
        settlement.creditor_id,
      );
      settlement.debtor = debtor;
      settlement.creditor = creditor;
    }

    res.status(200).json({
      success: true,
      settlements: settlements
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(normalizeSettlement),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// 7. GET MEMBER'S DEBTS
// ============================================================
router.get(
  "/member-debts/:roomId/:memberId",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { roomId, memberId } = req.params;

      const allSettlements = await SupabaseService.getRoomSettlements(roomId);
      const debts = allSettlements.filter(
        (s) =>
          s.debtor_id === memberId && ["pending", "partial"].includes(s.status),
      );

      // Enrich with user details
      for (let debt of debts) {
        const creditor = await SupabaseService.findUserById(debt.creditor_id);
        debt.creditor = creditor;
      }

      const totalDebt = debts.reduce((sum, s) => sum + s.amount, 0);

      res.status(200).json({
        success: true,
        debts,
        totalDebt,
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// 8. GET MEMBER'S CREDITS (who owes them)
// ============================================================
router.get(
  "/member-credits/:roomId/:memberId",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { roomId, memberId } = req.params;

      const allSettlements = await SupabaseService.getRoomSettlements(roomId);
      const credits = allSettlements.filter(
        (s) =>
          s.creditor_id === memberId &&
          ["pending", "partial"].includes(s.status),
      );

      // Enrich with user details
      for (let credit of credits) {
        const debtor = await SupabaseService.findUserById(credit.debtor_id);
        credit.debtor = debtor;
      }

      const totalCredit = credits.reduce((sum, s) => sum + s.amount, 0);

      res.status(200).json({
        success: true,
        credits,
        totalCredit,
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// 9. GET ALL PENDING PAYMENTS FOR A ROOM (admin/host)
// ============================================================
router.get(
  "/admin/pending/:roomId",
  isAuthenticated,
  isAdminOrHost,
  async (req, res, next) => {
    try {
      const { roomId } = req.params;

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Get active billing cycle
      const billingCycles = await SupabaseService.getRoomBillingCycles(roomId);
      const activeCycle = billingCycles.find((c) => c.status === "active");

      if (!activeCycle) {
        return res.status(200).json({
          success: true,
          pendingPayments: [],
          message: "No active billing cycle",
        });
      }

      // Get all payments for this room — show submitted (awaiting host verification)
      const payments = await SupabaseService.getRoomPayments(roomId);
      const members = room.room_members || [];
      const pendingPayments = payments
        .filter((p) => p.status === "submitted")
        .map((p) => {
          const member = members.find((m) => m.user_id === p.paid_by);
          return {
            ...p,
            // Camelcase aliases so the mobile frontend can read them
            billType: p.bill_type,
            memberId: p.paid_by,
            memberName: member?.name || "Unknown",
            cycleId: activeCycle.id,
            dueDate: activeCycle.end_date,
          };
        });

      res.status(200).json({
        success: true,
        pendingPayments,
        cycleId: activeCycle.id,
        cycleStart: activeCycle.start_date,
        cycleEnd: activeCycle.end_date,
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// 10. VERIFY/CONFIRM A PAYMENT (admin/host)
// ============================================================
router.post(
  "/admin/verify/:paymentId",
  isAuthenticated,
  isAdminOrHost,
  async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const { status } = req.body;

      const paymentStatus = status || "completed";

      const updatedPayment = await SupabaseService.update(
        "payments",
        paymentId,
        {
          status: paymentStatus,
          verified_by: req.user.id,
          verified_at: new Date().toISOString(),
        },
      );

      // Auto-close cycle if all payors have now been verified
      const payment = await SupabaseService.findPaymentById(paymentId);
      if (paymentStatus === "completed" && payment?.room_id) {
        await checkAndAutoCloseCycle(payment.room_id).catch(() => {});
      }

      // Notify the payer
      if (payment?.paid_by) {
        await sendPaymentStatusNotification({
          userId: payment.paid_by,
          status: paymentStatus,
          billType: payment.bill_type,
          amount: payment.amount,
          note: req.body.note || null,
          verifierName: req.user.name,
        });
      }

      res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        payment: updatedPayment,
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// 11. REJECT A PAYMENT (admin/host)
// ============================================================
router.post(
  "/admin/reject/:paymentId",
  isAuthenticated,
  isAdminOrHost,
  async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;

      const rejectedPayment = await SupabaseService.findPaymentById(paymentId);

      const updatedPayment = await SupabaseService.update(
        "payments",
        paymentId,
        {
          status: "rejected",
          rejection_reason: reason,
          rejected_by: req.user.id,
          rejected_at: new Date().toISOString(),
        },
      );

      // Notify the payer
      if (rejectedPayment?.paid_by) {
        await sendPaymentStatusNotification({
          userId: rejectedPayment.paid_by,
          status: "rejected",
          billType: rejectedPayment.bill_type,
          amount: rejectedPayment.amount,
          reason: reason || null,
          verifierName: req.user.name,
        });
      }

      res.status(200).json({
        success: true,
        message: "Payment rejected",
        payment: updatedPayment,
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

module.exports = router;
