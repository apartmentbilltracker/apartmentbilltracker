const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const {
  getRoomAnnouncements,
  createAnnouncement,
  addComment,
  deleteAnnouncement,
  deleteComment,
} = require("../controller/announcement");

// Create a new announcement (admin only)
router.post("/create", isAuthenticated, createAnnouncement);

// Add a comment to an announcement
router.post("/:announcementId/comments", isAuthenticated, addComment);

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
