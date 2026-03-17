/**
 * User Controller - Supabase Version
 * Handles authentication and user management with Supabase PostgreSQL
 */

const express = require("express");
const SupabaseService = require("../db/SupabaseService");
const supabase = require("../db/SupabaseClient");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const sendMail = require("../utils/sendMail");
const { isAuthenticated } = require("../middleware/auth");
const ActivationContent = require("../utils/ActivationContent");
const ResetPasswordEmail = require("../utils/ResetPasswordEmail");
const avatarCache = require("../utils/MemoryCache");
const { uploadAvatarToStorage } = require("../utils/supabaseStorage");
const activityTracker = require("../utils/activityTracker");

// In-memory store for pending users (10-minute expiry)
const pendingUsers = new Map();

// Cleanup expired pending users every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [email, data] of pendingUsers.entries()) {
      if (data.activationExpires < now) {
        pendingUsers.delete(email);
      }
    }
  },
  5 * 60 * 1000,
);

// ============ AUTHENTICATION ENDPOINTS ============

/**
 * Step 1: Create user (send activation code)
 * POST /api/v2/user/create-user
 */
router.post(
  "/create-user",
  catchAsyncErrors(async (req, res, next) => {
    const { email, name } = req.body;

    // Validation
    if (!email) {
      return next(new ErrorHandler("Email is required", 400));
    }

    if (!name) {
      return next(new ErrorHandler("Name is required", 400));
    }

    // Check if user already exists in Supabase
    const existingUser = await SupabaseService.findUserByEmail(email);
    if (existingUser) {
      return next(new ErrorHandler("User already exists", 400));
    }

    // Check if already in pending registration
    if (pendingUsers.has(email)) {
      return next(
        new ErrorHandler(
          "Registration already in progress for this email. Check your inbox.",
          400,
        ),
      );
    }

    try {
      // Generate 6-digit activation code
      const activationCode = Math.floor(
        100000 + Math.random() * 900000,
      ).toString();
      const activationExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

      // Store in pending users
      pendingUsers.set(email, {
        name,
        email,
        activationCode,
        activationExpires,
        createdAt: Date.now(),
      });

      // Send activation email
      await sendMail({
        email,
        subject: "Verify Your Apartment Bill Tracker Account",
        message: ActivationContent({
          userName: name,
          activationCode,
        }),
      });

      res.status(201).json({
        success: true,
        message: `Activation code sent to ${email}. It will expire in 15 minutes.`,
      });
    } catch (error) {
      pendingUsers.delete(email);
      return next(new ErrorHandler("Failed to send activation email", 500));
    }
  }),
);

/**
 * Step 2: Verify activation code
 * POST /api/v2/user/verify-activation-code
 */
router.post(
  "/verify-activation-code",
  catchAsyncErrors(async (req, res, next) => {
    const { email, activationCode } = req.body;

    // Validation
    if (!email || !activationCode) {
      return next(
        new ErrorHandler("Email and activation code are required", 400),
      );
    }

    // Check pending user
    const pending = pendingUsers.get(email);
    if (!pending) {
      return next(
        new ErrorHandler(
          "No pending registration found. Please start signup again.",
          400,
        ),
      );
    }

    // Verify code
    if (pending.activationCode !== activationCode) {
      return next(new ErrorHandler("Invalid activation code", 400));
    }

    // Check expiry
    if (pending.activationExpires < Date.now()) {
      pendingUsers.delete(email);
      return next(
        new ErrorHandler(
          "Activation code expired. Please request a new one.",
          400,
        ),
      );
    }

    // Mark as verified
    pending.verified = true;

    res.status(200).json({
      success: true,
      message: "Email verified successfully. Please set your password.",
    });
  }),
);

/**
 * Resend activation code
 * POST /api/v2/user/resend-verification
 */
router.post(
  "/resend-verification",
  catchAsyncErrors(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
      return next(new ErrorHandler("Email is required", 400));
    }

    const pending = pendingUsers.get(email);
    if (!pending) {
      return next(new ErrorHandler("No pending registration found", 404));
    }

    try {
      // Check resend cooldown (60 seconds)
      if (
        pending.lastResendTime &&
        Date.now() - pending.lastResendTime < 60000
      ) {
        return next(
          new ErrorHandler("Please wait 60 seconds before resending", 429),
        );
      }

      // Generate new code
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      pending.activationCode = newCode;
      pending.activationExpires = Date.now() + 15 * 60 * 1000;
      pending.lastResendTime = Date.now();

      // Send email
      await sendMail({
        email,
        subject: "Your New Verification Code - Apartment Bill Tracker",
        message: ActivationContent({
          userName: pending.name,
          activationCode: newCode,
        }),
      });

      res.status(200).json({
        success: true,
        message: "New verification code sent to your email",
      });
    } catch (error) {
      return next(new ErrorHandler("Failed to resend verification code", 500));
    }
  }),
);

/**
 * Step 3: Set password (complete signup)
 * POST /api/v2/user/set-password
 */
