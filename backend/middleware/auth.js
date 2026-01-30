const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("./catchAsyncErrors");
const jwt = require("jsonwebtoken");
const User = require("../model/user");

exports.isAuthenticated = catchAsyncErrors(async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1] || req.cookies.token;

  if (!token) {
    return next(new ErrorHandler("Please login to continue", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    req.user = await User.findById(decoded._id);
    if (!req.user) {
      return next(new ErrorHandler("Please login to continue", 401));
    }

    next();
  } catch (error) {
    return next(new ErrorHandler("Please login to continue", 401));
  }
});

// Add to middleware/auth.js
exports.checkRegistrationStatus = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate("shop");

  if (!user.shop) {
    req.registrationStatus = { completed: false, step: 1 };
    return next();
  }

  if (user.shop.registrationStep === 1) {
    req.registrationStatus = { completed: false, step: 2 };
    return next();
  }

  req.registrationStatus = { completed: true };
  next();
});

// Modify isSeller middleware
exports.isSeller = catchAsyncErrors(async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1] || req.cookies.token;

  if (!token) {
    return next(new ErrorHandler("Please login to continue", 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  const user = await User.findById(decoded._id).populate("shop");

  if (req.originalUrl.startsWith("/api")) {
    if (!user.shop) {
      return next(new ErrorHandler("Complete seller registration first", 403));
    }

    if (user.shop.registrationStep === 1) {
      return next();
    }

    if (user.shop.registrationStep < 3) {
      return next(
        new ErrorHandler(
          `Complete step ${user.shop.registrationStep + 1} of registration`,
          403
        )
      );
    }
  } else {
    if (!user.shop) {
      return res.redirect("/portal/ph-onboarding");
    }

    if (user.shop.registrationStep < 3) {
      return res.redirect(
        `/portal/ph-onboarding?step=${user.shop.registrationStep + 1}`
      );
    }
  }

  req.shop = user.shop;
  next();
});

// Add to middleware/auth.js
exports.isRegistrationComplete = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate("shop");

  if (!user.shop || user.shop.registrationStep < 3) {
    return next(new ErrorHandler("Complete seller registration first", 403));
  }

  next();
});

exports.isAdmin = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user || !user.role || !user.role.includes("admin")) {
    return next(new ErrorHandler("Forbidden", 403));
  }
  next();
});
