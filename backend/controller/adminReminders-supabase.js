// Admin Reminders Controller - Supabase
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const sendMail = require("../utils/sendMail");
const { sendPushNotification } = require("../utils/sendPushNotification");
const { enrichBillingCycle } = require("../utils/enrichBillingCycle");

// Get list of overdue payments (admin only)
router.get(
  "/overdue/:roomId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const today = new Date();

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const cycles = await SupabaseService.getRoomBillingCycles(roomId);
      const activeCycle = cycles.find((c) => c.status === "active");

      if (!activeCycle) {
        return res.status(200).json({
          success: true,
          overduePayments: [],
          message: "No active billing cycle",
        });
      }

      const isOverdue = new Date(activeCycle.end_date) < today;
      const overduePayments = [];

      if (isOverdue) {
        const daysOverdue = Math.floor(
          (today - new Date(activeCycle.end_date)) / (1000 * 60 * 60 * 24),
        );

        const members = await SupabaseService.getRoomMembers(roomId);

        // Enrich the cycle so member_charges (with total_due) are computed
        await enrichBillingCycle(activeCycle, members);

        const payments =
          (await SupabaseService.getPaymentsForCycle(
            roomId,
            activeCycle.start_date,
            activeCycle.end_date,
          )) || [];

        const completedPayments = payments.filter(
          (p) => p.status === "completed" || p.status === "verified",
        );

        members.forEach((member) => {
          if (!member.is_payer) return;

          const memberPayments = completedPayments.filter(
            (p) => p.paid_by === member.user_id,
          );

          const hasRent = memberPayments.some((p) => p.bill_type === "rent");
          const hasElectricity = memberPayments.some(
            (p) => p.bill_type === "electricity",
          );
          const hasWater = memberPayments.some((p) => p.bill_type === "water");
          const hasInternet = memberPayments.some(
            (p) => p.bill_type === "internet",
          );
          const hasTotal = memberPayments.some((p) => p.bill_type === "total");

          const unpaidItems = [];
          if (!hasRent && !hasTotal) unpaidItems.push("rent");
          if (!hasElectricity && !hasTotal) unpaidItems.push("electricity");
          if (!hasWater && !hasTotal) unpaidItems.push("water");
          if (!hasInternet && !hasTotal) unpaidItems.push("internet");

          if (unpaidItems.length > 0) {
            const charge =
              activeCycle.member_charges?.find(
                (c) => c.user_id === member.user_id,
              ) || {};
            overduePayments.push({
              memberId: member.user_id,
              memberName: member.name,
              memberEmail: member.email,
              unpaidBills: unpaidItems,
              daysOverdue,
              dueDate: activeCycle.end_date,
              totalDue: charge.total_due || 0,
              lastReminder: member.last_reminder_date || null,
              reminderCount: member.reminder_count || 0,
            });
          }
        });
      }

      res.status(200).json({
        success: true,
        overduePayments,
        cycleInfo: {
          cycleNumber: activeCycle.cycle_number,
          startDate: activeCycle.start_date,
          endDate: activeCycle.end_date,
          isOverdue,
          daysOverdue: isOverdue
            ? Math.floor(
                (today - new Date(activeCycle.end_date)) /
                  (1000 * 60 * 60 * 24),
              )
            : 0,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get reminder history for a member (admin only)
router.get(
  "/history/:roomId/:memberId",
  isAuthenticated,
  isAdmin,
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

// Send payment reminder to single member (admin only)
router.post(
  "/send-reminder/:roomId/:memberId",
  isAuthenticated,
  isAdmin,
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
      const activeCycle = cycles.find((c) => c.status === "active");

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

      const defaultMessage = `Dear ${member?.name || "Valued Resident"},\n\nWe hope this message finds you well. This is a formal reminder regarding your outstanding payment obligation for Room ${room.name}.\n\nOur records indicate that the following bill(s) remain unpaid:\n• ${unpaidBills.join("\n• ")}\n\nBilling Period: ${billingPeriod}\nDays Overdue: ${daysOverdue > 0 ? daysOverdue + " day(s)" : "Due now"}\n\nWe kindly request that you settle the above balance at your earliest convenience to avoid any further delays. Timely payments help us maintain quality services and ensure smooth operations for all residents.\n\nIf you have already made the payment, please disregard this notice. Should you have any questions or concerns, please do not hesitate to reach out to your room administrator.\n\nThank you for your prompt attention to this matter.\n\nWarm regards,\n${room.name} Management`;

      const reminderMessage = customMessage || defaultMessage;

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

// Send bulk reminders to all overdue members (admin only)
router.post(
  "/send-bulk-reminders/:roomId",
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

        const message = `Dear ${member.name || "Valued Resident"},\n\nWe hope this message finds you well. This is a formal reminder regarding your outstanding payment obligation for Room ${room.name}.\n\nOur records indicate that the following bill(s) remain unpaid:\n• ${unpaidBills.join("\n• ")}\n\nBilling Period: ${bulkBillingPeriod}\nDays Overdue: ${bulkDaysOverdue > 0 ? bulkDaysOverdue + " day(s)" : "Due now"}\n\nWe kindly request that you settle the above balance at your earliest convenience to avoid any further delays. Timely payments help us maintain quality services and ensure smooth operations for all residents.\n\nIf you have already made the payment, please disregard this notice. Should you have any questions or concerns, please do not hesitate to reach out to your room administrator.\n\nThank you for your prompt attention to this matter.\n\nWarm regards,\n${room.name} Management`;

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

// Get members without presence today (admin only)
router.get(
  "/presence/:roomId",
  isAuthenticated,
  isAdmin,
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

// Send presence reminder to single member (admin only)
router.post(
  "/send-presence/:roomId/:memberId",
  isAuthenticated,
  isAdmin,
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

      const defaultMessage = `Dear ${member.name || user.name || "Valued Resident"},\n\nWe hope you are doing well. This is a friendly reminder to please mark your daily presence for today, ${todayFormatted}, in the Apartment Bill Tracker application.\n\nRoom: ${room.name}\n\nAccurate attendance records are essential for computing fair and transparent billing among all room occupants. Marking your presence each day ensures that utility costs are distributed proportionally based on actual occupancy.\n\nIf you have already recorded your attendance for today, please disregard this notice. Should you encounter any issues with the app, feel free to contact your room administrator for assistance.\n\nThank you for your cooperation.\n\nBest regards,\n${room.name} Management`;

      const reminderMessage = customMessage || defaultMessage;

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

// Send bulk presence reminders (admin only)
router.post(
  "/send-presence-bulk/:roomId",
  isAuthenticated,
  isAdmin,
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

        const defaultMessage = `Dear ${member.name || user.name || "Valued Resident"},\n\nWe hope you are doing well. This is a friendly reminder to please mark your daily presence for today, ${bulkTodayFormatted}, in the Apartment Bill Tracker application.\n\nRoom: ${room.name}\n\nAccurate attendance records are essential for computing fair and transparent billing among all room occupants. Marking your presence each day ensures that utility costs are distributed proportionally based on actual occupancy.\n\nIf you have already recorded your attendance for today, please disregard this notice. Should you encounter any issues with the app, feel free to contact your room administrator for assistance.\n\nThank you for your cooperation.\n\nBest regards,\n${room.name} Management`;

        const reminderMessage = customMessage || defaultMessage;

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
