// Announcement Controller (Supabase Version)
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");

// Helper to normalize announcement for mobile compatibility
const normalizeAnnouncement = (ann) => ({
  ...ann,
  createdAt: ann.created_at,
  createdBy: ann.creator || ann.created_by, // Provide enriched user as createdBy for mobile avatar access
  roomId: ann.room_id,
  isPinned: ann.is_pinned,
});

// ============================================================
// CREATE ANNOUNCEMENT
// ============================================================
router.post("/", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId, title, content, isPinned } = req.body;

    if (!roomId || !title || !content) {
      return next(
        new ErrorHandler("Room ID, title, and content are required", 400),
      );
    }

    const room = await SupabaseService.findRoomById(roomId);
    if (!room) {
      return next(new ErrorHandler("Room not found", 404));
    }

    const announcement = await SupabaseService.insert("announcements", {
      room_id: roomId,
      title,
      content,
      created_by: req.user.id,
      is_pinned: isPinned || false,
      created_at: new Date(),
    });

    // Enrich with creator details
    const creator = await SupabaseService.findUserById(req.user.id);
    announcement.creator = creator;

    res.status(201).json({
      success: true,
      message: "Announcement created successfully",
      announcement: normalizeAnnouncement(announcement),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET ALL ANNOUNCEMENTS FOR A ROOM
// ============================================================
router.get("/room/:roomId", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const room = await SupabaseService.findRoomById(roomId);
    if (!room) {
      return next(new ErrorHandler("Room not found", 404));
    }

    const announcements =
      (await SupabaseService.selectAll("announcements", "room_id", roomId)) ||
      [];

    // Enrich with creator details and sort pinned first
    for (let announcement of announcements) {
      const creator = await SupabaseService.findUserById(
        announcement.created_by,
      );
      announcement.creator = creator;
    }

    const sorted = announcements.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) {
        return b.is_pinned ? 1 : -1;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

    res.status(200).json({
      success: true,
      announcements: sorted.map(normalizeAnnouncement),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET SINGLE ANNOUNCEMENT
// ============================================================
router.get("/:announcementId", isAuthenticated, async (req, res, next) => {
  try {
    const { announcementId } = req.params;

    const announcement = await SupabaseService.selectByColumn(
      "announcements",
      "id",
      announcementId,
    );

    if (!announcement) {
      return next(new ErrorHandler("Announcement not found", 404));
    }
    const creator = await SupabaseService.findUserById(announcement.created_by);
    announcement.creator = creator;

    res.status(200).json({
      success: true,
      announcement: normalizeAnnouncement(announcement),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// UPDATE ANNOUNCEMENT
// ============================================================
router.put("/:announcementId", isAuthenticated, async (req, res, next) => {
  try {
    const { announcementId } = req.params;
    const { title, content, isPinned } = req.body;

    // Verify ownership
    const announcement = await SupabaseService.selectByColumn(
      "announcements",
      "id",
      announcementId,
    );

    if (!announcement) {
      return next(new ErrorHandler("Announcement not found", 404));
    }

    if (announcement.created_by !== req.user.id) {
      return next(new ErrorHandler("Unauthorized", 403));
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (isPinned !== undefined) updateData.is_pinned = isPinned;
    updateData.updated_at = new Date();

    const updatedAnnouncement = await SupabaseService.update(
      "announcements",
      announcementId,
      updateData,
    );

    const creator = await SupabaseService.findUserById(
      updatedAnnouncement.created_by,
    );
    updatedAnnouncement.creator = creator;

    res.status(200).json({
      success: true,
      message: "Announcement updated successfully",
      announcement: normalizeAnnouncement(updatedAnnouncement),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// DELETE ANNOUNCEMENT
// ============================================================
router.delete("/:announcementId", isAuthenticated, async (req, res, next) => {
  try {
    const { announcementId } = req.params;

    // Verify ownership
    const announcement = await SupabaseService.selectByColumn(
      "announcements",
      "id",
      announcementId,
    );

    if (!announcement) {
      return next(new ErrorHandler("Announcement not found", 404));
    }

    if (announcement.created_by !== req.user.id) {
      return next(new ErrorHandler("Unauthorized", 403));
    }

    await SupabaseService.deleteRecord("announcements", announcementId);

    res.status(200).json({
      success: true,
      message: "Announcement deleted successfully",
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// MARK ANNOUNCEMENT AS READ
// ============================================================
router.put(
  "/:announcementId/mark-read",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { announcementId } = req.params;

      // Verify announcement exists
      const announcement = await SupabaseService.selectByColumn(
        "announcements",
        "id",
        announcementId,
      );

      if (!announcement) {
        return next(new ErrorHandler("Announcement not found", 404));
      }

      // Try to record in announcement_reads table if it exists
      try {
        await SupabaseService.insert("announcement_reads", {
          announcement_id: announcementId,
          user_id: req.user.id,
          read_at: new Date(),
        });
      } catch (e) {
        // Table may not exist yet — silently succeed
        console.log(
          "announcement_reads table not available, skipping:",
          e.message,
        );
      }

      res.status(200).json({
        success: true,
        message: "Announcement marked as read",
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// PIN/UNPIN ANNOUNCEMENT
// ============================================================
router.post("/:announcementId/pin", isAuthenticated, async (req, res, next) => {
  try {
    const { announcementId } = req.params;
    const { isPinned } = req.body;

    const updatedAnnouncement = await SupabaseService.update(
      "announcements",
      announcementId,
      { is_pinned: isPinned },
    );

    const creator = await SupabaseService.findUserById(
      updatedAnnouncement.created_by,
    );
    updatedAnnouncement.creator = creator;

    res.status(200).json({
      success: true,
      message: isPinned ? "Announcement pinned" : "Announcement unpinned",
      announcement: normalizeAnnouncement(updatedAnnouncement),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

module.exports = router;
