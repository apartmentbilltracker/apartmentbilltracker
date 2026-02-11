// Admin Financial Dashboard Controller - Supabase
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const { enrichBillingCycle } = require("../utils/enrichBillingCycle");

/** Round to 2 decimal places (cents) */
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// Get financial dashboard summary for a room (admin only)
router.get(
  "/dashboard/:roomId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Get all billing cycles for room
      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      const activeCycle = cycles.find((c) => c.status === "active");

      // Get room members
      const members = await SupabaseService.getRoomMembers(roomId);
      const payerCount = members.filter((m) => m.is_payer).length;
      const nonPayerCount = members.length - payerCount;

      // Enrich active cycle with presence-based water charges
      if (activeCycle) {
        await enrichBillingCycle(activeCycle, members);
      }

      const totalBilled =
        activeCycle?.total_billed_amount ||
        (activeCycle
          ? (parseFloat(activeCycle.rent) || 0) +
            (parseFloat(activeCycle.electricity) || 0) +
            (parseFloat(activeCycle.water_bill_amount) || 0) +
            (parseFloat(activeCycle.internet) || 0)
          : 0);

      let rentCollected = 0,
        electricityCollected = 0,
        waterCollected = 0,
        internetCollected = 0;
      let rentPending = 0,
        electricityPending = 0,
        waterPending = 0,
        internetPending = 0;

      if (activeCycle) {
        // Get payments for active cycle
        const payments =
          (await SupabaseService.getPaymentsForCycle(
            roomId,
            activeCycle.start_date,
            activeCycle.end_date,
          )) || [];
        const completedPayments = payments.filter(
          (p) => p.status === "completed",
        );

        // Process each member charge
        (activeCycle.member_charges || []).forEach((charge) => {
          const member = members.find((m) => m.user_id === charge.user_id);
          if (!member || !member.is_payer) return;

          const perPayerShare =
            payerCount > 0 ? r2(activeCycle.rent / payerCount) : 0;
          const elecShare =
            payerCount > 0 ? r2(activeCycle.electricity / payerCount) : 0;
          const internetShare =
            payerCount > 0 ? r2((activeCycle.internet || 0) / payerCount) : 0;
          const memberWaterShare = charge.water_bill_share || 0;

          const memberPayments = completedPayments.filter(
            (p) => p.paid_by === charge.user_id,
          );

          const hasRentPayment = memberPayments.some(
            (p) => p.bill_type === "rent",
          );
          const hasElecPayment = memberPayments.some(
            (p) => p.bill_type === "electricity",
          );
          const hasWaterPayment = memberPayments.some(
            (p) => p.bill_type === "water",
          );
          const hasInternetPayment = memberPayments.some(
            (p) => p.bill_type === "internet",
          );
          const hasTotalPayment = memberPayments.some(
            (p) => p.bill_type === "total",
          );

          if (hasTotalPayment) {
            const totalPaymentAmount = memberPayments
              .filter((p) => p.bill_type === "total")
              .reduce((sum, p) => sum + (p.amount || 0), 0);
            const cycleTotalBilled =
              activeCycle.total_billed_amount ||
              (parseFloat(activeCycle.rent) || 0) +
                (parseFloat(activeCycle.electricity) || 0) +
                (parseFloat(activeCycle.water_bill_amount) || 0) +
                (parseFloat(activeCycle.internet) || 0);
            const proportion =
              cycleTotalBilled > 0 ? totalPaymentAmount / cycleTotalBilled : 0;
            rentCollected += proportion * (activeCycle.rent || 0);
            electricityCollected += proportion * (activeCycle.electricity || 0);
            waterCollected += proportion * (activeCycle.water_bill_amount || 0);
            internetCollected += proportion * (activeCycle.internet || 0);
          } else {
            if (hasRentPayment) rentCollected += perPayerShare;
            else rentPending += perPayerShare;

            if (hasElecPayment) electricityCollected += elecShare;
            else electricityPending += elecShare;

            if (hasWaterPayment) waterCollected += memberWaterShare;
            else waterPending += memberWaterShare;

            if (hasInternetPayment) internetCollected += internetShare;
            else internetPending += internetShare;
          }
        });
      }

      const totalCollected =
        rentCollected +
        electricityCollected +
        waterCollected +
        internetCollected;
      const activeCycleBilled =
        activeCycle?.total_billed_amount ||
        (activeCycle
          ? (parseFloat(activeCycle.rent) || 0) +
            (parseFloat(activeCycle.electricity) || 0) +
            (parseFloat(activeCycle.water_bill_amount) || 0) +
            (parseFloat(activeCycle.internet) || 0)
          : 0);
      const outstanding = activeCycle ? activeCycleBilled - totalCollected : 0;
      const collectionRate =
        activeCycleBilled > 0
          ? Math.round((totalCollected / activeCycleBilled) * 100)
          : 0;

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
          totalMembers: members.length,
          activeCycleId: activeCycle?.id,
          activeCycleStart: activeCycle?.start_date,
          activeCycleEnd: activeCycle?.end_date,
          activeCycleBilled: activeCycleBilled,
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
              expected: activeCycle?.water_bill_amount || 0,
              collected: Number(waterCollected.toFixed(2)),
              pending: Number(waterPending.toFixed(2)),
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

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      const trends = cycles
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
        .map((cycle) => ({
          cycleNumber: cycle.cycle_number,
          startDate: cycle.start_date,
          endDate: cycle.end_date,
          totalBilled:
            cycle.total_billed_amount ||
            (parseFloat(cycle.rent) || 0) +
              (parseFloat(cycle.electricity) || 0) +
              (parseFloat(cycle.water_bill_amount) || 0) +
              (parseFloat(cycle.internet) || 0),
          rent: cycle.rent,
          electricity: cycle.electricity,
          water: cycle.water_bill_amount,
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

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const user = await SupabaseService.findUserById(memberId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const members = await SupabaseService.getRoomMembers(roomId);
      const member = members.find((m) => m.user_id === memberId);
      if (!member) {
        return next(new ErrorHandler("Member not found in this room", 404));
      }

      // Get all payments for this member
      const allPayments = await SupabaseService.getUserPayments(memberId);
      const memberPayments = allPayments.sort(
        (a, b) =>
          new Date(b.payment_date || b.created_at) -
          new Date(a.payment_date || a.created_at),
      );

      // Calculate total paid by bill type
      const totalByType = {
        rent: memberPayments
          .filter((p) => p.bill_type === "rent")
          .reduce((sum, p) => sum + (p.amount || 0), 0),
        electricity: memberPayments
          .filter((p) => p.bill_type === "electricity")
          .reduce((sum, p) => sum + (p.amount || 0), 0),
        water: memberPayments
          .filter((p) => p.bill_type === "water")
          .reduce((sum, p) => sum + (p.amount || 0), 0),
      };

      res.status(200).json({
        success: true,
        memberInfo: {
          userId: memberId,
          memberName: member.name,
          userEmail: user.email,
          isPayer: member.is_payer,
          joinedAt: member.joined_at,
        },
        paymentHistory: memberPayments,
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
          memberStatus: [],
        });
      }

      const members = await SupabaseService.getRoomMembers(roomId);
      const payerCount = members.filter((m) => m.is_payer).length;

      // Enrich active cycle with presence-based water charges
      await enrichBillingCycle(activeCycle, members);

      const memberStatus = members.map((member) => {
        const charge =
          activeCycle.member_charges?.find(
            (c) => c.user_id === member.user_id,
          ) || {};
        return {
          memberId: member.user_id,
          memberName: member.name,
          isPayer: member.is_payer,
          rentAmount:
            member.is_payer && payerCount > 0
              ? r2(activeCycle.rent / payerCount)
              : 0,
          electricityAmount:
            member.is_payer && payerCount > 0
              ? r2(activeCycle.electricity / payerCount)
              : 0,
          waterAmount: charge.water_bill_share || 0,
          totalDue: charge.total_due || 0,
          allPaid: charge.all_paid || false,
        };
      });

      const totalDue = memberStatus.reduce((sum, m) => sum + m.totalDue, 0);
      const totalPaid = memberStatus
        .filter((m) => m.allPaid)
        .reduce((sum, m) => sum + m.totalDue, 0);
      const totalPending = totalDue - totalPaid;
      const collectionPercentage =
        totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

      res.status(200).json({
        success: true,
        cycleId: activeCycle.id,
        cycleStart: activeCycle.start_date,
        cycleEnd: activeCycle.end_date,
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
