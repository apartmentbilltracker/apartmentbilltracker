// Admin Financial Dashboard Controller
const express = require("express");
const router = express.Router();
const BillingCycle = require("../model/billingCycle");
const Room = require("../model/room");
const Payment = require("../model/payment");
const User = require("../model/user");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

// Get financial dashboard summary for a room (admin only)
router.get(
  "/dashboard/:roomId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;

      const room = await Room.findById(roomId).populate("billingCycles");
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Get active cycle
      const activeCycle = room.billingCycles.find((c) => c.status === "active");

      // Calculate total billing amounts from ACTIVE cycle only (not all cycles)
      // This ensures fresh data per cycle without mixing old closed cycles
      const totalBilled = activeCycle?.totalBilledAmount || 0;

      // Calculate payment status for active cycle
      let rentCollected = 0,
        electricityCollected = 0,
        waterCollected = 0,
        internetCollected = 0;
      let rentPending = 0,
        electricityPending = 0,
        waterPending = 0,
        internetPending = 0;

      if (activeCycle) {
        const payerCount = room.members.filter((m) => m.isPayer).length;

        // Get payments for active cycle - query by cycleId to avoid mixing old payments
        const PaymentTransaction = require("../model/paymentTransaction");
        let paymentsForCycle = await PaymentTransaction.find({
          billingCycleId: activeCycle._id,
          status: "completed",
        });

        console.log(
          `Found ${paymentsForCycle.length} payments for cycle ${activeCycle._id}`,
        );

        // Process each member in the cycle
        activeCycle.memberCharges.forEach((charge) => {
          const member = room.members.find(
            (m) => m.user.toString() === charge.userId.toString(),
          );
          if (!member || !member.isPayer) return;

          const perPayerShare = activeCycle.rent / payerCount;
          const elecShare = activeCycle.electricity / payerCount;
          const internetShare = activeCycle.internet / payerCount || 0;
          const memberWaterShare = charge.waterBillShare || 0;

          // Find payments for this member
          const memberPayments = paymentsForCycle.filter(
            (p) => p.payer.toString() === String(charge.userId),
          );

          console.log(
            `Member ${charge.name} (${charge.userId}): ${memberPayments.length} payments`,
            memberPayments.map((p) => ({
              billType: p.billType,
              amount: p.amount,
            })),
          );

          const hasRentPayment = memberPayments.some(
            (p) => p.billType === "rent",
          );
          const hasElecPayment = memberPayments.some(
            (p) => p.billType === "electricity",
          );
          const hasWaterPayment = memberPayments.some(
            (p) => p.billType === "water",
          );
          const hasInternetPayment = memberPayments.some(
            (p) => p.billType === "internet",
          );
          const hasTotalPayment = memberPayments.some(
            (p) => p.billType === "total",
          );

          // Special handling for "total" payments: use actual amount instead of calculated shares
          if (hasTotalPayment) {
            const totalPaymentAmount = memberPayments
              .filter((p) => p.billType === "total")
              .reduce((sum, p) => sum + (p.amount || 0), 0);
            rentCollected +=
              totalPaymentAmount *
              (activeCycle.rent / activeCycle.totalBilledAmount);
            electricityCollected +=
              totalPaymentAmount *
              (activeCycle.electricity / activeCycle.totalBilledAmount);
            waterCollected +=
              totalPaymentAmount *
              (activeCycle.waterBillAmount / activeCycle.totalBilledAmount);
            internetCollected +=
              totalPaymentAmount *
              ((activeCycle.internet || 0) / activeCycle.totalBilledAmount);
          } else {
            // For individual bill payments, use calculated shares
            if (hasRentPayment) rentCollected += perPayerShare;
            else rentPending += perPayerShare;

            if (hasElecPayment) electricityCollected += elecShare;
            else electricityPending += elecShare;

            if (hasWaterPayment) waterCollected += memberWaterShare;
            else waterPending += memberWaterShare;

            if (hasInternetPayment) internetCollected += internetShare;
            else internetPending += internetShare;
          }

          // Add pending for unpaid bills
          if (!hasTotalPayment) {
            if (!hasRentPayment) rentPending += perPayerShare;
            if (!hasElecPayment) electricityPending += elecShare;
            if (!hasWaterPayment) waterPending += memberWaterShare;
            if (!hasInternetPayment) internetPending += internetShare;
          } else {
            // If paid with total, the remainder is pending
            const totalPaymentAmount = memberPayments
              .filter((p) => p.billType === "total")
              .reduce((sum, p) => sum + (p.amount || 0), 0);
            const memberTotalDue = charge.totalDue || 0;
            const memberPending = Math.max(
              0,
              memberTotalDue - totalPaymentAmount,
            );
            if (memberPending > 0) {
              rentPending +=
                memberPending *
                (activeCycle.rent / activeCycle.totalBilledAmount);
              electricityPending +=
                memberPending *
                (activeCycle.electricity / activeCycle.totalBilledAmount);
              waterPending +=
                memberPending *
                (activeCycle.waterBillAmount / activeCycle.totalBilledAmount);
              internetPending +=
                memberPending *
                ((activeCycle.internet || 0) / activeCycle.totalBilledAmount);
            }
          }
        });
      }

      // Use active cycle collected amount for the dashboard total
      const totalCollected =
        rentCollected +
        electricityCollected +
        waterCollected +
        internetCollected;

      const outstanding = activeCycle
        ? activeCycle.totalBilledAmount - totalCollected
        : 0;

      // Collection rate based on active cycle (not all cycles)
      const activeCycleBilled = activeCycle?.totalBilledAmount || 0;
      const collectionRate =
        activeCycleBilled > 0
          ? Math.round((totalCollected / activeCycleBilled) * 100)
          : 0;

      const payerCount = room.members.filter((m) => m.isPayer).length;
      const nonPayerCount = room.members.length - payerCount;

      res.status(200).json({
        success: true,
        dashboard: {
          roomName: room.name,
          roomCode: room.code,
          totalBilled: Number(totalBilled.toFixed(2)),
          totalCollected: Number(totalCollected.toFixed(2)),
          outstanding: Number(outstanding.toFixed(2)),
          collectionRate,
          payerCount,
          nonPayerCount,
          totalMembers: room.members.length,
          activeCycleId: activeCycle?._id,
          activeCycleStart: activeCycle?.startDate,
          activeCycleEnd: activeCycle?.endDate,
          activeCycleBilled: activeCycle?.totalBilledAmount || 0,
          paymentBreakdown: {
            rent: {
              expected: activeCycle?.rent || 0,
              collected: Number(rentCollected.toFixed(2)),
              pending: Number(rentPending.toFixed(2)),
            },
            electricity: {
              expected: activeCycle?.electricity || 0,
              collected: Number(electricityCollected.toFixed(2)),
              pending: Number(electricityPending.toFixed(2)),
            },
            water: {
              expected: activeCycle?.waterBillAmount || 0,
              collected: waterCollected,
              pending: waterPending,
            },
            internet: {
              expected: activeCycle?.internet || 0,
              collected: Number(internetCollected.toFixed(2)),
              pending: Number(internetPending.toFixed(2)),
            },
          },
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get financial trends (month-over-month) for a room (admin only)
router.get(
  "/trends/:roomId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;

      const room = await Room.findById(roomId).populate("billingCycles");
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const cycles = room.billingCycles || [];
      const trends = cycles
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
        .map((cycle) => ({
          cycleNumber: cycle.cycleNumber,
          startDate: cycle.startDate,
          endDate: cycle.endDate,
          totalBilled: cycle.totalBilledAmount,
          rent: cycle.rent,
          electricity: cycle.electricity,
          water: cycle.waterBillAmount,
          totalMembers: cycle.membersCount,
          status: cycle.status,
        }));

      res.status(200).json({
        success: true,
        trends,
        totalCycles: trends.length,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get member payment history (admin only)
router.get(
  "/member-history/:roomId/:memberId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, memberId } = req.params;

      const room = await Room.findById(roomId).populate("billingCycles");
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const user = await User.findById(memberId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const member = room.members.find((m) => m.user.toString() === memberId);
      if (!member) {
        return next(new ErrorHandler("Member not found in this room", 404));
      }

      // Get all payments for this member
      const payments = await Payment.find({
        room: roomId,
        paidBy: memberId,
      }).sort({ paymentDate: -1 });

      // Calculate total paid by bill type
      const totalByType = {
        rent: payments
          .filter((p) => p.billType === "rent")
          .reduce((sum, p) => sum + p.amount, 0),
        electricity: payments
          .filter((p) => p.billType === "electricity")
          .reduce((sum, p) => sum + p.amount, 0),
        water: payments
          .filter((p) => p.billType === "water")
          .reduce((sum, p) => sum + p.amount, 0),
      };

      // Get current status from memberPayments
      const currentStatus = room.memberPayments.find(
        (mp) => mp.member.toString() === memberId,
      );

      res.status(200).json({
        success: true,
        memberInfo: {
          userId: memberId,
          memberName: member.name,
          userEmail: user.email,
          isPayer: member.isPayer,
          joinedAt: member.joinedAt,
        },
        paymentHistory: payments,
        paymentSummary: {
          totalPaid: Number(
            Object.values(totalByType)
              .reduce((a, b) => a + b, 0)
              .toFixed(2),
          ),
          byType: {
            rent: Number(totalByType.rent.toFixed(2)),
            electricity: Number(totalByType.electricity.toFixed(2)),
            water: Number(totalByType.water.toFixed(2)),
          },
        },
        currentPaymentStatus: {
          rentStatus: currentStatus?.rentStatus || "N/A",
          electricityStatus: currentStatus?.electricityStatus || "N/A",
          waterStatus: currentStatus?.waterStatus || "N/A",
          rentPaidDate: currentStatus?.rentPaidDate || null,
          electricityPaidDate: currentStatus?.electricityPaidDate || null,
          waterPaidDate: currentStatus?.waterPaidDate || null,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get collection status for active cycle (admin only)
router.get(
  "/collection-status/:roomId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;

      const room = await Room.findById(roomId)
        .populate("members.user")
        .populate("billingCycles");
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const activeCycle = room.billingCycles.find((c) => c.status === "active");
      if (!activeCycle) {
        return res.status(200).json({
          success: true,
          message: "No active billing cycle",
          memberStatus: [],
        });
      }

      const payerCount = room.members.filter((m) => m.isPayer).length;

      const memberStatus = room.memberPayments.map((mp) => {
        const member = room.members.find(
          (m) => m.user.toString() === mp.member.toString(),
        );

        const chargeData = activeCycle.memberCharges.find(
          (c) => c.userId === mp.member.toString(),
        );

        return {
          memberId: mp.member,
          memberName: mp.memberName,
          isPayer: member?.isPayer || false,
          rentStatus: mp.rentStatus,
          electricityStatus: mp.electricityStatus,
          waterStatus: mp.waterStatus,
          rentAmount: member?.isPayer ? activeCycle.rent / payerCount : 0,
          electricityAmount: member?.isPayer
            ? activeCycle.electricity / payerCount
            : 0,
          waterAmount: chargeData?.waterBillShare || 0,
          totalDue: chargeData?.totalDue || 0,
          allPaid:
            mp.rentStatus === "paid" &&
            mp.electricityStatus === "paid" &&
            mp.waterStatus === "paid",
          rentPaidDate: mp.rentPaidDate,
          electricityPaidDate: mp.electricityPaidDate,
          waterPaidDate: mp.waterPaidDate,
        };
      });

      // Calculate summary
      const totalDue = memberStatus.reduce((sum, m) => sum + m.totalDue, 0);
      const totalPaid = memberStatus
        .filter((m) => m.allPaid)
        .reduce((sum, m) => sum + m.totalDue, 0);
      const totalPending = totalDue - totalPaid;

      const collectionPercentage =
        totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

      res.status(200).json({
        success: true,
        cycleId: activeCycle._id,
        cycleStart: activeCycle.startDate,
        cycleEnd: activeCycle.endDate,
        memberStatus,
        summary: {
          totalDue: Number(totalDue.toFixed(2)),
          totalPaid: Number(totalPaid.toFixed(2)),
          totalPending: Number(totalPending.toFixed(2)),
          collectionPercentage,
          fullyPaidMembers: memberStatus.filter((m) => m.allPaid).length,
          totalMembers: memberStatus.length,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

module.exports = router;
