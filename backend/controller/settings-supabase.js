// App Settings Controller - Supabase
// Manages application-level settings like payment method availability
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

// ─── Default settings (used when no DB row exists yet) ───
const DEFAULT_SETTINGS = {
  gcash_enabled: true,
  bank_transfer_enabled: true,
  gcash_maintenance_message: "",
  bank_transfer_maintenance_message: "",
  // Version control fields
  min_app_version: "1.0.0",
  latest_app_version: "1.1.2",
  force_update: false,
  update_url: "https://github.com/@apartmentbilltracker/apartment-bill-tracker/releases",
  update_message: "",
};

// ─── Helper: get or create the single settings row ───
const getOrCreateSettings = async () => {
  try {
    const rows = await SupabaseService.selectAllRecords("app_settings");
    if (rows && rows.length > 0) return rows[0];

    // No row yet — seed one
    const created = await SupabaseService.insert("app_settings", {
      ...DEFAULT_SETTINGS,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return Array.isArray(created) ? created[0] : created;
  } catch (err) {
    // If the table doesn't exist yet, return defaults with a fake id
    console.error("app_settings read error (table may not exist):", err.message);
    return { id: null, ...DEFAULT_SETTINGS };
  }
};

// ─────────────────────────────────────────────
// GET /payment-methods  (any authenticated user)
// Returns which payment methods are currently enabled
// ─────────────────────────────────────────────
router.get(
  "/payment-methods",
  isAuthenticated,
  catchAsyncErrors(async (req, res) => {
    const settings = await getOrCreateSettings();

    res.status(200).json({
      success: true,
      paymentMethods: {
        gcash: {
          enabled: settings.gcash_enabled,
          maintenanceMessage: settings.gcash_maintenance_message || "",
        },
        bank_transfer: {
          enabled: settings.bank_transfer_enabled,
          maintenanceMessage: settings.bank_transfer_maintenance_message || "",
        },
        // Cash is always available — no infrastructure dependency
        cash: { enabled: true, maintenanceMessage: "" },
      },
    });
  }),
);

// ─────────────────────────────────────────────
// PUT /payment-methods  (admin only)
// Toggle payment methods and set maintenance messages
// Body: { gcash_enabled, bank_transfer_enabled, gcash_maintenance_message, bank_transfer_maintenance_message }
// ─────────────────────────────────────────────
router.put(
  "/payment-methods",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    const {
      gcash_enabled,
      bank_transfer_enabled,
      gcash_maintenance_message,
      bank_transfer_maintenance_message,
    } = req.body;

    const settings = await getOrCreateSettings();

    const updates = { updated_at: new Date().toISOString() };

    if (typeof gcash_enabled === "boolean") updates.gcash_enabled = gcash_enabled;
    if (typeof bank_transfer_enabled === "boolean") updates.bank_transfer_enabled = bank_transfer_enabled;
    if (typeof gcash_maintenance_message === "string") updates.gcash_maintenance_message = gcash_maintenance_message;
    if (typeof bank_transfer_maintenance_message === "string")
      updates.bank_transfer_maintenance_message = bank_transfer_maintenance_message;

    if (!settings.id) {
      // Table might not exist yet — try to create
      try {
        const created = await SupabaseService.insert("app_settings", {
          ...DEFAULT_SETTINGS,
          ...updates,
          created_at: new Date().toISOString(),
        });
        const row = Array.isArray(created) ? created[0] : created;
        return res.status(200).json({ success: true, settings: row });
      } catch (err) {
        return next(new ErrorHandler("Failed to save settings. Ensure the app_settings table exists in Supabase.", 500));
      }
    }

    const updated = await SupabaseService.update("app_settings", settings.id, updates);
    const row = Array.isArray(updated) ? updated[0] : updated;

    res.status(200).json({ success: true, settings: row || { ...settings, ...updates } });
  }),
);

// ─────────────────────────────────────────────
// GET /version-control  (any user, no auth needed for pre-login check)
// Returns version control settings
// ─────────────────────────────────────────────
router.get(
  "/version-control",
  catchAsyncErrors(async (req, res) => {
    const settings = await getOrCreateSettings();

    res.status(200).json({
      success: true,
      versionControl: {
        minAppVersion: settings.min_app_version || "1.0.0",
        latestAppVersion: settings.latest_app_version || "1.1.2",
        forceUpdate: settings.force_update || false,
        updateUrl: settings.update_url || "https://github.com/@apartmentbilltracker/apartment-bill-tracker/releases",
        updateMessage: settings.update_message || "",
      },
    });
  }),
);

// ─────────────────────────────────────────────
// PUT /version-control  (admin only)
// Update version control settings
// Body: { min_app_version, latest_app_version, force_update, update_url, update_message }
// ─────────────────────────────────────────────
router.put(
  "/version-control",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    const {
      min_app_version,
      latest_app_version,
      force_update,
      update_url,
      update_message,
    } = req.body;

    const settings = await getOrCreateSettings();
    const updates = { updated_at: new Date().toISOString() };

    if (typeof min_app_version === "string" && min_app_version.trim())
      updates.min_app_version = min_app_version.trim();
    if (typeof latest_app_version === "string" && latest_app_version.trim())
      updates.latest_app_version = latest_app_version.trim();
    if (typeof force_update === "boolean") updates.force_update = force_update;
    if (typeof update_url === "string") updates.update_url = update_url.trim();
    if (typeof update_message === "string") updates.update_message = update_message.trim();

    if (!settings.id) {
      try {
        const created = await SupabaseService.insert("app_settings", {
          ...DEFAULT_SETTINGS,
          ...updates,
          created_at: new Date().toISOString(),
        });
        const row = Array.isArray(created) ? created[0] : created;
        return res.status(200).json({ success: true, settings: row });
      } catch (err) {
        return next(new ErrorHandler("Failed to save version settings. Ensure app_settings table has version columns.", 500));
      }
    }

    const updated = await SupabaseService.update("app_settings", settings.id, updates);
    const row = Array.isArray(updated) ? updated[0] : updated;

    res.status(200).json({ success: true, settings: row || { ...settings, ...updates } });
  }),
);

module.exports = router;
