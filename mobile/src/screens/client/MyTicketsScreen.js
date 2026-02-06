import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { supportService } from "../../services/apiService";

const MyTicketsScreen = ({ navigation }) => {
  const { state } = useContext(AuthContext);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [newReply, setNewReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");

  useEffect(() => {
    fetchTickets();

    // Refresh tickets when screen comes into focus
    const unsubscribe = navigation.addListener("focus", () => {
      fetchTickets();
    });

    return unsubscribe;
  }, [navigation]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await supportService.getUserTickets();
      setTickets(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      Alert.alert("Error", "Failed to load your support tickets");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchTickets().then(() => setRefreshing(false));
  }, []);

  const handleViewDetails = async (ticket) => {
    try {
      const response = await supportService.getTicketDetails(ticket._id);
      setSelectedTicket(response?.data || response);
      setDetailsVisible(true);

      // Mark ticket as read
      try {
        await supportService.markTicketAsRead(ticket._id);
        // Update the ticket in the local list
        setTickets(
          tickets.map((t) =>
            t._id === ticket._id ? { ...t, isReadByUser: true } : t,
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
    if (!newReply.trim()) {
      Alert.alert("Validation", "Please enter your message");
      return;
    }

    setSubmitting(true);
    try {
      await supportService.addTicketReply(selectedTicket._id, newReply);
      Alert.alert("Success", "Reply added successfully");
      setNewReply("");
      // Refresh ticket details
      const response = await supportService.getTicketDetails(
        selectedTicket._id,
      );
      setSelectedTicket(response?.data || response);
      // Reset read flag so indicator appears for admin
      setTickets(
        tickets.map((t) =>
          t._id === selectedTicket._id ? { ...t, isReadByAdmin: false } : t,
        ),
      );
    } catch (error) {
      Alert.alert("Error", "Failed to add reply");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "open":
        return "#ff6b6b";
      case "in-progress":
        return "#ffd93d";
      case "resolved":
        return "#27ae60";
      case "closed":
        return "#95a5a6";
      default:
        return "#3498db";
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
        return "#3498db";
    }
  };

  const getFilteredTickets = () => {
    if (selectedFilter === "all") {
      return tickets;
    }
    return tickets.filter((ticket) => ticket.status === selectedFilter);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "open":
        return "🔴";
      case "in-progress":
        return "🟠";
      case "resolved":
        return "✅";
      case "closed":
        return "⏹️";
      default:
        return "•";
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0a66c2" />
        <Text style={styles.loadingText}>Loading your tickets...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Support Tickets</Text>
          <Text style={styles.headerSubtitle}>Track your requests</Text>
        </View>
        <View style={styles.ticketCountBadge}>
          <Text style={styles.ticketCountText}>{tickets.length}</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {["all", "open", "in-progress", "resolved", "closed"].map((filter) => {
          const isSelected = selectedFilter === filter;
          const count =
            filter === "all"
              ? tickets.length
              : tickets.filter((t) => t.status === filter).length;
          const statusEmoji = filter === "all" ? "📋" : getStatusIcon(filter);

          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterTab, isSelected && styles.filterTabActive]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  isSelected && styles.filterTabTextActive,
                ]}
              >
                {statusEmoji}{" "}
                {filter.charAt(0).toUpperCase() +
                  filter.slice(1).replace("-", " ")}
              </Text>
              <View
                style={[
                  styles.filterTabBadge,
                  isSelected && styles.filterTabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterTabBadgeText,
                    isSelected && styles.filterTabBadgeTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tickets.length === 0 ? (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="inbox-multiple-outline"
              size={56}
              color="#ddd"
            />
            <Text style={styles.emptyText}>No support tickets yet</Text>
            <Text style={styles.emptySubtext}>
              Your support requests will appear here
            </Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={getFilteredTickets()}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.ticketCard}
              onPress={() => handleViewDetails(item)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.cardLeftBorder,
                  { borderLeftColor: getStatusColor(item.status) },
                ]}
              />
              <View style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleSection}>
                    <Text style={styles.ticketSubject} numberOfLines={2}>
                      {item.subject}
                    </Text>
                    <Text style={styles.ticketMeta}>
                      <MaterialCommunityIcons
                        name="tag"
                        size={12}
                        color="#999"
                      />{" "}
                      {item.category}
                    </Text>
                  </View>
                  <View style={styles.badgeContainer}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>
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
                    {!item.isReadByUser &&
                      item.replies &&
                      item.replies.length > 0 && (
                        <View style={styles.unreadDotIndicator} />
                      )}
                  </View>
                </View>

                <Text style={styles.messagePreview} numberOfLines={2}>
                  {item.message}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.footerItem}>
                    <MaterialCommunityIcons
                      name="flag"
                      size={12}
                      color={getPriorityColor(item.priority)}
                    />
                    <Text
                      style={[
                        styles.footerText,
                        { color: getPriorityColor(item.priority) },
                      ]}
                    >
                      {item.priority.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.footerItem}>
                    <MaterialCommunityIcons
                      name="message-reply-text-outline"
                      size={12}
                      color="#0a66c2"
                    />
                    <Text style={styles.footerText}>
                      {item.replies?.length || 0} replies
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={18}
                    color="#ccc"
                  />
                </View>
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Ticket Details Modal */}
      <Modal visible={detailsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Ticket Details</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {selectedTicket?.subject}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDetailsVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedTicket && (
              <ScrollView
                style={styles.detailsContainer}
                showsVerticalScrollIndicator={false}
              >
                {/* Quick Info Cards */}
                <View style={styles.infoCardsGrid}>
                  <View style={styles.infoCard}>
                    <MaterialCommunityIcons
                      name="checkbox-marked-circle"
                      size={20}
                      color={getStatusColor(selectedTicket.status)}
                    />
                    <Text style={styles.infoCardLabel}>Status</Text>
                    <Text
                      style={[
                        styles.infoCardValue,
                        { color: getStatusColor(selectedTicket.status) },
                      ]}
                    >
                      {selectedTicket.status.charAt(0).toUpperCase() +
                        selectedTicket.status.slice(1)}
                    </Text>
                  </View>

                  <View style={styles.infoCard}>
                    <MaterialCommunityIcons
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

                <View style={styles.infoCardsGrid}>
                  <View style={styles.infoCard}>
                    <MaterialCommunityIcons
                      name="tag-multiple"
                      size={20}
                      color="#f39c12"
                    />
                    <Text style={styles.infoCardLabel}>Category</Text>
                    <Text style={styles.infoCardValue}>
                      {selectedTicket.category}
                    </Text>
                  </View>

                  <View style={styles.infoCard}>
                    <MaterialCommunityIcons
                      name="message-reply-text-outline"
                      size={20}
                      color="#0a66c2"
                    />
                    <Text style={styles.infoCardLabel}>Replies</Text>
                    <Text style={styles.infoCardValue}>
                      {selectedTicket.replies?.length || 0}
                    </Text>
                  </View>
                </View>

                {/* Ticket Message */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    <MaterialCommunityIcons
                      name="message-text-outline"
                      size={16}
                      color="#0a66c2"
                    />{" "}
                    Your Message
                  </Text>
                  <View style={styles.messageContent}>
                    <Text style={styles.messageText}>
                      {selectedTicket.message}
                    </Text>
                  </View>
                </View>

                {/* Conversation Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    <MaterialCommunityIcons
                      name="chat-outline"
                      size={16}
                      color="#0a66c2"
                    />{" "}
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
                            reply.from === "user"
                              ? styles.userBubbleWrapper
                              : styles.adminBubbleWrapper,
                          ]}
                        >
                          <View
                            style={[
                              styles.messageBubble,
                              reply.from === "user"
                                ? styles.userBubble
                                : styles.adminBubble,
                            ]}
                          >
                            <View style={styles.messageHeader}>
                              <Text
                                style={[
                                  styles.messageSender,
                                  reply.from === "user"
                                    ? styles.userSender
                                    : styles.adminSender,
                                ]}
                              >
                                {reply.from === "user"
                                  ? "👤 You"
                                  : "🔧 Support Team"}
                              </Text>
                              <Text style={styles.messageTimestamp}>
                                {new Date(reply.createdAt).toLocaleString()}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.messageTextContent,
                                reply.from === "user"
                                  ? styles.userMessageText
                                  : styles.adminMessageText,
                              ]}
                            >
                              {reply.message}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noReplies}>
                      No replies yet. We'll get back to you soon!
                    </Text>
                  )}
                </View>

                {/* Add Reply Section */}
                {selectedTicket.status !== "closed" && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Add Your Reply</Text>
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Type your message here..."
                      multiline
                      numberOfLines={4}
                      value={newReply}
                      onChangeText={setNewReply}
                      editable={!submitting}
                    />
                    <TouchableOpacity
                      style={[
                        styles.submitButton,
                        submitting && styles.buttonDisabled,
                      ]}
                      onPress={handleAddReply}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator
                          size="small"
                          color="#fff"
                          style={{ marginRight: 8 }}
                        />
                      ) : (
                        <MaterialIcons name="send" size={18} color="#fff" />
                      )}
                      <Text style={styles.submitButtonText}>
                        {submitting ? "Sending..." : "Send Reply"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
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
    backgroundColor: "#0a66c2",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#e3f2fd",
    marginTop: 4,
  },
  ticketCountBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ticketCountText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#eee",
  },
  filterTabActive: {
    backgroundColor: "#0a66c2",
    borderColor: "#0a66c2",
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
  },
  filterTabTextActive: {
    color: "#fff",
  },
  filterTabBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: "center",
  },
  filterTabBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  filterTabBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#555",
  },
  filterTabBadgeTextActive: {
    color: "#fff",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#999",
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#bbb",
    marginTop: 8,
  },
  ticketCard: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
  },
  cardLeftBorder: {
    width: 4,
    height: "100%",
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardTitleSection: {
    flex: 1,
    marginRight: 12,
  },
  badgeContainer: {
    position: "relative",
    alignItems: "center",
  },
  unreadDotIndicator: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e74c3c",
    borderWidth: 2,
    borderColor: "#fff",
  },
  ticketSubject: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a202c",
    marginBottom: 4,
  },
  ticketMeta: {
    fontSize: 11,
    color: "#666",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "700",
  },
  messagePreview: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
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
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    fontWeight: "500",
  },
  closeButton: {
    padding: 8,
  },
  detailsContainer: {
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
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
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
    fontSize: 13,
    color: "#1a202c",
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a202c",
    marginBottom: 12,
  },
  messageContent: {
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
  replyBox: {
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  messagesContainer: {
    marginVertical: 12,
    paddingVertical: 8,
  },
  messageBubbleWrapper: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  userBubbleWrapper: {
    alignItems: "flex-end",
  },
  adminBubbleWrapper: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: "#0a66c2",
    borderBottomRightRadius: 4,
  },
  adminBubble: {
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
  userSender: {
    color: "#fff",
  },
  adminSender: {
    color: "#0a66c2",
  },
  messageTimestamp: {
    fontSize: 11,
    color: "#999",
  },
  messageTextContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: "#fff",
  },
  adminMessageText: {
    color: "#333",
  },
  replyFrom: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  replyText: {
    fontSize: 12,
    color: "#333",
    lineHeight: 18,
    marginBottom: 6,
  },
  replyTime: {
    fontSize: 10,
    color: "#999",
  },
  noReplies: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    paddingVertical: 20,
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
  submitButton: {
    flexDirection: "row",
    backgroundColor: "#0a66c2",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
});

export default MyTicketsScreen;
