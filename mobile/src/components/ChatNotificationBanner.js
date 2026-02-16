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
import { useNavigation, useNavigationState } from "@react-navigation/native";
import { AuthContext } from "../context/AuthContext";
import { chatService, roomService } from "../services/apiService";
import { useTheme } from "../theme/ThemeContext";

const POLL_INTERVAL = 8000; // 8 seconds
const BANNER_DURATION = 4500; // 4.5 seconds visible
const BANNER_HEIGHT = 76;

/**
 * Messenger-style chat notification banner.
 * Slides down from the top when a new message arrives in the user's room.
 * Suppresses when user is already on the ChatRoom screen.
 *
 * Props:
 *  - role: "client" | "host"
 */
const ChatNotificationBanner = ({ role = "client" }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { state: authState } = useContext(AuthContext);
  const userId = authState?.user?.id || authState?.user?._id;

  const [visible, setVisible] = useState(false);
  const [notification, setNotification] = useState(null); // { senderName, senderAvatar, text, roomId, roomName }
  const [roomId, setRoomId] = useState(null);
  const [roomName, setRoomName] = useState(null);

  const slideAnim = useRef(new Animated.Value(-BANNER_HEIGHT - 20)).current;
  const lastMsgIdRef = useRef(null);
  const dismissTimerRef = useRef(null);
  const pollRef = useRef(null);
  const isHost = role === "host";

  // Detect if ChatRoom screen is currently active
  const navState = useNavigationState((s) => s);
  const isChatActive = useRef(false);

  useEffect(() => {
    // Recursively find active route name
    const getActiveRouteName = (state) => {
      if (!state) return null;
      const route = state.routes?.[state.index];
      if (route?.state) return getActiveRouteName(route.state);
      return route?.name;
    };
    const activeRoute = getActiveRouteName(navState);
    isChatActive.current = activeRoute === "ChatRoom";
  }, [navState]);

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
      toValue: -BANNER_HEIGHT - 20,
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

    const checkMessages = async () => {
      // Skip if user is on the chat screen
      if (isChatActive.current) return;

      try {
        // First check if chat is enabled
        const status = await chatService.getChatStatus(roomId);
        if (!status.chatEnabled) return;

        const res = await chatService.getMessages(roomId, { limit: 1 });
        const msgs = res?.messages || [];
        if (msgs.length === 0) return;

        const latest = msgs[msgs.length - 1];

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

    // Initial check after a short delay
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

  const handlePress = () => {
    hideBanner();
    navigation.navigate(isHost ? "DashboardStack" : "HomeStack", {
      screen: "ChatRoom",
      params: {
        roomId: notification.roomId,
        roomName: notification.roomName,
        isHost,
      },
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          top: insets.top + 4,
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: "#000",
        },
      ]}
    >
      <TouchableOpacity
        style={styles.inner}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {notification.senderAvatar ? (
            <Image
              source={{ uri: notification.senderAvatar }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: colors.accentLight || colors.accentSurface },
              ]}
            >
              <Text style={[styles.avatarLetter, { color: colors.accent }]}>
                {(notification.senderName || "?")[0].toUpperCase()}
              </Text>
            </View>
          )}
          {/* Online dot */}
          <View style={styles.onlineDot} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text
            style={[styles.senderName, { color: colors.text }]}
            numberOfLines={1}
          >
            {notification.senderName}
          </Text>
          <Text
            style={[
              styles.messagePreview,
              { color: colors.textSecondary || colors.textTertiary },
            ]}
            numberOfLines={1}
          >
            {notification.text}
          </Text>
        </View>

        {/* Dismiss */}
        <TouchableOpacity
          style={[styles.dismissBtn, { backgroundColor: colors.background }]}
          onPress={(e) => {
            e.stopPropagation?.();
            hideBanner();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={14} color={colors.textTertiary} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Room badge */}
      <View
        style={[
          styles.roomBadge,
          { backgroundColor: colors.accentLight || colors.accentSurface },
        ]}
      >
        <Ionicons name="chatbubble-ellipses" size={10} color={colors.accent} />
        <Text
          style={[styles.roomBadgeText, { color: colors.accent }]}
          numberOfLines={1}
        >
          {notification.roomName}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
      },
      android: {
        elevation: 20,
      },
    }),
    overflow: "visible",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: "700",
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2ecc71",
    borderWidth: 2,
    borderColor: "#fff",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  senderName: {
    fontSize: 14,
    fontWeight: "700",
  },
  messagePreview: {
    fontSize: 13,
    lineHeight: 18,
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  roomBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginLeft: 70,
    marginBottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roomBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    maxWidth: 120,
  },
});

export default ChatNotificationBanner;
