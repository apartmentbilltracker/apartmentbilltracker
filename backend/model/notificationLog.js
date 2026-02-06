const mongoose = require("mongoose");

const notificationLogSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  notificationType: {
    type: String,
    enum: [
      "payment_reminder",
      "payment_received",
      "billing_cycle_started",
      "settlement_alert",
      "member_status_changed",
      "presence_reminder",
      "general",
    ],
    required: true,
  },
  title: String,
  message: String,
  relatedData: {
    roomId: mongoose.Schema.Types.ObjectId,
    billingCycleId: mongoose.Schema.Types.ObjectId,
    memberId: mongoose.Schema.Types.ObjectId,
    billType: String, // rent, electricity, water, total
    amount: Number,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: Date,
  sentAt: {
    type: Date,
    default: Date.now,
  },
  pushNotificationSent: {
    type: Boolean,
    default: false,
  },
  pushTokenUsed: String,
  expoMessageId: String, // Expo push notification ID for tracking
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model("NotificationLog", notificationLogSchema);
