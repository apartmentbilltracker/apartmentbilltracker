const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  description: { type: String, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String },
      isPayer: { type: Boolean, default: true },
      joinedAt: { type: Date, default: Date.now },
      presence: [{ type: String }], // Array of ISO date strings for current billing period
    },
  ],
  billing: {
    start: { type: Date },
    end: { type: Date },
    rent: { type: Number },
    electricity: { type: Number },
    water: { type: Number },
    internet: { type: Number },
    previousReading: { type: Number },
    currentReading: { type: Number },
    updatedAt: { type: Date, default: Date.now },
  },
  // Payment tracking for current billing cycle
  memberPayments: [
    {
      member: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      memberName: { type: String },
      rentStatus: {
        type: String,
        enum: ["pending", "paid", "overdue"],
        default: "pending",
      },
      rentPaidDate: { type: Date },
      electricityStatus: {
        type: String,
        enum: ["pending", "paid", "overdue"],
        default: "pending",
      },
      electricityPaidDate: { type: Date },
      waterStatus: {
        type: String,
        enum: ["pending", "paid", "overdue"],
        default: "pending",
      },
      waterPaidDate: { type: Date },
      internetStatus: {
        type: String,
        enum: ["pending", "paid", "overdue"],
        default: "pending",
      },
      internetPaidDate: { type: Date },
    },
  ],
  billingHistory: [
    {
      start: { type: Date },
      end: { type: Date },
      rent: { type: Number },
      electricity: { type: Number },
      water: { type: Number },
      previousReading: { type: Number },
      currentReading: { type: Number },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  // New: Reference to billing cycles
  billingCycles: [
    { type: mongoose.Schema.Types.ObjectId, ref: "BillingCycle" },
  ],
  currentCycleId: { type: mongoose.Schema.Types.ObjectId, ref: "BillingCycle" }, // Quick reference to active cycle
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Room", roomSchema);
