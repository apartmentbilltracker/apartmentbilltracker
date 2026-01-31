// Payment and Settlement Controller
const express = require("express");
const router = express.Router();
const Payment = require("../model/payment");
const Settlement = require("../model/settlement");
const Room = require("../model/room");
const User = require("../model/user");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");

// 1. Mark bill as paid
router.post(
  "/mark-bill-paid",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
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

      const room = await Room.findById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Update member payment status
      const memberPayment = room.memberPayments.find(
        (mp) => mp.member.toString() === memberId,
      );

      if (memberPayment) {
        if (billType === "rent") {
          memberPayment.rentStatus = "paid";
          memberPayment.rentPaidDate = new Date();
        } else if (billType === "electricity") {
          memberPayment.electricityStatus = "paid";
          memberPayment.electricityPaidDate = new Date();
        } else if (billType === "water") {
          memberPayment.waterStatus = "paid";
          memberPayment.waterPaidDate = new Date();
        }
      }

      // Record payment
      const payment = new Payment({
        room: roomId,
        paidBy: memberId,
        amount,
        billingCycleStart: room.billing.start,
        billingCycleEnd: room.billing.end,
        billType,
        paymentMethod: paymentMethod || "cash",
        reference,
      });

      await payment.save();
      await room.save();

      res.status(200).json({
        success: true,
        message: "Bill marked as paid successfully",
        payment,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 2. Get payment history for a room
router.get(
  "/payment-history/:roomId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;

      const payments = await Payment.find({ room: roomId })
        .populate("paidBy", "name email")
        .populate("room", "name")
        .sort({ paymentDate: -1 });

      res.status(200).json({
        success: true,
        payments,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 3. Get payment history for a specific member
router.get(
  "/member-payment-history/:roomId/:memberId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, memberId } = req.params;

      const payments = await Payment.find({
        room: roomId,
        paidBy: memberId,
      })
        .populate("paidBy", "name email")
        .populate("room", "name")
        .sort({ paymentDate: -1 });

      res.status(200).json({
        success: true,
        payments,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 4. Calculate settlements (who owes whom)
router.post(
  "/calculate-settlements",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.body;

      if (!roomId) {
        return next(new ErrorHandler("Room ID is required", 400));
      }

      const room = await Room.findById(roomId).populate("members.user");
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const settlements = [];
      const payers = room.members.filter((m) => m.isPayer);
      const nonPayers = room.members.filter((m) => !m.isPayer);

      // Calculate total bills
      const totalRent = room.billing.rent || 0;
      const totalElectricity = room.billing.electricity || 0;
      const totalWater = nonPayers.length * 5; // ₱5 per person per day

      // Calculate per-person share for payers
      const payerCount = payers.length;

      // Each payer covers their share
      const perPayerShare = {
        rent: totalRent / payerCount,
        electricity: totalElectricity / payerCount,
      };

      // Non-payers owe payers for their share
      for (const nonPayer of nonPayers) {
        for (const payer of payers) {
          const memberPayment = room.memberPayments.find(
            (mp) => mp.member.toString() === nonPayer.user._id.toString(),
          );

          let amountOwed = 0;

          // Calculate based on presence days
          if (memberPayment) {
            // Non-payer's water bill
            amountOwed += memberPayment.waterStatus === "pending" ? 5 : 0;
          }

          if (amountOwed > 0) {
            settlements.push({
              debtor: nonPayer.user,
              debtorName: nonPayer.name,
              creditor: payer.user,
              creditorName: payer.name,
              amount: amountOwed,
              billType: "water",
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
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 5. Record settlement
router.post(
  "/record-settlement",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
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

      const settlement = new Settlement({
        room: roomId,
        debtor: debtorId,
        creditor: creditorId,
        amount,
        settlementAmount,
        status:
          settlementAmount >= amount
            ? "settled"
            : settlementAmount > 0
              ? "partial"
              : "pending",
        settlementDate: settlementAmount > 0 ? new Date() : null,
        notes,
      });

      await settlement.save();

      res.status(200).json({
        success: true,
        message: "Settlement recorded successfully",
        settlement,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 6. Get settlements for a room
router.get(
  "/settlements/:roomId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const { status } = req.query; // Filter by status: pending, settled, partial

      let query = { room: roomId };
      if (status) {
        query.status = status;
      }

      const settlements = await Settlement.find(query)
        .populate("debtor", "name email")
        .populate("creditor", "name email")
        .populate("room", "name")
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        settlements,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 7. Get member's debts
router.get(
  "/member-debts/:roomId/:memberId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, memberId } = req.params;

      const debts = await Settlement.find({
        room: roomId,
        debtor: memberId,
        status: { $in: ["pending", "partial"] },
      })
        .populate("debtor", "name email")
        .populate("creditor", "name email")
        .sort({ createdAt: -1 });

      const totalDebt = debts.reduce(
        (sum, s) => sum + (s.amount - s.settlementAmount),
        0,
      );

      res.status(200).json({
        success: true,
        debts,
        totalDebt,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 8. Get member's credits (who owes them)
router.get(
  "/member-credits/:roomId/:memberId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, memberId } = req.params;

      const credits = await Settlement.find({
        room: roomId,
        creditor: memberId,
        status: { $in: ["pending", "partial"] },
      })
        .populate("debtor", "name email")
        .populate("creditor", "name email")
        .sort({ createdAt: -1 });

      const totalCredit = credits.reduce(
        (sum, s) => sum + (s.amount - s.settlementAmount),
        0,
      );

      res.status(200).json({
        success: true,
        credits,
        totalCredit,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

module.exports = router;
