// Payment Processing Controller - Phase 3
const express = require("express");
const router = express.Router();
const PaymentTransaction = require("../model/paymentTransaction");
const Room = require("../model/room");
const User = require("../model/user");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");
const crypto = require("crypto");

// Helper: Generate QR code data for GCash
const generateGCashQRData = (amount, referenceNumber, merchantId) => {
  // Format: gcash|{amount}|{reference}|{merchantId}
  return `gcash|${amount}|${referenceNumber}|${merchantId}`;
};

// 1. Initiate GCash Payment
router.post(
  "/initiate-gcash",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, amount, billType } = req.body;

      if (!roomId || !amount || !billType) {
        return next(
          new ErrorHandler("Room ID, Amount, and Bill Type are required", 400),
        );
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Generate unique reference number
      const referenceNumber = `GCASH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create payment transaction record
      const transaction = new PaymentTransaction({
        room: roomId,
        payer: req.user._id,
        amount,
        billType,
        paymentMethod: "gcash",
        status: "pending",
        gcash: {
          referenceNumber,
          merchantId: process.env.GCASH_MERCHANT_ID || "ABT-MERCHANT-001",
        },
        billingCycleStart: room.billing.start,
        billingCycleEnd: room.billing.end,
      });

      await transaction.save();

      // Generate QR code data
      const qrData = generateGCashQRData(
        amount,
        referenceNumber,
        transaction.gcash.merchantId,
      );

      res.status(200).json({
        success: true,
        message: "GCash payment initiated",
        transaction: {
          _id: transaction._id,
          referenceNumber,
          amount,
          billType,
          status: "pending",
        },
        qrData, // Client will generate QR code from this
        instructions: `Send ₱${amount} to GCash with reference: ${referenceNumber}`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 2. Verify GCash Payment (Webhook or manual verification)
router.post(
  "/verify-gcash",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { transactionId, gcashReferenceNumber, mobileNumber } = req.body;

      if (!transactionId) {
        return next(new ErrorHandler("Transaction ID is required", 400));
      }

      const transaction = await PaymentTransaction.findById(transactionId);
      if (!transaction) {
        return next(new ErrorHandler("Transaction not found", 404));
      }

      if (transaction.status !== "pending") {
        return next(new ErrorHandler("Transaction is already processed", 400));
      }

      // Update GCash details
      transaction.gcash.transactionId = gcashReferenceNumber;
      transaction.gcash.mobileNumber = mobileNumber;
      transaction.status = "completed";
      transaction.completionDate = new Date();

      await transaction.save();

      // Update room payment status
      const room = await Room.findById(transaction.room);
      if (room) {
        const memberPayment = room.memberPayments.find(
          (mp) => mp.member.toString() === transaction.payer.toString(),
        );

        if (memberPayment) {
          if (transaction.billType === "rent") {
            memberPayment.rentStatus = "paid";
            memberPayment.rentPaidDate = new Date();
          } else if (transaction.billType === "electricity") {
            memberPayment.electricityStatus = "paid";
            memberPayment.electricityPaidDate = new Date();
          } else if (transaction.billType === "water") {
            memberPayment.waterStatus = "paid";
            memberPayment.waterPaidDate = new Date();
          }
        }

        await room.save();
      }

      res.status(200).json({
        success: true,
        message: "GCash payment verified and completed",
        transaction,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 3. Initiate Bank Transfer Payment
router.post(
  "/initiate-bank-transfer",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId, amount, billType } = req.body;

      if (!roomId || !amount || !billType) {
        return next(
          new ErrorHandler("Room ID, Amount, and Bill Type are required", 400),
        );
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Generate reference number
      const referenceNumber = `BT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create payment transaction
      const transaction = new PaymentTransaction({
        room: roomId,
        payer: req.user._id,
        amount,
        billType,
        paymentMethod: "bank_transfer",
        status: "pending",
        bankTransfer: {
          referenceNumber,
          bankName: process.env.BANK_NAME || "BDO",
          accountName:
            process.env.BANK_ACCOUNT_NAME || "Apartment Bill Tracker",
          accountNumber: process.env.BANK_ACCOUNT_NUMBER || "XXXX-XXXX-XXXX",
        },
        billingCycleStart: room.billing.start,
        billingCycleEnd: room.billing.end,
      });

      await transaction.save();

      res.status(200).json({
        success: true,
        message: "Bank transfer initiated",
        transaction: {
          _id: transaction._id,
          referenceNumber,
          amount,
          billType,
          status: "pending",
        },
        bankDetails: transaction.bankTransfer,
        instructions: `Transfer ₱${amount} using reference: ${referenceNumber}. Bank: ${transaction.bankTransfer.bankName}, Account: ${transaction.bankTransfer.accountName}`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 4. Confirm Bank Transfer Payment (with proof upload)
router.post(
  "/confirm-bank-transfer",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { transactionId, depositDate, proofImageUrl } = req.body;

      if (!transactionId || !depositDate) {
        return next(
          new ErrorHandler("Transaction ID and Deposit Date are required", 400),
        );
      }

      const transaction = await PaymentTransaction.findById(transactionId);
      if (!transaction) {
        return next(new ErrorHandler("Transaction not found", 404));
      }

      if (transaction.status !== "pending") {
        return next(new ErrorHandler("Transaction is already processed", 400));
      }

      // Update bank transfer details
      transaction.bankTransfer.depositDate = new Date(depositDate);
      transaction.bankTransfer.depositProof = proofImageUrl;
      transaction.status = "completed";
      transaction.completionDate = new Date();

      await transaction.save();

      // Update room payment status
      const room = await Room.findById(transaction.room);
      if (room) {
        const memberPayment = room.memberPayments.find(
          (mp) => mp.member.toString() === transaction.payer.toString(),
        );

        if (memberPayment) {
          if (transaction.billType === "rent") {
            memberPayment.rentStatus = "paid";
            memberPayment.rentPaidDate = new Date();
          } else if (transaction.billType === "electricity") {
            memberPayment.electricityStatus = "paid";
            memberPayment.electricityPaidDate = new Date();
          } else if (transaction.billType === "water") {
            memberPayment.waterStatus = "paid";
            memberPayment.waterPaidDate = new Date();
          }
        }

        await room.save();
      }

      res.status(200).json({
        success: true,
        message: "Bank transfer payment confirmed",
        transaction,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 5. Record Cash Payment
router.post(
  "/record-cash",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const {
        roomId,
        amount,
        billType,
        receiptNumber,
        receivedBy,
        witnessName,
        notes,
      } = req.body;

      if (!roomId || !amount || !billType || !receivedBy) {
        return next(
          new ErrorHandler(
            "Room ID, Amount, Bill Type, and Received By are required",
            400,
          ),
        );
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }

      // Create payment transaction
      const transaction = new PaymentTransaction({
        room: roomId,
        payer: req.user._id,
        amount,
        billType,
        paymentMethod: "cash",
        status: "completed",
        completionDate: new Date(),
        cash: {
          receiptNumber: receiptNumber || `CASH-${Date.now()}`,
          receivedBy,
          witnessName,
          notes,
        },
        billingCycleStart: room.billing.start,
        billingCycleEnd: room.billing.end,
      });

      await transaction.save();

      // Update room payment status
      const memberPayment = room.memberPayments.find(
        (mp) => mp.member.toString() === req.user._id.toString(),
      );

      if (memberPayment) {
        if (billType === "rent") {
          memberPayment.rentStatus = "paid";
          memberPayment.rentPaidDate = new Date();
        } else if (billType === "electricity") {
          memberPayment.electricityStatus = "paid";
          memberPayment.electricityPaidDate = new Date();
        } else if (billType === "water") {
          memberPayment.waterStatus = "paid";
          memberPayment.waterPaidDate = new Date();
        }
      }

      await room.save();

      res.status(200).json({
        success: true,
        message: "Cash payment recorded",
        transaction,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 6. Get Payment Transactions (for member)
router.get(
  "/transactions/:roomId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const { status, paymentMethod } = req.query;

      let query = { room: roomId };

      if (status) {
        query.status = status;
      }
      if (paymentMethod) {
        query.paymentMethod = paymentMethod;
      }

      const transactions = await PaymentTransaction.find(query)
        .populate("payer", "name email")
        .populate("room", "name")
        .sort({ transactionDate: -1 });

      res.status(200).json({
        success: true,
        transactions,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 7. Get Single Transaction
router.get(
  "/transaction/:transactionId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { transactionId } = req.params;

      const transaction = await PaymentTransaction.findById(transactionId)
        .populate("payer", "name email")
        .populate("room", "name");

      if (!transaction) {
        return next(new ErrorHandler("Transaction not found", 404));
      }

      res.status(200).json({
        success: true,
        transaction,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// 8. Get Transaction Statistics (for analytics)
router.get(
  "/analytics/:roomId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { roomId } = req.params;

      const transactions = await PaymentTransaction.find({
        room: roomId,
        status: "completed",
      });

      // Calculate stats
      const totalPaid = transactions.reduce((sum, t) => sum + t.amount, 0);
      const totalPending = await PaymentTransaction.countDocuments({
        room: roomId,
        status: "pending",
      });

      // By payment method
      const byMethod = {
        gcash: transactions
          .filter((t) => t.paymentMethod === "gcash")
          .reduce((sum, t) => sum + t.amount, 0),
        bank_transfer: transactions
          .filter((t) => t.paymentMethod === "bank_transfer")
          .reduce((sum, t) => sum + t.amount, 0),
        cash: transactions
          .filter((t) => t.paymentMethod === "cash")
          .reduce((sum, t) => sum + t.amount, 0),
      };

      // By bill type
      const byBillType = {
        rent: transactions
          .filter((t) => t.billType === "rent")
          .reduce((sum, t) => sum + t.amount, 0),
        electricity: transactions
          .filter((t) => t.billType === "electricity")
          .reduce((sum, t) => sum + t.amount, 0),
        water: transactions
          .filter((t) => t.billType === "water")
          .reduce((sum, t) => sum + t.amount, 0),
      };

      // By payer (per member contribution)
      const byPayer = {};
      for (const transaction of transactions) {
        const payerName = transaction.payer.name || "Unknown";
        if (!byPayer[payerName]) {
          byPayer[payerName] = 0;
        }
        byPayer[payerName] += transaction.amount;
      }

      res.status(200).json({
        success: true,
        analytics: {
          totalPaid,
          totalPending,
          byMethod,
          byBillType,
          byPayer,
          transactionCount: transactions.length,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

module.exports = router;
