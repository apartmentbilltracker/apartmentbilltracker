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
// ONLY returns rows belonging to the specified user — never leak another host's settings.
const pickBestRow = (rows, userId) => {
  if (!rows || rows.length === 0) return null;
  // Only consider rows that belong to this user (or have no user_id / global rows)
  const userRows = rows.filter((r) => r.user_id === userId);
  if (userRows.length === 0) return null;
  // Prefer a row with actual payment data configured
  const withData = userRows.find(
    (r) => (r.bank_accounts && r.bank_accounts !== "[]") || r.gcash_qr_url,
  );
  return withData || userRows[0];
};

// ─── Helper: get existing settings for a user (READ-ONLY, never creates rows) ───
const getSettingsForUser = async (userId) => {
  if (!userId) return { ...DEFAULT_SETTINGS };
  try {
    const userRows = await SupabaseService.selectAll(
      "app_settings",
      "user_id",
      userId,
    );
    // Filter to host-level rows only (no room_id) — room-specific rows are handled separately
    const hostRows = userRows ? userRows.filter((r) => !r.room_id) : [];
    const best = pickBestRow(hostRows, userId);
    if (best) return best;
    // No row found — return in-memory defaults (do NOT create a DB row on read)
    return { ...DEFAULT_SETTINGS };
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
//   ?room_id=xxx  – look up room-specific settings first, then fall back to host settings
// ─────────────────────────────────────────────
router.get(
  "/payment-methods",
  isAuthenticated,
  catchAsyncErrors(async (req, res) => {
    let hostUserId = req.query.host_id || null;
    let roomId = req.query.room_id || null;

    console.log(
      "[GET /payment-methods] room_id =",
      roomId,
      "| host_id =",
      hostUserId,
      "| user =",
      req.user?.id,
    );

    // Check memory cache first to reduce Supabase reads
    // We need to build a preliminary cache key; for room-based lookups use room_id
    const preliminaryCacheKey = roomId
      ? "settings:room:" + roomId
      : hostUserId
        ? "settings:user:" + hostUserId
        : null;
    if (preliminaryCacheKey) {
      const cached = cache.get(preliminaryCacheKey);
      if (cached) {
        return res.status(200).json({ success: true, paymentMethods: cached });
      }
    }

    let settings = null;

    // PRIORITY 1: If room_id provided, try to get room-specific settings first
    if (roomId) {
      try {
        const roomSettings = await SupabaseService.selectAll(
          "app_settings",
          "room_id",
          roomId,
        );
        console.log(
          "[GET /payment-methods] room query returned",
          roomSettings?.length,
          "rows",
          roomSettings?.length > 0
            ? "| first row id=" +
                roomSettings[0].id +
                " gcash=" +
                roomSettings[0].gcash_enabled +
                " bank=" +
                roomSettings[0].bank_transfer_enabled +
                " bank_accounts=" +
                (roomSettings[0].bank_accounts || "null")
                  .toString()
                  .substring(0, 80)
            : "",
        );
        if (roomSettings && roomSettings.length > 0) {
          settings = roomSettings[0];
        } else {
          // No room-specific settings found, resolve host and use host-level settings
          const room = await SupabaseService.findRoomById(roomId);
          if (room && room.created_by) {
            hostUserId = room.created_by;
          } else if (room && Array.isArray(room.room_members)) {
            const hostMember = room.room_members.find(
              (m) => m.is_payer === false,
            );
            if (hostMember) hostUserId = hostMember.user_id;
          }
        }
      } catch (_) {}
    }

    // PRIORITY 2: If no room-specific settings, use host-level settings
    if (!settings) {
      if (!hostUserId) hostUserId = req.user.id;
      console.log(
        "[GET /payment-methods] No room settings found, falling back to host:",
        hostUserId,
      );
      settings = await getSettingsForUser(hostUserId);
    }

    console.log(
      "[GET /payment-methods] Final settings row: id =",
      settings.id,
      "| room_id =",
      settings.room_id,
      "| gcash =",
      settings.gcash_enabled,
      "| bank =",
      settings.bank_transfer_enabled,
      "| gcash_qr_url length =",
      settings.gcash_qr_url ? settings.gcash_qr_url.length : "null",
    );

    const cacheKey = roomId
      ? "settings:room:" + roomId
      : "settings:user:" + hostUserId;

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
// Toggle payment methods and set maintenance messages — saved PER ROOM or PER HOST
// Body: { gcash_enabled, bank_transfer_enabled, gcash_maintenance_message, bank_transfer_maintenance_message, room_id? }
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
      room_id,
    } = req.body;

    console.log(
      "[PUT /payment-methods] req.body.room_id =",
      room_id,
      "| user_id =",
      req.user.id,
      "| gcash_qr_url length =",
      gcash_qr_url ? gcash_qr_url.length : "undefined/null",
      "| starts with =",
      gcash_qr_url ? gcash_qr_url.substring(0, 30) : "N/A",
    );

    // If room_id provided, verify ownership and get room-specific settings
    let settings = null;
    let needsNewRoomRow = false;
    if (room_id) {
      // Verify the current user owns this room before allowing settings changes
      const room = await SupabaseService.findRoomById(room_id);
      if (!room) {
        return next(new ErrorHandler("Room not found", 404));
      }
      if (room.created_by !== req.user.id && req.user.role !== "admin") {
        return next(
          new ErrorHandler(
            "Not authorized to change settings for this room",
            403,
          ),
        );
      }

      const roomSettings = await SupabaseService.selectAll(
        "app_settings",
        "room_id",
        room_id,
      );
      if (roomSettings && roomSettings.length > 0) {
        settings = roomSettings[0];
      } else {
        // No room-specific row exists yet — we need to CREATE one, not update the host row
        needsNewRoomRow = true;
      }
    }

    // Only fall back to host-level settings if NOT creating a new room-specific row
    if (!settings && !needsNewRoomRow) {
      settings = await getSettingsForUser(req.user.id);
    }

    const updates = {
      user_id: req.user.id,
      updated_at: new Date().toISOString(),
    };

    // If saving room-specific settings, include room_id
    if (room_id) {
      updates.room_id = room_id;
    }

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

    if (!settings || !settings.id || needsNewRoomRow) {
      // Create a new row — either first-ever settings or a new room-specific row
      console.log(
        "[PUT /payment-methods] INSERTING new row. needsNewRoomRow =",
        needsNewRoomRow,
        "| updates =",
        JSON.stringify(updates),
      );
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
        // DIAGNOSTIC: detect column truncation
        if (gcash_qr_url && row?.gcash_qr_url) {
          console.log(
            "[PUT /payment-methods] QR TRUNCATION CHECK (INSERT): sent =",
            gcash_qr_url.length,
            "| stored =",
            row.gcash_qr_url.length,
            "| match =",
            gcash_qr_url.length === row.gcash_qr_url.length,
          );
        }
        cache.invalidatePrefix("settings:");
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
    console.log(
      "[PUT /payment-methods] UPDATED row id =",
      settings.id,
      "| room_id in updates =",
      updates.room_id,
    );
    const row = Array.isArray(updated) ? updated[0] : updated;
    // DIAGNOSTIC: detect column truncation
    if (gcash_qr_url && row?.gcash_qr_url) {
      console.log(
        "[PUT /payment-methods] QR TRUNCATION CHECK (UPDATE): sent =",
        gcash_qr_url.length,
        "| stored =",
        row.gcash_qr_url.length,
        "| match =",
        gcash_qr_url.length === row.gcash_qr_url.length,
      );
    }

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

    // Bust the cached version response so the app sees the new values immediately
    cache.del("app_settings");

    res
      .status(200)
      .json({ success: true, settings: row || { ...settings, ...updates } });
  }),
);

module.exports = router;
