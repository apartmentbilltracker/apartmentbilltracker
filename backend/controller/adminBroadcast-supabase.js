// Admin Broadcast Controller - Supabase
// Allows admin to send notifications (in-app + email) to all users or specific room members
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const sendMail = require("../utils/sendMail");

/**
 * Build a styled HTML email for broadcast notifications
 */
const buildBroadcastEmail = ({ title, message, senderName }) => {
  return `
    <div style="max-width: 600px; margin: auto; font-family: Arial, sans-serif; color: #333;">
      <div style="text-align: center; padding: 20px 0; font-size: 12px; color: #888;">
        Notification from Apartment Bill Tracker
      </div>
      <div style="background-color: #b38604; padding: 30px 0; text-align: center;">
        <h2 style="color: white; margin: 0;">📢 ${title}</h2>
      </div>
      <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; margin: 20px 0; border: 1px solid #eee;">
        <div style="white-space: pre-wrap; line-height: 1.6; color: #333; font-size: 15px;">${message}</div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #888; font-size: 13px;">
          Sent by <strong>${senderName}</strong> via Apartment Bill Tracker
        </p>
      </div>
      <div style="text-align: center; padding: 16px; font-size: 11px; color: #aaa;">
        You received this because you have an account on Apartment Bill Tracker.
      </div>
    </div>
  `;
};

// ─────────────────────────────────────────────
// POST / — Send broadcast notification
// Body: { title, message, target, roomId, userIds, sendEmail }
//   target: "all" | "room" | "user"
//   roomId: required when target === "room"
//   userIds: array of user IDs, required when target === "user"
//   sendEmail: boolean (default false)
// ─────────────────────────────────────────────
router.post(
  "/",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    const {
      title,
      message,
      target = "all",
      roomId,
      userIds,
      sendEmail = false,
    } = req.body;

    if (!title || !message) {
      return next(new ErrorHandler("Title and message are required", 400));
    }

    try {
      let recipients = [];

      if (target === "user" && userIds && userIds.length > 0) {
        // Send to specific user(s)
        const userMap = await SupabaseService.findUsersByIds(userIds);
        recipients = [...userMap.values()];
      } else if (target === "room" && roomId) {
        // Send to members of a specific room
        const members = await SupabaseService.getRoomMembers(roomId);
        const userIds = (members || []).map((m) => m.user_id);
        if (userIds.length > 0) {
          const userMap = await SupabaseService.findUsersByIds(userIds);
          recipients = [...userMap.values()];
        }
      } else {
        // Send to all users
        const allUsers = await SupabaseService.selectAllRecords(
          "users",
          "id, name, email",
        );
        recipients = allUsers || [];
      }

      if (recipients.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No recipients found",
          sent: 0,
          emailed: 0,
        });
      }

      // 1) Create in-app notifications for all recipients (batch insert)
      const notificationRows = recipients.map((user) => ({
        recipient_id: user.id,
        notification_type: "admin_broadcast",
        title,
        message,
        is_read: false,
        related_data: {
          sent_by: req.user.id,
          sent_by_name: req.user.name,
          target,
          room_id: roomId || null,
          user_ids: userIds || null,
        },
        created_at: new Date().toISOString(),
      }));

      await SupabaseService.insertMany("notifications", notificationRows);

      // 2) Send emails if requested (non-blocking, don't fail the request)
      let emailedCount = 0;
      if (sendEmail) {
        const htmlBody = buildBroadcastEmail({
          title,
          message,
          senderName: req.user.name || "Admin",
        });

        // Send emails in parallel batches of 5
        const BATCH_SIZE = 5;
        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
          const batch = recipients.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map((user) =>
              sendMail({
                email: user.email,
                subject: `📢 ${title}`,
                message: htmlBody,
              }),
            ),
          );
          emailedCount += results.filter(
            (r) => r.status === "fulfilled",
          ).length;
        }
      }

      res.status(201).json({
        success: true,
        message: `Notification sent to ${recipients.length} user(s)`,
        sent: recipients.length,
        emailed: emailedCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// ─────────────────────────────────────────────
// GET /users — Get all users (for single-user picker)
// ─────────────────────────────────────────────
router.get(
  "/users",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const allUsers = await SupabaseService.selectAllRecords(
        "users",
        "id, name, email",
      );
      res.status(200).json({ success: true, users: allUsers || [] });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// ─────────────────────────────────────────────
// GET /history — Get broadcast history (last 50)
// ─────────────────────────────────────────────
router.get(
  "/history",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const supabase = SupabaseService.getClient();
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, related_data, created_at")
        .eq("notification_type", "admin_broadcast")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Deduplicate by title+timestamp (broadcasts create N rows, one per recipient)
      const seen = new Set();
      const unique = (data || []).filter((row) => {
        const key = `${row.title}|${row.created_at}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      res.status(200).json({ success: true, broadcasts: unique });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

module.exports = router;
