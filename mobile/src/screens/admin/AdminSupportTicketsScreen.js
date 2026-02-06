import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { supportService } from "../../services/apiService";

const AdminSupportTicketsScreen = ({ navigation }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchAllTickets();

    // Refresh tickets when screen comes into focus
    const unsubscribe = navigation.addListener("focus", () => {
      fetchAllTickets();
    });

    return unsubscribe;
  }, [navigation]);

  const fetchAllTickets = async () => {
    setLoading(true);
    try {
      const response = await supportService.getAllTickets();
      setTickets(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      Alert.alert("Error", "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  const handleTicketPress = async (ticketId) => {
    try {
      const details = await supportService.getTicketDetails(ticketId);
      setSelectedTicket(details?.data || details);
      setNewStatus(details?.data?.status || details?.status);
      setModalVisible(true);

      // Mark ticket as read by admin
      try {
        await supportService.markTicketAsRead(ticketId);
        // Update the ticket in the local list
        setTickets(
          tickets.map((t) =>
            t._id === ticketId ? { ...t, isReadByAdmin: true } : t,
          ),
        );
      } catch (error) {
        console.error("Error marking ticket as read:", error);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load ticket details");
    }
  };

  const handleAddReply = async () => {
    if (!replyText.trim()) {
      Alert.alert("Validation", "Please enter a reply message");
      return;
    }

    setSubmitting(true);
    try {
      await supportService.addTicketReply(selectedTicket._id, replyText);

      // Update local state
      const updatedTicket = {
        ...selectedTicket,
        replies: [
          ...(selectedTicket.replies || []),
          {
            from: "admin",
            message: replyText,
            createdAt: new Date(),
          },
        ],
        isReadByAdmin: false, // Reset read flag so indicator appears for user
      };
      setSelectedTicket(updatedTicket);
      setReplyText("");
      Alert.alert("Success", "Reply added successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to add reply");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setSubmitting(true);
    try {
      await supportService.updateTicketStatus(selectedTicket._id, newStatus);
      const updatedTicket = { ...selectedTicket, status: newStatus };
      setSelectedTicket(updatedTicket);
      setNewStatus(newStatus);
      Alert.alert("Success", "Ticket status updated");
    } catch (error) {
      Alert.alert("Error", "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "open":
        return "#e74c3c";
      case "in-progress":
        return "#f39c12";
      case "resolved":
        return "#27ae60";
      case "closed":
        return "#95a5a6";
      default:
        return "#95a5a6";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "#e74c3c";
      case "medium":
        return "#f39c12";
      case "low":
        return "#27ae60";
      default:
        return "#95a5a6";
    }
  };

  const filteredTickets =
    statusFilter === "all"
      ? tickets
      : tickets.filter((t) => t.status === statusFilter);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0a66c2" />
        <Text style={styles.loadingText}>Loading tickets...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Support Tickets</Text>
          <Text style={styles.headerSubtitle}>Manage customer issues</Text>
        </View>
        <View style={styles.ticketCountBadge}>
          <MaterialIcons name="mail" size={18} color="#fff" />
          <Text style={styles.ticketCount}>{filteredTickets.length}</Text>
        </View>
      </View>

      {/* Status Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        <TouchableOpacity
          style={[
            styles.filterTab,
            statusFilter === "all" && styles.filterTabActive,
          ]}
          onPress={() => setStatusFilter("all")}
        >
          <MaterialIcons
            name={statusFilter === "all" ? "list" : "list"}
            size={16}
            color={statusFilter === "all" ? "#fff" : "#666"}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.filterTabText,
              statusFilter === "all" && styles.filterTabTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {["open", "in-progress", "resolved", "closed"].map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterTab,
              statusFilter === status && styles.filterTabActive,
            ]}
            onPress={() => setStatusFilter(status)}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(status) },
              ]}
            />
            <Text
              style={[
                styles.filterTabText,
                statusFilter === status && styles.filterTabTextActive,
              ]}
            >
              {status === "open"
                ? "🔴 Open"
                : status === "in-progress"
                  ? "🟠 In Progress"
                  : status === "resolved"
                    ? "✅ Resolved"
                    : "⏹️ Closed"}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tickets List */}
      <FlatList
        data={filteredTickets}
        keyExtractor={(item) => item._id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.ticketCard}
            onPress={() => handleTicketPress(item._id)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.cardLeftBorder,
                { borderLeftColor: getStatusColor(item.status) },
              ]}
            />
            <View style={styles.ticketCardContent}>
              <View style={styles.ticketHeader}>
                <View style={styles.ticketTitleSection}>
                  <Text style={styles.ticketSubject} numberOfLines={2}>
                    {item.subject}
                  </Text>
                  <Text style={styles.ticketUser}>
                    <MaterialIcons name="person" size={12} color="#666" />{" "}
                    {item.userName}
                  </Text>
                </View>
                <View style={styles.ticketBadgesGroup}>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: getStatusColor(item.status) + "15" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: getStatusColor(item.status) },
                      ]}
                    >
                      {item.status === "open"
                        ? "🔴"
                        : item.status === "in-progress"
                          ? "🟠"
                          : item.status === "resolved"
                            ? "✅"
                            : "⏹️"}{" "}
                      {item.status.charAt(0).toUpperCase() +
                        item.status.slice(1)}
                    </Text>
                  </View>
                  {!item.isReadByAdmin &&
                    item.replies &&
                    item.replies.length > 0 && (
                      <View style={styles.unreadDotIndicator} />
                    )}
                </View>
              </View>

              <View style={styles.ticketMeta}>
                <View style={styles.metaItem}>
                  <MaterialIcons name="label" size={12} color="#999" />
                  <Text style={styles.metaText}>{item.category}</Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialIcons
                    name="flag"
                    size={12}
                    color={getPriorityColor(item.priority)}
                  />
                  <Text
                    style={[
                      styles.metaText,
                      { color: getPriorityColor(item.priority) },
                    ]}
                  >
                    {item.priority.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialIcons name="chat" size={12} color="#0a66c2" />
                  <Text style={styles.metaText}>
                    {(item.replies || []).length}
                  </Text>
                </View>
              </View>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color="#ccc"
              style={styles.cardChevron}
            />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inbox" size={48} color="#ddd" />
            <Text style={styles.emptyText}>No tickets found</Text>
            <Text style={styles.emptySubtext}>All tickets are handled!</Text>
          </View>
        }
      />

      {/* Ticket Details Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Ticket Details</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedTicket?.subject}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedTicket && (
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
              >
                {/* Quick Info Cards */}
                <View style={styles.infoCardsGrid}>
                  <View style={styles.infoCard}>
                    <MaterialIcons name="person" size={20} color="#0a66c2" />
                    <Text style={styles.infoCardLabel}>Customer</Text>
                    <Text style={styles.infoCardValue} numberOfLines={1}>
                      {selectedTicket.userName}
                    </Text>
                  </View>

                  <View style={styles.infoCard}>
                    <MaterialIcons name="email" size={20} color="#27ae60" />
                    <Text style={styles.infoCardLabel}>Email</Text>
                    <Text style={styles.infoCardValue} numberOfLines={1}>
                      {selectedTicket.userEmail}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoCardsGrid}>
                  <View style={styles.infoCard}>
                    <MaterialIcons name="label" size={20} color="#f39c12" />
                    <Text style={styles.infoCardLabel}>Category</Text>
                    <Text style={styles.infoCardValue}>
                      {selectedTicket.category.charAt(0).toUpperCase() +
                        selectedTicket.category.slice(1)}
                    </Text>
                  </View>

                  <View style={styles.infoCard}>
                    <MaterialIcons
                      name="flag"
                      size={20}
                      color={getPriorityColor(selectedTicket.priority)}
                    />
                    <Text style={styles.infoCardLabel}>Priority</Text>
                    <Text
                      style={[
                        styles.infoCardValue,
                        { color: getPriorityColor(selectedTicket.priority) },
                      ]}
                    >
                      {selectedTicket.priority.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Ticket Message */}
                <View style={styles.messageSection}>
                  <Text style={styles.sectionHeader}>
                    <MaterialIcons
                      name="description"
                      size={18}
                      color="#0a66c2"
                    />{" "}
                    Ticket Message
                  </Text>
                  <View style={styles.messageBox}>
                    <Text style={styles.messageText}>
                      {selectedTicket.message}
                    </Text>
                  </View>
                </View>

                {/* Status Update Section */}
                <View style={styles.messageSection}>
                  <Text style={styles.sectionHeader}>
                    <MaterialIcons name="info" size={18} color="#0a66c2" />{" "}
                    Update Status
                  </Text>
                  <View style={styles.statusPicker}>
                    {["open", "in-progress", "resolved", "closed"].map(
                      (status) => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusButton,
                            newStatus === status && styles.statusButtonActive,
                          ]}
                          onPress={() => handleStatusChange(status)}
                        >
                          <Text style={[styles.statusButtonIcon]}>
                            {status === "open"
                              ? "🔴"
                              : status === "in-progress"
                                ? "🟠"
                                : status === "resolved"
                                  ? "✅"
                                  : "⏹️"}
                          </Text>
                          <Text
                            style={[
                              styles.statusButtonText,
                              newStatus === status &&
                                styles.statusButtonTextActive,
                            ]}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ),
                    )}
                  </View>
                </View>

                {/* Conversation/Replies Section */}
                <View style={styles.messageSection}>
                  <Text style={styles.sectionHeader}>
                    <MaterialIcons name="chat" size={18} color="#0a66c2" />{" "}
                    Conversation ({selectedTicket.replies?.length || 0})
                  </Text>

                  {selectedTicket.replies &&
                  selectedTicket.replies.length > 0 ? (
                    <View style={styles.messagesContainer}>
                      {selectedTicket.replies.map((reply, index) => (
                        <View
                          key={index}
                          style={[
                            styles.messageBubbleWrapper,
                            reply.from === "admin"
                              ? styles.adminBubbleWrapper
                              : styles.customerBubbleWrapper,
                          ]}
                        >
                          <View
                            style={[
                              styles.messageBubble,
                              reply.from === "admin"
                                ? styles.adminBubble
                                : styles.customerBubble,
                            ]}
                          >
                            <View style={styles.messageHeader}>
                              <Text
                                style={[
                                  styles.messageSender,
                                  reply.from === "admin"
                                    ? styles.adminSender
                                    : styles.customerSender,
                                ]}
                              >
                                {reply.from === "admin"
                                  ? "🔧 You (Admin)"
                                  : "👤 Customer"}
                              </Text>
                              <Text style={styles.messageTimestamp}>
                                {new Date(reply.createdAt).toLocaleString()}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.messageTextContent,
                                reply.from === "admin"
                                  ? styles.adminMessageText
                                  : styles.customerMessageText,
                              ]}
                            >
                              {reply.message}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.noRepliesContainer}>
                      <MaterialIcons name="mail" size={32} color="#ddd" />
                      <Text style={styles.noReplies}>
                        No replies yet. Add one below to engage with the
                        customer!
                      </Text>
                    </View>
                  )}
                </View>

                {/* Add Reply Section */}
                <View style={styles.messageSection}>
                  <Text style={styles.sectionHeader}>
                    <MaterialIcons name="reply" size={18} color="#0a66c2" /> Add
                    Admin Reply
                  </Text>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Type your reply here... Be helpful and professional!"
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={4}
                    value={replyText}
                    onChangeText={setReplyText}
                    editable={!submitting}
                  />
                  <TouchableOpacity
                    style={[
                      styles.replyButton,
                      submitting && styles.buttonDisabled,
                    ]}
                    onPress={handleAddReply}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.replyButtonText}>Sending...</Text>
                      </>
                    ) : (
                      <>
                        <MaterialIcons name="send" size={18} color="#fff" />
                        <Text style={styles.replyButtonText}>Send Reply</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#0a66c2",
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#e3f2fd",
    marginTop: 4,
  },
  ticketCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  ticketCount: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f5f5f5",
  },
  filterTabActive: {
    backgroundColor: "#0a66c2",
    borderColor: "#0a66c2",
  },
  filterTabText: {
    fontSize: 12,
    color: "#555",
    fontWeight: "600",
  },
  filterTabTextActive: {
    color: "#fff",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  ticketCard: {
    margin: 16,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardLeftBorder: {
    width: 4,
    height: "100%",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  ticketCardContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  ticketTitleSection: {
    flex: 1,
    marginRight: 12,
  },
  ticketSubject: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a202c",
    marginBottom: 4,
  },
  ticketUser: {
    fontSize: 12,
    color: "#666",
  },
  ticketBadgesGroup: {
    flexDirection: "row",
    gap: 8,
    position: "relative",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  unreadDotIndicator: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e74c3c",
    borderWidth: 2,
    borderColor: "#fff",
  },
  ticketMeta: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },
  cardChevron: {
    marginRight: 8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#bbb",
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a202c",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
    fontWeight: "500",
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoCardsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  infoCardLabel: {
    fontSize: 11,
    color: "#666",
    fontWeight: "600",
    marginTop: 8,
  },
  infoCardValue: {
    fontSize: 12,
    color: "#1a202c",
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  messageSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a202c",
    marginBottom: 12,
  },
  messageBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#0a66c2",
  },
  messageText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 20,
  },
  statusPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statusButton: {
    flex: 0.48,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  statusButtonActive: {
    backgroundColor: "#0a66c2",
    borderColor: "#0a66c2",
  },
  statusButtonIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },
  statusButtonTextActive: {
    color: "#fff",
  },
  conversationList: {
    marginBottom: 16,
  },
  conversationList: {
    marginVertical: 8,
  },
  replyContainer: {
    marginBottom: 12,
  },
  messagesContainer: {
    marginVertical: 12,
    paddingVertical: 8,
  },
  messageBubbleWrapper: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  adminBubbleWrapper: {
    alignItems: "flex-end",
  },
  customerBubbleWrapper: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  adminBubble: {
    backgroundColor: "#0a66c2",
    borderBottomRightRadius: 4,
  },
  customerBubble: {
    backgroundColor: "#f0f0f0",
    borderBottomLeftRadius: 4,
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: "700",
  },
  adminSender: {
    color: "#fff",
  },
  customerSender: {
    color: "#333",
  },
  messageTimestamp: {
    fontSize: 11,
    color: "#999",
  },
  messageTextContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  adminMessageText: {
    color: "#fff",
  },
  customerMessageText: {
    color: "#333",
  },
  replyBubble: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  replyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  replyFrom: {
    fontSize: 12,
    fontWeight: "700",
  },
  replyTime: {
    fontSize: 10,
    color: "#999",
  },
  replyText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 20,
  },
  noRepliesContainer: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  noReplies: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
  },
  replyInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: "#333",
    textAlignVertical: "top",
    marginBottom: 12,
  },
  replyButton: {
    flexDirection: "row",
    backgroundColor: "#0a66c2",
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  replyButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default AdminSupportTicketsScreen;
