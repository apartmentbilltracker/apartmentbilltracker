// App Settings Controller - Supabase
// Manages application-level settings like payment method availability
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const cache = require("../utils/MemoryCache");
const {
  isAuthenticated,
  isAdmin,
  isAdminOrHost,
} = require("../middleware/auth");

// ─── Default settings (used when no DB row exists yet) ───
const DEFAULT_SETTINGS = {
  gcash_enabled: true,
  bank_transfer_enabled: true,
  gcash_maintenance_message: "",
  bank_transfer_maintenance_message: "",
  gcash_qr_url: null,
  bank_accounts: "[]",
  // Version control fields
  min_app_version: "1.0.0",
  latest_app_version: "1.1.2",
  force_update: false,
  update_url:
    "https://github.com/@apartmentbilltracker/apartment-bill-tracker/releases",
  update_message: "",
};

// ─── Helper: safely parse bank_accounts JSON ───
const parseBankAccounts = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

// ─── Helper: get or create the global settings row (version control, etc.) ───
const getOrCreateSettings = async () => {
  try {
    // Global row = rows where user_id is null
    const rows = await SupabaseService.selectAllRecords("app_settings");
    const globalRow = rows ? rows.find((r) => !r.user_id) || rows[0] : null;
    if (globalRow) return globalRow;

    const created = await SupabaseService.insert("app_settings", {
      ...DEFAULT_SETTINGS,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return Array.isArray(created) ? created[0] : created;
  } catch (err) {
    console.error(
      "app_settings read error (table may not exist):",
      err.message,
    );
    return { id: null, ...DEFAULT_SETTINGS };
  }
};

// ─── Helper: pick the best settings row from an array ───
// Prefers an exact user_id match; falls back to any row with real payment data.
const pickBestRow = (rows, userId) => {
  if (!rows || rows.length === 0) return null;
  // 1. Exact per-user match
  const exact = rows.find((r) => r.user_id === userId);
  if (exact) {
    const hasData =
      (exact.bank_accounts && exact.bank_accounts !== "[]") ||
      exact.gcash_qr_url;
    if (hasData) return exact;
  }
  // 2. Any row that has actual payment configuration
  const withData = rows.find(
    (r) => (r.bank_accounts && r.bank_accounts !== "[]") || r.gcash_qr_url,
  );
  if (withData) return withData;
  // 3. Return exact match even if empty (so PUT updates the right row later)
  return exact || rows[0];
};

// ─── Helper: get or create a per-host settings row (keyed by user_id) ───
const getOrCreateSettingsForUser = async (userId) => {
  if (!userId) return { ...DEFAULT_SETTINGS };
  try {
    // Read ALL rows so we can fall back to any configured row
    const allRows = await SupabaseService.selectAllRecords("app_settings");
    const best = pickBestRow(allRows, userId);
    if (best) return best;
    // No row at all — create one with defaults
    const created = await SupabaseService.insert("app_settings", {
      user_id: userId,
      gcash_enabled: true,
      bank_transfer_enabled: true,
      gcash_maintenance_message: "",
      bank_transfer_maintenance_message: "",
      gcash_qr_url: null,
      bank_accounts: "[]",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return Array.isArray(created) ? created[0] : created;
  } catch (err) {
    console.error("app_settings per-user read error:", err.message);
    return { ...DEFAULT_SETTINGS };
  }
};

// ─────────────────────────────────────────────
// GET /payment-methods  (any authenticated user)
// Returns which payment methods are currently enabled
// Optional query params:
//   ?host_id=xxx  – return settings for a specific host (used by client screens)
//   ?room_id=xxx  – look up room's host then return their settings
// ─────────────────────────────────────────────
router.get(
  "/payment-methods",
  isAuthenticated,
  catchAsyncErrors(async (req, res) => {
    let hostUserId = req.query.host_id || null;

    // If room_id provided, resolve the host from the room
    if (!hostUserId && req.query.room_id) {
      try {
        const room = await SupabaseService.findRoomById(req.query.room_id);
        if (room && room.created_by) {
          hostUserId = room.created_by;
        } else {
          // created_by is null — fall back to looking for a non-payer member (host)
          if (room && Array.isArray(room.room_members)) {
            const hostMember = room.room_members.find(
              (m) => m.is_payer === false,
            );
            if (hostMember) hostUserId = hostMember.user_id;
          }
        }
      } catch (_) {}
    }

    // If no explicit host, use the requesting user's own settings
    if (!hostUserId) hostUserId = req.user.id;

    // Check memory cache first to reduce Supabase reads
    const cacheKey = "settings:" + hostUserId;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, paymentMethods: cached });
    }

    const settings = await getOrCreateSettingsForUser(hostUserId);

    const paymentMethods = {
      gcash: {
        enabled: settings.gcash_enabled !== false,
        maintenanceMessage: settings.gcash_maintenance_message || "",
        qrUrl: settings.gcash_qr_url || null,
      },
      bank_transfer: {
        enabled: settings.bank_transfer_enabled !== false,
        maintenanceMessage: settings.bank_transfer_maintenance_message || "",
        accounts: parseBankAccounts(settings.bank_accounts),
      },
      // Cash is always available — no infrastructure dependency
      cash: { enabled: true, maintenanceMessage: "" },
    };

    cache.set(cacheKey, paymentMethods, 10);

    res.status(200).json({
      success: true,
      paymentMethods,
    });
  }),
);

// ─────────────────────────────────────────────
// PUT /payment-methods  (admin/host)
// Toggle payment methods and set maintenance messages — saved PER HOST
// Body: { gcash_enabled, bank_transfer_enabled, gcash_maintenance_message, bank_transfer_maintenance_message }
// ─────────────────────────────────────────────
router.put(
  "/payment-methods",
  isAuthenticated,
  isAdminOrHost,
  catchAsyncErrors(async (req, res, next) => {
    const {
      gcash_enabled,
      bank_transfer_enabled,
      gcash_maintenance_message,
      bank_transfer_maintenance_message,
      gcash_qr_url,
      bank_accounts,
    } = req.body;

    const settings = await getOrCreateSettingsForUser(req.user.id);

    const updates = {
      user_id: req.user.id,
      updated_at: new Date().toISOString(),
    };

    if (typeof gcash_enabled === "boolean")
      updates.gcash_enabled = gcash_enabled;
    if (typeof bank_transfer_enabled === "boolean")
      updates.bank_transfer_enabled = bank_transfer_enabled;
    if (typeof gcash_maintenance_message === "string")
      updates.gcash_maintenance_message = gcash_maintenance_message;
    if (typeof bank_transfer_maintenance_message === "string")
      updates.bank_transfer_maintenance_message =
        bank_transfer_maintenance_message;
    // QR URL — accept base64 data URI or regular URL; null = clear
    if (gcash_qr_url !== undefined) updates.gcash_qr_url = gcash_qr_url || null;
    // Bank accounts — stored as JSON string
    if (typeof bank_accounts === "string")
      updates.bank_accounts = bank_accounts;
    else if (Array.isArray(bank_accounts))
      updates.bank_accounts = JSON.stringify(bank_accounts);

    if (!settings.id) {
      try {
        const created = await SupabaseService.insert("app_settings", {
          gcash_enabled: true,
          bank_transfer_enabled: true,
          gcash_maintenance_message: "",
          bank_transfer_maintenance_message: "",
          gcash_qr_url: null,
          bank_accounts: "[]",
          ...updates,
          created_at: new Date().toISOString(),
        });
        const row = Array.isArray(created) ? created[0] : created;
        return res.status(200).json({ success: true, settings: row });
      } catch (err) {
        return next(
          new ErrorHandler(
            "Failed to save settings. Ensure the app_settings table exists in Supabase with a user_id column.",
            500,
          ),
        );
      }
    }

    const updated = await SupabaseService.update(
      "app_settings",
      settings.id,
      updates,
    );
    const row = Array.isArray(updated) ? updated[0] : updated;

    // Invalidate ALL cached payment-method entries — any host could be served
    // the updated row via the fallback picker (pickBestRow), so stale caches
    // for every user_id must be cleared whenever settings are saved.
    cache.invalidatePrefix("settings:");

    res
      .status(200)
      .json({ success: true, settings: row || { ...settings, ...updates } });
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
        updateUrl:
          settings.update_url ||
          "https://github.com/@apartmentbilltracker/apartment-bill-tracker/releases",
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
    if (typeof update_message === "string")
      updates.update_message = update_message.trim();

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
        return next(
          new ErrorHandler(
            "Failed to save version settings. Ensure app_settings table has version columns.",
            500,
          ),
        );
      }
    }

    const updated = await SupabaseService.update(
      "app_settings",
      settings.id,
      updates,
    );
    const row = Array.isArray(updated) ? updated[0] : updated;

    res
      .status(200)
      .json({ success: true, settings: row || { ...settings, ...updates } });
  }),
);

module.exports = router;