router.post(
  "/set-password",
  catchAsyncErrors(async (req, res, next) => {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return next(new ErrorHandler("Email and password are required", 400));
    }

    if (password.length < 6) {
      return next(
        new ErrorHandler("Password must be at least 6 characters", 400),
      );
    }

    // Check pending user and verification
    const pending = pendingUsers.get(email);
    if (!pending || !pending.verified) {
      return next(
        new ErrorHandler(
          "Please verify your email first. Registration not valid.",
          400,
        ),
      );
    }

    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user in Supabase
      const user = await SupabaseService.createUser({
        name: pending.name,
        email: pending.email,
        password_hash: hashedPassword,
        username: email.split("@")[0],
        role: "client",
        is_admin: false,
      });

      // Remove from pending
      pendingUsers.delete(email);

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET_KEY,
        { expiresIn: process.env.JWT_EXPIRES || "7d" },
      );

      res.status(201).json({
        success: true,
        message: "Account created successfully!",
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      return next(
        new ErrorHandler(error.message || "Failed to create account", 500),
      );
    }
  }),
);

/**
 * Login user
 * POST /api/v2/user/login-user
 */
router.post(
  "/login-user",
  catchAsyncErrors(async (req, res, next) => {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return next(new ErrorHandler("Email and password are required", 400));
    }

    try {
      // Find user (need password_hash for bcrypt + avatar for response)
      const user = await SupabaseService.findUserByEmail(email, {
        withPassword: true,
      });
      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 401));
      }

      // If user signed up via OAuth and has no password, prompt them
      if (
        !user.password_hash &&
        user.auth_provider &&
        user.auth_provider !== "email"
      ) {
        return next(
          new ErrorHandler(
            `This account uses ${user.auth_provider} login. Please sign in with ${user.auth_provider}.`,
            400,
          ),
        );
      }

      // Check password
      const isPasswordMatch = await bcrypt.compare(
        password,
        user.password_hash,
      );
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid email or password", 401));
      }

      // Block deactivated accounts
      if (user.is_active === false) {
        return next(
          new ErrorHandler(
            "Your account has been deactivated. Please contact support.",
            403,
          ),
        );
      }

      // Generate token
      const token = jwt.sign(
        { _id: user.id, id: user.id, email: user.email },
        process.env.JWT_SECRET_KEY,
        { expiresIn: process.env.JWT_EXPIRES || "7d" },
      );

      res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          is_admin: user.is_admin,
          avatar: user.avatar,
          auth_provider: user.auth_provider || "email",
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message || "Login failed", 500));
    }
  }),
);

// ============ SOCIAL / OAUTH LOGIN ============

/**
 * Helper: sign JWT for a user (reused by Google & Facebook login)
 */
function signUserToken(user) {
  return jwt.sign(
    { _id: user.id, id: user.id, email: user.email },
    process.env.JWT_SECRET_KEY,
    { expiresIn: process.env.JWT_EXPIRES || "7d" },
  );
}

/**
 * Helper: build the standard user response payload
 */
function userPayload(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    is_admin: user.is_admin,
    avatar: user.avatar,
    auth_provider: user.auth_provider || "email",
  };
}

/**
 * Google login / signup
 * POST /api/v2/user/google-login
 *
 * Body: { email, name, avatar, accessToken }
 * – accessToken is verified server-side with Google's userinfo endpoint
 */
