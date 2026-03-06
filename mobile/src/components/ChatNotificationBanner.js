import React, { useState, useEffect, useRef, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../context/AuthContext";
import { chatService, roomService } from "../services/apiService";
import { useTheme } from "../theme/ThemeContext";
import { navigationRef } from "../navigation/navigationRef";

const POLL_INTERVAL = 60000; // 60 seconds — reduced to save Supabase egress
const BANNER_DURATION = 4500; // 4.5 seconds visible
const BANNER_HEIGHT = 95; // header (~30) + body (~65)

// Deterministic color per sender name — makes avatars recognizable at a glance
const AVATAR_PALETTE = [
  "#e91e63",
  "#9c27b0",
  "#3f51b5",
  "#2196f3",
  "#009688",
  "#ff5722",
  "#795548",
  "#607d8b",
];
const getAvatarColor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

/**
 * Messenger-style chat notification banner.
 * Slides down from the top when a new message arrives in the user's room.
 * Suppresses when user is already on the ChatRoom screen.
 *
 * Props:
 *  - role: "client" | "host"
 */
const ChatNotificationBanner = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { state: authState } = useContext(AuthContext);
  const userId = authState?.user?.id || authState?.user?._id;
  const userRole = authState?.user?.role;
  const isHost = Array.isArray(userRole)
    ? userRole.includes("host")
    : typeof userRole === "string" && userRole.toLowerCase() === "host";

  const [visible, setVisible] = useState(false);
  const [notification, setNotification] = useState(null); // { senderName, senderAvatar, text, roomId, roomName }
  const [roomId, setRoomId] = useState(null);
  const [roomName, setRoomName] = useState(null);

  const slideAnim = useRef(new Animated.Value(-(BANNER_HEIGHT + 20))).current;
  const lastMsgIdRef = useRef(null);
  const dismissTimerRef = useRef(null);
  const pollRef = useRef(null);

  // Don't render for admins or unauthenticated users
  const isAdmin = Array.isArray(userRole)
    ? userRole.includes("admin")
    : typeof userRole === "string" && userRole.toLowerCase().includes("admin");

  // Check active route via ref — safe to call from anywhere, no Navigator context needed
  const isChatScreenActive = () =>
    navigationRef.current?.getCurrentRoute()?.name === "ChatRoom";

  // Fetch user's room ID
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        if (isHost) {
          const res = await roomService.getRooms();
          const rooms = res?.rooms || res || [];
          if (rooms.length > 0) {
            const room = rooms[0];
            setRoomId(room.id || room._id);
            setRoomName(room.name);
          }
        } else {
          const res = await roomService.getClientRooms();
          let rooms = [];
          if (Array.isArray(res)) rooms = res;
          else if (res?.data)
            rooms = Array.isArray(res.data) ? res.data : [res.data];
          else if (res?.rooms)
            rooms = Array.isArray(res.rooms) ? res.rooms : [res.rooms];

          // Find joined room
          const joined = rooms.find((r) =>
            r.members?.some(
              (m) =>
                String(m.user?._id || m.user?.id || m.user) === String(userId),
            ),
          );
          if (joined) {
            setRoomId(joined.id || joined._id);
            setRoomName(joined.name);
          }
        }
      } catch (err) {
        // Silent fail
      }
    };
    if (userId) fetchRoom();
  }, [userId, isHost]);

  // Show banner with animation
  const showBanner = (data) => {
    setNotification(data);
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();

    // Auto-dismiss
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(hideBanner, BANNER_DURATION);
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -(BANNER_HEIGHT + 20),
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setNotification(null);
    });
  };

  // Poll for new messages
  useEffect(() => {
    if (!roomId) return;

    // On first mount, seed lastMsgIdRef so we don't banner old messages
    let seeded = false;

    const checkMessages = async () => {
      // Skip if user is on the chat screen
      if (isChatScreenActive()) return;

      try {
        // First check if chat is enabled
        const status = await chatService.getChatStatus(roomId);
        if (!status.chatEnabled) return;

        const res = await chatService.getMessages(roomId, { limit: 1 });
        const msgs = res?.messages || [];
        if (msgs.length === 0) return;

        const latest = msgs[msgs.length - 1];

        // First poll: just record the current latest ID, don't show banner
        if (!seeded) {
          lastMsgIdRef.current = latest.id;
          seeded = true;
          return;
        }

        // Skip own messages
        if (String(latest.senderId) === String(userId)) {
          lastMsgIdRef.current = latest.id;
          return;
        }

        // New message?
        if (latest.id !== lastMsgIdRef.current) {
          lastMsgIdRef.current = latest.id;
          showBanner({
            senderName: latest.sender?.name || "Someone",
            senderAvatar: latest.sender?.avatar?.url || null,
            text: latest.text,
            roomId,
            roomName: roomName || "Chat",
          });
        }
      } catch {
        // Silent fail
      }
    };

    // Initial seed after a short delay (silent — no banner)
    const initTimer = setTimeout(checkMessages, 2000);
    pollRef.current = setInterval(checkMessages, POLL_INTERVAL);

    return () => {
      clearTimeout(initTimer);
      clearInterval(pollRef.current);
    };
  }, [roomId, userId, roomName]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (!visible || !notification) return null;
  // Don't mount for admin users or when signed out
  if (!userId || isAdmin) return null;

  const handlePress = () => {
    hideBanner();
    navigationRef.current?.navigate("ChatRoom", {
      roomId: notification.roomId,
      roomName: notification.roomName,
      isHost,
    });
  };

  const avatarColor = getAvatarColor(notification.senderName);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          top: insets.top + 8,
          shadowColor: "#000",
        },
      ]}
    >
      {/* Inner wrapper — clips header accent colour to rounded corners */}
      <View style={[styles.innerClip, { backgroundColor: colors.card }]}>
        {/* ── Accent header bar ── */}
        <View style={[styles.headerBar, { backgroundColor: colors.accent }]}>
          <Ionicons
            name="chatbubble-ellipses"
            size={12}
            color="rgba(255,255,255,0.95)"
          />
          <Text style={styles.headerLabel}>NEW MESSAGE</Text>
          <View style={styles.headerDot} />
          <Text style={styles.headerRoom} numberOfLines={1}>
            {notification.roomName}
          </Text>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              hideBanner();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>

        {/* ── Message body (tappable) ── */}
        <TouchableOpacity
          style={styles.body}
          onPress={handlePress}
          activeOpacity={0.85}
        >
          {/* Avatar */}
          <View style={[styles.avatarBox, { backgroundColor: avatarColor }]}>
            {notification.senderAvatar ? (
              <Image
                source={{ uri: notification.senderAvatar }}
                style={styles.avatar}
              />
            ) : (
              <Text style={styles.avatarLetter}>
                {(notification.senderName || "?")[0].toUpperCase()}
              </Text>
            )}
          </View>

          {/* Text content */}
          <View style={styles.msgContent}>
            <Text
              style={[styles.senderName, { color: colors.text }]}
              numberOfLines={1}
            >
              {notification.senderName}
            </Text>
            <Text
              style={[
                styles.msgText,
                { color: colors.textSecondary || colors.textTertiary },
              ]}
              numberOfLines={2}
            >
              {notification.text}
            </Text>
          </View>

          {/* Reply caret */}
          <View
            style={[styles.replyBtn, { backgroundColor: `${colors.accent}1A` }]}
          >
            <Ionicons name="arrow-forward" size={14} color={colors.accent} />
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 10,
    right: 10,
    zIndex: 9999,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.22,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 16,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  innerClip: {
    borderRadius: 14,
    overflow: "hidden",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
  },
  headerLabel: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    flex: 1,
  },
  headerDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  headerRoom: {
    color: "rgba(255,255,255,0.87)",
    fontSize: 11,
    fontWeight: "500",
    flex: 2,
  },
  closeBtn: {
    marginLeft: 6,
    padding: 2,
  },
  body: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarLetter: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  msgContent: {
    flex: 1,
    gap: 3,
  },
  senderName: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 17,
  },
  msgText: {
    fontSize: 12,
    lineHeight: 16,
  },
  replyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ChatNotificationBanner;
