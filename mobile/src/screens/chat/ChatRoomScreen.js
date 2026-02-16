import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { AuthContext } from "../../context/AuthContext";
import { chatService } from "../../services/apiService";
import chatReadTracker from "../../services/chatReadTracker";
import { useTheme } from "../../theme/ThemeContext";

const POLL_INTERVAL = 5000; // 5 seconds

const ChatRoomScreen = ({ route, navigation }) => {
  const { roomId, roomName, isHost } = route.params;
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { state } = useContext(AuthContext);
  const userId = state?.user?.id || state?.user?._id;
  const userName = state?.user?.name || "You";

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [togglingChat, setTogglingChat] = useState(false);
  const flatListRef = useRef(null);
  const pollRef = useRef(null);

  const fetchMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await chatService.getMessages(roomId, { limit: 100 });
      const serverMsgs = res.messages || [];
      // Merge: keep any optimistic (temp_) messages that aren't on the server yet
      setMessages((prev) => {
        const pendingOptimistic = prev.filter(
          (m) => typeof m.id === "string" && m.id.startsWith("temp_"),
        );
        if (pendingOptimistic.length === 0) return serverMsgs;
        // Append optimistic msgs that don't match any server msg by text+time
        const serverTexts = new Set(serverMsgs.map((m) => m.text));
        const stillPending = pendingOptimistic.filter(
          (om) => !serverTexts.has(om.text),
        );
        return stillPending.length > 0
          ? [...serverMsgs, ...stillPending]
          : serverMsgs;
      });
      // Only mark enabled on successful fetch — don't touch chatEnabled on errors
    } catch (err) {
      const msg = err?.data?.message || err?.message || "";
      if (!silent) {
        console.error("Chat fetch error:", msg);
      }
      // Don't set chatEnabled=false here — let fetchStatus be the source of truth
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await chatService.getChatStatus(roomId);
      const enabled = !!res.chatEnabled;
      setChatEnabled(enabled);
      if (enabled) {
        await fetchMessages(true);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error("Chat status error:", err.message);
      // On error, don't change chatEnabled — keep current state
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchStatus();
  }, [roomId]);

  // Poll for new messages when focused & mark as read
  useFocusEffect(
    useCallback(() => {
      // Mark room as read when user views the chat
      chatReadTracker.markAsRead(roomId);

      // Always start by fetching fresh status + messages
      fetchStatus();
      pollRef.current = setInterval(() => {
        if (chatEnabled) {
          fetchMessages(true);
          // Keep updating the read timestamp while viewing
          chatReadTracker.markAsRead(roomId);
        } else {
          // Re-check status periodically in case host enables chat
          fetchStatus();
        }
      }, POLL_INTERVAL);
      return () => {
        // Mark as read when leaving the chat screen
        chatReadTracker.markAsRead(roomId);
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [chatEnabled, roomId]),
  );

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Instantly clear input & show message (true optimistic update)
    const tempId = `temp_${Date.now()}`;
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 3);

    const optimisticMsg = {
      id: tempId,
      roomId,
      text: trimmed,
      senderId: userId,
      sender: { id: userId, name: userName, avatar: null },
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    setText("");
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    // Fire API in background — replace temp msg with real one on success
    chatService
      .sendMessage(roomId, trimmed)
      .then((res) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.message : m)),
        );
      })
      .catch((err) => {
        // Remove optimistic msg on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        Alert.alert("Error", err?.data?.message || "Failed to send message");
      });
  };

  const handleDeleteMessage = (msgId, msgSenderId) => {
    const canDelete = String(msgSenderId) === String(userId) || isHost;
    if (!canDelete) return;

    Alert.alert("Delete Message", "Remove this message?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await chatService.deleteMessage(roomId, msgId);
            setMessages((prev) => prev.filter((m) => m.id !== msgId));
          } catch (err) {
            Alert.alert("Error", "Failed to delete message");
          }
        },
      },
    ]);
  };

  const toggleChat = async () => {
    setTogglingChat(true);
    try {
      if (chatEnabled) {
        await chatService.disableChat(roomId);
        setChatEnabled(false);
        setMessages([]);
      } else {
        await chatService.enableChat(roomId);
        setChatEnabled(true);
        await fetchMessages(true);
      }
    } catch (err) {
      Alert.alert("Error", err?.data?.message || "Failed to toggle chat");
    } finally {
      setTogglingChat(false);
    }
  };

  // Time helpers
  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateSeparator = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  };

  const getExpiryLabel = (expiresAt) => {
    const now = new Date();
    const exp = new Date(expiresAt);
    const hoursLeft = Math.max(0, Math.round((exp - now) / (1000 * 60 * 60)));
    if (hoursLeft < 1) return "Expiring soon";
    if (hoursLeft < 24) return `${hoursLeft}h left`;
    const days = Math.round(hoursLeft / 24);
    return `${days}d left`;
  };

  // Check if we need a date separator
  const needsDateSeparator = (index) => {
    if (index === 0) return true;
    const curr = new Date(messages[index].createdAt).toDateString();
    const prev = new Date(messages[index - 1].createdAt).toDateString();
    return curr !== prev;
  };

  const renderMessage = ({ item: msg, index }) => {
    const isMine = String(msg.senderId) === String(userId);
    const showDate = needsDateSeparator(index);

    return (
      <View>
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>
              {formatDateSeparator(msg.createdAt)}
            </Text>
            <View style={styles.dateLine} />
          </View>
        )}
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => handleDeleteMessage(msg.id, msg.senderId)}
          style={[
            styles.msgRow,
            isMine ? styles.msgRowRight : styles.msgRowLeft,
          ]}
        >
          {/* Avatar for others */}
          {!isMine && (
            <View style={styles.msgAvatar}>
              {msg.sender?.avatar?.url ? (
                <Image
                  source={{ uri: msg.sender.avatar.url }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarLetter}>
                    {(msg.sender?.name || "?")[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          )}
          <View
            style={[
              styles.msgBubble,
              isMine ? styles.msgBubbleMine : styles.msgBubbleOther,
            ]}
          >
            {!isMine && (
              <Text style={styles.msgSenderName}>
                {msg.sender?.name || "Unknown"}
              </Text>
            )}
            <Text
              style={[
                styles.msgText,
                isMine ? styles.msgTextMine : styles.msgTextOther,
              ]}
            >
              {msg.text}
            </Text>
            <View style={styles.msgMeta}>
              <Text
                style={[
                  styles.msgTime,
                  isMine ? styles.msgTimeMine : styles.msgTimeOther,
                ]}
              >
                {formatTime(msg.createdAt)}
              </Text>
              <Text
                style={[
                  styles.msgExpiry,
                  isMine ? styles.msgTimeMine : styles.msgTimeOther,
                ]}
              >
                {" · "}
                {getExpiryLabel(msg.expiresAt)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── RENDER ───
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{roomName || "Chat"}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {roomName || "Chat"}
          </Text>
          <Text style={styles.headerSub}>
            {chatEnabled
              ? `${messages.length} message${messages.length !== 1 ? "s" : ""}`
              : "Chat disabled"}
          </Text>
        </View>
        {isHost && (
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              {
                backgroundColor: chatEnabled
                  ? colors.errorBg
                  : colors.successBg,
              },
            ]}
            onPress={toggleChat}
            disabled={togglingChat}
          >
            {togglingChat ? (
              <ActivityIndicator
                size="small"
                color={chatEnabled ? colors.error : colors.success}
              />
            ) : (
              <Ionicons
                name={
                  chatEnabled
                    ? "close-circle-outline"
                    : "chatbubble-ellipses-outline"
                }
                size={18}
                color={chatEnabled ? colors.error : colors.success}
              />
            )}
          </TouchableOpacity>
        )}
        {!isHost && <View style={{ width: 36 }} />}
      </View>

      {/* Chat not enabled state */}
      {!chatEnabled && (
        <View style={styles.centered}>
          <Ionicons
            name="chatbubbles-outline"
            size={56}
            color={colors.textTertiary}
          />
          <Text style={styles.emptyTitle}>Chat Not Available</Text>
          <Text style={styles.emptyDesc}>
            {isHost
              ? "Tap the button above to enable chat for all room members."
              : "The room host hasn't enabled chat yet."}
          </Text>
        </View>
      )}

      {/* Messages */}
      {chatEnabled && (
        <>
          {/* Info banner */}
          <View style={styles.ttlBanner}>
            <Ionicons name="time-outline" size={14} color={colors.accent} />
            <Text style={styles.ttlText}>
              Messages auto-delete after 3 days
            </Text>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons
                  name="chatbubble-outline"
                  size={40}
                  color={colors.textTertiary}
                />
                <Text style={styles.emptyDesc}>
                  No messages yet. Start the conversation!
                </Text>
              </View>
            }
          />

          {/* Input bar */}
          <View
            style={[
              styles.inputBar,
              { paddingBottom: Math.max(insets.bottom, 8) },
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor={colors.textTertiary}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim()}
              activeOpacity={0.7}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
      gap: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    headerCenter: {
      flex: 1,
      marginLeft: 12,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    headerSub: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 1,
    },
    toggleBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    ttlBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 6,
      backgroundColor: colors.accentLight || colors.accentSurface,
    },
    ttlText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.accent,
    },
    messagesList: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexGrow: 1,
    },
    dateSeparator: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 12,
      gap: 10,
    },
    dateLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    dateText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    msgRow: {
      flexDirection: "row",
      marginBottom: 6,
      maxWidth: "82%",
    },
    msgRowRight: {
      alignSelf: "flex-end",
    },
    msgRowLeft: {
      alignSelf: "flex-start",
    },
    msgAvatar: {
      marginRight: 8,
      marginTop: 4,
    },
    avatarImg: {
      width: 30,
      height: 30,
      borderRadius: 15,
    },
    avatarPlaceholder: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.accentLight || colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarLetter: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
    },
    msgBubble: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      maxWidth: "100%",
    },
    msgBubbleMine: {
      backgroundColor: colors.accent,
      borderBottomRightRadius: 4,
    },
    msgBubbleOther: {
      backgroundColor: colors.card,
      borderBottomLeftRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    msgSenderName: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.accent,
      marginBottom: 2,
    },
    msgText: {
      fontSize: 14,
      lineHeight: 20,
    },
    msgTextMine: {
      color: colors.textOnAccent || "#fff",
    },
    msgTextOther: {
      color: colors.text,
    },
    msgMeta: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 3,
    },
    msgTime: {
      fontSize: 10,
    },
    msgTimeMine: {
      color: "rgba(255,255,255,0.6)",
    },
    msgTimeOther: {
      color: colors.textTertiary,
    },
    msgExpiry: {
      fontSize: 10,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    emptyDesc: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: "center",
      lineHeight: 19,
    },
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 12,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === "ios" ? 10 : 8,
      fontSize: 14,
      color: colors.text,
      maxHeight: 100,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: Platform.OS === "ios" ? 2 : 0,
    },
    sendBtnDisabled: {
      opacity: 0.4,
    },
  });

export default ChatRoomScreen;
