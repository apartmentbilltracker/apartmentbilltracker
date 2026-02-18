// Chat Controller (Supabase Version)
// Messages auto-expire after 1 day for storage management
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");
const { sendPushNotification } = require("../utils/sendPushNotification");
const cache = require("../utils/MemoryCache");

const MESSAGE_TTL_DAYS = 1;

// Helper: normalize chat message for mobile
const normalizeMessage = (msg) => ({
  id: msg.id,
  roomId: msg.room_id,
  text: msg.text,
  sender: msg.sender || null,
  senderId: msg.sender_id,
  createdAt: msg.created_at,
  expiresAt: msg.expires_at,
});

// Helper: purge expired messages for a room (runs on every fetch)
const purgeExpired = async (roomId) => {
  try {
    const supabase = SupabaseService.getClient();
    await supabase
      .from("chat_messages")
      .delete()
      .eq("room_id", roomId)
      .lt("expires_at", new Date().toISOString());
  } catch (err) {
    console.error("Chat purge error:", err.message);
  }
};

// ============================================================
// ENABLE / CREATE CHAT FOR A ROOM  (host only)
// ============================================================
router.post("/room/:roomId/enable", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Verify room exists
    const room = await SupabaseService.findRoomById(roomId);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Only the room creator (host) can enable chat
    if (String(room.created_by) !== String(userId)) {
      return next(new ErrorHandler("Only the room host can enable chat", 403));
    }

    // Update room to mark chat as enabled
    const supabase = SupabaseService.getClient();
    const { error } = await supabase
      .from("rooms")
      .update({ chat_enabled: true })
      .eq("id", roomId);
    if (error) throw new Error(error.message);

    // Invalidate cached status
    cache.del(`chat_status:${roomId}`);
    cache.del(`room:${roomId}`);

    res.status(200).json({
      success: true,
      message: "Chat enabled for this room. All members can now chat.",
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// DISABLE CHAT FOR A ROOM  (host only)
// ============================================================
router.post(
  "/room/:roomId/disable",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) return next(new ErrorHandler("Room not found", 404));

      if (String(room.created_by) !== String(userId)) {
        return next(
          new ErrorHandler("Only the room host can disable chat", 403),
        );
      }

      const supabase = SupabaseService.getClient();
      const { error } = await supabase
        .from("rooms")
        .update({ chat_enabled: false })
        .eq("id", roomId);
      if (error) throw new Error(error.message);

      // Invalidate cached status
      cache.del(`chat_status:${roomId}`);
      cache.del(`room:${roomId}`);

      res.status(200).json({
        success: true,
        message: "Chat disabled for this room.",
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// GET CHAT STATUS FOR A ROOM
// ============================================================
router.get("/room/:roomId/status", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId } = req.params;

    // Cache chat status for 30 seconds — avoids hammering DB on every poll
    const status = await cache.getOrSet(
      `chat_status:${roomId}`,
      async () => {
        const room = await SupabaseService.findRoomById(roomId);
        if (!room) return null;
        return { chatEnabled: !!room.chat_enabled, roomId };
      },
      30,
    );

    if (!status) return next(new ErrorHandler("Room not found", 404));

    res.status(200).json({ success: true, ...status });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// SEND MESSAGE
// ============================================================
router.post(
  "/room/:roomId/messages",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const { text } = req.body;
      const userId = req.user.id;

      if (!text || !text.trim()) {
        return next(new ErrorHandler("Message text is required", 400));
      }

      // Verify room exists and chat is enabled
      const room = await SupabaseService.findRoomById(roomId);
      if (!room) return next(new ErrorHandler("Room not found", 404));
      if (!room.chat_enabled) {
        return next(new ErrorHandler("Chat is not enabled for this room", 403));
      }

      // Verify user is the host OR a member of this room
      const isHost = String(room.created_by) === String(userId);
      if (!isHost) {
        const supabase = SupabaseService.getClient();
        const { data: membership } = await supabase
          .from("room_members")
          .select("id")
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .single();

        if (!membership) {
          return next(
            new ErrorHandler("You must be a member of this room to chat", 403),
          );
        }
      }

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + MESSAGE_TTL_DAYS);

      const message = await SupabaseService.insert("chat_messages", {
        room_id: roomId,
        sender_id: userId,
        text: text.trim(),
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      // Enrich with sender info
      const sender = await SupabaseService.findUserById(userId);
      message.sender = sender
        ? { id: sender.id, name: sender.name, avatar: sender.avatar }
        : null;

      // ── Push notifications to other room members (fire & forget) ──
      (async () => {
        try {
          // Get all room members
          const members = await SupabaseService.getRoomMembers(roomId);
          const memberUserIds = (members || []).map((m) => m.user_id);

          // Include the host (room creator) if not already a member
          if (!memberUserIds.includes(room.created_by)) {
            memberUserIds.push(room.created_by);
          }

          // Exclude sender
          const recipientIds = memberUserIds.filter(
            (id) => String(id) !== String(userId),
          );

          if (recipientIds.length === 0) return;

          // Batch-fetch users to get their push tokens
          const userMap = await SupabaseService.findUsersByIds(recipientIds);
          const senderName = sender?.name || "Someone";
          const truncatedText =
            text.trim().length > 80
              ? text.trim().substring(0, 80) + "..."
              : text.trim();

          for (const [, user] of userMap) {
            if (user?.expo_push_token) {
              sendPushNotification(user.expo_push_token, {
                title: `💬 ${senderName}`,
                body: truncatedText,
                data: {
                  type: "chat_message",
                  roomId,
                  roomName: room.name || "Chat",
                  senderId: userId,
                  senderName,
                },
              });
            }
          }
        } catch (pushErr) {
          console.error("Chat push notification error:", pushErr.message);
        }
      })();

      res.status(201).json({
        success: true,
        message: normalizeMessage(message),
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// GET MESSAGES FOR A ROOM (with auto-purge of expired)
// ============================================================
router.get(
  "/room/:roomId/messages",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const { before, limit = 50 } = req.query;

      // Cache room lookup for 30s to avoid re-querying on every poll
      const room = await cache.getOrSet(
        `room:${roomId}`,
        () => SupabaseService.findRoomById(roomId),
        30,
      );
      if (!room) return next(new ErrorHandler("Room not found", 404));
      if (!room.chat_enabled) {
        return next(new ErrorHandler("Chat is not enabled for this room", 403));
      }

      // Purge expired messages at most once per 5 minutes per room
      const purgeKey = `chat_purge:${roomId}`;
      if (!cache.get(purgeKey)) {
        await purgeExpired(roomId);
        cache.set(purgeKey, true, 300); // 5 minutes
      }

      // Fetch messages
      const supabase = SupabaseService.getClient();
      let query = supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(parseInt(limit));

      if (before) {
        query = query.lt("created_at", before);
      }

      const { data: messages, error } = await query;
      if (error) throw new Error(error.message);

      // Enrich with sender info — batch fetch all unique senders in ONE query
      const senderIds = [...new Set((messages || []).map((m) => m.sender_id))];
      const userMap =
        senderIds.length > 0
          ? await SupabaseService.findUsersByIds(senderIds)
          : new Map();
      const senderMap = {};
      for (const [id, user] of userMap) {
        if (user) {
          senderMap[id] = { id: user.id, name: user.name, avatar: user.avatar };
        }
      }

      const enriched = (messages || []).map((m) => {
        m.sender = senderMap[m.sender_id] || null;
        return normalizeMessage(m);
      });

      res.status(200).json({
        success: true,
        messages: enriched,
        count: enriched.length,
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// DELETE A MESSAGE  (sender or host can delete)
// ============================================================
router.delete(
  "/room/:roomId/messages/:messageId",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { roomId, messageId } = req.params;
      const userId = req.user.id;

      const room = await SupabaseService.findRoomById(roomId);
      if (!room) return next(new ErrorHandler("Room not found", 404));

      const msg = await SupabaseService.findById("chat_messages", messageId);
      if (!msg) return next(new ErrorHandler("Message not found", 404));

      // Only sender or room host can delete
      const isHost = String(room.created_by) === String(userId);
      const isSender = String(msg.sender_id) === String(userId);
      if (!isHost && !isSender) {
        return next(
          new ErrorHandler(
            "Only the message sender or room host can delete messages",
            403,
          ),
        );
      }

      await SupabaseService.deleteRecord("chat_messages", messageId);

      res.status(200).json({
        success: true,
        message: "Message deleted",
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

module.exports = router;
