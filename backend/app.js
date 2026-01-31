const express = require("express");
const ErrorHandler = require("./middleware/error");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");
const net = require("net");

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

// Add this after fileUpload middleware
app.use((req, res, next) => {
  if (req.files) {
    console.log("Files received:", {
      fileNames: Object.keys(req.files),
      fileDetails: Object.entries(req.files).map(([key, file]) => ({
        name: file.name,
        type: file.mimetype,
        size: file.size,
      })),
    });
  }
  next();
});

app.use(cookieParser());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Test cookie setting
app.use("/test", (req, res) => {
  res
    .cookie("testCookie", "testValue", {
      httpOnly: true,
      sameSite: "none",
      secure: true,
    })
    .send("Hello world!");
});

// Test cookie clearing
app.use("/clear-cookie", (req, res) => {
  res.cookie("testCookie", "", {
    expires: new Date(0),
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });
  res.send("Cookie cleared");
});

// Load environment variables
if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({ path: "config/.env" });
}

// Import routes
const user = require("./controller/user");
const room = require("./controller/room");
const billingCycleRoutes = require("./routes/billingCycle");

// 5. Debug Endpoints (Add before routes)
app.post("/api/v2/debug/upload", (req, res) => {
  console.log(
    "Debug upload - Files:",
    req.files ? Object.keys(req.files) : "none",
  );
  console.log("Debug upload - Body:", req.body);

  if (req.files?.testFile) {
    const file = req.files.testFile;
    return res.status(200).json({
      success: true,
      fileName: file.name,
      size: file.size,
      mimetype: file.mimetype,
    });
  }

  res.status(400).json({
    success: false,
    message: "No file received",
  });
});

// Debug: SMTP connectivity check (temporary)
app.get("/api/v2/debug/smtp-check", (req, res) => {
  const host = process.env.SMPT_HOST;
  const port = process.env.SMPT_PORT ? Number(process.env.SMPT_PORT) : 465;

  if (!host) {
    return res
      .status(400)
      .json({ success: false, message: "SMPT_HOST not set" });
  }

  const socket = new net.Socket();
  let finished = false;

  socket.setTimeout(8000);

  socket.on("connect", () => {
    finished = true;
    socket.destroy();
    return res
      .status(200)
      .json({ success: true, message: `Connected to ${host}:${port}` });
  });

  socket.on("timeout", () => {
    if (finished) return;
    finished = true;
    socket.destroy();
    return res
      .status(504)
      .json({ success: false, message: "Connection timed out" });
  });

  socket.on("error", (err) => {
    if (finished) return;
    finished = true;
    socket.destroy();
    return res.status(502).json({
      success: false,
      message: "Connection error",
      error: err.message,
    });
  });

  socket.connect(port, host);
});

// App Version Check Endpoint
app.get("/api/app-version", (req, res) => {
  try {
    // Define minimum version - update this when releasing new app versions
    const minVersion = process.env.MIN_APP_VERSION || "1.0.0";
    const isForced = process.env.FORCE_APP_UPDATE === "true" || false;
    // Default to GitHub releases page if no URL specified
    const updateUrl =
      process.env.APP_UPDATE_URL ||
      "https://github.com/mjdev031219/abt-mobile-app/releases";

    res.status(200).json({
      success: true,
      minVersion,
      isForced,
      updateUrl,
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

app.use("/api/v2/user", user);
app.use("/api/v2/rooms", room);
app.use("/api/v2/billing-cycles", billingCycleRoutes);

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
