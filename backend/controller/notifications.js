const express = require("express");
const router = express.Router();
const User = require("../model/user");
const NotificationLog = require("../model/notificationLog");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");

/**
 * Get unread notifications for current user
 * GET /api/v2/notifications
 */
router.get(
  "/",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const userId = req.user._id;

      const notifications = await NotificationLog.find({
        recipient: userId,
        isRead: false,
      })
        .sort({ sentAt: -1 })
        .limit(50);

      const unreadCount = notifications.length;

      res.status(200).json({
        success: true,
        notifications,
        unreadCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Get all notifications (read + unread) for current user
 * GET /api/v2/notifications/all
 */
router.get(
  "/all",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const notifications = await NotificationLog.find({
        recipient: req.user._id,
      })
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await NotificationLog.countDocuments({
        recipient: req.user._id,
      });

      res.status(200).json({
        success: true,
        notifications,
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Mark notification as read
 * PATCH /api/v2/notifications/:notificationId/read
 */
router.patch(
  "/:notificationId/read",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const notification = await NotificationLog.findByIdAndUpdate(
        req.params.notificationId,
        {
          isRead: true,
          readAt: new Date(),
        },
        { new: true },
      );

      if (!notification) {
        return next(new ErrorHandler("Notification not found", 404));
      }

      res.status(200).json({
        success: true,
        notification,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Mark all notifications as read
 * PATCH /api/v2/notifications/read-all
 */
router.patch(
  "/read-all",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const result = await NotificationLog.updateMany(
        {
          recipient: req.user._id,
          isRead: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        },
      );

      res.status(200).json({
        success: true,
        message: `${result.modifiedCount} notifications marked as read`,
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Delete notification
 * DELETE /api/v2/notifications/:notificationId
 */
router.delete(
  "/:notificationId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const notification = await NotificationLog.findByIdAndDelete(
        req.params.notificationId,
      );

      if (!notification) {
        return next(new ErrorHandler("Notification not found", 404));
      }

      res.status(200).json({
        success: true,
        message: "Notification deleted",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Clear all notifications for user
 * DELETE /api/v2/notifications/clear-all
 */
router.delete(
  "/clear-all",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const result = await NotificationLog.deleteMany({
        recipient: req.user._id,
      });

      res.status(200).json({
        success: true,
        message: `${result.deletedCount} notifications deleted`,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Register or update Expo push token for current user
 * POST /api/v2/notifications/register-token
 */
router.post(
  "/register-token",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { expoPushToken } = req.body;

      if (!expoPushToken) {
        return next(new ErrorHandler("Expo push token is required", 400));
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        {
          expoPushToken,
          expoPushTokenUpdatedAt: new Date(),
        },
        { new: true },
      );

      res.status(200).json({
        success: true,
        message: "Push token registered successfully",
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Log presence marking notification (called when user marks presence)
 * POST /api/v2/notifications/log-presence
 */
router.post(
  "/log-presence",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, date } = req.body;

      const notification = new NotificationLog({
        recipient: req.user._id,
        notificationType: "general",
        title: "✅ Presence Marked",
        message: `Your presence has been marked for ${new Date(date).toLocaleDateString()}`,
        relatedData: {
          roomId,
          type: "presence_marked",
        },
        isRead: false,
      });

      await notification.save();

      res.status(201).json({
        success: true,
        message: "Presence notification logged",
        notification,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

module.exports = router;
