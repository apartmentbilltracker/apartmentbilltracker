// Web Version
const express = require("express");
const User = require("../model/user");
const router = express.Router();
const cloudinary = require("cloudinary");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const sendMail = require("../utils/sendMail");
const sendToken = require("../utils/jwtToken");
const { isAuthenticated } = require("../middleware/auth");
const ActivationContent = require("../utils/ActivationContent");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const ResetPasswordEmail = require("../utils/ResetPasswordEmail");

const pendingUsers = new Map();

// Simple register endpoint for mobile app (bypasses email verification for now)
router.post(
  "/register",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email, name, password } = req.body;

      if (!email || !name || !password) {
        return next(
          new ErrorHandler("Email, name, and password are required", 400),
        );
      }

      if (password.length < 6) {
        return next(
          new ErrorHandler("Password must be at least 6 characters", 400),
        );
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return next(new ErrorHandler("User already exists", 400));
      }

      const username = email.split("@")[0];

      const user = new User({
        name,
        email,
        username,
        password, // Password will be hashed by the User model
        isVerified: true, // Auto-verify for mobile app
        role: "user",
        avatar: {
          public_id: "default_avatar",
          url: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
        },
      });

      await user.save();

      // Generate token and send response
      sendToken(user, 201, res, {
        role: user.role,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// create user (send code, not saved yet)
router.post("/create-user", async (req, res, next) => {
  try {
    const { email, name = null, avatar } = req.body;

    // Check if the user already exists
    if (!email) {
      return next(new ErrorHandler("Email is required", 400));
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ErrorHandler("User already exists", 400));
    }

    const username = email.split("@")[0];
    const userName = name || `User${Math.floor(Math.random() * 10000)}`;
    // generate a 6 digit code
    const activationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const expires = Date.now() + 10 * 60 * 1000;

    // default avatar
    let avatarData = {
      public_id: "default_avatar",
      url: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
    };

    if (avatar) {
      try {
        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
          folder: "avatars",
        });
        avatarData = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      } catch (cloudError) {
        return next(new ErrorHandler("Avatar upload failed", 500));
      }
    }

    // Create the new user object with the Cloudinary avatar URL
    pendingUsers.set(email, {
      name: userName,
      email,
      username,
      activationCode,
      activationExpires: expires,
      avatar: avatarData,
      isVerified: false,
    });

    // Send activation email with HTML message
    try {
      await sendMail({
        email,
        subject: "Your Activation Code",
        message: ActivationContent({
          userName: username,
          activationCode,
        }),
      });

      res.status(201).json({
        success: true,
        message: `An activation code has been sent to ${email}`,
      });
    } catch (mailError) {
      console.error("SendMail error:", mailError);
      return next(new ErrorHandler("Failed to send activation email", 500));
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return next(new ErrorHandler(error.message, 500));
  }
}); // original create-user code

