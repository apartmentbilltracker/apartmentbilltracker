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
    previousReading: { type: Number },
    currentReading: { type: Number },
    updatedAt: { type: Date, default: Date.now },
  },
  billingHistory: [
    {
      start: { type: Date },
      end: { type: Date },
      rent: { type: Number },
      electricity: { type: Number },
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