router.post(
  "/google-login",
  catchAsyncErrors(async (req, res, next) => {
    const { email, name, avatar, accessToken } = req.body;

    if (!email) {
      return next(new ErrorHandler("Email is required", 400));
    }

    try {
      // ── Verify the Google access token server-side ──
      if (accessToken) {
        const googleRes = await fetch(
          `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
        );
        if (!googleRes.ok) {
          return next(new ErrorHandler("Invalid Google access token", 401));
        }
        const googleData = await googleRes.json();
        if (googleData.email !== email) {
          return next(new ErrorHandler("Google email mismatch", 401));
        }
      }

      // ── Find or create user ──
      let user = await SupabaseService.findUserByEmail(email, {
        withAvatar: true,
      });

      if (!user) {
        // New user — create account
        const userData = {
          name: name || email.split("@")[0],
          email,
          password_hash: null,
          username: email.split("@")[0],
          role: "client",
          is_admin: false,
        };

        // Attach avatar if provided
        if (avatar) {
          userData.avatar = JSON.stringify({
            public_id: "google_avatar",
            url: avatar,
          });
        }

        // Try with auth_provider column; fall back without it
        try {
          userData.auth_provider = "google";
          user = await SupabaseService.createUser(userData);
        } catch (colErr) {
          if (colErr.message && colErr.message.includes("auth_provider")) {
            delete userData.auth_provider;
            user = await SupabaseService.createUser(userData);
          } else {
            throw colErr;
          }
        }
      } else {
        // Existing user — optionally update avatar
        if (avatar && !user.avatar) {
          try {
            await SupabaseService.updateUser(user.id, {
              avatar: JSON.stringify({
                public_id: "google_avatar",
                url: avatar,
              }),
            });
          } catch (_) {
            /* ignore avatar update failure */
          }
        }

        // Optionally tag provider (best-effort)
        if (!user.auth_provider) {
          try {
            await SupabaseService.updateUser(user.id, {
              auth_provider: "google",
            });
          } catch (_) {
            /* column may not exist yet */
          }
        }

        // Block deactivated accounts
        if (user.is_active === false) {
          return next(
            new ErrorHandler(
              "Your account has been deactivated. Please contact support.",
              403,
            ),
          );
        }
      }

      const token = signUserToken(user);

      res.status(200).json({
        success: true,
        message: "Google login successful",
        token,
        user: userPayload(user),
      });
    } catch (error) {
      console.error("Google login error:", error);
      return next(
        new ErrorHandler(error.message || "Google login failed", 500),
      );
    }
  }),
);

/**
 * Facebook login / signup
 * POST /api/v2/user/facebook-login
 *
 * Body: { email, name, avatar, accessToken }
 * – accessToken is verified server-side with Facebook's Graph API
 */
router.post(
  "/facebook-login",
  catchAsyncErrors(async (req, res, next) => {
    const { email, name, avatar, accessToken } = req.body;

    if (!email) {
      return next(new ErrorHandler("Email is required", 400));
    }

    try {
      // ── Verify the Facebook access token server-side ──
      if (accessToken) {
        const fbRes = await fetch(
          `https://graph.facebook.com/me?fields=email,name&access_token=${accessToken}`,
        );
        if (!fbRes.ok) {
          return next(new ErrorHandler("Invalid Facebook access token", 401));
        }
        const fbData = await fbRes.json();
        if (fbData.email && fbData.email !== email) {
          return next(new ErrorHandler("Facebook email mismatch", 401));
        }
      }

      // ── Find or create user ──
      let user = await SupabaseService.findUserByEmail(email, {
        withAvatar: true,
      });

      if (!user) {
        const userData = {
          name: name || email.split("@")[0],
          email,
          password_hash: null,
          username: email.split("@")[0],
          role: "client",
          is_admin: false,
        };

        if (avatar) {
          userData.avatar = JSON.stringify({
            public_id: "facebook_avatar",
            url: avatar,
          });
        }

        try {
          userData.auth_provider = "facebook";
          user = await SupabaseService.createUser(userData);
        } catch (colErr) {
          if (colErr.message && colErr.message.includes("auth_provider")) {
            delete userData.auth_provider;
            user = await SupabaseService.createUser(userData);
          } else {
            throw colErr;
          }
        }
      } else {
        if (avatar && !user.avatar) {
          try {
            await SupabaseService.updateUser(user.id, {
              avatar: JSON.stringify({
                public_id: "facebook_avatar",
                url: avatar,
              }),
            });
          } catch (_) {
            /* ignore */
          }
        }

        if (!user.auth_provider) {
          try {
            await SupabaseService.updateUser(user.id, {
              auth_provider: "facebook",
            });
          } catch (_) {
            /* column may not exist yet */
          }
        }

        // Block deactivated accounts
        if (user.is_active === false) {
          return next(
            new ErrorHandler(
              "Your account has been deactivated. Please contact support.",
              403,
            ),
          );
        }
      }

      const token = signUserToken(user);

      res.status(200).json({
        success: true,
        message: "Facebook login successful",
        token,
        user: userPayload(user),
      });
    } catch (error) {
      console.error("Facebook login error:", error);
      return next(
        new ErrorHandler(error.message || "Facebook login failed", 500),
      );
    }
  }),
);

// ============ SERVER-SIDE FACEBOOK OAUTH ============
// These two routes handle the browser-based Facebook OAuth flow for the mobile app.
// The mobile app opens a WebBrowser session to /auth/facebook, which redirects the
// user to Facebook, and Facebook then calls /auth/facebook/callback (an HTTPS URL
// Facebook accepts). The backend completes the flow and deep-links back into the app.

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || "1296319515642952";
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || "";
const BACKEND_URL =
  process.env.BACKEND_URL || "https://apartmentbilltracker-server.onrender.com";
const MOBILE_DEEP_LINK = "aptbilltracker://oauth";

/**
 * Initiate Facebook OAuth
 * GET /api/v2/user/auth/facebook
 * The mobile app opens this URL in a WebBrowser session.
 */
router.get("/auth/facebook", (req, res) => {
  const redirectUri = encodeURIComponent(
    `${BACKEND_URL}/api/v2/user/auth/facebook/callback`,
  );
  // Use literal comma between scopes — Facebook's OAuth dialog expects this format.
  // public_profile is granted by default; email requires the permission to be
  // added in Facebook Developer Console → App Review → Permissions and Features.
  const fbAuthUrl = `https://www.facebook.com/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${redirectUri}&scope=public_profile,email&response_type=code`;
  res.redirect(fbAuthUrl);
});

