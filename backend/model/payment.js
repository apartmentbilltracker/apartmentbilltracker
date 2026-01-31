const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  billingCycleStart: { type: Date },
  billingCycleEnd: { type: Date },
  billType: {
    type: String,
    enum: ["rent", "electricity", "water", "total"],
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["cash", "bank_transfer", "credit_card", "e_wallet", "other"],
    default: "cash",
  },
  paymentDate: { type: Date, default: Date.now },
  reference: { type: String }, // Receipt number, transaction ID, etc.
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Payment", paymentSchema);
