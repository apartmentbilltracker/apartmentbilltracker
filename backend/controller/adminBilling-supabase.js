// Admin Billing Reports Controller - Supabase
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const { enrichBillingCycle } = require("../utils/enrichBillingCycle");

// Helper: compute a fallback charge for a member when member_charges is empty
function computeFallbackCharge(member, billingCycle, payerCount) {
  if (!member.is_payer) {
    return {
      user_id: member.user_id,
      name: member.name,
      is_payer: false,
      presence_days: 0,
      rent_share: 0,
      electricity_share: 0,
      water_bill_share: 0,
      internet_share: 0,
      total_due: 0,
    };
  }
  const rent = parseFloat(billingCycle.rent || 0);
  const electricity = parseFloat(billingCycle.electricity || 0);
  const water = parseFloat(billingCycle.water_bill_amount || 0);
  const internet = parseFloat(billingCycle.internet || 0);
  const rentShare = payerCount > 0 ? rent / payerCount : 0;
  const electricityShare = payerCount > 0 ? electricity / payerCount : 0;
  const waterShare = payerCount > 0 ? water / payerCount : 0;
  const internetShare = payerCount > 0 ? internet / payerCount : 0;
  return {
    user_id: member.user_id,
    name: member.name,
    is_payer: true,
    presence_days: 0,
    rent_share: rentShare,
    electricity_share: electricityShare,
    water_bill_share: waterShare,
    internet_share: internetShare,
    total_due: rentShare + electricityShare + waterShare + internetShare,
  };
}