/**
 * Facebook OAuth callback
 * GET /api/v2/user/auth/facebook/callback
 * Facebook redirects here after the user approves. We exchange the code for a token,
 * fetch user info, create/find user, then deep-link back into the mobile app.
 */
router.get(
  "/auth/facebook/callback",
  catchAsyncErrors(async (req, res) => {
    const { code, error } = req.query;

    if (error || !code) {
      // User denied / something went wrong — deep-link back with error
      return res.redirect(
        `${MOBILE_DEEP_LINK}?success=false&error=${encodeURIComponent(error || "Facebook login cancelled")}`,
      );
    }

    try {
      const callbackUri = encodeURIComponent(
        `${BACKEND_URL}/api/v2/user/auth/facebook/callback`,
      );

      // Exchange code for access token
      const tokenRes = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${callbackUri}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`,
      );
      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        return res.redirect(
          `${MOBILE_DEEP_LINK}?success=false&error=${encodeURIComponent(tokenData.error?.message || "Failed to get access token")}`,
        );
      }

      // Fetch user info
      const profileRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${tokenData.access_token}`,
      );
      const profile = await profileRes.json();

      if (!profile.email) {
        return res.redirect(
          `${MOBILE_DEEP_LINK}?success=false&error=${encodeURIComponent("Facebook account has no email. Please use Google or email login.")}`,
        );
      }

      // Find or create user
      let user = await SupabaseService.findUserByEmail(profile.email, {
        withAvatar: true,
      });

      const avatarUrl = profile.picture?.data?.url || null;

      if (!user) {
        const userData = {
          name: profile.name || profile.email.split("@")[0],
          email: profile.email,
          password_hash: null,
          username: profile.email.split("@")[0],
          role: "client",
          is_admin: false,
        };
        if (avatarUrl) {
          userData.avatar = JSON.stringify({
            public_id: "facebook_avatar",
            url: avatarUrl,
          });
        }
        try {
          userData.auth_provider = "facebook";
          user = await SupabaseService.createUser(userData);
        } catch (colErr) {
          if (colErr.message?.includes("auth_provider")) {
            delete userData.auth_provider;
            user = await SupabaseService.createUser(userData);
          } else throw colErr;
        }
      } else {
        if (user.is_active === false) {
          return res.redirect(
            `${MOBILE_DEEP_LINK}?success=false&error=${encodeURIComponent("Account deactivated. Contact support.")}`,
          );
        }
        if (avatarUrl && !user.avatar) {
          try {
            await SupabaseService.updateUser(user.id, {
              avatar: JSON.stringify({
                public_id: "facebook_avatar",
                url: avatarUrl,
              }),
            });
          } catch (_) {}
        }
        if (!user.auth_provider) {
          try {
            await SupabaseService.updateUser(user.id, {
              auth_provider: "facebook",
            });
          } catch (_) {}
        }
      }

      const token = signUserToken(user);
      const userJson = encodeURIComponent(JSON.stringify(userPayload(user)));

      // Deep-link back into the mobile app with token + user data
      res.redirect(
        `${MOBILE_DEEP_LINK}?success=true&token=${token}&user=${userJson}`,
      );
    } catch (err) {
      console.error("Facebook OAuth callback error:", err);
      res.redirect(
        `${MOBILE_DEEP_LINK}?success=false&error=${encodeURIComponent("Facebook login failed")}`,
      );
    }
  }),
);

/**
 * Request password reset (sends 6-digit code)
 * POST /api/v2/user/forgot-password
 */
router.post(
  "/forgot-password",
  catchAsyncErrors(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
      return next(new ErrorHandler("Email is required", 400));
    }

    try {
      const user = await SupabaseService.findUserByEmail(email);

      // Don't reveal if email exists (security best practice)
      if (!user) {
        return res.status(200).json({
          success: true,
          message:
            "If this email is registered, you will receive a password reset code.",
        });
      }

      // Generate 6-digit code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Store code and expiry (15 minutes)
      await SupabaseService.updateUser(user.id, {
        reset_password_token: resetCode,
        reset_password_expire: new Date(Date.now() + 15 * 60 * 1000),
      });

      // Send reset email with 6-digit code
      await sendMail({
        email: user.email,
        subject: "Password Reset Code - Apartment Bill Tracker",
        message: ResetPasswordEmail({
          userName: user.name,
          activationCode: resetCode,
        }),
      });

      res.status(200).json({
        success: true,
        message:
          "If this email is registered, you will receive a password reset code.",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      return next(
        new ErrorHandler("Failed to process password reset request", 500),
      );
    }
  }),
);

/**
 * Verify reset code
 * POST /api/v2/user/verify-reset-code
 */
