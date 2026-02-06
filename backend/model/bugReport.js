const mongoose = require("mongoose");

const bugReportSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },
  status: {
    type: String,
    enum: ["new", "in-review", "acknowledged", "fixed", "closed"],
    default: "new",
  },
  module: {
    type: String,
    enum: ["billing", "payment", "announcements", "profile", "general"],
    default: "general",
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
  },
  screenshots: [{ type: String }], // URLs to uploaded screenshots
  deviceInfo: { type: String }, // Device/OS info
  responses: [
    {
      from: { type: String }, // "user" or "admin"
      message: { type: String },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  isReadByUser: { type: Boolean, default: false },
  isReadByAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  fixedAt: { type: Date },
});

module.exports = mongoose.model("BugReport", bugReportSchema);
