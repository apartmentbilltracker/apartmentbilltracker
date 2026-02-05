const express = require("express");
const router = express.Router();
const BillingCycle = require("../model/billingCycle");
const Room = require("../model/room");
const User = require("../model/user");
const NotificationLog = require("../model/notificationLog");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const sendMail = require("../utils/sendMail"); // Use sendMail utility
const { sendPushNotification } = require("../utils/sendPushNotification");

// Get list of overdue payments (admin only)
router.get(
  "/overdue/:roomId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const today = new Date();

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
          overduePayments: [],
          message: "No active billing cycle",
        });
      }

      const isOverdue = new Date(activeCycle.endDate) < today;
      const overduePayments = [];

      if (isOverdue) {
        const daysOverdue = Math.floor(
          (today - activeCycle.endDate) / (1000 * 60 * 60 * 24),
        );

        room.memberPayments.forEach((mp) => {
          const member = room.members.find(
            (m) => m.user._id.toString() === mp.member.toString(),
          );
          if (!member || !member.isPayer) return;

          const unpaidItems = [];
          if (mp.rentStatus === "pending") unpaidItems.push("rent");
          if (mp.electricityStatus === "pending")
            unpaidItems.push("electricity");
          if (mp.waterStatus === "pending") unpaidItems.push("water");
          if (mp.internetStatus === "pending") unpaidItems.push("internet");

          if (unpaidItems.length > 0) {
            overduePayments.push({
              memberId: mp.member,
              memberName: mp.memberName,
              memberEmail: member.user?.email,
              unpaidBills: unpaidItems,
              daysOverdue,
              dueDate: activeCycle.endDate,
              totalDue: 0, // Will be calculated from memberCharges
              lastReminder: mp.lastReminderDate || null,
              reminderCount: mp.reminderCount || 0,
            });
          }
        });

        // Add total due from memberCharges
        overduePayments.forEach((op) => {
          const charge = activeCycle.memberCharges.find(
            (c) => c.userId.toString() === op.memberId.toString(),
          );
          if (charge) {
            op.totalDue = charge.totalDue;
          }
        });
      }

      res.status(200).json({
        success: true,
        overduePayments,
        cycleInfo: {
          cycleNumber: activeCycle.cycleNumber,
          startDate: activeCycle.startDate,
          endDate: activeCycle.endDate,
          isOverdue,
          daysOverdue: isOverdue
            ? Math.floor((today - activeCycle.endDate) / (1000 * 60 * 60 * 24))
            : 0,
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

      const room = await Room.findById(roomId).populate(
        "members.user billingCycles",
      );
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const user = await User.findById(memberId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const member = room.members.find(
        (m) => m.user._id.toString() === memberId,
      );
      const activeCycle = room.billingCycles.find((c) => c.status === "active");
      const memberPayment = room.memberPayments.find(
        (mp) => mp.member.toString() === memberId,
      );

      if (!memberPayment) {
        return next(new ErrorHandler("Member payment record not found", 404));
      }

      // Prepare reminder message
      const unpaidBills = [];
      if (memberPayment.rentStatus === "pending") unpaidBills.push("Rent");
      if (memberPayment.electricityStatus === "pending")
        unpaidBills.push("Electricity");
      if (memberPayment.waterStatus === "pending") unpaidBills.push("Water");
      if (memberPayment.internetStatus === "pending")
        unpaidBills.push("Internet");

      const defaultMessage = `Dear ${member.name},\n\nThis is a payment reminder for ${unpaidBills.join(", ")} in room ${room.name}.\n\nBilling Period: ${new Date(activeCycle.startDate).toLocaleDateString()} - ${new Date(activeCycle.endDate).toLocaleDateString()}\n\nPlease settle your outstanding bills as soon as possible.`;

      const reminderMessage = customMessage || defaultMessage;

      // Send email
      try {
        await sendMail({
          email: user.email,
          subject: `Payment Reminder - ${room.name}`,
          message: reminderMessage,
        });
        console.log(`Email sent to ${user.email}`);
      } catch (emailError) {
        console.log("Email sending failed:", emailError.message);
      }

      // Send push notification if user has a registered push token
      let pushNotificationSent = false;
      let expoMessageId = null;

      if (user.expoPushToken) {
        const pushNotification = {
          title: "💰 Payment Reminder",
          body: customMessage
            ? customMessage.split("\n")[0] // Use first line of custom message
            : `Reminder: You have pending ${unpaidBills.join(", ").toLowerCase()} payment in ${room.name}`,
          data: {
            type: "payment_reminder",
            roomId: roomId,
            memberId: memberId,
            unpaidBills: unpaidBills.join(","),
            cycleId: activeCycle._id,
            screen: "Bills",
          },
        };

        const pushResult = await sendPushNotification(
          user.expoPushToken,
          pushNotification,
        );

        if (pushResult && pushResult.id) {
          pushNotificationSent = true;
          expoMessageId = pushResult.id;
          console.log("Push notification sent:", expoMessageId);
        }
      }

      // Log notification in database
      const notification = new NotificationLog({
        recipient: memberId,
        notificationType: "payment_reminder",
        title: "💰 Payment Reminder",
        message: reminderMessage,
        relatedData: {
          roomId: roomId,
          billingCycleId: activeCycle._id,
          unpaidBills: unpaidBills.join(","),
        },
        pushNotificationSent,
        pushTokenUsed: user.expoPushToken || null,
        expoMessageId,
      });

      await notification.save();

      console.log(
        `[Send Reminder] Notification created for user ${memberId}:`,
        {
          notificationId: notification._id,
          recipient: notification.recipient,
          type: notification.notificationType,
        },
      );

      // Update reminder tracking
      memberPayment.lastReminderDate = new Date();
      memberPayment.reminderCount = (memberPayment.reminderCount || 0) + 1;

      await room.save();

      res.status(200).json({
        success: true,
        message: "Reminder sent successfully",
        reminderSent: {
          memberId,
          memberName: member.name,
          email: user.email,
          unpaidBills,
          sentAt: new Date(),
          reminderCount: memberPayment.reminderCount,
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
      const { customMessage } = req.body;

      const room = await Room.findById(roomId)
        .populate("members.user")
        .populate("billingCycles");

      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const activeCycle = room.billingCycles.find((c) => c.status === "active");
      if (!activeCycle) {
        return res.status(400).json({
          success: false,
          message: "No active billing cycle",
        });
      }

      const today = new Date();
      const isOverdue = new Date(activeCycle.endDate) < today;

      if (!isOverdue) {
        return res.status(400).json({
          success: false,
          message: "Billing cycle is not yet overdue",
        });
      }

      let sentCount = 0;
      let failedCount = 0;
      const remindersLog = [];

      // Send reminders to all overdue members
      for (const mp of room.memberPayments) {
        const member = room.members.find(
          (m) => m.user._id.toString() === mp.member.toString(),
        );

        if (!member || !member.isPayer) continue;

        // Check if has unpaid bills
        const hasUnpaid =
          mp.rentStatus === "pending" ||
          mp.electricityStatus === "pending" ||
          mp.waterStatus === "pending" ||
          mp.internetStatus === "pending";

        if (!hasUnpaid) continue;

        try {
          const user = await User.findById(mp.member);

          const unpaidBills = [];
          if (mp.rentStatus === "pending") unpaidBills.push("Rent");
          if (mp.electricityStatus === "pending")
            unpaidBills.push("Electricity");
          if (mp.waterStatus === "pending") unpaidBills.push("Water");
          if (mp.internetStatus === "pending") unpaidBills.push("Internet");

          const defaultMessage = `Dear ${member.name},\n\nThis is a payment reminder for ${unpaidBills.join(", ")} in room ${room.name}.\n\nBilling Period: ${new Date(activeCycle.startDate).toLocaleDateString()} - ${new Date(activeCycle.endDate).toLocaleDateString()}\n\nPlease settle your outstanding bills as soon as possible.`;

          const reminderMsg = customMessage || defaultMessage;

          // Send email
          await sendEmail({
            email: user.email,
            subject: `Payment Reminder - ${room.name}`,
            message: reminderMsg,
          }).catch(() => {
            // Email failed but continue with next member
          });

          // Update reminder tracking
          mp.lastReminderDate = new Date();
          mp.reminderCount = (mp.reminderCount || 0) + 1;

          remindersLog.push({
            memberId: mp.member,
            memberName: mp.memberName,
            email: user.email,
            unpaidBills,
            status: "sent",
          });

          sentCount++;
        } catch (error) {
          remindersLog.push({
            memberId: mp.member,
            memberName: mp.memberName,
            status: "failed",
            error: error.message,
          });
          failedCount++;
        }
      }

      await room.save();

      res.status(200).json({
        success: true,
        message: `Sent ${sentCount} reminders, ${failedCount} failed`,
        remindersLog,
        summary: {
          totalSent: sentCount,
          totalFailed: failedCount,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Get reminder history (admin only)
router.get(
  "/history/:roomId/:memberId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, memberId } = req.params;

      const room = await Room.findById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const memberPayment = room.memberPayments.find(
        (mp) => mp.member.toString() === memberId,
      );

      if (!memberPayment) {
        return next(new ErrorHandler("Member payment record not found", 404));
      }

      res.status(200).json({
        success: true,
        reminderHistory: {
          memberId,
          memberName: memberPayment.memberName,
          totalReminders: memberPayment.reminderCount || 0,
          lastReminderDate: memberPayment.lastReminderDate || null,
          lastReminderDaysAgo: memberPayment.lastReminderDate
            ? Math.floor(
                (new Date() - memberPayment.lastReminderDate) /
                  (1000 * 60 * 60 * 24),
              )
            : null,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Get members without presence marking for today (admin only)
 * GET /api/v2/admin/reminders/presence/:roomId
 */
router.get(
  "/presence/:roomId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const today = new Date();
      const todayDateString = today.toISOString().split("T")[0]; // YYYY-MM-DD format

      const room = await Room.findById(roomId).populate("members.user");

      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const membersWithoutPresence = [];

      // Check which members haven't marked presence today
      for (const member of room.members) {
        // Check if today's date is in the presence array
        const hasPresenceToday = member.presence?.some((dateStr) =>
          dateStr.includes(todayDateString),
        );

        if (!hasPresenceToday) {
          membersWithoutPresence.push({
            memberId: member.user._id,
            memberName: member.name,
            memberEmail: member.user?.email,
            expoPushToken: member.user?.expoPushToken,
          });
        }
      }

      res.status(200).json({
        success: true,
        membersWithoutPresence,
        roomInfo: {
          roomId: room._id,
          roomName: room.name,
          totalMembers: room.members.length,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Send presence reminder to single member (admin only)
 * POST /api/v2/admin-reminders/send-presence/:roomId/:memberId
 */
router.post(
  "/send-presence/:roomId/:memberId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, memberId } = req.params;
      const { customMessage } = req.body;

      const room = await Room.findById(roomId).populate(
        "members.user billingCycles",
      );
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const user = await User.findById(memberId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const member = room.members.find(
        (m) => m.user._id.toString() === memberId,
      );

      const activeCycle = room.billingCycles.find((c) => c.status === "active");
      if (!activeCycle) {
        return next(new ErrorHandler("No active billing cycle", 400));
      }

      const defaultMessage = `Hi ${member.name},\n\nPlease mark your presence for today in the Apartment Bill Tracker app.\n\nThis helps us track your occupancy for billing purposes.`;

      const reminderMessage = customMessage || defaultMessage;

      // Send email
      try {
        await sendMail({
          email: user.email,
          subject: `Presence Reminder - ${room.name}`,
          message: reminderMessage,
        });
        console.log(`Presence reminder email sent to ${user.email}`);
      } catch (emailError) {
        console.log("Email sending failed:", emailError.message);
      }

      // Send push notification if user has a registered push token
      let pushNotificationSent = false;
      let expoMessageId = null;

      if (user.expoPushToken) {
        const pushNotification = {
          title: "📍 Mark Your Presence",
          body: customMessage
            ? customMessage.split("\n")[0] // Use first line of custom message
            : "Please mark your presence for today",
          data: {
            type: "presence_reminder",
            roomId: roomId,
            memberId: memberId,
            cycleId: activeCycle._id,
            screen: "Presence",
          },
        };

        const pushResult = await sendPushNotification(
          user.expoPushToken,
          pushNotification,
        );

        if (pushResult && pushResult.id) {
          pushNotificationSent = true;
          expoMessageId = pushResult.id;
          console.log("Presence notification sent:", expoMessageId);
        }
      }

      // Log notification in database
      const notification = new NotificationLog({
        recipient: memberId,
        notificationType: "presence_reminder",
        title: "📍 Mark Your Presence",
        message: reminderMessage,
        relatedData: {
          roomId: roomId,
          billingCycleId: activeCycle._id,
        },
        pushNotificationSent,
        pushTokenUsed: user.expoPushToken || null,
        expoMessageId,
      });

      await notification.save();

      res.status(200).json({
        success: true,
        message: "Presence reminder sent successfully",
        notification: {
          notificationId: notification._id,
          recipient: notification.recipient,
          type: notification.notificationType,
          emailSent: true,
          pushNotificationSent,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Send presence reminder to all members without presence (admin only)
 * POST /api/v2/admin/reminders/send-presence-bulk/:roomId
 */
router.post(
  "/send-presence-bulk/:roomId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const { customMessage } = req.body;

      const room = await Room.findById(roomId).populate("members.user");

      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      const today = new Date();
      const todayDateString = today.toISOString().split("T")[0]; // YYYY-MM-DD format

      let sentCount = 0;
      let failedCount = 0;
      const remindersLog = [];

      // Send reminders to all members without presence
      for (const member of room.members) {
        // Check if today's date is in the presence array
        const hasPresenceToday = member.presence?.some((dateStr) =>
          dateStr.includes(todayDateString),
        );

        // Skip if presence already marked
        if (hasPresenceToday) continue;

        try {
          const user = await User.findById(member.user._id);

          const defaultMessage = `Hi ${member.name},\n\nPlease mark your presence for today in the Apartment Bill Tracker app.\n\nThis helps us track your occupancy for billing purposes.`;

          const reminderMsg = customMessage || defaultMessage;

          // Send email
          await sendMail({
            email: user.email,
            subject: `Presence Reminder - ${room.name}`,
            message: reminderMsg,
          }).catch(() => {
            // Email failed but continue with next member
          });

          // Send push notification if user has token
          let pushSent = false;
          if (user.expoPushToken) {
            const pushNotification = {
              title: "📍 Mark Your Presence",
              body: customMessage
                ? customMessage.split("\n")[0]
                : "Please mark your presence for today",
              data: {
                type: "presence_reminder",
                roomId: roomId,
                memberId: member.user._id.toString(),
                screen: "Presence",
              },
            };

            const pushResult = await sendPushNotification(
              user.expoPushToken,
              pushNotification,
            );
            pushSent = !!pushResult?.id;
          }

          remindersLog.push({
            memberId: member.user._id,
            memberName: member.name,
            email: user.email,
            status: "sent",
            pushSent,
          });

          sentCount++;
        } catch (error) {
          remindersLog.push({
            memberId: member.user._id,
            memberName: member.name,
            status: "failed",
            error: error.message,
          });
          failedCount++;
        }
      }

      res.status(200).json({
        success: true,
        message: `Sent ${sentCount} presence reminders, ${failedCount} failed`,
        remindersLog,
        summary: {
          totalSent: sentCount,
          totalFailed: failedCount,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

module.exports = router;
