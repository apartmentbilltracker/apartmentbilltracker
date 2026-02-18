const express = require("express");
const ErrorHandler = require("./middleware/error");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const compression = require("compression");
const cloudinary = require("cloudinary").v2;
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const allowedOrigins = [
  // Deployed frontend
  "https://apartmentbilltracker.onrender.com",
  "https://apartmentbill-tracker.onrender.com",
  "https://apartmentbilltracker-server.onrender.com",
  // Local development
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5000",
  "http://localhost:8081",
  "http://localhost:8000",
  // Expo dev server
  "http://localhost:19000",
  "http://localhost:19001",
  // Development machine IPs (adjust as needed)
  "http://10.18.100.4:3000",
  "http://10.18.100.4:5000",
  "http://10.18.100.4:8000",
  "http://10.18.100.4:8081",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl requests, etc)
      if (!origin) {
        callback(null, true);
      } else if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // For development, log but allow; for production, you might want stricter control
        console.log("CORS request from non-whitelisted origin:", origin);
        callback(null, true); // Still allow - change to false for strict CORS enforcement
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition"],
  }),
);

// Gzip/Brotli compress all responses (typically 70-90% size reduction)
app.use(compression());

// Ensure temp directory exists and is writable
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// File upload middleware
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: path.join(__dirname, "temp"),
    createParentPath: true,
    limits: { fileSize: 50 * 1024 * 1024, files: 50 }, // 50MB max
    abortOnLimit: true,
    preserveExtension: true,
    safeFileNames: true,
    debug: false, // Enable debug mode
    responseOnLimit: "File size limit has been reached",
    uploadTimeout: 30000, // 30 seconds timeout
  }),
);

app.use(cookieParser());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Load environment variables
if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({ path: "config/.env" });
}

// Import routes
const user = require("./controller/user-supabase");
const room = require("./controller/room-supabase");
const billingCycleRoutes = require("./controller/billingCycle-supabase");
const paymentRoutes = require("./controller/payment-supabase");
const announcementRoutes = require("./controller/announcement-supabase");
const supportRoutes = require("./controller/supportTicket-supabase");
const bugReportRoutes = require("./controller/bugReport-supabase");
const paymentProcessingRoutes = require("./controller/paymentProcessing-supabase");
const adminFinancialRoutes = require("./controller/adminFinancial-supabase");
const adminBillingRoutes = require("./controller/adminBilling-supabase");
const adminRemindersRoutes = require("./controller/adminReminders-supabase");
const notificationsRoutes = require("./controller/notifications-supabase");
const faqRoutes = require("./controller/faq-supabase");
const settingsRoutes = require("./controller/settings-supabase");
const adminBroadcastRoutes = require("./controller/adminBroadcast-supabase");
const chatRoutes = require("./controller/chat-supabase");
const badgesRoutes = require("./controller/badges-supabase");

// App Version Check Endpoint — reads from app_settings DB table (cached 5 min)
app.get("/api/app-version", async (req, res) => {
  try {
    const SupabaseService = require("./db/SupabaseService");
    const cache = require("./utils/MemoryCache");

    const settings = await cache.getOrSet(
      "app_settings",
      async () => {
        try {
          const rows = await SupabaseService.selectAllRecords("app_settings");
          return rows && rows.length > 0 ? rows[0] : null;
        } catch (err) {
          console.error("app_settings read error:", err.message);
          return null;
        }
      },
      300, // Cache for 5 minutes
    );

    const minVersion =
      settings?.min_app_version || process.env.MIN_APP_VERSION || "1.0.0";
    const isForced =
      settings?.force_update ??
      process.env.FORCE_APP_UPDATE === "true" ??
      false;
    const updateUrl =
      settings?.update_url ||
      process.env.APP_UPDATE_URL ||
      "https://github.com/@apartmentbilltracker/apartment-bill-tracker/releases";
    const latestVersion = settings?.latest_app_version || minVersion;
    const updateMessage = settings?.update_message || "";

    res.status(200).json({
      success: true,
      minVersion,
      latestVersion,
      isForced,
      updateUrl,
      updateMessage,
      message: "Version check successful",
    });
  } catch (error) {
    console.error("Error in version check:", error);
    res.status(500).json({
      success: false,
      message: "Version check failed",
      error: error.message,
    });
  }
});

// Health check endpoint (for UptimeRobot / monitoring)
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/v2/user", user);
app.use("/api/v2/rooms", room);
app.use("/api/v2/billing-cycles", billingCycleRoutes);
app.use("/api/v2/payments", paymentRoutes);
app.use("/api/v2/payment-processing", paymentProcessingRoutes);
app.use("/api/v2/admin/financial", adminFinancialRoutes);
app.use("/api/v2/admin/billing", adminBillingRoutes);
app.use("/api/v2/admin/reminders", adminRemindersRoutes);
app.use("/api/v2/notifications", notificationsRoutes);
app.use("/api/v2/announcements", announcementRoutes);
app.use("/api/v2/support", supportRoutes);
app.use("/api/v2/support", bugReportRoutes);
app.use("/api/v2/faqs", faqRoutes);
app.use("/api/v2/settings", settingsRoutes);
app.use("/api/v2/admin/broadcast", adminBroadcastRoutes);
app.use("/api/v2/chat", chatRoutes);
app.use("/api/v2/badges", badgesRoutes);

// Logout route - ensures the token cookie is properly removed
app.get("/api/v2/user/logout", async (req, res, next) => {
  try {
    res.cookie("token", "", {
      expires: new Date(0), // Expire immediately
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });
    res.status(200).json({
      success: true,
      message: "Log out successful!",
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Error Handling Middleware
app.use(ErrorHandler);

module.exports = app;
