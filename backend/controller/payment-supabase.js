// Payment and Settlement Controller (Supabase Version)
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

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
    });

    res.status(200).json({
      success: true,
      message: "Bill marked as paid successfully",
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

      const payments = await SupabaseService.getRoomPayments(roomId);

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
// 9. ADMIN: GET ALL PENDING PAYMENTS FOR A ROOM
// ============================================================
router.get(
  "/admin/pending/:roomId",
  isAuthenticated,
  isAdmin,
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

      // Get all payments for this room
      const payments = await SupabaseService.getRoomPayments(roomId);
      const pendingPayments = payments
        .filter((p) => p.status === "pending")
        .map((p) => ({
          ...p,
          cycleId: activeCycle.id,
          dueDate: activeCycle.end_date,
        }));

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
// 10. ADMIN: VERIFY/CONFIRM A PAYMENT
// ============================================================
router.post(
  "/admin/verify/:paymentId",
  isAuthenticated,
  isAdmin,
  async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const { status } = req.body;

      if (!status) {
        return next(new ErrorHandler("Status is required", 400));
      }

      const updatedPayment = await SupabaseService.update(
        "payments",
        paymentId,
        { status },
      );

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
// 11. ADMIN: REJECT A PAYMENT
// ============================================================
router.post(
  "/admin/reject/:paymentId",
  isAuthenticated,
  isAdmin,
  async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;

      const updatedPayment = await SupabaseService.update(
        "payments",
        paymentId,
        { status: "rejected", rejection_reason: reason },
      );

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
