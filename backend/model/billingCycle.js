const mongoose = require("mongoose");

const billingCycleSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  cycleNumber: { type: Number, required: true }, // 1, 2, 3... for tracking
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ["active", "completed", "archived"],
    default: "active",
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Admin who created this
  closedAt: { type: Date }, // When the cycle was closed
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Admin who closed it

  // Snapshot data for historical reference (stored when cycle closes)
  totalBilledAmount: { type: Number, default: 0 },
  membersCount: { type: Number, default: 0 },
  billBreakdown: {
    rent: { type: Number, default: 0 },
    electricity: { type: Number, default: 0 },
    water: { type: Number, default: 0 },
    internet: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },

  // Billing details for this cycle
  rent: { type: Number },
  electricity: { type: Number },
  waterBillAmount: { type: Number }, // Flat water bill for the cycle
  internet: { type: Number }, // Internet bill amount for the cycle
  previousMeterReading: { type: Number }, // Previous water meter reading
  currentMeterReading: { type: Number }, // Current water meter reading

  // Member presence and charges for this cycle
  memberCharges: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String },
      isPayer: { type: Boolean, default: true },
      presenceDays: { type: Number, default: 0 }, // Number of days present
      waterBillShare: { type: Number, default: 0 }, // Water bill assigned to this member
      rentShare: { type: Number, default: 0 },
      electricityShare: { type: Number, default: 0 },
      internetShare: { type: Number, default: 0 },
      totalDue: { type: Number, default: 0 },
    },
  ],

  // References to bills and expenses
  bills: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bill" }],
  expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Expense" }],

  // Notes/description
  notes: { type: String, default: "" },

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Index for efficient queries
billingCycleSchema.index({ room: 1, cycleNumber: 1 });
billingCycleSchema.index({ room: 1, status: 1 });
billingCycleSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model("BillingCycle", billingCycleSchema);