router.post(
  "/verify-reset-code",
  catchAsyncErrors(async (req, res, next) => {
    const { email, resetCode } = req.body;

    if (!email || !resetCode) {
      return next(new ErrorHandler("Email and reset code are required", 400));
    }

    try {
      const user = await SupabaseService.findUserByEmail(email, {
        withResetToken: true,
      });
      if (!user) {
        return next(new ErrorHandler("Invalid reset code", 400));
      }

      if (
        user.reset_password_token !== resetCode ||
        !user.reset_password_expire ||
        new Date(user.reset_password_expire) < new Date()
      ) {
        return next(new ErrorHandler("Invalid or expired reset code", 400));
      }

      res.status(200).json({
        success: true,
        message: "Code verified successfully",
      });
    } catch (error) {
      return next(new ErrorHandler("Failed to verify reset code", 500));
    }
  }),
);

/**
 * Reset password with code
 * POST /api/v2/user/reset-password
 */
router.post(
  "/reset-password",
  catchAsyncErrors(async (req, res, next) => {
    const { email, resetCode, password } = req.body;

    if (!email || !resetCode || !password) {
      return next(
        new ErrorHandler(
          "Email, reset code, and new password are required",
          400,
        ),
      );
    }

    if (password.length < 6) {
      return next(
        new ErrorHandler("Password must be at least 6 characters", 400),
      );
    }

    try {
      const user = await SupabaseService.findUserByEmail(email, {
        withResetToken: true,
      });
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Verify code
      if (
        user.reset_password_token !== resetCode ||
        !user.reset_password_expire ||
        new Date(user.reset_password_expire) < new Date()
      ) {
        return next(new ErrorHandler("Invalid or expired reset code", 400));
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update password and clear reset token
      await SupabaseService.updateUser(user.id, {
        password_hash: hashedPassword,
        reset_password_token: null,
        reset_password_expire: null,
      });

      res.status(200).json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error) {
      return next(new ErrorHandler("Failed to reset password", 500));
    }
  }),
);

/**
 * Logout user (client-side handles token cleanup)
 * POST /api/v2/user/logout
 */
router.post(
  "/logout",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    activityTracker.setOffline(req.user.id);
    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  }),
);

/**
 * Get user profile
 * GET /api/v2/user/me
 */
