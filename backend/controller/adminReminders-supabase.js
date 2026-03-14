// Admin Reminders Controller - Supabase
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdminOrHost } = require("../middleware/auth");
const sendMail = require("../utils/sendMail");
const { sendPushNotification } = require("../utils/sendPushNotification");
const { enrichBillingCycle } = require("../utils/enrichBillingCycle");
const PaymentReminderContent = require("../utils/PaymentReminderContent");
const PresenceReminderContent = require("../utils/PresenceReminderContent");
const cache = require("../utils/MemoryCache");

// Get list of overdue payments
// Cached per-room for 5 minutes — invalidated by payment verification & cycle close
router.get(
  "/overdue/:roomId",
  isAuthenticated,
  isAdminOrHost,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const today = new Date();
      const cacheKey = `overdue:${roomId}`;

      // ── Serve from cache if fresh ──
      const hit = cache.get(cacheKey);
      if (hit) return res.status(200).json(hit);

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) return next(new ErrorHandler("Room not found", 404));

      const members = await SupabaseService.getRoomMembers(roomId);
      const payers = members.filter((m) => m.is_payer !== false);
      if (payers.length === 0) {
        return res.status(200).json({
          success: true,
          overduePayments: [],
          message: "No payers in room",
        });
      }

      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      if (!cycles || cycles.length === 0) {
        return res.status(200).json({
          success: true,
          overduePayments: [],
          message: "No billing cycles found",
        });
      }

      // ── Single batch payment fetch for ALL cycles (egress-optimised) ──
      // Old: one getPaymentsForCycle() per completed cycle (N queries)
      // New: one getAllPaymentsForRoom() then filter per cycle in-memory (1 query)
      const allPayments = await SupabaseService.getAllPaymentsForRoom(roomId);

      const overdueMap = {};

      // ── 1. ALL completed cycles: any unpaid member is outstanding ──
      const completedCycles = cycles.filter((c) => c.status === "completed");
      for (const cycle of completedCycles) {
        // Pass already-fetched room to avoid a DB lookup per cycle inside enrichBillingCycle
        await enrichBillingCycle(cycle, members, room);

        const payments = allPayments.filter(
          (p) =>
            p.billing_cycle_start === cycle.start_date &&
            p.billing_cycle_end === cycle.end_date,
        );
        const donePmts = payments.filter(
          (p) => p.status === "completed" || p.status === "verified",
        );
        const daysSinceClosed = Math.floor(
          (today - new Date(cycle.end_date)) / (1000 * 60 * 60 * 24),
        );

        payers.forEach((member) => {
          const memberPayments = donePmts.filter(
            (p) => p.paid_by === member.user_id,
          );
          const hasTotal = memberPayments.some((p) => p.bill_type === "total");
          const unpaidItems = [];
          if (!hasTotal) {
            if (!memberPayments.some((p) => p.bill_type === "rent"))
              unpaidItems.push("rent");
            if (!memberPayments.some((p) => p.bill_type === "electricity"))
              unpaidItems.push("electricity");
            if (!memberPayments.some((p) => p.bill_type === "water"))
              unpaidItems.push("water");
            if (!memberPayments.some((p) => p.bill_type === "internet"))
              unpaidItems.push("internet");
          }
          if (unpaidItems.length === 0) return;

          const charge =
            cycle.member_charges?.find((c) => c.user_id === member.user_id) ||
            {};

          if (!overdueMap[member.user_id]) {
            overdueMap[member.user_id] = {
              memberId: member.user_id,
              memberName: member.name,
              email: member.email,
              unpaidBills: unpaidItems,
              daysOverdue: Math.max(0, daysSinceClosed),
              dueDate: cycle.end_date,
              totalDue: charge.total_due || 0,
              lastReminder: member.last_reminder_date || null,
              reminderCount: member.reminder_count || 0,
              cycleCount: 1,
            };
          } else {
            const existing = overdueMap[member.user_id];
            existing.unpaidBills = [
              ...new Set([...existing.unpaidBills, ...unpaidItems]),
            ];
            existing.totalDue += charge.total_due || 0;
            existing.cycleCount += 1;
            existing.daysOverdue = Math.max(
              existing.daysOverdue,
              Math.max(0, daysSinceClosed),
            );
          }
        });
      }

      // ── 2. Active cycle overdue by date ──
      const activeCycle = cycles.find((c) => c.status === "active");
      const activeCycleOverdue =
        activeCycle && new Date(activeCycle.end_date) < today;

      if (activeCycleOverdue) {
        const daysOverdue = Math.floor(
          (today - new Date(activeCycle.end_date)) / (1000 * 60 * 60 * 24),
        );
        await enrichBillingCycle(activeCycle, members, room);

        const payments = allPayments.filter(
          (p) =>
            p.billing_cycle_start === activeCycle.start_date &&
            p.billing_cycle_end === activeCycle.end_date,
        );
        const donePmts = payments.filter(
          (p) => p.status === "completed" || p.status === "verified",
        );

        payers.forEach((member) => {
          const memberPayments = donePmts.filter(
            (p) => p.paid_by === member.user_id,
          );
          const hasTotal = memberPayments.some((p) => p.bill_type === "total");
          const unpaidItems = [];
          if (!hasTotal) {
            if (!memberPayments.some((p) => p.bill_type === "rent"))
              unpaidItems.push("rent");
            if (!memberPayments.some((p) => p.bill_type === "electricity"))
              unpaidItems.push("electricity");
            if (!memberPayments.some((p) => p.bill_type === "water"))
              unpaidItems.push("water");
            if (!memberPayments.some((p) => p.bill_type === "internet"))
              unpaidItems.push("internet");
          }
          if (unpaidItems.length === 0) return;

          const charge =
            activeCycle.member_charges?.find(
              (c) => c.user_id === member.user_id,
            ) || {};

          if (!overdueMap[member.user_id]) {
            overdueMap[member.user_id] = {
              memberId: member.user_id,
              memberName: member.name,
              email: member.email,
              unpaidBills: unpaidItems,
              daysOverdue,
              dueDate: activeCycle.end_date,
              totalDue: charge.total_due || 0,
              lastReminder: member.last_reminder_date || null,
              reminderCount: member.reminder_count || 0,
              cycleCount: 1,
            };
          } else {
            const existing = overdueMap[member.user_id];
            existing.unpaidBills = [
              ...new Set([...existing.unpaidBills, ...unpaidItems]),
            ];
            existing.totalDue += charge.total_due || 0;
            existing.cycleCount += 1;
            existing.daysOverdue = Math.max(existing.daysOverdue, daysOverdue);
          }
        });
      }

      const overduePayments = Object.values(overdueMap);

      const refCycle =
        completedCycles[completedCycles.length - 1] || activeCycle || cycles[0];

      const payload = {
        success: true,
        overduePayments,
        cycleInfo: {
          cycleNumber: refCycle?.cycle_number,
          startDate: refCycle?.start_date,
          endDate: refCycle?.end_date,
          isOverdue: overduePayments.length > 0,
          daysOverdue:
            overduePayments.length > 0
              ? Math.max(...overduePayments.map((m) => m.daysOverdue))
              : 0,
        },
      };

      // Cache for 5 minutes — invalidated when a payment is verified or cycle is closed
      cache.set(cacheKey, payload, 300);
      return res.status(200).json(payload);
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get reminder history for a member
router.get(
  "/history/:roomId/:memberId",
  isAuthenticated,
  isAdminOrHost,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, memberId } = req.params;

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const members = await SupabaseService.getRoomMembers(roomId);
      const member = members.find((m) => m.user_id === memberId);
      if (!member) {
        return next(new ErrorHandler("Member not found in this room", 404));
      }

      let notifications = [];
      try {
        notifications = await SupabaseService.selectAll(
          "notifications",
          "recipient_id",
          memberId,
          "*",
          "created_at",
          false,
        );
      } catch (err) {
        console.log("Notifications query failed:", err.message);
        // Fallback to older table name if present
        try {
          notifications = await SupabaseService.selectAll(
            "notification_logs",
            "user_id",
            memberId,
            "*",
            "created_at",
            false,
          );
        } catch (err2) {
          console.log("Fallback notifications query failed:", err2.message);
          notifications = [];
        }
      }

      // Filter to relevant reminder types and room context when possible
      const relevant = (notifications || []).filter((n) => {
        const typeOk =
          n.notification_type === "payment_reminder" ||
          n.notification_type === "presence_reminder";
        if (!typeOk) return false;

        // Try to ensure this notification belongs to the requested room
        try {
          const related = n.related_data || n.related || null;
          if (!related) return true;
          const json =
            typeof related === "string" ? related : JSON.stringify(related);
          return json.includes(roomId);
        } catch (e) {
          return true;
        }
      });

      const reminderCount = relevant.length;
      const lastReminder = relevant.length > 0 ? relevant[0].created_at : null;
      const daysAgo = lastReminder
        ? Math.floor(
            (Date.now() - new Date(lastReminder)) / (1000 * 60 * 60 * 24),
          )
        : null;

      res.status(200).json({
        success: true,
        history: {
          reminderCount,
          lastReminderDate: lastReminder,
          daysAgo,
          reminders: relevant,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Send payment reminder to single member
router.post(
  "/send-reminder/:roomId/:memberId",
  isAuthenticated,
  isAdminOrHost,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, memberId } = req.params;
      const { customMessage } = req.body;

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

      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      const activeCycle = cycles.find(
        (c) => c.status === "active" || c.status === "completed",
      );

      if (!activeCycle) {
        return next(new ErrorHandler("No active billing cycle", 400));
      }

      const payments =
        (await SupabaseService.getPaymentsForCycle(
          roomId,
          activeCycle.start_date,
          activeCycle.end_date,
        )) || [];
      const memberPayments = payments.filter((p) => p.paid_by === memberId);

      const unpaidBills = [];
      if (!memberPayments.some((p) => p.bill_type === "rent"))
        unpaidBills.push("Rent");
      if (!memberPayments.some((p) => p.bill_type === "electricity"))
        unpaidBills.push("Electricity");
      if (!memberPayments.some((p) => p.bill_type === "water"))
        unpaidBills.push("Water");
      if (!memberPayments.some((p) => p.bill_type === "internet"))
        unpaidBills.push("Internet");

      const daysOverdue = Math.floor(
        (new Date() - new Date(activeCycle.end_date)) / (1000 * 60 * 60 * 24),
      );
      const billingPeriod = `${new Date(activeCycle.start_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${new Date(activeCycle.end_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

      const reminderMessage = PaymentReminderContent({
        recipientName: member?.name || "Valued Resident",
        roomName: room.name,
        unpaidBills,
        billingPeriod,
        daysOverdue,
        customMessage,
      });

      // Send email
      try {
        await sendMail({
          email: user.email,
          subject: `Payment Reminder - ${room.name}`,
          message: reminderMessage,
        });
      } catch (emailError) {
        console.log("Email sending failed:", emailError.message);
      }

      // Send push notification if enabled
      let pushNotificationSent = false;
      let expoMessageId = null;

      if (user.expo_push_token) {
        const pushNotification = {
          title: "💰 Payment Reminder",
          body: `Reminder: You have pending ${unpaidBills.join(", ").toLowerCase()} payment`,
          data: {
            type: "payment_reminder",
            roomId: roomId,
            memberId: memberId,
            unpaidBills: unpaidBills.join(","),
          },
        };

        const pushResult = await sendPushNotification(
          user.expo_push_token,
          pushNotification,
        );

        if (pushResult && pushResult.id) {
          pushNotificationSent = true;
          expoMessageId = pushResult.id;
        }
      }

      // Log notification
      try {
        await SupabaseService.insert("notifications", {
          recipient_id: memberId,
          notification_type: "payment_reminder",
          title: "💰 Payment Reminder",
          message: reminderMessage,
          related_data: {
            roomId,
            billingCycleId: activeCycle.id,
            unpaidBills: unpaidBills.join(","),
          },
          push_sent: pushNotificationSent,
          expo_message_id: expoMessageId,
        });
      } catch (logError) {
        console.log("Notification log failed:", logError.message);
      }

      res.status(200).json({
        success: true,
        message: "Reminder sent successfully",
        reminderSent: {
          memberId,
          memberName: member?.name,
          email: user.email,
          unpaidBills,
          sentAt: new Date(),
          emailSent: true,
          pushNotificationSent,
          expoMessageId,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Send bulk reminders to all overdue members
router.post(
  "/send-bulk-reminders/:roomId",
  isAuthenticated,
  isAdminOrHost,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      const activeCycle = cycles.find(
        (c) => c.status === "active" || c.status === "completed",
      );

      if (!activeCycle) {
        return res.status(400).json({
          success: false,
          message: "No active billing cycle",
        });
      }

      const today = new Date();
      const isOverdue = new Date(activeCycle.end_date) < today;

      if (!isOverdue) {
        return res.status(400).json({
          success: false,
          message: "Billing cycle is not yet overdue",
        });
      }

      let sentCount = 0;
      const remindersLog = [];

      const members = await SupabaseService.getRoomMembers(roomId);
      const payments =
        (await SupabaseService.getPaymentsForCycle(
          roomId,
          activeCycle.start_date,
          activeCycle.end_date,
        )) || [];

      for (const member of members) {
        if (!member.is_payer) continue;

        const memberPayments = payments.filter(
          (p) => p.paid_by === member.user_id,
        );
        const hasUnpaid = !memberPayments.some((p) => p.bill_type === "total");

        if (!hasUnpaid) continue;

        const user = await SupabaseService.findUserById(member.user_id);
        if (!user || !user.email) continue;

        const unpaidBills = [];
        if (!memberPayments.some((p) => p.bill_type === "rent"))
          unpaidBills.push("Rent");
        if (!memberPayments.some((p) => p.bill_type === "electricity"))
          unpaidBills.push("Electricity");
        if (!memberPayments.some((p) => p.bill_type === "water"))
          unpaidBills.push("Water");
        if (!memberPayments.some((p) => p.bill_type === "internet"))
          unpaidBills.push("Internet");

        const bulkDaysOverdue = Math.floor(
          (new Date() - new Date(activeCycle.end_date)) / (1000 * 60 * 60 * 24),
        );
        const bulkBillingPeriod = `${new Date(activeCycle.start_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${new Date(activeCycle.end_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

        const message = PaymentReminderContent({
          recipientName: member.name || "Valued Resident",
          roomName: room.name,
          unpaidBills,
          billingPeriod: bulkBillingPeriod,
          daysOverdue: bulkDaysOverdue,
        });

        try {
          await sendMail({
            email: user.email,
            subject: `Payment Reminder - ${room.name}`,
            message,
          });

          remindersLog.push({
            memberId: member.user_id,
            memberName: member.name,
            email: user.email,
            status: "sent",
          });

          sentCount++;
        } catch (error) {
          remindersLog.push({
            memberId: member.user_id,
            memberName: member.name,
            email: user.email,
            status: "failed",
            error: error.message,
          });
        }
      }

      res.status(200).json({
        success: true,
        message: `Reminders sent to ${sentCount} members`,
        sentCount,
        remindersLog,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get members without presence today
router.get(
  "/presence/:roomId",
  isAuthenticated,
  isAdminOrHost,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const members = await SupabaseService.getRoomMembers(roomId);
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      const membersWithoutPresence = [];

      for (const member of members) {
        const presenceArray = Array.isArray(member.presence)
          ? member.presence
          : [];
        const hasPresenceToday = presenceArray.some(
          (d) => String(d).split("T")[0] === today,
        );

        if (!hasPresenceToday) {
          const user = await SupabaseService.findUserById(member.user_id);
          membersWithoutPresence.push({
            memberId: member.user_id,
            memberName: member.name || user?.name || "Unknown",
            memberEmail: user?.email || "",
          });
        }
      }

      res.status(200).json({
        success: true,
        membersWithoutPresence,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Send presence reminder to single member
router.post(
  "/send-presence/:roomId/:memberId",
  isAuthenticated,
  isAdminOrHost,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, memberId } = req.params;
      const { customMessage } = req.body;

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

      const todayFormatted = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      const reminderMessage = PresenceReminderContent({
        recipientName: member.name || user.name || "Valued Resident",
        roomName: room.name,
        todayFormatted,
        customMessage,
      });

      // Send email
      try {
        await sendMail({
          email: user.email,
          subject: `Presence Reminder - ${room.name}`,
          message: reminderMessage,
        });
      } catch (emailError) {
        console.log("Email sending failed:", emailError.message);
      }

      // Send push notification if enabled
      let pushNotificationSent = false;
      let expoMessageId = null;

      if (user.expo_push_token) {
        const pushNotification = {
          title: "📋 Presence Reminder",
          body: `Please mark your presence for today in ${room.name}`,
          data: {
            type: "presence_reminder",
            roomId,
            memberId,
          },
        };

        const pushResult = await sendPushNotification(
          user.expo_push_token,
          pushNotification,
        );

        if (pushResult && pushResult.id) {
          pushNotificationSent = true;
          expoMessageId = pushResult.id;
        }
      }

      // Log notification
      try {
        await SupabaseService.insert("notifications", {
          recipient_id: memberId,
          notification_type: "presence_reminder",
          title: "📋 Presence Reminder",
          message: reminderMessage,
          related_data: { roomId },
          push_sent: pushNotificationSent,
          expo_message_id: expoMessageId,
        });
      } catch (logError) {
        console.log("Notification log failed:", logError.message);
      }

      res.status(200).json({
        success: true,
        message: "Presence reminder sent successfully",
        reminderSent: {
          memberId,
          memberName: member.name || user.name,
          email: user.email,
          sentAt: new Date(),
          emailSent: true,
          pushNotificationSent,
          expoMessageId,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Send bulk presence reminders
router.post(
  "/send-presence-bulk/:roomId",
  isAuthenticated,
  isAdminOrHost,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const { customMessage } = req.body;

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const members = await SupabaseService.getRoomMembers(roomId);
      const today = new Date().toISOString().split("T")[0];

      let sentCount = 0;
      const remindersLog = [];

      for (const member of members) {
        const presenceArray = Array.isArray(member.presence)
          ? member.presence
          : [];
        const hasPresenceToday = presenceArray.some(
          (d) => String(d).split("T")[0] === today,
        );

        if (hasPresenceToday) continue;

        const user = await SupabaseService.findUserById(member.user_id);
        if (!user || !user.email) continue;

        const bulkTodayFormatted = new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });

        const reminderMessage = PresenceReminderContent({
          recipientName: member.name || user.name || "Valued Resident",
          roomName: room.name,
          todayFormatted: bulkTodayFormatted,
          customMessage,
        });

        try {
          await sendMail({
            email: user.email,
            subject: `Presence Reminder - ${room.name}`,
            message: reminderMessage,
          });

          // Send push notification if available
          if (user.expo_push_token) {
            await sendPushNotification(user.expo_push_token, {
              title: "📋 Presence Reminder",
              body: `Please mark your presence for today in ${room.name}`,
              data: { type: "presence_reminder", roomId },
            });
          }

          remindersLog.push({
            memberId: member.user_id,
            memberName: member.name || user.name,
            email: user.email,
            status: "sent",
          });

          sentCount++;
        } catch (error) {
          remindersLog.push({
            memberId: member.user_id,
            memberName: member.name || user.name,
            email: user.email,
            status: "failed",
            error: error.message,
          });
        }
      }

      res.status(200).json({
        success: true,
        message: `Presence reminders sent to ${sentCount} members`,
        sentCount,
        remindersLog,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

module.exports = router;
