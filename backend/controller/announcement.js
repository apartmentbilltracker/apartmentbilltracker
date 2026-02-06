const Announcement = require("../model/announcement");
const Room = require("../model/room");
const User = require("../model/user");

// Get all announcements for a room
exports.getRoomAnnouncements = async (req, res) => {
  try {
    const { roomId } = req.params;

    const announcements = await Announcement.find({ room: roomId })
      .populate("createdBy", "name avatar")
      .populate("comments.user", "name avatar")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: announcements,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching announcements",
      error: error.message,
    });
  }
};

// Create a new announcement (admin only)
exports.createAnnouncement = async (req, res) => {
  try {
    const { roomId, title, content } = req.body;
    const userId = req.user._id;

    // Verify user is admin of the room
    const room = await Room.findById(roomId);
    if (!room || String(room.createdBy) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only room admin can create announcements",
      });
    }

    const user = await User.findById(userId);
    const announcement = new Announcement({
      room: roomId,
      createdBy: userId,
      creatorName: user.name,
      title,
      content,
    });

    await announcement.save();

    res.status(201).json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating announcement",
      error: error.message,
    });
  }
};

// Add a comment to an announcement
exports.addComment = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    const announcement = await Announcement.findByIdAndUpdate(
      announcementId,
      {
        $push: {
          comments: {
            user: userId,
            userName: user.name,
            text,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    ).populate("createdBy", "name");

    res.status(200).json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding comment",
      error: error.message,
    });
  }
};

// Delete an announcement (admin only)
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const userId = req.user._id;

    const announcement = await Announcement.findById(announcementId);
    if (!announcement || String(announcement.createdBy) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only creator can delete announcement",
      });
    }

    await Announcement.findByIdAndDelete(announcementId);

    res.status(200).json({
      success: true,
      message: "Announcement deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting announcement",
      error: error.message,
    });
  }
};

// Delete a comment
exports.deleteComment = async (req, res) => {
  try {
    const { announcementId, commentId } = req.params;
    const userId = req.user._id;

    const announcement = await Announcement.findById(announcementId);
    const comment = announcement.comments.id(commentId);

    if (!comment || String(comment.user) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only comment creator can delete it",
      });
    }

    comment.deleteOne();
    await announcement.save();

    res.status(200).json({
      success: true,
      message: "Comment deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting comment",
      error: error.message,
    });
  }
};

// Mark announcement as read by user
exports.markAsRead = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const userId = req.user._id;

    const announcement = await Announcement.findByIdAndUpdate(
      announcementId,
      {
        $addToSet: { readBy: userId },
      },
      { new: true },
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Announcement marked as read",
      data: announcement,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error marking announcement as read",
      error: error.message,
    });
  }
};

// Add or update reaction to an announcement
exports.addReaction = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const { reactionType } = req.body;
    const userId = req.user._id;

    const validReactions = ["like", "love", "haha", "wow", "sad", "angry"];
    if (!validReactions.includes(reactionType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reaction type",
      });
    }

    // Remove user's existing reaction if any
    await Announcement.findByIdAndUpdate(announcementId, {
      $pull: { reactions: { user: userId } },
    });

    // Add new reaction
    const announcement = await Announcement.findByIdAndUpdate(
      announcementId,
      {
        $push: {
          reactions: {
            user: userId,
            type: reactionType,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    ).populate("reactions.user", "name");

    res.status(200).json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding reaction",
      error: error.message,
    });
  }
};

// Remove reaction from an announcement
exports.removeReaction = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const userId = req.user._id;

    const announcement = await Announcement.findByIdAndUpdate(
      announcementId,
      {
        $pull: { reactions: { user: userId } },
      },
      { new: true },
    );

    res.status(200).json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error removing reaction",
      error: error.message,
    });
  }
};

// Get reaction summary (count by type)
exports.getReactionSummary = async (req, res) => {
  try {
    const { announcementId } = req.params;

    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    const reactionSummary = {};
    const reactionEmojis = {
      like: "👍",
      love: "❤️",
      haha: "😂",
      wow: "😮",
      sad: "😢",
      angry: "😠",
    };

    announcement.reactions.forEach((reaction) => {
      if (!reactionSummary[reaction.type]) {
        reactionSummary[reaction.type] = 0;
      }
      reactionSummary[reaction.type]++;
    });

    const totalReactions = announcement.reactions.length;

    res.status(200).json({
      success: true,
      data: {
        total: totalReactions,
        summary: reactionSummary,
        emojis: reactionEmojis,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error getting reaction summary",
      error: error.message,
    });
  }
};

// Share an announcement
exports.shareAnnouncement = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    const announcement = await Announcement.findByIdAndUpdate(
      announcementId,
      {
        $push: {
          shares: {
            user: userId,
            userName: user.name,
            sharedAt: new Date(),
          },
        },
      },
      { new: true },
    );

    res.status(200).json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error sharing announcement",
      error: error.message,
    });
  }
};

// Get share count
exports.getShareCount = async (req, res) => {
  try {
    const { announcementId } = req.params;

    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        shareCount: announcement.shares?.length || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error getting share count",
      error: error.message,
    });
  }
};
