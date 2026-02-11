import React, { useState, useEffect, useCallback, useMemo} from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { apiService } from "../services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const NotificationsInboxScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get("/api/v2/notifications/all");
      setNotifications(response.notifications || []);
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      Alert.alert("Error", "Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      const response = await apiService.patch(
        `/api/v2/notifications/${notificationId}/read`,
        {},
      );
      if (response.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            (n.id || n._id) === notificationId
              ? { ...n, isRead: true, readAt: new Date() }
              : n,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else {
        throw new Error(response.message || "Failed to mark as read");
      }
    } catch (error) {
      console.error("Mark as read error:", error.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const response = await apiService.patch(
        "/api/v2/notifications/read-all",
        {},
      );
      if (response.success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date() })),
        );
        setUnreadCount(0);
      } else {
        throw new Error(response.message || "Failed to mark all as read");
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to mark all as read");
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await apiService.delete(`/api/v2/notifications/${notificationId}`);
      setNotifications((prev) =>
        prev.filter((n) => (n.id || n._id) !== notificationId),
      );
    } catch (error) {
      Alert.alert("Error", "Failed to delete notification");
    }
  };

  /* ─── Helpers ─── */
  const getNotifIcon = (title) => {
    const t = (title || "").toLowerCase();
    if (t.includes("payment") || t.includes("paid")) return "card-outline";
    if (t.includes("bill") || t.includes("billing")) return "receipt-outline";
    if (t.includes("room") || t.includes("join")) return "home-outline";
    if (t.includes("water")) return "water-outline";
    if (t.includes("electric")) return "flash-outline";
    if (t.includes("announce")) return "megaphone-outline";
    if (t.includes("approve") || t.includes("accept"))
      return "checkmark-circle-outline";
    if (t.includes("reject") || t.includes("denied"))
      return "close-circle-outline";
    return "notifications-outline";
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const now = new Date();
    const d = new Date(dateStr);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  };

  /* ─── Loading ─── */
  if (loading && notifications.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ width: 36 }} />
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      </View>
    );
  }

  /* ─── Render Notification ─── */
  const renderNotification = ({ item }) => {
    const isUnread = !item.isRead;

    return (
      <TouchableOpacity
        style={[styles.card, isUnread && styles.cardUnread]}
        activeOpacity={0.7}
        onPress={() => {
          setSelectedNotification(item);
          if (isUnread) handleMarkAsRead(item.id || item._id);
        }}
      >
        {/* Icon */}
        <View
          style={[
            styles.iconWrap,
            isUnread ? styles.iconUnread : styles.iconRead,
          ]}
        >
          <Ionicons
            name={getNotifIcon(item.title)}
            size={18}
            color={isUnread ? "#b38604" : "#94a3b8"}
          />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.cardMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.cardTime}>{formatTimeAgo(item.sentAt)}</Text>
        </View>

        {/* Delete */}
        <TouchableOpacity
          style={styles.deleteBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() =>
            Alert.alert("Delete", "Delete this notification?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                onPress: () => handleDelete(item.id || item._id),
                style: "destructive",
              },
            ])
          }
        >
          <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  /* ─── Main ─── */
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: 36 }} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Mark All Read */}
      {unreadCount > 0 && (
        <TouchableOpacity
          style={styles.markAllBtn}
          onPress={handleMarkAllRead}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-done-outline" size={15} color={colors.accent} />
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      )}

      {/* Empty */}
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptyText}>
            You're all caught up. New notifications will appear here.
          </Text>
          <TouchableOpacity style={styles.emptyRefresh} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={16} color={colors.accent} />
            <Text style={styles.emptyRefreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id || item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#b38604"]}
              tintcolor={colors.accent}
            />
          }
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!selectedNotification}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedNotification(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedNotification(null)}
        >
          <View
            style={styles.modalSheet}
            onStartShouldSetResponder={() => true}
          >
            {/* Drag handle */}
            <View style={styles.dragHandle} />

            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons
                  name={getNotifIcon(selectedNotification?.title)}
                  size={20}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {selectedNotification?.title}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedNotification(null)}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Modal body */}
            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalMessage}>
                {selectedNotification?.message}
              </Text>
              <View style={styles.modalTimeRow}>
                <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.modalTime}>
                  {selectedNotification?.sentAt
                    ? new Date(selectedNotification.sentAt).toLocaleString(
                        "en-PH",
                        {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : ""}
                </Text>
              </View>
            </ScrollView>

            {/* Close button */}
            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setSelectedNotification(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

/* ═══════════════════════ STYLES ═══════════════════════ */
const createStyles = (colors) => StyleSheet.create({
  /* Layout */
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textTertiary,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  badge: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
  },

  /* Mark All */
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 14,
    marginTop: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#b38604",
    gap: 6,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
  },

  /* Empty */
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.inputBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyRefresh: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#b38604",
    gap: 6,
  },
  emptyRefreshText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
  },

  /* List */
  listContent: {
    padding: 14,
    paddingBottom: 24,
  },

  /* Card */
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardUnread: {
    backgroundColor: colors.warningBg,
    borderLeftWidth: 3,
    borderLeftColor: "#b38604",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginTop: 2,
  },
  iconUnread: {
    backgroundColor: colors.warningBg,
  },
  iconRead: {
    backgroundColor: colors.background,
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  cardTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  cardTitleUnread: {
    fontWeight: "700",
    color: colors.text,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: 6,
  },
  cardMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 4,
  },
  cardTime: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: "500",
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 4,
    marginTop: 2,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "75%",
    paddingBottom: 28,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.skeleton,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  modalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.warningBg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  modalBody: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 14,
  },
  modalTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
  },
  modalTime: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  modalDoneBtn: {
    marginHorizontal: 18,
    marginTop: 8,
    paddingVertical: 13,
    backgroundColor: colors.accent,
    borderRadius: 12,
    alignItems: "center",
  },
  modalDoneText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});

export default NotificationsInboxScreen;