router.get(
  "/me",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      // withAvatar: false — avatar column can hold a 2–5 MB base64 blob.
      // Flip to true only after migrate-avatars.js has run (all rows have Storage URLs).
      // Profile screens call /avatar-image/:email as fallback.
      const user = await SupabaseService.findUserById(req.user.id, {
        withAvatar: false,
      });
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
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

/**
 * Get user profile (alias for mobile app)
 * GET /api/v2/user/getuser
 */
router.get(
  "/getuser",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      // withAvatar: false — same reasoning as /me above.
      // After migrate-avatars.js completes, change to withAvatar: true.
      const user = await SupabaseService.findUserById(req.user.id, {
        withAvatar: false,
      });
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
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

/**
 * Update user profile
 * PUT /api/v2/user/update-profile
 */
router.put(
  "/update-profile",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { name, gender, dateOfBirth, phoneNumber, avatar } = req.body;

      const updates = {};
      if (name) updates.name = name;
      if (gender) updates.gender = gender;
      if (dateOfBirth) updates.date_of_birth = dateOfBirth;
      if (phoneNumber) updates.phone_number = phoneNumber;

      // Handle avatar update — upload to Supabase Storage (CDN) instead of
      // storing base64 in the DB column (which costs 2–5 MB of egress per read).
      if (avatar) {
        try {
          const base64Url = avatar.startsWith("data:image")
            ? avatar
            : `data:image/jpeg;base64,${avatar}`;
          const publicUrl = await uploadAvatarToStorage(req.user.id, base64Url);
          updates.avatar = JSON.stringify({
            public_id: "user_avatar",
            url: publicUrl, // Supabase Storage public URL (tiny string)
          });
          // Bust the in-memory avatar cache so the new image is served immediately.
          avatarCache.del(`avatar:${req.user.email?.toLowerCase()}`);
        } catch (storageErr) {
          // Storage unavailable — fall back to DB base64 (old behaviour).
          console.error(
            "⚠️  Storage upload failed, falling back to DB storage:",
            storageErr.message,
          );
          const avatarUrl = avatar.startsWith("data:image")
            ? avatar
            : `data:image/jpeg;base64,${avatar}`;
          updates.avatar = JSON.stringify({
            public_id: "user_avatar",
            url: avatarUrl,
          });
        }
      }

      try {
        const updatedUser = await SupabaseService.updateUser(
          req.user.id,
          updates,
        );

        res.status(200).json({
          success: true,
          message: "Profile updated successfully",
          user: updatedUser,
        });
      } catch (updateError) {
        // If avatar column doesn't exist, retry without it
        if (
          updateError.message.includes("Could not find the 'avatar' column")
        ) {
          delete updates.avatar;
          const updatedUser = await SupabaseService.updateUser(
            req.user.id,
            updates,
          );

          res.status(200).json({
            success: true,
            message:
              "Profile updated successfully (avatar feature requires database migration)",
            user: updatedUser,
          });
        } else {
          throw updateError;
        }
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Promote user to admin (admin-only operation)
 * PUT /api/v2/user/promote-to-admin/:userId
 * Requires admin authentication
 */
router.put(
  "/promote-to-admin/:userId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      // Only a real admin can promote users
      const requester = await SupabaseService.findUserById(req.user.id);
      if (!requester || !requester.is_admin) {
        return next(
          new ErrorHandler("Only admins can promote users to admin", 403),
        );
      }

      const { userId } = req.params;
      const targetUser = await SupabaseService.findUserById(userId);
      if (!targetUser) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Promote user to admin
      const updatedUser = await SupabaseService.updateUser(userId, {
        is_admin: true,
        role: "admin",
      });

      res.status(200).json({
        success: true,
        message: `User ${targetUser.name} promoted to admin`,
        user: updatedUser,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// ============ HOST ROLE MANAGEMENT ============

/**
 * Request to become a host
 * POST /api/v2/user/request-host
 */
router.post(
  "/request-host",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await SupabaseService.findUserById(req.user.id);
      if (!user) return next(new ErrorHandler("User not found", 404));

      if (user.role === "host" || user.role === "admin") {
        return next(
          new ErrorHandler("You already have elevated privileges", 400),
        );
      }

      if (user.host_request_status === "pending") {
        return next(
          new ErrorHandler("You already have a pending host request", 400),
        );
      }

      await SupabaseService.updateUser(req.user.id, {
        host_request_status: "pending",
        host_requested_at: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        message: "Host request submitted! An admin will review it soon.",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Get current user's host request status
 * GET /api/v2/user/host-status
 */
router.get(
  "/host-status",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const user = await SupabaseService.findUserById(req.user.id);
      if (!user) return next(new ErrorHandler("User not found", 404));

      res.status(200).json({
        success: true,
        hostRequestStatus: user.host_request_status || null,
        role: user.role,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Get all pending host requests (admin only)
 * GET /api/v2/user/pending-host-requests
 */
router.get(
  "/pending-host-requests",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const requester = await SupabaseService.findUserById(req.user.id);
      if (!requester || !requester.is_admin) {
        return next(new ErrorHandler("Admin access required", 403));
      }

      const allUsers = await SupabaseService.getAllUsers();
      const pendingRequests = (allUsers || [])
        .filter((u) => u.host_request_status === "pending")
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          avatar: u.avatar,
          host_request_status: u.host_request_status,
          host_requested_at: u.host_requested_at,
        }));

      res.status(200).json({ success: true, requests: pendingRequests });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Approve host request (admin only)
 * PUT /api/v2/user/approve-host/:userId
 */
router.put(
  "/approve-host/:userId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const requester = await SupabaseService.findUserById(req.user.id);
      if (!requester || !requester.is_admin) {
        return next(new ErrorHandler("Admin access required", 403));
      }

      const { userId } = req.params;
      const targetUser = await SupabaseService.findUserById(userId);
      if (!targetUser) return next(new ErrorHandler("User not found", 404));

      if (targetUser.host_request_status !== "pending") {
        return next(
          new ErrorHandler("No pending host request for this user", 400),
        );
      }

      await SupabaseService.updateUser(userId, {
        role: "host",
        host_request_status: "approved",
      });

      res.status(200).json({
        success: true,
        message: `${targetUser.name} is now a host`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Reject host request (admin only)
 * PUT /api/v2/user/reject-host/:userId
 */
router.put(
  "/reject-host/:userId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const requester = await SupabaseService.findUserById(req.user.id);
      if (!requester || !requester.is_admin) {
        return next(new ErrorHandler("Admin access required", 403));
      }

      const { userId } = req.params;
      const targetUser = await SupabaseService.findUserById(userId);
      if (!targetUser) return next(new ErrorHandler("User not found", 404));

      await SupabaseService.updateUser(userId, {
        host_request_status: "rejected",
      });

      res.status(200).json({
        success: true,
        message: `Host request for ${targetUser.name} has been rejected`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Get all users with roles (admin only, for user management)
 * GET /api/v2/user/all-users
 */
router.get(
  "/all-users",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const requester = await SupabaseService.findUserById(req.user.id);
      if (!requester || !requester.is_admin) {
        return next(new ErrorHandler("Admin access required", 403));
      }

      const allUsers = await SupabaseService.getAllUsers();
      const users = (allUsers || []).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        role: u.role,
        is_admin: u.is_admin,
        is_active: u.is_active,
        host_request_status: u.host_request_status,
        created_at: u.created_at,
      }));

      res.status(200).json({ success: true, users });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Demote host back to client (admin only)
 * PUT /api/v2/user/demote-host/:userId
 */
router.put(
  "/demote-host/:userId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const requester = await SupabaseService.findUserById(req.user.id);
      if (!requester || !requester.is_admin) {
        return next(new ErrorHandler("Admin access required", 403));
      }

      const { userId } = req.params;
      const targetUser = await SupabaseService.findUserById(userId);
      if (!targetUser) return next(new ErrorHandler("User not found", 404));

      await SupabaseService.updateUser(userId, {
        role: "client",
        host_request_status: null,
      });

      res.status(200).json({
        success: true,
        message: `${targetUser.name} has been demoted to client`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Change user role (admin only)
 * PUT /api/v2/user/change-role/:userId
 * Body: { role: "client" | "host" }
 */
router.put(
  "/change-role/:userId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const requester = await SupabaseService.findUserById(req.user.id);
      if (!requester || !requester.is_admin) {
        return next(new ErrorHandler("Admin access required", 403));
      }

      const { userId } = req.params;
      const { role } = req.body;

      if (!role || !["client", "host"].includes(role)) {
        return next(
          new ErrorHandler("Invalid role. Must be 'client' or 'host'", 400),
        );
      }

      const targetUser = await SupabaseService.findUserById(userId);
      if (!targetUser) return next(new ErrorHandler("User not found", 404));

      // Prevent changing own role
      if (userId === req.user.id) {
        return next(new ErrorHandler("Cannot change your own role", 400));
      }

      // Prevent changing another admin's role
      if (targetUser.is_admin) {
        return next(
          new ErrorHandler("Cannot change another admin's role", 400),
        );
      }

      const updates = { role };
      if (role === "host") {
        updates.host_request_status = "approved";
      } else {
        updates.host_request_status = null;
      }

      const updatedUser = await SupabaseService.updateUser(userId, updates);

      res.status(200).json({
        success: true,
        message: `${targetUser.name}'s role changed to ${role}`,
        user: updatedUser,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Toggle user active status (admin only)
 * PUT /api/v2/user/toggle-status/:userId
 * Body: { is_active: true | false }
 */
router.put(
  "/toggle-status/:userId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const requester = await SupabaseService.findUserById(req.user.id);
      if (!requester || !requester.is_admin) {
        return next(new ErrorHandler("Admin access required", 403));
      }

      const { userId } = req.params;
      const { is_active } = req.body;

      if (typeof is_active !== "boolean") {
        return next(new ErrorHandler("is_active must be a boolean", 400));
      }

      const targetUser = await SupabaseService.findUserById(userId);
      if (!targetUser) return next(new ErrorHandler("User not found", 404));

      // Prevent deactivating self
      if (userId === req.user.id) {
        return next(
          new ErrorHandler("Cannot deactivate your own account", 400),
        );
      }

      // Prevent deactivating another admin
      if (targetUser.is_admin) {
        return next(new ErrorHandler("Cannot deactivate another admin", 400));
      }

      const updatedUser = await SupabaseService.updateUser(userId, {
        is_active,
      });

      res.status(200).json({
        success: true,
        message: `${targetUser.name}'s account has been ${is_active ? "activated" : "deactivated"}`,
        user: updatedUser,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Delete user account (admin only)
 * DELETE /api/v2/user/delete-user/:userId
 */
router.delete(
  "/delete-user/:userId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const requester = await SupabaseService.findUserById(req.user.id);
      if (!requester || !requester.is_admin) {
        return next(new ErrorHandler("Admin access required", 403));
      }

      const { userId } = req.params;
      const targetUser = await SupabaseService.findUserById(userId);
      if (!targetUser) return next(new ErrorHandler("User not found", 404));

      // Prevent deleting self
      if (userId === req.user.id) {
        return next(new ErrorHandler("Cannot delete your own account", 400));
      }

      // Prevent deleting another admin
      if (targetUser.is_admin) {
        return next(
          new ErrorHandler("Cannot delete another admin account", 400),
        );
      }

      await SupabaseService.deleteRecord("users", userId);

      res.status(200).json({
        success: true,
        message: `${targetUser.name}'s account has been deleted`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Get avatars for saved accounts (public — no auth required)
 * POST /api/v2/user/avatars
 * Body: { emails: ["a@b.com", ...] }
 * Returns: { avatars: { "a@b.com": "https://..." | "/api/v2/user/avatar/email@..." | null } }
 *
 * For external URLs (Google/Facebook), returns the URL directly.
 * For base64 data URLs (uploaded photos), returns a server URL that
 * serves the image as binary so the mobile Image component can cache it.
 */
router.post(
  "/avatars",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { emails } = req.body;
      if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(200).json({ success: true, avatars: {} });
      }

      // Limit to 10 emails max to prevent abuse
      const limitedEmails = emails.slice(0, 10).map((e) => e.toLowerCase());

      const avatars = {};

      // --- Phase 1: serve from cache (no DB hit) ---
      const uncachedEmails = [];
      for (const email of limitedEmails) {
        const cachedUrl = avatarCache.get(`avatar:${email}`);
        if (cachedUrl !== undefined) {
          avatars[email] = cachedUrl
            ? cachedUrl.startsWith("http")
              ? cachedUrl
              : `/api/v2/user/avatar-image/${encodeURIComponent(email)}`
            : null;
        } else {
          uncachedEmails.push(email);
        }
      }

      // --- Phase 2: single batch query for all uncached emails ---
      if (uncachedEmails.length > 0) {
        const users = await SupabaseService.findUsersByEmails(uncachedEmails, {
          withAvatar: true,
        });
        // Build a lookup map email -> user
        const userByEmail = {};
        for (const user of users) {
          if (user?.email) userByEmail[user.email.toLowerCase()] = user;
        }
        for (const email of uncachedEmails) {
          try {
            const user = userByEmail[email];
            if (user && user.avatar && user.avatar.url) {
              avatarCache.set(`avatar:${email}`, user.avatar.url, 3600);
              avatars[email] = user.avatar.url.startsWith("http")
                ? user.avatar.url
                : `/api/v2/user/avatar-image/${encodeURIComponent(email)}`;
            } else {
              avatarCache.set(`avatar:${email}`, null, 3600);
              avatars[email] = null;
            }
          } catch {
            avatars[email] = null;
          }
        }
      }

      res.status(200).json({ success: true, avatars });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Serve user avatar as binary image (public — no auth required)
 * GET /api/v2/user/avatar-image/:email
 * Returns the image directly as binary with proper Content-Type
 */
router.get(
  "/avatar-image/:email",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();

      // Check cache first (avoid re-fetching base64 from Supabase)
      const cacheKey = `avatar:${email}`;
      let avatarUrl = avatarCache.get(cacheKey);

      if (avatarUrl === undefined) {
        const user = await SupabaseService.findUserByEmail(email, {
          withAvatar: true,
        });
        if (!user || !user.avatar || !user.avatar.url) {
          return res.status(404).send("No avatar");
        }
        avatarUrl = user.avatar.url;
        // Cache avatar URL/data for 1 hour
        avatarCache.set(cacheKey, avatarUrl, 3600);
      }

      if (!avatarUrl) {
        return res.status(404).send("No avatar");
      }

      // If it's an external URL, redirect to it
      if (avatarUrl.startsWith("http")) {
        return res.redirect(avatarUrl);
      }

      // Parse base64 data URL: "data:image/jpeg;base64,/9j/4AAQ..."
      const match = avatarUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) {
        return res.status(404).send("Invalid avatar format");
      }

      const contentType = match[1]; // e.g. "image/jpeg"
      const base64Data = match[2];
      const imgBuffer = Buffer.from(base64Data, "base64");

      res.set({
        "Content-Type": contentType,
        "Content-Length": imgBuffer.length,
        "Cache-Control": "public, max-age=86400", // Cache for 1 day
      });
      res.send(imgBuffer);
    } catch (error) {
      return res.status(500).send("Error loading avatar");
    }
  }),
);

/**
 * Get public user profile by userId (no auth required)
 * GET /api/v2/user/public/:userId
 * Returns: { success: true, user: { id, name, username, avatar, role, is_admin, gender, date_of_birth, created_at, totalContributions, roomCount, isOnline, isRecentlyActive, lastActiveAt } }
 */
router.get(
  "/public/:userId",
  catchAsyncErrors(async (req, res, next) => {
    const { userId } = req.params;
    // console.log("[Public Profile] Fetching user:", userId);

    // Fetch user with avatar
    const user = await SupabaseService.findUserById(userId, {
      withAvatar: true,
    });

    if (!user) {
      // console.log("[Public Profile] User not found:", userId);
      return next(new ErrorHandler("User not found", 404));
    }

    // console.log("[Public Profile] Found user:", user.name, "ID:", user.id);

    // Fetch user's rooms (rooms where they are a member)
    const userRooms = await SupabaseService.getUserRooms(userId);
    const roomIds = (userRooms || []).map((r) => r.id);
    const roomCount = roomIds.length;

    // Calculate total contributions across all rooms (only select amount field to reduce egress)
    let totalContributions = 0;
    if (roomIds.length > 0) {
      const { data: allPayments, error: paymentsError } = await supabase
        .from("payments")
        .select("amount, status")
        .eq("paid_by", userId)
        .in("status", ["completed", "verified"]);

      if (!paymentsError && allPayments) {
        totalContributions = allPayments.reduce(
          (sum, p) => sum + (p.amount || 0),
          0,
        );
      }
    }

    // Get activity status
    const activityData = activityTracker.getActivityForUsers([userId]);
    const userActivity = activityData[userId] || {};

    const publicUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar || null,
      role: user.role,
      is_admin: user.is_admin,
      gender: user.gender,
      date_of_birth: user.date_of_birth,
      created_at: user.created_at,
      totalContributions: totalContributions,
      roomCount: roomCount,
      isOnline: userActivity.isOnline || false,
      isRecentlyActive: userActivity.isRecentlyActive || false,
      lastActiveAt: userActivity.lastActiveAt || null,
    };

    res.status(200).json({ success: true, user: publicUser });
  }),
);

module.exports = router;
