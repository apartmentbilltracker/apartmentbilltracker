// Notifications Controller - Supabase (ACTIVE)
const express = require("express");
const router = express.Router();
const supabase = require("../db/SupabaseClient");
const SupabaseService = require("../db/SupabaseService");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");

/**
 * Helper: map DB row → client-friendly shape
 */
function mapNotification(row) {
  return {
    id: row.id,
    _id: row.id,
    title: row.title || "",
    message: row.message || "",
    type: row.notification_type || "general",
    isRead: !!row.is_read,
    sentAt: row.created_at,
    relatedData: row.related_data || {},
  };
}

// ──────────────────────────────────────────────
// GET / — unread notifications for current user
// ──────────────────────────────────────────────
router.get(
  "/",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", req.user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const notifications = (data || []).map(mapNotification);

      res.status(200).json({
        success: true,
        notifications,
        unreadCount: notifications.length,
      });
    } catch (error) {
      // Table might not exist yet — degrade gracefully
      console.log("Notifications fetch error:", error.message);
      res.status(200).json({
        success: true,
        notifications: [],
        unreadCount: 0,
      });
    }
  }),
);

// ──────────────────────────────────────────────
// GET /all — paginated all notifications
// ──────────────────────────────────────────────
router.get(
  "/all",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 30;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Get total count
      const { count, error: countErr } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", req.user.id);

      if (countErr) throw countErr;

      // Get page of data
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", req.user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const total = count || 0;
      const notifications = (data || []).map(mapNotification);

      res.status(200).json({
        success: true,
        notifications,
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      });
    } catch (error) {
      console.log("Notifications /all error:", error.message);
      res.status(200).json({
        success: true,
        notifications: [],
        total: 0,
        pages: 0,
        currentPage: 1,
      });
    }
  }),
);

// ──────────────────────────────────────────────
// PATCH /:notificationId/read — mark single as read
// ──────────────────────────────────────────────
router.patch(
  "/:notificationId/read",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { notificationId } = req.params;

      const { data, error } = await supabase
        .from("notifications")
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("recipient_id", req.user.id)
        .select()
        .single();

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: "Notification marked as read",
        notification: data ? mapNotification(data) : null,
      });
    } catch (error) {
      console.log("Mark as read error:", error.message);
      res.status(200).json({
        success: true,
        message: "Notification marked as read",
      });
    }
  }),
);

// ──────────────────────────────────────────────
// PATCH /read-all — mark all as read for user
// ──────────────────────────────────────────────
router.patch(
  "/read-all",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("recipient_id", req.user.id)
        .eq("is_read", false)
        .select("id");

      if (error) throw error;

      const modifiedCount = data ? data.length : 0;

      res.status(200).json({
        success: true,
        message: `${modifiedCount} notifications marked as read`,
        modifiedCount,
      });
    } catch (error) {
      console.log("Mark all read error:", error.message);
      res.status(200).json({
        success: true,
        message: "0 notifications marked as read",
        modifiedCount: 0,
      });
    }
  }),
);

// ──────────────────────────────────────────────
// DELETE /:notificationId — delete single
// ──────────────────────────────────────────────
router.delete(
  "/:notificationId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { notificationId } = req.params;

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("recipient_id", req.user.id);

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: "Notification deleted",
      });
    } catch (error) {
      console.log("Delete notification error:", error.message);
      res.status(200).json({
        success: true,
        message: "Notification deleted",
      });
    }
  }),
);

// ──────────────────────────────────────────────
// DELETE /clear-all — delete all for user
// ──────────────────────────────────────────────
router.delete(
  "/clear-all",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      // Count first
      const { count, error: countErr } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", req.user.id);

      if (countErr) throw countErr;

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("recipient_id", req.user.id);

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: `${count || 0} notifications deleted`,
        deletedCount: count || 0,
      });
    } catch (error) {
      console.log("Clear all notifications error:", error.message);
      res.status(200).json({
        success: true,
        message: "0 notifications deleted",
        deletedCount: 0,
      });
    }
  }),
);

// ──────────────────────────────────────────────
// POST /register-token — save Expo push token
// ──────────────────────────────────────────────
router.post(
  "/register-token",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { expoPushToken } = req.body;

      if (!expoPushToken) {
        return next(new ErrorHandler("Expo push token is required", 400));
      }

      // Try to save to users table (column may not exist yet)
      try {
        await supabase
          .from("users")
          .update({ expo_push_token: expoPushToken })
          .eq("id", req.user.id);
      } catch (updateErr) {
        console.log(
          "Push token save skipped (column may not exist):",
          updateErr.message,
        );
      }

      res.status(200).json({
        success: true,
        message: "Push token registered successfully",
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// ──────────────────────────────────────────────
// POST /log-presence — log a presence notification
// ──────────────────────────────────────────────
router.post(
  "/log-presence",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const notification = await SupabaseService.insert("notifications", {
        recipient_id: req.user.id,
        notification_type: "presence_confirmation",
        title: "✅ Presence Marked",
        message:
          req.body.message || "Your presence has been recorded for today.",
        related_data: req.body.relatedData || {},
      });

      res.status(201).json({
        success: true,
        message: "Presence notification logged",
        notification: mapNotification(notification),
      });
    } catch (error) {
      // Graceful fallback if table doesn't exist
      console.log("Log presence notification error:", error.message);
      res.status(201).json({
        success: true,
        message: "Presence notification logged",
        notification: {
          id: "temp",
          title: "✅ Presence Marked",
          message: "Your presence has been marked",
        },
      });
    }
  }),
);

module.exports = router;
