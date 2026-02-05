// Admin Billing Reports Controller
const express = require("express");
const router = express.Router();
const BillingCycle = require("../model/billingCycle");
const Room = require("../model/room");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

// Get detailed billing breakdown for a cycle (admin only)
router.get(
  "/breakdown/:cycleId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { cycleId } = req.params;

      const cycle = await BillingCycle.findById(cycleId).populate("room");
      if (!cycle) {
        return next(new ErrorHandler("Billing cycle not found", 404));
      }

      const room = await Room.findById(cycle.room._id).populate("members.user");

      // Get payments for this cycle - query by billingCycleId to avoid matching old payments
      const PaymentTransaction = require("../model/paymentTransaction");

      // Get ALL completed payments for THIS specific cycle only
      let paymentsForCycle = await PaymentTransaction.find({
        billingCycleId: cycle._id,
        status: "completed",
      });

      console.log(
        `[Breakdown] Cycle ${cycle._id}:`,
        `Date range: ${new Date(cycle.startDate).toISOString()} to ${new Date(cycle.endDate).toISOString()}`,
        `Found ${paymentsForCycle.length} total completed payments:`,
        paymentsForCycle.map((p) => ({
          payer: p.payer,
          billType: p.billType,
          transactionDate: p.transactionDate.toISOString(),
        })),
      );

      const payerCount = room.members.filter((m) => m.isPayer).length;
      const nonPayerCount = room.members.length - payerCount;

      const breakdown = {
        cycleNumber: cycle.cycleNumber,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        status: cycle.status,
        roomName: cycle.room.name,
        roomCode: cycle.room.code,
        totalBilled: cycle.totalBilledAmount,
        billBreakdown: {
          rent: {
            total: cycle.rent,
            perPayer: Number((cycle.rent / payerCount).toFixed(2)),
            totalPayers: payerCount,
          },
          electricity: {
            total: cycle.electricity,
            perPayer: Number((cycle.electricity / payerCount).toFixed(2)),
            totalPayers: payerCount,
          },
          water: {
            total: cycle.waterBillAmount,
            perPayerDirect: 0, // Will be calculated from memberCharges
            nonPayorWaterShare: 0,
          },
          internet: {
            total: cycle.internet || 0,
            perPayer: Number(((cycle.internet || 0) / payerCount).toFixed(2)),
            totalPayers: payerCount,
          },
        },
        memberBreakdown: cycle.memberCharges
          .filter((charge) => charge.isPayer) // Only include payers for adjustment
          .map((charge) => {
            const member = room.members.find(
              (m) => m.user._id.toString() === charge.userId,
            );

            // Calculate water breakdown
            const WATER_BILL_PER_DAY = 5;
            const ownWaterAmount = Number(
              (charge.presenceDays * WATER_BILL_PER_DAY).toFixed(2),
            );
            const waterShare = Number(charge.waterBillShare.toFixed(2));
            const sharedNonPayorWater = Number(
              (waterShare - ownWaterAmount).toFixed(2),
            );

            // Find payments for this member
            const memberPayments = paymentsForCycle.filter(
              (p) => p.payer.toString() === String(charge.userId),
            );

            // Determine payment status based on actual payments
            const rentPayment = memberPayments.find(
              (p) => p.billType === "rent",
            );
            const electricityPayment = memberPayments.find(
              (p) => p.billType === "electricity",
            );
            const waterPayment = memberPayments.find(
              (p) => p.billType === "water",
            );
            const internetPayment = memberPayments.find(
              (p) => p.billType === "internet",
            );
            const totalPayment = memberPayments.find(
              (p) => p.billType === "total",
            );

            // If there's a "total" payment, all utilities are considered paid
            const isTotalPaid = !!totalPayment;

            const result = {
              userId: charge.userId,
              memberName: charge.name,
              isPayer: charge.isPayer,
              presenceDays: charge.presenceDays,
              rentShare: Number(charge.rentShare.toFixed(2)),
              electricityShare: Number(charge.electricityShare.toFixed(2)),
              waterShare: waterShare,
              internetShare: Number(charge.internetShare.toFixed(2)),
              ownWaterAmount: ownWaterAmount,
              sharedNonPayorWater: sharedNonPayorWater,
              waterShareNote: `Own consumption: ₱${ownWaterAmount} + Non-payer share: ₱${sharedNonPayorWater}`,
              totalDue: Number(charge.totalDue.toFixed(2)),
              // Payment status for this cycle
              rentStatus: rentPayment || isTotalPaid ? "paid" : "pending",
              electricityStatus:
                electricityPayment || isTotalPaid ? "paid" : "pending",
              waterStatus: waterPayment || isTotalPaid ? "paid" : "pending",
              internetStatus:
                internetPayment || isTotalPaid ? "paid" : "pending",
              allPaid:
                !!totalPayment ||
                (!!rentPayment &&
                  !!electricityPayment &&
                  !!waterPayment &&
                  !!internetPayment),
            };

            return result;
          }),
        summary: {
          totalRentCharged: Number((cycle.rent || 0).toFixed(2)),
          totalElectricityCharged: Number((cycle.electricity || 0).toFixed(2)),
          totalWaterCharged: Number((cycle.waterBillAmount || 0).toFixed(2)),
          totalInternetCharged: Number(cycle.internet.toFixed(2)),
          payerCount,
          nonPayerCount,
          totalMembers: room.members.length,
        },
      };

      res.status(200).json({
        success: true,
        breakdown,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get collection status for billing cycle (admin only)
router.get(
  "/collection-status/:cycleId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { cycleId } = req.params;

      const cycle = await BillingCycle.findById(cycleId).populate("room");
      if (!cycle) {
        return next(new ErrorHandler("Billing cycle not found", 404));
      }

      const room = await Room.findById(cycle.room._id).populate("members.user");

      // Get payment records for this cycle - query by billingCycleId to avoid matching old payments
      const PaymentTransaction = require("../model/paymentTransaction");
      let paymentsForCycle = await PaymentTransaction.find({
        billingCycleId: cycle._id,
        status: "completed",
      });

      // Get collection status for this cycle
      const memberStatus = cycle.memberCharges
        .filter((charge) => charge.isPayer) // Only include payers
        .map((charge) => {
          const member = room.members.find(
            (m) => m.user._id.toString() === charge.userId,
          );

          // Find payments for this member in this cycle
          const memberPayments = paymentsForCycle.filter(
            (p) => p.payer.toString() === String(charge.userId),
          );

          // Determine payment status based on actual payments
          const rentPayment = memberPayments.find((p) => p.billType === "rent");
          const electricityPayment = memberPayments.find(
            (p) => p.billType === "electricity",
          );
          const waterPayment = memberPayments.find(
            (p) => p.billType === "water",
          );
          const internetPayment = memberPayments.find(
            (p) => p.billType === "internet",
          );
          const totalPayment = memberPayments.find(
            (p) => p.billType === "total",
          );

          // If there's a "total" payment, all utilities are considered paid
          const isTotalPaid = !!totalPayment;

          return {
            userId: charge.userId,
            memberName: charge.name,
            isPayer: charge.isPayer,
            totalDue: Number(charge.totalDue.toFixed(2)),
            rentStatus: rentPayment || isTotalPaid ? "paid" : "pending",
            electricityStatus:
              electricityPayment || isTotalPaid ? "paid" : "pending",
            waterStatus: waterPayment || isTotalPaid ? "paid" : "pending",
            internetStatus: internetPayment || isTotalPaid ? "paid" : "pending",
            rentAmount: Number(charge.rentShare.toFixed(2)),
            electricityAmount: Number(charge.electricityShare.toFixed(2)),
            waterAmount: Number(charge.waterBillShare.toFixed(2)),
            internetAmount: Number(charge.internetShare.toFixed(2)),
            allPaid:
              !!totalPayment ||
              (!!rentPayment &&
                !!electricityPayment &&
                !!waterPayment &&
                !!internetPayment),
            rentPaidDate:
              totalPayment?.transactionDate ||
              rentPayment?.transactionDate ||
              null,
            electricityPaidDate:
              totalPayment?.transactionDate ||
              electricityPayment?.transactionDate ||
              null,
            waterPaidDate:
              totalPayment?.transactionDate ||
              waterPayment?.transactionDate ||
              null,
            internetPaidDate:
              totalPayment?.transactionDate ||
              internetPayment?.transactionDate ||
              null,
          };
        });

      // Calculate summary
      const totalDue = cycle.totalBilledAmount;
      const totalPaid = memberStatus
        .filter((m) => m.isPayer) // Only count payers
        .filter((m) => m.allPaid)
        .reduce((sum, m) => sum + m.totalDue, 0);
      const totalPending = totalDue - totalPaid;
      const fullyPaidMembers = memberStatus.filter((m) => m.allPaid).length;

      const collectionPercentage =
        totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

      res.status(200).json({
        success: true,
        cycleId: cycle._id,
        cycleNumber: cycle.cycleNumber,
        cycleStart: cycle.startDate,
        cycleEnd: cycle.endDate,
        status: cycle.status,
        memberStatus,
        summary: {
          totalDue: Number(totalDue.toFixed(2)),
          totalPaid: Number(totalPaid.toFixed(2)),
          totalPending: Number(totalPending.toFixed(2)),
          collectionPercentage,
          fullyPaidMembers,
          totalMembers: memberStatus.length,
          payingMembers: memberStatus.filter((m) => m.isPayer).length,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get export data for billing cycle (admin only)
router.get(
  "/export/:cycleId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { cycleId } = req.params;

      const cycle = await BillingCycle.findById(cycleId).populate("room");
      if (!cycle) {
        return next(new ErrorHandler("Billing cycle not found", 404));
      }

      const room = await Room.findById(cycle.room._id).populate("members.user");

      // Prepare export data
      const exportData = {
        roomName: cycle.room.name,
        roomCode: cycle.room.code,
        cycleNumber: cycle.cycleNumber,
        billingPeriod: `${new Date(cycle.startDate).toLocaleDateString()} - ${new Date(cycle.endDate).toLocaleDateString()}`,
        generatedDate: new Date().toLocaleDateString(),
        summary: {
          totalBilled: Number(cycle.totalBilledAmount.toFixed(2)),
          rent: Number(cycle.rent.toFixed(2)),
          electricity: Number(cycle.electricity.toFixed(2)),
          water: Number(cycle.waterBillAmount.toFixed(2)),
          status: cycle.status,
        },
        memberCharges: cycle.memberCharges.map((charge) => ({
          memberName: charge.name,
          isPayer: charge.isPayer,
          presenceDays: charge.presenceDays,
          rentShare: Number(charge.rentShare.toFixed(2)),
          electricityShare: Number(charge.electricityShare.toFixed(2)),
          waterShare: Number(charge.waterBillShare.toFixed(2)),
          totalDue: Number(charge.totalDue.toFixed(2)),
        })),
        paymentStatus: room.memberPayments.map((mp) => ({
          memberName: mp.memberName,
          rentStatus: mp.rentStatus,
          electricityStatus: mp.electricityStatus,
          waterStatus: mp.waterStatus,
          rentPaidDate: mp.rentPaidDate
            ? new Date(mp.rentPaidDate).toLocaleDateString()
            : "Not Paid",
          electricityPaidDate: mp.electricityPaidDate
            ? new Date(mp.electricityPaidDate).toLocaleDateString()
            : "Not Paid",
          waterPaidDate: mp.waterPaidDate
            ? new Date(mp.waterPaidDate).toLocaleDateString()
            : "Not Paid",
        })),
      };

      res.status(200).json({
        success: true,
        exportData,
        fileName: `billing-cycle-${cycle.cycleNumber}-${new Date().getTime()}.json`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Adjust member charge (admin only)
router.put(
  "/adjust-charge/:cycleId/:chargeId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { cycleId, chargeId } = req.params;
      const { rentAdjustment, electricityAdjustment, waterAdjustment, reason } =
        req.body;

      if (!reason) {
        return next(new ErrorHandler("Adjustment reason is required", 400));
      }

      const cycle = await BillingCycle.findById(cycleId);
      if (!cycle) {
        return next(new ErrorHandler("Billing cycle not found", 404));
      }

      const charge = cycle.memberCharges.id(chargeId);
      if (!charge) {
        return next(new ErrorHandler("Member charge not found", 404));
      }

      const originalTotal = charge.totalDue;

      // Apply adjustments
      if (rentAdjustment)
        charge.rentShare = Number(
          Math.max(0, charge.rentShare + rentAdjustment).toFixed(2),
        );
      if (electricityAdjustment)
        charge.electricityShare = Number(
          Math.max(0, charge.electricityShare + electricityAdjustment).toFixed(
            2,
          ),
        );
      if (waterAdjustment)
        charge.waterBillShare = Number(
          Math.max(0, charge.waterBillShare + waterAdjustment).toFixed(2),
        );

      charge.totalDue = Number(
        (
          charge.rentShare +
          charge.electricityShare +
          charge.waterBillShare
        ).toFixed(2),
      );

      // Record adjustment
      if (!cycle.adjustments) {
        cycle.adjustments = [];
      }

      cycle.adjustments.push({
        chargeId,
        memberName: charge.name,
        originalAmount: originalTotal,
        newAmount: charge.totalDue,
        rentAdjustment: rentAdjustment || 0,
        electricityAdjustment: electricityAdjustment || 0,
        waterAdjustment: waterAdjustment || 0,
        reason,
        adjustedAt: new Date(),
        adjustedBy: req.user._id,
      });

      // Update total billed amount
      const newTotalBilled = cycle.memberCharges.reduce(
        (sum, c) => sum + c.totalDue,
        0,
      );
      cycle.totalBilledAmount = Number(newTotalBilled.toFixed(2));

      await cycle.save();

      res.status(200).json({
        success: true,
        message: "Charge adjusted successfully",
        adjustedCharge: charge,
        newTotalBilled: cycle.totalBilledAmount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Process refund for member (admin only)
router.post(
  "/refund/:cycleId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { cycleId } = req.params;
      const { memberId, amount, billType, reason } = req.body;

      if (!memberId || !amount || !billType || !reason) {
        return next(
          new ErrorHandler(
            "memberId, amount, billType, and reason are required",
            400,
          ),
        );
      }

      const cycle = await BillingCycle.findById(cycleId).populate("room");
      if (!cycle) {
        return next(new ErrorHandler("Billing cycle not found", 404));
      }

      const room = await Room.findById(cycle.room._id);

      // Record refund
      if (!cycle.refunds) {
        cycle.refunds = [];
      }

      const charge = cycle.memberCharges.find((c) => c.userId === memberId);

      cycle.refunds.push({
        memberId,
        memberName: charge?.name || "Unknown",
        billType,
        amount: Number(amount.toFixed(2)),
        reason,
        refundedAt: new Date(),
        refundedBy: req.user._id,
        status: "completed",
      });

      // Adjust total billed amount if refund was for pending payment
      if (charge) {
        const oldTotal = cycle.totalBilledAmount;
        cycle.totalBilledAmount = Number(
          (cycle.totalBilledAmount - amount).toFixed(2),
        );

        await cycle.save();

        res.status(200).json({
          success: true,
          message: "Refund processed successfully",
          refund: cycle.refunds[cycle.refunds.length - 1],
          previousTotal: Number(oldTotal.toFixed(2)),
          newTotal: cycle.totalBilledAmount,
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Member not found in this cycle",
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Add note to billing cycle (admin only)
router.post(
  "/add-note/:cycleId/:memberId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { cycleId, memberId } = req.params;
      const { note, billType } = req.body;

      if (!note) {
        return next(new ErrorHandler("Note is required", 400));
      }

      const cycle = await BillingCycle.findById(cycleId);
      if (!cycle) {
        return next(new ErrorHandler("Billing cycle not found", 404));
      }

      if (!cycle.notes) {
        cycle.notes = [];
      }

      cycle.notes.push({
        memberId,
        billType: billType || "general",
        text: note,
        addedAt: new Date(),
        addedBy: req.user._id,
      });

      await cycle.save();

      res.status(200).json({
        success: true,
        message: "Note added successfully",
        notes: cycle.notes.filter((n) => n.memberId === memberId),
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get payment statistics (collected, pending, collection rate)
router.get(
  "/payment-stats",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const PaymentTransaction = require("../model/paymentTransaction");
      const Payment = require("../model/payment");
      const BillingCycle = require("../model/billingCycle");

      // Get all admin's rooms (use createdBy, not owner)
      const Room = require("../model/room");
      const adminRooms = await Room.find({ createdBy: req.user._id });
      const roomIds = adminRooms.map((r) => r._id);

      // Get total billed amount from all active billing cycles
      const activeCycles = await BillingCycle.find({
        room: { $in: roomIds },
        status: "active",
      });

      const totalBilled = activeCycles.reduce(
        (sum, cycle) => sum + (cycle.totalBilledAmount || 0),
        0,
      );

      // Get cycle IDs for ACTIVE cycles only
      const activeCycleIds = activeCycles.map((c) => c._id);

      // Get all completed payments from PaymentTransaction collection for ACTIVE cycles only
      // Query by cycleId to ensure we only get payments for the specific cycle
      const completedPaymentsTransaction = await PaymentTransaction.find({
        billingCycleId: { $in: activeCycleIds },
        status: "completed",
      });

      // Sum collected from PaymentTransaction
      const collectedFromTransaction = completedPaymentsTransaction.reduce(
        (sum, p) => sum + (p.amount || 0),
        0,
      );

      // Get all completed payments from old Payment collection for ACTIVE cycles only
      const completedPaymentsOld = await Payment.find({
        room: { $in: roomIds },
        billingCycleId: { $in: activeCycleIds },
        $or: [
          { paymentStatus: "completed" },
          { paymentStatus: "confirmed" },
          { status: "completed" },
        ],
      });

      // Sum collected from Payment
      const collectedFromOld = completedPaymentsOld.reduce(
        (sum, p) => sum + (p.amount || 0),
        0,
      );

      // Total collected from both sources
      const totalCollected = collectedFromTransaction + collectedFromOld;

      // Pending = Total Billed - Total Collected
      const totalPending = Math.max(0, totalBilled - totalCollected);

      // Calculate collection rate
      const collectionRate =
        totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

      console.log(
        `[PAYMENT-STATS] Billed: ₱${totalBilled}, Collected: ₱${totalCollected}, Pending: ₱${totalPending}, Rate: ${collectionRate}%`,
      );

      res.status(200).json({
        success: true,
        data: {
          totalCollected: Number(totalCollected.toFixed(2)),
          totalPending: Number(totalPending.toFixed(2)),
          collectionRate: collectionRate,
          totalBilled: Number(totalBilled.toFixed(2)),
        },
      });
    } catch (error) {
      console.error("[Payment Stats Error]", error);
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

module.exports = router;
