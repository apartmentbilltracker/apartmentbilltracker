// Consolidated badges endpoint — returns all badge counts in a single API call
// This dramatically reduces egress by replacing 3-6 separate API calls per tab switch
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const { isAuthenticated } = require("../middleware/auth");
const cache = require("../utils/MemoryCache");

// ============================================================
// GET ALL BADGE COUNTS FOR CURRENT USER
// ============================================================
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = (req.user.role || "").toLowerCase();

    // Cache per-user badge counts for 30 seconds
    const cacheKey = `badges:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, ...cached });
    }

    const result = {
      unreadNotifications: 0,
      unreadAnnouncements: 0,
      unreadSupport: 0,
    };

    // --- Notifications: count unread ---
    // Table is 'notifications' with 'recipient_id' (not notification_logs/user_id)
    try {
      const notifications = await SupabaseService.selectAll(
        "notifications",
        "recipient_id",
        userId,
        "id, is_read",
        "created_at",
        false,
      );
      result.unreadNotifications = (notifications || []).filter(
        (n) => !n.is_read,
      ).length;
    } catch (e) {
      /* ignore */
    }

    if (role === "admin") {
      // --- Admin: count unread support tickets + bug reports ---
      try {
        const [tickets, bugs] = await Promise.all([
          SupabaseService.selectAllRecords(
            "support_tickets",
            "id, is_read, status",
          ),
          SupabaseService.selectAllRecords(
            "bug_reports",
            "id, is_read, status",
          ),
        ]);
        const unreadTickets = (tickets || []).filter(
          (t) => !t.is_read && t.status !== "closed",
        ).length;
        const unreadBugs = (bugs || []).filter(
          (b) => !b.is_read && b.status !== "closed",
        ).length;
        result.unreadSupport = unreadTickets + unreadBugs;
      } catch (e) {
        /* ignore */
      }
    } else {
      // --- Client/Host: count unread support responses ---
      try {
        const [tickets, bugs] = await Promise.all([
          SupabaseService.selectAll(
            "support_tickets",
            "user_id",
            userId,
            "id, is_read, status",
          ),
          SupabaseService.selectAll(
            "bug_reports",
            "user_id",
            userId,
            "id, is_read, status",
          ),
        ]);
        const unreadTickets = (tickets || []).filter((t) => !t.is_read).length;
        const unreadBugs = (bugs || []).filter((b) => !b.is_read).length;
        result.unreadSupport = unreadTickets + unreadBugs;
      } catch (e) {
        /* ignore */
      }

      // --- Client: count unread announcements ---
      try {
        const userRooms = await SupabaseService.getUserRooms(userId);
        if (userRooms && userRooms.length > 0) {
          const roomId = userRooms[0].id;
          const announcements = await SupabaseService.selectAll(
            "announcements",
            "room_id",
            roomId,
            "id, read_by",
            "created_at",
            false,
          );
          result.unreadAnnouncements = (announcements || []).filter((a) => {
            const readBy = a.read_by || [];
            return !readBy.includes(userId);
          }).length;
        }
      } catch (e) {
        /* ignore */
      }
    }

    cache.set(cacheKey, result, 30); // Cache for 30 seconds
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Badge count error:", error.message);
    res.status(200).json({
      success: true,
      unreadNotifications: 0,
      unreadAnnouncements: 0,
      unreadSupport: 0,
    });
  }
});

module.exports = router;
