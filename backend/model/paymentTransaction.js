const mongoose = require("mongoose");

const paymentTransactionSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  payer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  billType: {
    type: String,
    enum: ["rent", "electricity", "water", "total"],
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["gcash", "bank_transfer", "cash"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "cancelled"],
    default: "pending",
  },

  // GCash specific fields
  gcash: {
    referenceNumber: String,
    mobileNumber: String,
    merchantId: String,
    transactionId: String,
  },

  // Bank Transfer specific fields
  bankTransfer: {
    bankName: String,
    accountName: String,
    accountNumber: String,
    referenceNumber: String, // Check number or transfer reference
    depositDate: Date,
    depositProof: String, // URL to uploaded proof image
  },

  // Cash specific fields
  cash: {
    receiptNumber: String,
    receivedBy: String, // Who received the cash
    witnessName: String, // Optional witness
    notes: String,
  },

  // Common fields
  transactionDate: { type: Date, default: Date.now },
  completionDate: Date, // When payment was confirmed
  cancellationDate: Date, // When payment was cancelled by user
  receiptUrl: String, // Generated receipt URL
  billingCycleStart: Date,
  billingCycleEnd: Date,

  // For tracking
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("PaymentTransaction", paymentTransactionSchema);
