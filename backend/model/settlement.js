const mongoose = require("mongoose");

const settlementSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  debtor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Person who owes
  creditor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }, // Person to be paid
  amount: { type: Number, required: true },
  billingCycleStart: { type: Date },
  billingCycleEnd: { type: Date },
  status: {
    type: String,
    enum: ["pending", "settled", "partial"],
    default: "pending",
  },
  settlementDate: { type: Date }, // When it was settled
  settlementAmount: { type: Number, default: 0 }, // How much was paid
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Settlement", settlementSchema);
