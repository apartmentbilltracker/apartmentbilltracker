import React, { useState, useEffect, useMemo} from "react";
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
  Platform,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supportService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const GOLD = "#b38604";
const AdminSupportTicketsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchAllTickets();
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

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await supportService.getAllTickets();
      setTickets(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error("Error refreshing tickets:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTicketPress = async (ticketId) => {
    try {
      const details = await supportService.getTicketDetails(ticketId);
      setSelectedTicket(details?.data || details);
      setNewStatus(details?.data?.status || details?.status);
      setModalVisible(true);
      try {
        await supportService.markTicketAsRead(ticketId);
        setTickets(
          tickets.map((t) =>
            (t.id || t._id) === ticketId ? { ...t, isReadByAdmin: true } : t,
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
      await supportService.addTicketReply(
        selectedTicket.id || selectedTicket._id,
        replyText,
      );
      const updatedTicket = {
        ...selectedTicket,
        replies: [
          ...(selectedTicket.replies || []),
          { from: "admin", message: replyText, createdAt: new Date() },
        ],
        isReadByAdmin: false,
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

  const handleStatusChange = async (status) => {
    setSubmitting(true);
    try {
      await supportService.updateTicketStatus(
        selectedTicket.id || selectedTicket._id,
        status,
      );
      const updatedTicket = { ...selectedTicket, status };
      setSelectedTicket(updatedTicket);
      setNewStatus(status);
      Alert.alert("Success", "Ticket status updated");
    } catch (error) {
      Alert.alert("Error", "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "open": return "alert-circle";
      case "in-progress": return "time";
      case "resolved": return "checkmark-circle";
      case "closed": return "lock-closed";
      default: return "help-circle";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "open": return "#ef4444";
      case "in-progress": return "#f59e0b";
      case "resolved": return "#10b981";
      case "closed": return "#6b7280";
      default: return "#6b7280";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high": return "#ef4444";
      case "medium": return "#f59e0b";
      case "low": return "#10b981";
      default: return "#6b7280";
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case "high": return "flame";
      case "medium": return "warning";
      case "low": return "leaf";
      default: return "flag";
    }
  };

  const filteredTickets =
    statusFilter === "all"
      ? tickets
      : tickets.filter((t) => t.status === statusFilter);

  const statusCounts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    "in-progress": tickets.filter((t) => t.status === "in-progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.loadingIconWrap}>
          <Ionicons name="ticket-outline" size={32} color={GOLD} />
        </View>
        <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 16 }} />
        <Text style={styles.loadingText}>Loading tickets...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{statusCounts.all}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={[styles.summaryDivider]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: "#ef4444" }]}>{statusCounts.open}</Text>
          <Text style={styles.summaryLabel}>Open</Text>
        </View>
        <View style={[styles.summaryDivider]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: "#f59e0b" }]}>{statusCounts["in-progress"]}</Text>
          <Text style={styles.summaryLabel}>In Progress</Text>
        </View>
        <View style={[styles.summaryDivider]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: "#10b981" }]}>{statusCounts.resolved}</Text>
          <Text style={styles.summaryLabel}>Resolved</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {[
          { key: "all", label: "All", icon: "list" },
          { key: "open", label: "Open", icon: "alert-circle" },
          { key: "in-progress", label: "In Progress", icon: "time" },
          { key: "resolved", label: "Resolved", icon: "checkmark-circle" },
          { key: "closed", label: "Closed", icon: "lock-closed" },
        ].map((tab) => {
          const active = statusFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setStatusFilter(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={active ? "#fff" : colors.textSecondary}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Tickets List */}
      <FlatList
        data={filteredTickets}
        keyExtractor={(item) => item.id || item._id}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD]} tintColor={GOLD} />
        }
        renderItem={({ item }) => {
          const sColor = getStatusColor(item.status);
          const pColor = getPriorityColor(item.priority);
          const hasUnread = !item.isReadByAdmin && item.replies && item.replies.length > 0;
          return (
            <TouchableOpacity
              style={styles.ticketCard}
              onPress={() => handleTicketPress(item.id || item._id)}
              activeOpacity={0.7}
            >
              {/* Left accent */}
              <View style={[styles.cardAccent, { backgroundColor: sColor }]} />

              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.ticketSubject} numberOfLines={2}>{item.subject}</Text>
                    <View style={styles.userRow}>
                      <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.ticketUser}>{item.userName}</Text>
                    </View>
                  </View>

                  <View style={styles.badgeColumn}>
                    <View style={[styles.statusBadge, { backgroundColor: sColor + "18" }]}>
                      <Ionicons name={getStatusIcon(item.status)} size={12} color={sColor} />
                      <Text style={[styles.statusBadgeText, { color: sColor }]}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1).replace("-", " ")}
                      </Text>
                    </View>
                    {hasUnread && <View style={styles.unreadDot} />}
                  </View>
                </View>

                <View style={styles.cardSeparator} />

                <View style={styles.cardMetaRow}>
                  <View style={styles.metaChip}>
                    <Ionicons name="pricetag-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.metaText}>{item.category}</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Ionicons name={getPriorityIcon(item.priority)} size={12} color={pColor} />
                    <Text style={[styles.metaText, { color: pColor }]}>
                      {item.priority?.charAt(0).toUpperCase() + item.priority?.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Ionicons name="chatbubble-outline" size={12} color={GOLD} />
                    <Text style={[styles.metaText, { color: GOLD }]}>{(item.replies || []).length}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={{ marginLeft: "auto" }} />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="mail-open-outline" size={40} color={GOLD} />
            </View>
            <Text style={styles.emptyTitle}>No Tickets Found</Text>
            <Text style={styles.emptySub}>All support tickets are handled!</Text>
          </View>
        }
      />

      {/* Ticket Details Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="ticket-outline" size={22} color={GOLD} />
              </View>
              <Text style={styles.modalTitle}>Ticket Details</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedTicket && (
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 30 }}
              >
                {/* Subject */}
                <Text style={styles.modalSubject}>{selectedTicket.subject}</Text>

                {/* Info Grid */}
                <View style={styles.infoGrid}>
                  <View style={styles.infoCell}>
                    <View style={[styles.infoCellIcon, { backgroundColor: GOLD + "18" }]}>
                      <Ionicons name="person-outline" size={16} color={GOLD} />
                    </View>
                    <Text style={styles.infoCellLabel}>Customer</Text>
                    <Text style={styles.infoCellValue} numberOfLines={1}>{selectedTicket.userName}</Text>
                  </View>
                  <View style={styles.infoCell}>
                    <View style={[styles.infoCellIcon, { backgroundColor: "#10b981" + "18" }]}>
                      <Ionicons name="mail-outline" size={16} color="#10b981" />
                    </View>
                    <Text style={styles.infoCellLabel}>Email</Text>
                    <Text style={styles.infoCellValue} numberOfLines={1}>{selectedTicket.userEmail}</Text>
                  </View>
                  <View style={styles.infoCell}>
                    <View style={[styles.infoCellIcon, { backgroundColor: "#f59e0b" + "18" }]}>
                      <Ionicons name="pricetag-outline" size={16} color="#f59e0b" />
                    </View>
                    <Text style={styles.infoCellLabel}>Category</Text>
                    <Text style={styles.infoCellValue}>
                      {selectedTicket.category?.charAt(0).toUpperCase() + selectedTicket.category?.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.infoCell}>
                    <View style={[styles.infoCellIcon, { backgroundColor: getPriorityColor(selectedTicket.priority) + "18" }]}>
                      <Ionicons name={getPriorityIcon(selectedTicket.priority)} size={16} color={getPriorityColor(selectedTicket.priority)} />
                    </View>
                    <Text style={styles.infoCellLabel}>Priority</Text>
                    <Text style={[styles.infoCellValue, { color: getPriorityColor(selectedTicket.priority) }]}>
                      {selectedTicket.priority?.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Message Section */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconWrap}>
                      <Ionicons name="document-text-outline" size={16} color={GOLD} />
                    </View>
                    <Text style={styles.sectionTitle}>Ticket Message</Text>
                  </View>
                  <View style={styles.messageBox}>
                    <Text style={styles.messageText}>{selectedTicket.message}</Text>
                  </View>
                </View>

                {/* Status Update */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconWrap}>
                      <Ionicons name="swap-horizontal-outline" size={16} color={GOLD} />
                    </View>
                    <Text style={styles.sectionTitle}>Update Status</Text>
                  </View>
                  <View style={styles.statusGrid}>
                    {["open", "in-progress", "resolved", "closed"].map((status) => {
                      const active = newStatus === status;
                      const sCol = getStatusColor(status);
                      return (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusOption,
                            active && { backgroundColor: sCol, borderColor: sCol },
                          ]}
                          onPress={() => handleStatusChange(status)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={getStatusIcon(status)}
                            size={18}
                            color={active ? "#fff" : sCol}
                          />
                          <Text style={[styles.statusOptionText, active && { color: colors.textOnAccent }]}>
                            {status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ")}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Conversation */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconWrap}>
                      <Ionicons name="chatbubbles-outline" size={16} color={GOLD} />
                    </View>
                    <Text style={styles.sectionTitle}>
                      Conversation ({selectedTicket.replies?.length || 0})
                    </Text>
                  </View>

                  {selectedTicket.replies && selectedTicket.replies.length > 0 ? (
                    <View style={styles.conversationWrap}>
                      {selectedTicket.replies.map((reply, index) => {
                        const isAdmin = reply.from === "admin";
                        return (
                          <View
                            key={index}
                            style={[
                              styles.bubbleRow,
                              isAdmin ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" },
                            ]}
                          >
                            <View style={[
                              styles.bubble,
                              isAdmin ? styles.adminBubble : styles.customerBubble,
                            ]}>
                              <View style={styles.bubbleHeader}>
                                <View style={styles.bubbleSenderRow}>
                                  <Ionicons
                                    name={isAdmin ? "build-outline" : "person-outline"}
                                    size={12}
                                    color={isAdmin ? "#fff" : colors.text}
                                  />
                                  <Text style={[styles.bubbleSender, isAdmin && { color: colors.textOnAccent }]}>
                                    {isAdmin ? "You (Admin)" : "Customer"}
                                  </Text>
                                </View>
                                <Text style={[styles.bubbleTime, isAdmin && { color: "rgba(255,255,255,0.7)" }]}>
                                  {new Date(reply.createdAt).toLocaleString()}
                                </Text>
                              </View>
                              <Text style={[styles.bubbleText, isAdmin && { color: colors.textOnAccent }]}>
                                {reply.message}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.noRepliesWrap}>
                      <Ionicons name="chatbubble-ellipses-outline" size={32} color={GOLD + "60"} />
                      <Text style={styles.noRepliesText}>No replies yet. Start the conversation below!</Text>
                    </View>
                  )}
                </View>

                {/* Reply Input */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconWrap}>
                      <Ionicons name="return-down-forward-outline" size={16} color={GOLD} />
                    </View>
                    <Text style={styles.sectionTitle}>Add Reply</Text>
                  </View>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Type your reply here..."
                    placeholderTextColor={colors.placeholder}
                    multiline
                    numberOfLines={4}
                    value={replyText}
                    onChangeText={setReplyText}
                    editable={!submitting}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, submitting && { opacity: 0.6 }]}
                    onPress={handleAddReply}
                    disabled={submitting}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <ActivityIndicator color={colors.textOnAccent} size="small" />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color={colors.textOnAccent} />
                        <Text style={styles.sendBtnText}>Send Reply</Text>
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

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: GOLD + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },

  /* Summary Strip */
  summaryStrip: {
    flexDirection: "row",
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "800",
    color: GOLD,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: "500",
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.border,
  },

  /* Filter Tabs */
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#fff",
  },

  /* Ticket Cards */
  ticketCard: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  cardAccent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  ticketSubject: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ticketUser: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  badgeColumn: {
    alignItems: "flex-end",
    gap: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
    borderWidth: 2,
    borderColor: colors.card,
  },
  cardSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "500",
  },

  /* Empty State */
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: GOLD + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxHeight: "92%",
    backgroundColor: colors.card,
    borderRadius: 18,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GOLD + "15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  modalSubject: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 14,
    lineHeight: 22,
  },

  /* Info Grid */
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  infoCell: {
    width: "47%",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  infoCellIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  infoCellLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  infoCellValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "700",
    marginTop: 2,
    textAlign: "center",
  },

  /* Section */
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GOLD + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  messageBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  messageText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },

  /* Status Grid */
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusOption: {
    width: "47%",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  /* Conversation Bubbles */
  conversationWrap: {
    marginTop: 4,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  adminBubble: {
    backgroundColor: GOLD,
    borderBottomRightRadius: 4,
  },
  customerBubble: {
    backgroundColor: colors.background,
    borderBottomLeftRadius: 4,
  },
  bubbleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
    gap: 8,
  },
  bubbleSenderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bubbleSender: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },
  bubbleTime: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  noRepliesWrap: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  noRepliesText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 20,
  },

  /* Reply Input */
  replyInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: colors.text,
    textAlignVertical: "top",
    minHeight: 80,
    marginBottom: 10,
  },
  sendBtn: {
    flexDirection: "row",
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  sendBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default AdminSupportTicketsScreen;