// verify activation code (step 2)
router.post("/verify-activation-code", async (req, res, next) => {
  try {
    // console.log("Received Request Body:", req.body);

    const { email, activationCode } = req.body;

    if (!email || !activationCode) {
      return next(
        new ErrorHandler("Email and activation code are required", 400),
      );
    }

    // Find user by email and activation code
    const pending = pendingUsers.get(email);
    if (!pending || pending.activationCode !== activationCode) {
      return next(new ErrorHandler("Invalid activation code", 400));
    }
    if (pending.activationExpires < Date.now()) {
      pendingUsers.delete(email);
      return next(new ErrorHandler("Activation code expired", 400));
    }

    const user = new User({
      name: pending.name,
      email: pending.email,
      username: pending.username,
      avatar: pending.avatar,
      isVerified: true,
    });
    await user.save();

    pendingUsers.delete(email);

    res.status(200).json({
      success: true,
      message: "Activation code verified successfully",
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Resend verification code
router.post(
  "/resend-verification",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email } = req.body;

      if (!email) {
        return next(new ErrorHandler("Email is required", 400));
      }

      const pending = pendingUsers.get(email);
      if (!pending)
        return next(new ErrorHandler("No pending registration found", 404));

      let activationCode = pending.activationCode;
      const currentTime = Date.now();

      if (currentTime > pending.activationExpires) {
        activationCode = Math.floor(100000 + Math.random() * 900000).toString();
        pending.activationCode = activationCode;
        pending.activationExpires = currentTime + 10 * 60 * 1000;
        pendingUsers.set(email, pending);
      }

      try {
        await sendMail({
          email,
          subject: "Your New Activation Code",
          message: ActivationContent({
            userName: pending.username,
            activationCode,
          }),
        });

        res.status(200).json({
          success: true,
          message: `New verification code sent to ${email}`,
        });
      } catch (mailError) {
        console.error("Resend mail error:", mailError);
        return next(new ErrorHandler("Failed to resend activation email", 500));
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Set user password (step 3)
router.post("/set-password", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new ErrorHandler("Email and password are required", 400));
    }

    const user = await User.findOne({ email });

    if (!user || !user.isVerified) {
      return next(new ErrorHandler("User not found or not verrified", 400));
    }

    // dont hash manually, just assign the password
    user.password = password;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password set successfully. You can now log in.",
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// login user
router.post(
  "/login-user",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return next(new ErrorHandler("Please provide all fields!", 400));
      }

      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 400));
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return next(new ErrorHandler("Invalid email or password", 400));
      }

      sendToken(user, 201, res, {
        role: user.role,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Request password reset - send reset link to email
router.post(
  "/password-reset",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email } = req.body;

      if (!email) {
        return next(new ErrorHandler("Please provide email address", 400));
      }

      const user = await User.findOne({ email });

      if (!user) {
        // For security, don't reveal if email exists
        return res.status(200).json({
          success: true,
          message:
            "If this email is registered, you will receive a password reset link.",
        });
      }

      // Generate reset token (valid for 24 hours)
      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      // Store hashed token and expiry in user document
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpire = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await user.save();

      // Send email with reset link
      const resetUrl = `aptbilltracker://reset-password?token=${resetToken}&email=${email}`;

      try {
        await sendMail({
          email: user.email,
          subject: "Password Reset Request - Apartment Bill Tracker",
          html: ResetPasswordEmail({
            name: user.name,
            resetUrl,
          }),
        });

        res.status(200).json({
          success: true,
          message:
            "Password reset link has been sent to your email. Check your inbox.",
        });
      } catch (mailError) {
        // Clear tokens if email fails
        user.resetPasswordToken = null;
        user.resetPasswordExpire = null;
        await user.save();

        return next(
          new ErrorHandler(
            "Failed to send reset email. Please try again later.",
            500,
          ),
        );
      }
    } catch (error) {
      console.error("Password reset error:", error);
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// load user
router.get(
  "/getuser",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      if (!req.user || !req.user._id) {
        return next(new ErrorHandler("User is not authenticated", 400));
      }

      const user = await User.findById(req.user._id);

      if (!user) {
        return next(new ErrorHandler("User doesn't exist", 400));
      }

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// log out user
router.get(
  "/logout",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      res.cookie("token", null, {
        expires: new Date(Date.now()),
        httpOnly: true,
        sameSite: "none",
        secure: true,
      });
      res.status(201).json({
        success: true,
        message: "Log out successfully",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Update username
router.put(
  "/update-username",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const { username } = req.body;
    if (!username) {
      return next(new ErrorHandler("Username is required", 400));
    }
    // Check if username is taken
    const exists = await User.findOne({ username });
    if (exists) {
      return next(new ErrorHandler("Username already taken", 400));
    }
    const user = await User.findById(req.user._id);
    user.username = username;
    await user.save();
    res.status(200).json({ success: true, user });
  }),
);

// update user info
router.put(
  "/update-user-info",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const {
        name,
        phoneNumber,
        gender,
        dateOfBirth, // Updated from age
        email,
      } = req.body;

      const user = await User.findById(req.user._id);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Update other fields
      if (name) user.name = name;
      if (phoneNumber) user.phoneNumber = phoneNumber;
      if (gender) user.gender = gender;
      if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
      // if (email) user.email = email; emailchange

      await user.save();

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// update user avatar
router.put(
  "/update-avatar",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      let existsUser = await User.findById(req.user._id);

      // If no new avatar is provided, reset to default avatar
      if (!req.body.avatar) {
        existsUser.avatar = {
          public_id: "default_avatar",
          url: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
        };
      } else {
        // Delete previous avatar if it's not the default one
        if (existsUser.avatar.public_id !== "default_avatar") {
          await cloudinary.v2.uploader.destroy(existsUser.avatar.public_id);
        }

        // Try to upload new avatar
        try {
          const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
            folder: "avatars",
            width: 150,
          });

          existsUser.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        } catch (cloudinaryError) {
          return next(new ErrorHandler("Failed to upload new avatar", 500));
        }
      }

      await existsUser.save();

      res.status(200).json({
        success: true,
        user: existsUser,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Update user profile (name + avatar combined)
router.put(
  "/update-profile",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { name, avatar } = req.body;
      const user = await User.findById(req.user._id);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Update name if provided
      if (name && name.trim()) {
        user.name = name.trim();
      }

      // Update avatar if provided
      if (avatar) {
        // Delete previous avatar if it's not the default one
        if (user.avatar && user.avatar.public_id !== "default_avatar") {
          try {
            await cloudinary.v2.uploader.destroy(user.avatar.public_id);
          } catch (err) {
            console.log("Error deleting old avatar:", err);
          }
        }

        // Upload new avatar
        try {
          // Avatar comes as base64 string from mobile client
          // Mobile sends only the base64 part (no data: prefix)
          console.log("Avatar data received, length:", avatar.length);

          // Ensure proper data URI format for Cloudinary
          const base64String = avatar.startsWith("data:")
            ? avatar
            : `data:image/jpeg;base64,${avatar}`;

          console.log("Uploading to Cloudinary with base64 string...");
          const myCloud = await cloudinary.v2.uploader.upload(base64String, {
            folder: "avatars",
            width: 150,
            crop: "fill",
            resource_type: "auto",
          });

          console.log("Cloudinary upload successful:", myCloud.public_id);
          user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        } catch (cloudinaryError) {
          console.error("Cloudinary upload error:", cloudinaryError);
          console.error("Error message:", cloudinaryError.message);
          return next(
            new ErrorHandler(
              "Failed to upload avatar: " + cloudinaryError.message,
              500,
            ),
          );
        }
      }

      await user.save();

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Update user addresses
router.put(
  "/update-user-addresses",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      // console.log("Received Payload:", req.body);

      const user = await User.findById(req.user._id);
      // console.log("User:", user);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const { _id, addressType, isDefault, ...addressData } = req.body;

      // Adding a new address
      if (isDefault) {
        // If the new address is set as default, reset all other addresses to non-default
        user.addresses.forEach((address) => {
          address.isDefault = false;
        });
      }

      // Add the new address to the addresses array
      user.addresses.push({ ...addressData, addressType, isDefault });

      // Save the updated user
      await user.save();
      // console.log("Updated User:", user);

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
); // Final working code

// Delete user address
router.delete(
  "/delete-user-address/:addressId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const addressId = req.params.addressId;

      // Find the index of the address to delete
      const addressIndex = user.addresses.findIndex(
        (address) => address._id.toString() === addressId,
      );

      if (addressIndex === -1) {
        return next(new ErrorHandler("Address not found", 404));
      }

      const wasDefault = user.addresses[addressIndex].isDefault;
      // Remove the address from the addresses array
      user.addresses.splice(addressIndex, 1);

      if (wasDefault && user.addresses.length > 0) {
        user.addresses[0].isDefault = true;
      }

      // Save the updated user
      await user.save();

      res.status(200).json({
        success: true,
        message: "Address deleted successfully",
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// unset all user addresses as default
router.put(
  "/set-all-non-default",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.user._id);
    if (!user) return next(new ErrorHandler("User not found", 404));
    user.addresses.forEach((addr) => (addr.isDefault = false));
    await user.save();
    res.status(200).json({ success: true });
  }),
);

// Set default address
router.put(
  "/set-default-address/:addressId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      // console.log("Setting default address:", req.params.addressId); // Log the address ID

      const user = await User.findById(req.user._id);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const addressId = req.params.addressId;

      // Find the address to set as default
      const addressToSetDefault = user.addresses.find(
        (address) => address._id.toString() === addressId,
      );

      if (!addressToSetDefault) {
        return next(new ErrorHandler("Address not found", 404));
      }

      // Reset all addresses to non-default
      user.addresses.forEach((address) => {
        address.isDefault = false;
      });

      // Set the selected address as default
      addressToSetDefault.isDefault = true;

      // Save the updated user
      await user.save();

      // console.log("Default address set successfully:", addressId); // Log success

      res.status(200).json({
        success: true,
        message: "Default address set successfully",
        user,
      });
    } catch (error) {
      console.error("Error setting default address:", error); // Log the error
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Edit user address
router.put(
  "/edit-user-address/:addressId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      // console.log("Editing address:", req.params.addressId); // Log the address ID
      // console.log("Received Payload:", req.body); // Log the updated address data

      const user = await User.findById(req.user._id);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const addressId = req.params.addressId;

      // Find the address to edit
      const addressToEdit = user.addresses.find(
        (address) => address._id.toString() === addressId,
      );

      if (!addressToEdit) {
        return next(new ErrorHandler("Address not found", 404));
      }

      // Update the address fields
      Object.assign(addressToEdit, req.body);

      // If the updated address is set as default, reset all other addresses to non-default
      if (req.body.isDefault) {
        user.addresses.forEach((address) => {
          address.isDefault = false;
        });
        addressToEdit.isDefault = true;
      }

      // Save the updated user
      await user.save();

      // console.log("Address updated successfully:", addressId); // Log success

      res.status(200).json({
        success: true,
        message: "Address updated successfully",
        user,
      });
    } catch (error) {
      console.error("Error updating address:", error); // Log the error
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// update user password
router.put(
  "/update-user-password",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id).select("+password");

      const isPasswordMatched = await user.comparePassword(
        req.body.oldPassword,
      );

      if (!isPasswordMatched) {
        return next(new ErrorHandler("Old password is incorrect", 400));
      }

      if (req.body.newPassword !== req.body.confirmPassword) {
        return next(
          new ErrorHandler("Password don't matched with each other", 400),
        );
      }
      user.password = req.body.newPassword;

      await user.save();

      res.status(200).json({
        success: true,
        message: "Password Updated Successfully",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// forgot password
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new ErrorHandler("Email is required", 400));

    const user = await User.findOne({ email });
    if (!user) return next(new ErrorHandler("User not found", 404));

    // Generate code and expiry
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpires = Date.now() + 10 * 60 * 1000;

    // Save to user (or use a separate field)
    user.resetCode = resetCode;
    user.resetExpires = resetExpires;
    await user.save();

    // Send code to email
    await sendMail({
      email,
      subject: "Your Password Reset Code",
      message: ResetPasswordEmail({
        userName: user.username,
        activationCode: resetCode,
      }),
    });

    res
      .status(200)
      .json({ success: true, message: "Reset code sent to email" });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

router.post("/verify-reset-code", async (req, res, next) => {
  try {
    const { email, resetCode } = req.body;
    if (!email || !resetCode)
      return next(new ErrorHandler("All fields required", 400));

    const user = await User.findOne({ email });
    if (!user || user.resetCode !== resetCode)
      return next(new ErrorHandler("Invalid code", 400));
    if (user.resetExpires < Date.now())
      return next(new ErrorHandler("Code expired", 400));

    res.status(200).json({ success: true, message: "Code verified" });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const { email, resetCode, password } = req.body;
    if (!email || !resetCode || !password)
      return next(new ErrorHandler("All fields required", 400));

    const user = await User.findOne({ email });
    if (!user || user.resetCode !== resetCode)
      return next(new ErrorHandler("Invalid code", 400));
    if (user.resetExpires < Date.now())
      return next(new ErrorHandler("Code expired", 400));

    user.password = password;
    user.resetCode = undefined;
    user.resetExpires = undefined;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password reset successful" });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Google OAuth login
router.post(
  "/google-login",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email, name, avatar } = req.body;

      // Check if user exists
      let user = await User.findOne({ email });

      if (!user) {
        // Create new user if doesn't exist
        user = await User.create({
          name,
          email,
          avatar: {
            public_id: "default_avatar",
            url:
              avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
          },
          isVerified: true, // Google users are pre-verified
          password: Math.random().toString(36).slice(-8), // Random password
        });
      }

      // Generate token and send response
      sendToken(user, 201, res, {
        role: user.role,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// Facebook OAuth login
router.post(
  "/facebook-login",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { email, name, avatar, facebookId } = req.body;

      let user = await User.findOne({ email });

      if (!user) {
        user = await User.create({
          name,
          email,
          avatar: {
            public_id: "default_avatar",
            url:
              avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
          },
          isVerified: true,
          password: Math.random().toString(36).slice(-8),
          facebookId,
        });
      }

      // Generate token and send response
      sendToken(user, 201, res, {
        role: user.role,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

module.exports = router;
