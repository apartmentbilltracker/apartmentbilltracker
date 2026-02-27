// Announcement Controller (Supabase Version)
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");
const cache = require("../utils/MemoryCache");

// Helper to normalize announcement for mobile compatibility
const normalizeAnnouncement = (ann) => ({
  ...ann,
  createdAt: ann.created_at,
  createdBy: ann.creator || ann.created_by, // Provide enriched user as createdBy for mobile avatar access
  roomId: ann.room_id,
  isPinned: ann.is_pinned,
  targetUserId: ann.target_user_id || null,
});

// ============================================================
// CREATE ANNOUNCEMENT
// ============================================================
router.post("/", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId, title, content, isPinned, targetUserId } = req.body;

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
      target_user_id: targetUserId || null,
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

    // Batch enrich: creator + comments + reactions in parallel per announcement
    const supabase = SupabaseService.getClient();
    await Promise.all(
      announcements.map(async (announcement) => {
        const annId = announcement.id;
        const [creator, commentsRes, reactionsRes] = await Promise.all([
          SupabaseService.findUserById(announcement.created_by),
          supabase
            .from("announcement_comments")
            .select("id, text, created_at, user_id")
            .eq("announcement_id", annId)
            .order("created_at", { ascending: true }),
          supabase
            .from("announcement_reactions")
            .select("id, type, user_id")
            .eq("announcement_id", annId),
        ]);
        announcement.creator = creator;

        // Enrich comments with user info
        const comments = commentsRes.data || [];
        const commentUserIds = [...new Set(comments.map((c) => c.user_id))];
        const commentUserMap =
          await SupabaseService.findUsersByIds(commentUserIds);
        announcement.comments = comments.map((c) => ({
          ...c,
          user: commentUserMap.get(c.user_id) || { id: c.user_id },
        }));

        // Enrich reactions with user info
        const reactions = reactionsRes.data || [];
        const reactionUserIds = [...new Set(reactions.map((r) => r.user_id))];
        const reactionUserMap =
          await SupabaseService.findUsersByIds(reactionUserIds);
        announcement.reactions = reactions.map((r) => ({
          ...r,
          user: reactionUserMap.get(r.user_id) || { id: r.user_id },
        }));
      }),
    );

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

      // Record read in announcement_reads table
      try {
        await SupabaseService.insert("announcement_reads", {
          announcement_id: announcementId,
          user_id: req.user.id,
          read_at: new Date(),
        });
      } catch (e) {
        // Duplicate read is fine — ignore unique constraint violations
      }

      // Invalidate badge cache so tab badge clears immediately
      cache.del(`badges:${req.user.id}`);

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

// ============================================================
// COMMENTS
// ============================================================
router.post(
  "/:announcementId/comments",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { announcementId } = req.params;
      const { text } = req.body;
      if (!text?.trim())
        return next(new ErrorHandler("Comment text is required", 400));

      const comment = await SupabaseService.insert("announcement_comments", {
        announcement_id: announcementId,
        user_id: req.user.id,
        text: text.trim(),
        created_at: new Date(),
      });
      const user = await SupabaseService.findUserById(req.user.id);
      res.status(201).json({ success: true, comment: { ...comment, user } });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

router.delete(
  "/:announcementId/comments/:commentId",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { commentId } = req.params;
      await SupabaseService.deleteRecord("announcement_comments", commentId);
      res.status(200).json({ success: true, message: "Comment deleted" });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// REACTIONS
// ============================================================
router.post(
  "/:announcementId/reactions",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { announcementId } = req.params;
      const { reactionType } = req.body;
      if (!reactionType)
        return next(new ErrorHandler("reactionType is required", 400));

      const supabase = SupabaseService.getClient();
      // Upsert: one reaction per user per announcement
      const { data, error } = await supabase
        .from("announcement_reactions")
        .upsert(
          {
            announcement_id: announcementId,
            user_id: req.user.id,
            type: reactionType,
            created_at: new Date(),
          },
          { onConflict: "announcement_id,user_id" },
        )
        .select()
        .single();
      if (error) throw new Error(error.message);
      const user = await SupabaseService.findUserById(req.user.id);
      res.status(200).json({ success: true, reaction: { ...data, user } });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

router.delete(
  "/:announcementId/reactions",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { announcementId } = req.params;
      const supabase = SupabaseService.getClient();
      await supabase
        .from("announcement_reactions")
        .delete()
        .eq("announcement_id", announcementId)
        .eq("user_id", req.user.id);
      res.status(200).json({ success: true, message: "Reaction removed" });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

router.get(
  "/:announcementId/reactions/summary",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { announcementId } = req.params;
      const supabase = SupabaseService.getClient();
      const { data } = await supabase
        .from("announcement_reactions")
        .select("type")
        .eq("announcement_id", announcementId);
      const summary = {};
      (data || []).forEach((r) => {
        summary[r.type] = (summary[r.type] || 0) + 1;
      });
      res.status(200).json({ success: true, summary });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// SHARE
// ============================================================
router.post(
  "/:announcementId/share",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { announcementId } = req.params;
      const supabase = SupabaseService.getClient();
      // Increment share_count
      await supabase
        .rpc("increment_share_count", { ann_id: announcementId })
        .catch(() => {
          // Fallback: manual increment if rpc not available
          return supabase
            .from("announcements")
            .select("share_count")
            .eq("id", announcementId)
            .single()
            .then(({ data }) => {
              const current = data?.share_count || 0;
              return supabase
                .from("announcements")
                .update({ share_count: current + 1 })
                .eq("id", announcementId);
            });
        });
      res.status(200).json({ success: true, message: "Share recorded" });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

router.get(
  "/:announcementId/shares/count",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { announcementId } = req.params;
      const ann = await SupabaseService.selectByColumn(
        "announcements",
        "id",
        announcementId,
        "share_count",
      );
      res.status(200).json({ success: true, count: ann?.share_count || 0 });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

module.exports = router;
