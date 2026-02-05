const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    default: "",
  },
  name: {
    type: String,
    default: "", // No name required initially
  },
  email: {
    type: String,
    required: [true, "Please enter your email!"],
    unique: true,
  },
  password: {
    type: String,
    minLength: [4, "Password should be greater than 4 characters"],
    select: false, // Don't return password in queries
  },
  phoneNumber: {
    type: Number,
    unique: true,
    sparse: true,
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
  },
  dateOfBirth: {
    type: Date,
  },
  addresses: [
    {
      name: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
      region: {
        type: String,
        required: true,
      },
      province: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      barangay: {
        type: String,
        required: true,
      },
      street: {
        type: String,
        required: true,
      },
      houseNumber: {
        type: String,
        required: true,
      },
      zipCode: {
        type: Number,
        required: true,
      },
      addressType: {
        type: String,
        enum: ["Home", "Work", "Default"],
        required: true,
      },
      isDefault: {
        type: Boolean,
        default: false,
      },
    },
  ],
  role: {
    type: [String],
    enum: ["user", "seller", "admin"],
    default: ["user"],
    set: function (roles) {
      if (typeof roles === "string") return [roles];
      return roles;
    },
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    default: null,
  },
  avatar: {
    public_id: {
      type: String,
      default: "default_avatar",
    },
    url: {
      type: String,
      default: "https://cdn-icons-png.flaticon.com/512/149/149071.png", // Allow users to upload later
    },
  },
  claimedVouchers: [
    {
      voucher: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher" },
      claimedAt: { type: Date, default: Date.now },
    },
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },
  isVerified: { type: Boolean, default: false },
  activationCode: { type: String },
  activationExpires: { type: Date },
  resetPasswordToken: String,
  resetPasswordExpire: Date,

  resetCode: { type: String },
  resetExpires: { type: Date },

  facebookId: {
    type: String,
    default: null,
  },

  // Expo Push Token for real-time notifications
  expoPushToken: {
    type: String,
    default: null,
  },
  expoPushTokenUpdatedAt: {
    type: Date,
    default: null,
  },
});

// Hash password before saving if modified
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  console.log("Hashing password:", this.password);
  this.password = await bcrypt.hash(this.password, 10);
  console.log("Hashed password:", this.password);
  next();
});

// Generate JWT token
userSchema.methods.getJwtToken = function () {
  return jwt.sign({ _id: this._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRES,
  });
};

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
