const Announcement = require("../model/announcement");
const Room = require("../model/room");
const User = require("../model/user");

// Get all announcements for a room
exports.getRoomAnnouncements = async (req, res) => {
  try {
    const { roomId } = req.params;

    const announcements = await Announcement.find({ room: roomId })
      .populate("createdBy", "name")
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
