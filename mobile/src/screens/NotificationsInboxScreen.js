import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiService } from "../services/apiService";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import ModalBottomSpacer from "../components/ModalBottomSpacer";
import AnnouncementsScreen from "./client/AnnouncementsScreen";
import HomeSpaceLoader from "../components/SpaceLoader";

const NotificationsInboxScreen = ({ navigation, route, onBadgeRefresh }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const initialView =
    route?.params?.view === "alerts" ? "alerts" : "announcements";

  const [activeView, setActiveView] = useState(initialView);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState(null);

  useEffect(() => {
    if (route?.params?.view === "alerts") {
      setActiveView("alerts");
    } else if (route?.params?.view === "announcements") {
      setActiveView("announcements");
    }
  }, [route?.params?.view]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get("/api/v2/notifications/all");
      const notifs = response.notifications || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.isRead).length);
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
        // Notify navigator to refresh tab badge
        onBadgeRefresh?.();
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
        // Notify navigator to refresh tab badge
        onBadgeRefresh?.();
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
  const getNotifMeta = (item) => {
    const type = item.type || "";
    const t = (item.title || "").toLowerCase();
    if (type === "payment_verified")
      return { icon: "checkmark-circle", color: "#2e7d32" };
    if (type === "payment_rejected")
      return { icon: "close-circle", color: "#c62828" };
    if (type === "water_payor_selected")
      return { icon: "water-outline", color: "#00847B" };
    if (
      t.includes("verified") ||
      t.includes("approved") ||
      t.includes("accept")
    )
      return { icon: "checkmark-circle-outline", color: "#2e7d32" };
    if (t.includes("rejected") || t.includes("denied"))
      return { icon: "close-circle-outline", color: "#c62828" };
    if (t.includes("payment") || t.includes("paid"))
      return { icon: "card-outline", color: null };
    if (t.includes("bill") || t.includes("billing"))
      return { icon: "receipt-outline", color: null };
    if (t.includes("room") || t.includes("join"))
      return { icon: "home-outline", color: null };
    if (t.includes("water")) return { icon: "water-outline", color: null };
    if (t.includes("electric")) return { icon: "flash-outline", color: null };
    if (t.includes("announce"))
      return { icon: "megaphone-outline", color: null };
    return { icon: "notifications-outline", color: null };
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

  const renderHeader = () => (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        <View style={{ width: 36 }} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Inbox</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.segmentedWrap}>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            activeView === "announcements" && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveView("announcements")}
          activeOpacity={0.75}
        >
          <Ionicons
            name={
              activeView === "announcements" ? "megaphone" : "megaphone-outline"
            }
            size={15}
            color={
              activeView === "announcements"
                ? colors.textOnAccent
                : colors.accent
            }
          />
          <Text
            style={[
              styles.segmentText,
              activeView === "announcements" && styles.segmentTextActive,
            ]}
          >
            Announcements
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentButton,
            activeView === "alerts" && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveView("alerts")}
          activeOpacity={0.75}
        >
          <Ionicons
            name={
              activeView === "alerts"
                ? "notifications"
                : "notifications-outline"
            }
            size={15}
            color={
              activeView === "alerts" ? colors.textOnAccent : colors.accent
            }
          />
          <Text
            style={[
              styles.segmentText,
              activeView === "alerts" && styles.segmentTextActive,
            ]}
          >
            Alerts
          </Text>
          {unreadCount > 0 && (
            <View
              style={[
                styles.segmentBadge,
                activeView === "alerts" && styles.segmentBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentBadgeText,
                  activeView === "alerts" && styles.segmentBadgeTextActive,
                ]}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (activeView === "announcements") {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.embeddedContent}>
          <AnnouncementsScreen navigation={navigation} />
        </View>
      </View>
    );
  }

  /* ─── Loading ─── */
  if (loading && notifications.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.centerContent}>
          <View style={styles.centerLoader}>
            <HomeSpaceLoader />
          </View>
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
            name={getNotifMeta(item).icon}
            size={18}
            color={
              getNotifMeta(item).color ||
              (isUnread ? colors.accent : colors.textTertiary)
            }
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
          <Ionicons
            name="trash-outline"
            size={16}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  /* ─── Main ─── */
  return (
    <View style={styles.container}>
      {/* Header */}
      {renderHeader()}

      {/* Mark All Read */}
      {unreadCount > 0 && (
        <TouchableOpacity
          style={styles.markAllBtn}
          onPress={handleMarkAllRead}
          activeOpacity={0.7}
        >
          <Ionicons
            name="checkmark-done-outline"
            size={15}
            color={colors.accent}
          />
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      )}

      {/* Empty */}
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="notifications-off-outline"
              size={48}
              color={colors.textSecondary}
            />
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
              colors={[colors.accent]}
              tintColor={colors.accent}
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
                  name={getNotifMeta(selectedNotification || {}).icon}
                  size={20}
                  color={
                    getNotifMeta(selectedNotification || {}).color ||
                    colors.accent
                  }
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
                <Ionicons
                  name="time-outline"
                  size={13}
                  color={colors.textSecondary}
                />
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
              <ModalBottomSpacer />
            </ScrollView>

            {/* Close button */}
            <TouchableOpacity
              style={[
                styles.modalDoneBtn,
                { marginBottom: Math.max(insets.bottom, 8) + 10 },
              ]}
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
const createStyles = (colors) =>
  StyleSheet.create({
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
    embeddedContent: {
      flex: 1,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 13,
      color: colors.textTertiary,
    },

    /* Header */
    headerWrap: {
      backgroundColor: colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
      shadowColor: colors.shadow || "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
      zIndex: 2,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 14,
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
    segmentedWrap: {
      flexDirection: "row",
      marginHorizontal: 14,
      marginBottom: 12,
      padding: 4,
      borderRadius: 16,
      backgroundColor: colors.accentLight || colors.inputBg,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      gap: 4,
    },
    segmentButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    segmentButtonActive: {
      backgroundColor: colors.accent,
      shadowColor: colors.shadow || colors.accent,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 2,
    },
    segmentText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.accent,
    },
    segmentTextActive: {
      color: colors.textOnAccent,
    },
    segmentBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    segmentBadgeActive: {
      backgroundColor: colors.card,
    },
    segmentBadgeText: {
      fontSize: 9,
      fontWeight: "800",
      color: colors.textOnAccent,
    },
    segmentBadgeTextActive: {
      color: colors.accent,
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
      borderColor: colors.accent,
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
      borderColor: colors.accent,
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
      backgroundColor: colors.accentLight || colors.warningBg,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
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
      backgroundColor: colors.accentSurface,
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
      paddingBottom: 8,
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
      backgroundColor: colors.accentSurface,
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
      marginBottom: 18,
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
