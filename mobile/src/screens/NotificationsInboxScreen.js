import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { apiService } from "../services/apiService";
import { Ionicons } from "@expo/vector-icons";

const NotificationsInboxScreen = ({ navigation }) => {
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
      console.log("Mark as read response:", response);
      if (response.success) {
        // Update local state instead of refetching
        setNotifications((prevNotifications) =>
          prevNotifications.map((notif) =>
            notif._id === notificationId
              ? { ...notif, isRead: true, readAt: new Date() }
              : notif,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else {
        throw new Error(response.message || "Failed to mark as read");
      }
    } catch (error) {
      console.error("Mark as read error:", error.message);
      Alert.alert("Error", error.message || "Failed to mark as read");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const response = await apiService.patch(
        "/api/v2/notifications/read-all",
        {},
      );
      console.log("Mark all read response:", response);
      if (response.success) {
        // Update all notifications to read in local state
        setNotifications((prevNotifications) =>
          prevNotifications.map((notif) => ({
            ...notif,
            isRead: true,
            readAt: new Date(),
          })),
        );
        setUnreadCount(0);
        Alert.alert("Success", "All notifications marked as read");
      } else {
        throw new Error(response.message || "Failed to mark all as read");
      }
    } catch (error) {
      console.error("Mark all read error:", error.message);
      Alert.alert("Error", error.message || "Failed to mark all as read");
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await apiService.delete(`/api/v2/notifications/${notificationId}`);
      fetchNotifications();
    } catch (error) {
      Alert.alert("Error", "Failed to delete notification");
    }
  };

  const renderNotification = ({ item }) => {
    const isUnread = !item.isRead;
    const notificationTime = new Date(item.sentAt);
    const timeString = notificationTime.toLocaleDateString();

    // Truncate message to two lines (approximately 80 characters)
    const truncatedMessage =
      item.message.length > 80
        ? item.message.substring(0, 80) + "..."
        : item.message;

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          isUnread ? styles.unreadCard : styles.readCard,
        ]}
        onPress={() => {
          setSelectedNotification(item);
          if (isUnread) {
            handleMarkAsRead(item._id);
          }
        }}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text
              style={[styles.notificationTitle, isUnread && styles.unreadText]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationMessage} numberOfLines={1}>
            {truncatedMessage}
          </Text>
          <Text style={styles.notificationTime}>{timeString}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            Alert.alert("Delete", "Delete this notification?", [
              { text: "Cancel", onPress: () => {} },
              {
                text: "Delete",
                onPress: () => handleDelete(item._id),
                style: "destructive",
              },
            ]);
          }}
        >
          <Ionicons name="trash" size={20} color="#ff4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading && notifications.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#b38604" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {unreadCount > 0 && (
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={handleMarkAllRead}
        >
          <Ionicons name="checkmark-done" size={18} color="#fff" />
          <Text style={styles.markAllText}>Mark All as Read</Text>
        </TouchableOpacity>
      )}

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Full Message Modal */}
      {selectedNotification && (
        <Modal
          visible={!!selectedNotification}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setSelectedNotification(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedNotification.title}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedNotification(null)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.modalMessage}>
                  {selectedNotification.message}
                </Text>
                <Text style={styles.modalTime}>
                  {new Date(selectedNotification.sentAt).toLocaleString()}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedNotification(null)}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  badge: {
    backgroundColor: "#ff4444",
    borderRadius: 10,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  badgeText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#4CAF50",
    borderRadius: 8,
  },
  markAllText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 8,
  },
  listContent: {
    padding: 12,
  },
  notificationCard: {
    flexDirection: "row",
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  unreadCard: {
    backgroundColor: "#f0f8ff",
    borderLeftColor: "#b38604",
  },
  readCard: {
    backgroundColor: "#fff",
    borderLeftColor: "#ddd",
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  unreadText: {
    color: "#b38604",
    fontWeight: "bold",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#b38604",
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 13,
    color: "#666",
    marginBottom: 6,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 11,
    color: "#999",
  },
  deleteButton: {
    padding: 8,
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: "#999",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    marginRight: 10,
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalMessage: {
    fontSize: 15,
    color: "#333",
    lineHeight: 24,
    marginBottom: 12,
  },
  modalTime: {
    fontSize: 12,
    color: "#999",
  },
  modalCloseButton: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#b38604",
    borderRadius: 8,
    alignItems: "center",
  },
  modalCloseButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
});

export default NotificationsInboxScreen;