// Get detailed billing breakdown for a cycle (admin only)
router.get(
  "/breakdown/:cycleId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { cycleId } = req.params;

      const billingCycle = await SupabaseService.selectByColumn(
        "billing_cycles",
        "id",
        cycleId,
      );
      if (!billingCycle) {
        return next(new ErrorHandler("Billing cycle not found", 404));
      }

      const room = await SupabaseService.findRoomById(billingCycle.room_id);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Get room members (only approved)
      const members = await SupabaseService.getRoomMembers(
        billingCycle.room_id,
      );

      // Enrich billing cycle with presence-based water charges
      await enrichBillingCycle(billingCycle, members);

      // Get payments for this cycle
      const payments =
        (await SupabaseService.getPaymentsForCycle(
          billingCycle.room_id,
          billingCycle.start_date,
          billingCycle.end_date,
        )) || [];

      const completedPayments = payments.filter(
        (p) => p.status === "completed" || p.status === "verified",
      );

      const payerCount = members.filter((m) => m.is_payer).length;
      const nonPayerCount = members.length - payerCount;

      const breakdown = {
        cycleNumber: billingCycle.cycle_number,
        startDate: billingCycle.start_date,
        endDate: billingCycle.end_date,
        status: billingCycle.status,
        roomName: room.name,
        roomCode: room.code,
        totalBilled: billingCycle.total_billed_amount,
        billBreakdown: {
          rent: {
            total: billingCycle.rent,
            perPayer:
              payerCount > 0
                ? Number((billingCycle.rent / payerCount).toFixed(2))
                : 0,
            totalPayers: payerCount,
          },
          electricity: {
            total: billingCycle.electricity,
            perPayer:
              payerCount > 0
                ? Number((billingCycle.electricity / payerCount).toFixed(2))
                : 0,
            totalPayers: payerCount,
          },
          water: {
            total: billingCycle.water_bill_amount,
            perPayerDirect: 0,
            nonPayorWaterShare: 0,
          },
          internet: {
            total: billingCycle.internet || 0,
            perPayer:
              payerCount > 0
                ? Number(((billingCycle.internet || 0) / payerCount).toFixed(2))
                : 0,
            totalPayers: payerCount,
          },
        },
        memberBreakdown: members.map((member) => {
          const hasCharges =
            billingCycle.member_charges &&
            billingCycle.member_charges.length > 0;
          const charge = hasCharges
            ? billingCycle.member_charges.find(
                (c) => c.user_id === member.user_id,
              ) || {}
            : computeFallbackCharge(member, billingCycle, payerCount);

          const WATER_BILL_PER_DAY = 5;
          const ownWaterAmount = Number(
            (
              charge.water_own ??
              (charge.presence_days || 0) * WATER_BILL_PER_DAY
            ).toFixed(2),
          );
          const waterShare = Number((charge.water_bill_share || 0).toFixed(2));
          const sharedNonPayorWater = Number(
            (
              charge.water_shared_nonpayor ?? waterShare - ownWaterAmount
            ).toFixed(2),
          );

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

          const isTotalPaid = !!totalPayment;

          return {
            userId: member.user_id,
            memberName: charge.name || member.name,
            isPayer: member.is_payer,
            presenceDays: charge.presence_days || 0,
            rentShare: Number((charge.rent_share || 0).toFixed(2)),
            electricityShare: Number(
              (charge.electricity_share || 0).toFixed(2),
            ),
            waterShare: waterShare,
            internetShare: Number((charge.internet_share || 0).toFixed(2)),
            ownWaterAmount: ownWaterAmount,
            sharedNonPayorWater: sharedNonPayorWater,
            waterShareNote: `Own consumption: ₱${ownWaterAmount} + Non-payer share: ₱${sharedNonPayorWater}`,
            totalDue: Number((charge.total_due || 0).toFixed(2)),
            rentStatus: rentPayment || isTotalPaid ? "paid" : "pending",
            electricityStatus:
              electricityPayment || isTotalPaid ? "paid" : "pending",
            waterStatus: waterPayment || isTotalPaid ? "paid" : "pending",
            internetStatus: internetPayment || isTotalPaid ? "paid" : "pending",
            allPaid:
              !!totalPayment ||
              (!!rentPayment &&
                !!electricityPayment &&
                !!waterPayment &&
                !!internetPayment),
          };
        }),
        summary: {
          totalRentCharged: Number((billingCycle.rent || 0).toFixed(2)),
          totalElectricityCharged: Number(
            (billingCycle.electricity || 0).toFixed(2),
          ),
          totalWaterCharged: Number(
            (billingCycle.water_bill_amount || 0).toFixed(2),
          ),
          totalInternetCharged: Number((billingCycle.internet || 0).toFixed(2)),
          payerCount,
          nonPayerCount,
          totalMembers: members.length,
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

      const cycle = await SupabaseService.selectByColumn(
        "billing_cycles",
        "id",
        cycleId,
      );
      if (!cycle) {
        return next(new ErrorHandler("Billing cycle not found", 404));
      }

      const billingCycle = cycle;
      const room = await SupabaseService.findRoomById(billingCycle.room_id);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const members = await SupabaseService.getRoomMembers(
        billingCycle.room_id,
      );

      // Enrich billing cycle with presence-based water charges
      await enrichBillingCycle(billingCycle, members);

      const payments =
        (await SupabaseService.getPaymentsForCycle(
          billingCycle.room_id,
          billingCycle.start_date,
          billingCycle.end_date,
        )) || [];

      const completedPayments = payments.filter(
        (p) => p.status === "completed" || p.status === "verified",
      );

      const memberStatus = members
        .filter((m) => m.is_payer)
        .map((member) => {
          const hasCharges =
            billingCycle.member_charges &&
            billingCycle.member_charges.length > 0;
          const charge = hasCharges
            ? billingCycle.member_charges.find(
                (c) => c.user_id === member.user_id,
              ) || {}
            : computeFallbackCharge(
                member,
                billingCycle,
                members.filter((m) => m.is_payer).length,
              );
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

          const isTotalPaid = !!totalPayment;

          return {
            userId: member.user_id,
            memberName: charge.name || member.name,
            isPayer: member.is_payer,
            totalDue: Number((charge.total_due || 0).toFixed(2)),
            rentStatus: rentPayment || isTotalPaid ? "paid" : "pending",
            electricityStatus:
              electricityPayment || isTotalPaid ? "paid" : "pending",
            waterStatus: waterPayment || isTotalPaid ? "paid" : "pending",
            internetStatus: internetPayment || isTotalPaid ? "paid" : "pending",
            rentAmount: Number((charge.rent_share || 0).toFixed(2)),
            electricityAmount: Number(
              (charge.electricity_share || 0).toFixed(2),
            ),
            waterAmount: Number((charge.water_bill_share || 0).toFixed(2)),
            internetAmount: Number((charge.internet_share || 0).toFixed(2)),
            allPaid:
              !!totalPayment ||
              (!!rentPayment &&
                !!electricityPayment &&
                !!waterPayment &&
                !!internetPayment),
            rentPaidDate:
              rentPayment?.created_at || totalPayment?.created_at || null,
            electricityPaidDate:
              electricityPayment?.created_at ||
              totalPayment?.created_at ||
              null,
            waterPaidDate:
              waterPayment?.created_at || totalPayment?.created_at || null,
            internetPaidDate:
              internetPayment?.created_at || totalPayment?.created_at || null,
          };
        });

      // Use the canonical total_billed_amount from the enriched cycle
      // instead of re-summing individually-rounded member totals
      const totalDue = billingCycle.total_billed_amount
        ? parseFloat(billingCycle.total_billed_amount)
        : memberStatus.reduce((sum, m) => sum + m.totalDue, 0);
      const totalPaid = memberStatus
        .filter((m) => m.allPaid)
        .reduce((sum, m) => sum + m.totalDue, 0);
      const totalPending = totalDue - totalPaid;
      const fullyPaidMembers = memberStatus.filter((m) => m.allPaid).length;

      const collectionPercentage =
        totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

      res.status(200).json({
        success: true,
        cycleId: billingCycle.id,
        cycleNumber: billingCycle.cycle_number,
        cycleStart: billingCycle.start_date,
        cycleEnd: billingCycle.end_date,
        status: billingCycle.status,
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

      const cycle = await SupabaseService.selectByColumn(
        "billing_cycles",
        "id",
        cycleId,
      );
      if (!cycle) {
        return next(new ErrorHandler("Billing cycle not found", 404));
      }

      const billingCycle = cycle;
      const room = await SupabaseService.findRoomById(billingCycle.room_id);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Enrich billing cycle with presence-based water charges
      await enrichBillingCycle(billingCycle);

      const exportData = {
        roomName: room.name,
        roomCode: room.code,
        cycleNumber: billingCycle.cycle_number,
        billingPeriod: `${new Date(billingCycle.start_date).toLocaleDateString()} - ${new Date(billingCycle.end_date).toLocaleDateString()}`,
        generatedDate: new Date().toLocaleDateString(),
        summary: {
          totalBilled: Number(billingCycle.total_billed_amount.toFixed(2)),
          rent: Number((billingCycle.rent || 0).toFixed(2)),
          electricity: Number((billingCycle.electricity || 0).toFixed(2)),
          water: Number((billingCycle.water_bill_amount || 0).toFixed(2)),
          status: billingCycle.status,
        },
        memberCharges: (billingCycle.member_charges || []).map((charge) => ({
          memberName: charge.name,
          isPayer: charge.is_payer,
          presenceDays: charge.presence_days,
          rentShare: Number((charge.rent_share || 0).toFixed(2)),
          electricityShare: Number((charge.electricity_share || 0).toFixed(2)),
          waterShare: Number((charge.water_bill_share || 0).toFixed(2)),
          totalDue: Number((charge.total_due || 0).toFixed(2)),
        })),
      };

      res.status(200).json({
        success: true,
        exportData,
        fileName: `billing-cycle-${billingCycle.cycle_number}-${new Date().getTime()}.json`,
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
      // Get all rooms created by admin
      const adminRooms =
        (await SupabaseService.selectAll("rooms", "created_by", req.user.id)) ||
        [];

      if (!adminRooms || adminRooms.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            totalCollected: 0,
            totalPending: 0,
            collectionRate: 0,
            totalBilled: 0,
          },
        });
      }

      const roomIds = adminRooms.map((r) => r.id);

      // Get all active billing cycles for these rooms
      const allCycles =
        await SupabaseService.selectAllRecords("billing_cycles");
      const activeCycles = allCycles.filter(
        (c) => roomIds.includes(c.room_id) && c.status === "active",
      );

      // Enrich active cycles with presence-based water charges
      for (const cycle of activeCycles) {
        await enrichBillingCycle(cycle);
      }

      const totalBilled = activeCycles.reduce((sum, cycle) => {
        const billed = cycle.total_billed_amount
          ? parseFloat(cycle.total_billed_amount)
          : parseFloat(cycle.rent || 0) +
            parseFloat(cycle.electricity || 0) +
            parseFloat(cycle.water_bill_amount || 0) +
            parseFloat(cycle.internet || 0);
        return sum + (billed || 0);
      }, 0);

      // Get completed payments for active cycles
      let completedPayments = [];
      for (const cycle of activeCycles) {
        const cyclePayments = await SupabaseService.getPaymentsForCycle(
          cycle.room_id,
          cycle.start_date,
          cycle.end_date,
        );
        completedPayments = completedPayments.concat(
          cyclePayments.filter(
            (p) => p.status === "completed" || p.status === "verified",
          ),
        );
      }

      const rawCollected = completedPayments.reduce(
        (sum, p) => sum + (parseFloat(p.amount) || 0),
        0,
      );
      // Cap collected at totalBilled to prevent rounding overshoot
      const totalCollected = Math.min(rawCollected, totalBilled);

      const totalPending = Math.max(0, totalBilled - totalCollected);
      const collectionRate =
        totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

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
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

module.exports = router;
