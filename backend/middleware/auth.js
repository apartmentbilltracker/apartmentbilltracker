const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("./catchAsyncErrors");
const jwt = require("jsonwebtoken");
const SupabaseService = require("../db/SupabaseService");
const cache = require("../utils/MemoryCache");
const activityTracker = require("../utils/activityTracker");

exports.isAuthenticated = catchAsyncErrors(async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1] || req.cookies.token;

  if (!token) {
    return next(new ErrorHandler("Please login to continue", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const userId = decoded._id || decoded.id;

    // Cache the user record for 60s to avoid a DB hit on every request.
    // Deactivation changes propagate within 60s.
    const cacheKey = `auth_user:${userId}`;
    let user = cache.get(cacheKey);
    if (!user) {
      user = await SupabaseService.findUserById(userId);
      if (user) cache.set(cacheKey, user, 60);
    }

    if (!user) {
      return next(new ErrorHandler("Please login to continue", 401));
    }

    if (user.is_active === false) {
      return next(
        new ErrorHandler(
          "Your account has been deactivated. Please contact support.",
          403,
        ),
      );
    }

    req.user = user;
    activityTracker.touch(user.id);
    next();
  } catch (error) {
    return next(new ErrorHandler("Please login to continue", 401));
  }
});

exports.isAdmin = catchAsyncErrors(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Please login to continue", 401));
  }

  const role = (req.user.role || "").toLowerCase();
  if (!req.user.is_admin && role !== "admin") {
    return next(new ErrorHandler("Admin access required", 403));
  }
  next();
});

exports.isAdminOrHost = catchAsyncErrors(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Please login to continue", 401));
  }

  const role = (req.user.role || "").toLowerCase();
  if (!req.user.is_admin && role !== "host") {
    return next(new ErrorHandler("Admin or Host access required", 403));
  }
  next();
});
