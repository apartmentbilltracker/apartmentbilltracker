const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const {
  getRoomAnnouncements,
  createAnnouncement,
  addComment,
  deleteAnnouncement,
  deleteComment,
  markAsRead,
  addReaction,
  removeReaction,
  getReactionSummary,
  shareAnnouncement,
  getShareCount,
} = require("../controller/announcement");

// Create a new announcement (admin only)
router.post("/create", isAuthenticated, createAnnouncement);

// Add a comment to an announcement
router.post("/:announcementId/comments", isAuthenticated, addComment);

// Mark announcement as read
router.put("/:announcementId/mark-read", isAuthenticated, markAsRead);

// Add reaction
router.post("/:announcementId/reactions", isAuthenticated, addReaction);

// Remove reaction
router.delete("/:announcementId/reactions", isAuthenticated, removeReaction);

// Get reaction summary
router.get("/:announcementId/reactions/summary", getReactionSummary);

// Share announcement
router.post("/:announcementId/share", isAuthenticated, shareAnnouncement);

// Get share count
router.get("/:announcementId/shares/count", getShareCount);

// Delete a comment
router.delete(
  "/:announcementId/comments/:commentId",
  isAuthenticated,
  deleteComment,
);

// Delete an announcement (admin only)
router.delete("/:announcementId", isAuthenticated, deleteAnnouncement);

// Get all announcements for a room (MUST BE LAST to avoid matching :announcementId)
router.get("/:roomId", isAuthenticated, getRoomAnnouncements);

module.exports = router;
