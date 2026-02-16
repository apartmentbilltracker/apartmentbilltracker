const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("./catchAsyncErrors");
const jwt = require("jsonwebtoken");
const SupabaseService = require("../db/SupabaseService");

exports.isAuthenticated = catchAsyncErrors(async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1] || req.cookies.token;

  if (!token) {
    return next(new ErrorHandler("Please login to continue", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    req.user = await SupabaseService.findUserById(decoded._id || decoded.id);
    if (!req.user) {
      return next(new ErrorHandler("Please login to continue", 401));
    }

    next();
  } catch (error) {
    return next(new ErrorHandler("Please login to continue", 401));
  }
});

exports.isAdmin = catchAsyncErrors(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Please login to continue", 401));
  }

  if (!req.user.is_admin) {
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
