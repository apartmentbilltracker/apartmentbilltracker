import React, { useState, useEffect, useContext, useMemo } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { supportService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const MyTicketsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

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
      const response = await supportService.getTicketDetails(
        ticket.id || ticket._id,
      );
      setSelectedTicket(response?.data || response);
      setDetailsVisible(true);
      try {
        await supportService.markTicketAsRead(ticket.id || ticket._id);
        setTickets(
          tickets.map((t) =>
            (t.id || t._id) === (ticket.id || ticket._id)
              ? { ...t, isReadByUser: true }
              : t,
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
      await supportService.addTicketReply(
        selectedTicket.id || selectedTicket._id,
        newReply,
      );
      Alert.alert("Success", "Reply added successfully");
      setNewReply("");
      const response = await supportService.getTicketDetails(
        selectedTicket.id || selectedTicket._id,
      );
      setSelectedTicket(response?.data || response);
      setTickets(
        tickets.map((t) =>
          (t.id || t._id) === (selectedTicket.id || selectedTicket._id)
            ? { ...t, isReadByAdmin: false }
            : t,
        ),
      );
    } catch (error) {
      Alert.alert("Error", "Failed to add reply");
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Helpers ─── */
  const getStatusConfig = (status) => {
    switch (status) {
      case "open":
        return {
          color: colors.error,
          bg: colors.errorBg,
          label: "Open",
          icon: "radio-button-on",
        };
      case "in-progress":
        return {
          color: colors.warning,
          bg: colors.warningBg,
          label: "In Progress",
          icon: "sync-outline",
        };
      case "resolved":
        return {
          color: colors.success,
          bg: colors.successBg,
          label: "Resolved",
          icon: "checkmark-circle",
        };
      case "closed":
        return {
          color: colors.textTertiary,
          bg: colors.cardAlt,
          label: "Closed",
          icon: "lock-closed-outline",
        };
      default:
        return {
          color: colors.textSecondary,
          bg: colors.cardAlt,
          label: status || "Unknown",
          icon: "help-circle-outline",
        };
    }
  };

  const getPriorityConfig = (priority) => {
    switch (priority) {
      case "high":
        return { color: colors.error, label: "High" };
      case "medium":
        return { color: colors.warning, label: "Medium" };
      case "low":
        return { color: colors.success, label: "Low" };
      default:
        return { color: colors.textSecondary, label: priority || "Normal" };
    }
  };

  const getCategoryIcon = (category) => {
    const c = (category || "").toLowerCase();
    if (c.includes("billing") || c.includes("payment")) return "card-outline";
    if (c.includes("technical") || c.includes("bug"))
      return "construct-outline";
    if (c.includes("room")) return "home-outline";
    if (c.includes("account")) return "person-outline";
    return "help-circle-outline";
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

  const getFilteredTickets = () => {
    if (selectedFilter === "all") return tickets;
    return tickets.filter((t) => t.status === selectedFilter);
  };

  const filters = [
    { key: "all", label: "All", icon: "list-outline" },
    { key: "open", label: "Open", icon: "radio-button-on" },
    { key: "in-progress", label: "Active", icon: "sync-outline" },
    { key: "resolved", label: "Resolved", icon: "checkmark-circle-outline" },
    { key: "closed", label: "Closed", icon: "lock-closed-outline" },
  ];

  /* ─── Loading ─── */
  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading tickets…</Text>
      </View>
    );
  }

  /* ─── Render Ticket Card ─── */
  const renderTicket = ({ item }) => {
    const sc = getStatusConfig(item.status);
    const pc = getPriorityConfig(item.priority);
    const hasUnread =
      !item.isReadByUser && item.replies && item.replies.length > 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleViewDetails(item)}
        activeOpacity={0.7}
      >
        {/* Left icon */}
        <View style={[styles.cardIcon, { backgroundColor: sc.bg }]}>
          <Ionicons
            name={getCategoryIcon(item.category)}
            size={18}
            color={sc.color}
          />
        </View>

        {/* Content */}
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.subject}
            </Text>
            {hasUnread && <View style={styles.unreadDot} />}
          </View>

          <Text style={styles.cardMessage} numberOfLines={2}>
            {item.message}
          </Text>

          <View style={styles.cardMeta}>
            {/* Status */}
            <View style={[styles.pill, { backgroundColor: sc.bg }]}>
              <Ionicons name={sc.icon} size={10} color={sc.color} />
              <Text style={[styles.pillText, { color: sc.color }]}>
                {sc.label}
              </Text>
            </View>

            {/* Priority */}
            <View style={styles.metaItem}>
              <Ionicons name="flag-outline" size={11} color={pc.color} />
              <Text style={[styles.metaText, { color: pc.color }]}>
                {pc.label}
              </Text>
            </View>

            {/* Replies */}
            <View style={styles.metaItem}>
              <Ionicons name="chatbubble-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.metaText}>{item.replies?.length || 0}</Text>
            </View>
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.textTertiary}
          style={{ marginTop: 4 }}
        />
      </TouchableOpacity>
    );
  };

  /* ─── Main ─── */
  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        style={styles.filterScroll}
      >
        {filters.map((f) => {
          const active = selectedFilter === f.key;
          const count =
            f.key === "all"
              ? tickets.length
              : tickets.filter((t) => t.status === f.key).length;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setSelectedFilter(f.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={f.icon}
                size={13}
                color={active ? "#fff" : "#64748b"}
              />
              <Text
                style={[styles.filterText, active && styles.filterTextActive]}
              >
                {f.label}
              </Text>
              <View
                style={[styles.filterCount, active && styles.filterCountActive]}
              >
                <Text
                  style={[
                    styles.filterCountText,
                    active && styles.filterCountTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Empty */}
      {tickets.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#b38604"]}
              tintcolor={colors.accent}
            />
          }
        >
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={colors.textSecondary}
            />
          </View>
          <Text style={styles.emptyTitle}>No Support Tickets</Text>
          <Text style={styles.emptyText}>
            Your support requests will appear here.
          </Text>
          <TouchableOpacity style={styles.emptyRefresh} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={16} color={colors.accent} />
            <Text style={styles.emptyRefreshText}>Refresh</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          data={getFilteredTickets()}
          renderItem={renderTicket}
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

      {/* ─── Ticket Details Modal ─── */}
      <Modal visible={detailsVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDetailsVisible(false)}
        >
          <View
            style={styles.modalSheet}
            onStartShouldSetResponder={() => true}
          >
            {/* Drag handle */}
            <View style={styles.dragHandle} />

            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Ticket Details</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {selectedTicket?.subject}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setDetailsVisible(false)}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedTicket && (
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 30 }}
              >
                {/* Info pills */}
                <View style={styles.infoPillRow}>
                  {(() => {
                    const sc = getStatusConfig(selectedTicket.status);
                    return (
                      <View
                        style={[styles.infoPill, { backgroundColor: sc.bg }]}
                      >
                        <Ionicons name={sc.icon} size={13} color={sc.color} />
                        <Text
                          style={[styles.infoPillText, { color: sc.color }]}
                        >
                          {sc.label}
                        </Text>
                      </View>
                    );
                  })()}
                  {(() => {
                    const pc = getPriorityConfig(selectedTicket.priority);
                    return (
                      <View
                        style={[
                          styles.infoPill,
                          { backgroundColor: colors.cardAlt },
                        ]}
                      >
                        <Ionicons
                          name="flag-outline"
                          size={13}
                          color={pc.color}
                        />
                        <Text
                          style={[styles.infoPillText, { color: pc.color }]}
                        >
                          {pc.label} Priority
                        </Text>
                      </View>
                    );
                  })()}
                  <View
                    style={[
                      styles.infoPill,
                      { backgroundColor: colors.accentSurface },
                    ]}
                  >
                    <Ionicons
                      name={getCategoryIcon(selectedTicket.category)}
                      size={13}
                      color={colors.accent}
                    />
                    <Text
                      style={[styles.infoPillText, { color: colors.accent }]}
                    >
                      {selectedTicket.category}
                    </Text>
                  </View>
                </View>

                {/* Original message */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Your Message</Text>
                  <View style={styles.messageBox}>
                    <Text style={styles.messageBoxText}>
                      {selectedTicket.message}
                    </Text>
                  </View>
                </View>

                {/* Conversation */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    Conversation ({selectedTicket.replies?.length || 0})
                  </Text>

                  {selectedTicket.replies &&
                  selectedTicket.replies.length > 0 ? (
                    selectedTicket.replies.map((reply, index) => {
                      const isUser = reply.from === "user";
                      return (
                        <View
                          key={index}
                          style={[
                            styles.bubbleWrap,
                            isUser ? styles.bubbleRight : styles.bubbleLeft,
                          ]}
                        >
                          <View
                            style={[
                              styles.bubble,
                              isUser ? styles.bubbleUser : styles.bubbleAdmin,
                            ]}
                          >
                            <View style={styles.bubbleHeader}>
                              <Text
                                style={[
                                  styles.bubbleSender,
                                  isUser
                                    ? { color: colors.textOnAccent }
                                    : { color: colors.accent },
                                ]}
                              >
                                {isUser ? "You" : "Support Team"}
                              </Text>
                              <Text
                                style={[
                                  styles.bubbleTime,
                                  isUser
                                    ? { color: "rgba(255,255,255,0.7)" }
                                    : { color: "#94a3b8" },
                                ]}
                              >
                                {formatTimeAgo(reply.createdAt)}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.bubbleText,
                                isUser
                                  ? { color: colors.textOnAccent }
                                  : { color: colors.text },
                              ]}
                            >
                              {reply.message}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.noRepliesWrap}>
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={24}
                        color={colors.textTertiary}
                      />
                      <Text style={styles.noRepliesText}>
                        No replies yet. We'll get back to you soon!
                      </Text>
                    </View>
                  )}
                </View>

                {/* Reply input */}
                {selectedTicket.status !== "closed" && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Add Reply</Text>
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Type your message…"
                      placeholderTextColor={colors.placeholder}
                      multiline
                      numberOfLines={4}
                      value={newReply}
                      onChangeText={setNewReply}
                      editable={!submitting}
                    />
                    <TouchableOpacity
                      style={[styles.sendBtn, submitting && { opacity: 0.6 }]}
                      onPress={handleAddReply}
                      disabled={submitting}
                      activeOpacity={0.8}
                    >
                      {submitting ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.textOnAccent}
                        />
                      ) : (
                        <Ionicons
                          name="send"
                          size={16}
                          color={colors.textOnAccent}
                        />
                      )}
                      <Text style={styles.sendBtnText}>
                        {submitting ? "Sending…" : "Send Reply"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

/* ═══════════════════════ STYLES ═══════════════════════ */
const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 13,
      color: colors.textTertiary,
    },

    /* Filters */
    filterScroll: {
      backgroundColor: colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    filterBar: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 18,
      backgroundColor: colors.background,
      gap: 5,
    },
    filterChipActive: {
      backgroundColor: colors.accent,
    },
    filterText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    filterTextActive: {
      color: "#fff",
    },
    filterCount: {
      backgroundColor: "rgba(0,0,0,0.06)",
      borderRadius: 8,
      minWidth: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    filterCountActive: {
      backgroundColor: "rgba(255,255,255,0.25)",
    },
    filterCountText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    filterCountTextActive: {
      color: "#fff",
    },

    /* Empty */
    emptyWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
      paddingTop: 80,
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
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    cardIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
      marginTop: 2,
    },
    cardBody: {
      flex: 1,
    },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 3,
    },
    cardTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#ef4444",
      marginLeft: 6,
    },
    cardMessage: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
      marginBottom: 8,
    },
    cardMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      gap: 3,
    },
    pillText: {
      fontSize: 10,
      fontWeight: "700",
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    metaText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
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
      maxHeight: "92%",
      flex: 1,
      marginTop: 40,
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
      alignItems: "flex-start",
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    modalCloseBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 10,
    },
    modalBody: {
      flex: 1,
      paddingHorizontal: 18,
      paddingTop: 14,
    },

    /* Info pills */
    infoPillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 18,
    },
    infoPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      gap: 5,
    },
    infoPillText: {
      fontSize: 12,
      fontWeight: "600",
    },

    /* Section */
    section: {
      marginBottom: 20,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 10,
    },

    /* Message box */
    messageBox: {
      backgroundColor: colors.cardAlt,
      borderRadius: 12,
      padding: 14,
      borderLeftWidth: 3,
      borderLeftColor: "#b38604",
    },
    messageBoxText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 20,
    },

    /* Bubbles */
    bubbleWrap: {
      marginBottom: 12,
    },
    bubbleRight: {
      alignItems: "flex-end",
    },
    bubbleLeft: {
      alignItems: "flex-start",
    },
    bubble: {
      maxWidth: "85%",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
    },
    bubbleUser: {
      backgroundColor: colors.accent,
      borderBottomRightRadius: 4,
    },
    bubbleAdmin: {
      backgroundColor: colors.background,
      borderBottomLeftRadius: 4,
    },
    bubbleHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
      gap: 8,
    },
    bubbleSender: {
      fontSize: 11,
      fontWeight: "700",
    },
    bubbleTime: {
      fontSize: 10,
    },
    bubbleText: {
      fontSize: 13,
      lineHeight: 19,
    },
    noRepliesWrap: {
      alignItems: "center",
      paddingVertical: 24,
      gap: 8,
    },
    noRepliesText: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: "center",
    },

    /* Reply input */
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
      minHeight: 90,
      marginBottom: 12,
    },
    sendBtn: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 13,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    sendBtnText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
    },
  });

export default MyTicketsScreen;
