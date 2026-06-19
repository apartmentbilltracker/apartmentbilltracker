import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supportService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import {
  ScrollViewWithDetection,
  FlatListWithDetection,
} from "../../components/ScrollDetectionWrappers";

// ─── Semantic status / priority colours (unchanged — these are not theme tones)
const STATUS_COLORS = {
  open: "#ef4444",
  "in-progress": "#f59e0b",
  resolved: "#10b981",
  closed: "#6b7280",
};
const PRIORITY_COLORS = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" };

const getStatusColor = (s) => STATUS_COLORS[s] ?? "#6b7280";
const getPriorityColor = (p) => PRIORITY_COLORS[p] ?? "#6b7280";

const getStatusIcon = (s) => {
  const map = {
    open: "alert-circle",
    "in-progress": "time",
    resolved: "checkmark-circle",
    closed: "lock-closed",
  };
  return map[s] ?? "help-circle";
};
const getPriorityIcon = (p) => {
  const map = { high: "flame", medium: "warning", low: "leaf" };
  return map[p] ?? "flag";
};

// ─────────────────────────────────────────────────────────────────────────────

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
    const unsubscribe = navigation.addListener("focus", fetchAllTickets);
    return unsubscribe;
  }, [navigation]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchAllTickets = async () => {
    setLoading(true);
    try {
      const res = await supportService.getAllTickets();
      setTickets(Array.isArray(res) ? res : res?.data || []);
    } catch (err) {
      console.error("Error fetching tickets:", err);
      Alert.alert("Error", "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await supportService.getAllTickets();
      setTickets(Array.isArray(res) ? res : res?.data || []);
    } catch (err) {
      console.error("Error refreshing tickets:", err);
    } finally {
      setRefreshing(false);
    }
  };

  // ── Ticket actions ─────────────────────────────────────────────────────────

  const handleTicketPress = async (ticketId) => {
    try {
      const details = await supportService.getTicketDetails(ticketId);
      setSelectedTicket(details?.data || details);
      setNewStatus(details?.data?.status || details?.status);
      setModalVisible(true);
      try {
        await supportService.markTicketAsRead(ticketId);
        setTickets((prev) =>
          prev.map((t) =>
            (t.id || t._id) === ticketId ? { ...t, isReadByAdmin: true } : t,
          ),
        );
      } catch (e) {
        console.error("Error marking ticket as read:", e);
      }
    } catch {
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
      setSelectedTicket((prev) => ({
        ...prev,
        replies: [
          ...(prev.replies || []),
          { from: "admin", message: replyText, createdAt: new Date() },
        ],
        isReadByAdmin: false,
      }));
      setReplyText("");
      Alert.alert("Success", "Reply added successfully");
    } catch {
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
      setSelectedTicket((prev) => ({ ...prev, status }));
      setNewStatus(status);
      Alert.alert("Success", "Ticket status updated");
    } catch {
      Alert.alert("Error", "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const statusCounts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    "in-progress": tickets.filter((t) => t.status === "in-progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  const filteredTickets =
    statusFilter === "all"
      ? tickets
      : tickets.filter((t) => t.status === statusFilter);

  // ── Loading screen ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.loadingIconWrap}>
          <Ionicons name="headset-outline" size={32} color={colors.accent} />
        </View>
        <ActivityIndicator
          size="large"
          color={colors.accent}
          style={{ marginTop: 16 }}
        />
        <Text style={styles.loadingText}>Loading tickets…</Text>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* ── Header Banner (matches dashboard deep-green header) ── */}
      <View style={styles.headerBanner}>
        <View style={styles.headerRow}>
          <View style={styles.headerIconWrap}>
            <Ionicons
              name="headset-outline"
              size={22}
              color={colors.headerText}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Support Hub</Text>
            <Text style={styles.headerSub}>
              Manage & respond to all tickets
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerRefreshBtn}
            onPress={fetchAllTickets}
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={colors.headerText}
            />
          </TouchableOpacity>
        </View>

        {/* ── Stat Cards (modelled on dashboard Quick Stats Row) ── */}
        <View style={styles.statRow}>
          {[
            {
              label: "Total",
              value: statusCounts.all,
              icon: "albums-outline",
              bg: "rgba(255,255,255,0.12)",
              iconColor: colors.headerText,
              valueColor: colors.headerText,
            },
            {
              label: "Open",
              value: statusCounts.open,
              icon: "alert-circle-outline",
              bg: "rgba(239,68,68,0.25)",
              iconColor: "#fca5a5",
              valueColor: "#fca5a5",
            },
            {
              label: "In Progress",
              value: statusCounts["in-progress"],
              icon: "time-outline",
              bg: "rgba(245,158,11,0.25)",
              iconColor: "#fcd34d",
              valueColor: "#fcd34d",
            },
            {
              label: "Resolved",
              value: statusCounts.resolved,
              icon: "checkmark-circle-outline",
              bg: "rgba(129,216,163,0.25)",
              iconColor: "#9af2bb",
              valueColor: "#9af2bb",
            },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={15} color={s.iconColor} />
              </View>
              <Text style={[styles.statValue, { color: s.valueColor }]}>
                {s.value}
              </Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Filter Chips ── */}
      <ScrollViewWithDetection
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
          const count = statusCounts[tab.key];
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
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  style={[styles.chipBadge, active && styles.chipBadgeActive]}
                >
                  <Text
                    style={[
                      styles.chipBadgeText,
                      active && styles.chipBadgeTextActive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollViewWithDetection>

      {/* ── Ticket List ── */}
      <FlatListWithDetection
        data={filteredTickets}
        keyExtractor={(item) => String(item.id || item._id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
        renderItem={({ item }) => {
          const sColor = getStatusColor(item.status);
          const pColor = getPriorityColor(item.priority);
          const hasUnread =
            !item.isReadByAdmin && (item.replies || []).length > 0;
          return (
            <TouchableOpacity
              style={styles.ticketCard}
              onPress={() => handleTicketPress(item.id || item._id)}
              activeOpacity={0.75}
            >
              {/* Left status accent bar */}
              <View style={[styles.cardAccent, { backgroundColor: sColor }]} />

              <View style={styles.cardBody}>
                {/* Top row: subject + status badge */}
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.ticketSubject} numberOfLines={2}>
                      {item.subject}
                    </Text>
                    <View style={styles.userRow}>
                      <Ionicons
                        name="person-circle-outline"
                        size={13}
                        color={colors.accent}
                      />
                      <Text style={styles.ticketUser}>{item.userName}</Text>
                    </View>
                  </View>

                  <View style={styles.badgeColumn}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: sColor + "18" },
                      ]}
                    >
                      <Ionicons
                        name={getStatusIcon(item.status)}
                        size={12}
                        color={sColor}
                      />
                      <Text style={[styles.statusBadgeText, { color: sColor }]}>
                        {item.status.charAt(0).toUpperCase() +
                          item.status.slice(1).replace("-", " ")}
                      </Text>
                    </View>
                    {hasUnread && <View style={styles.unreadDot} />}
                  </View>
                </View>

                <View style={styles.cardSeparator} />

                {/* Meta row: category · priority · reply count */}
                <View style={styles.cardMetaRow}>
                  <View style={styles.metaChip}>
                    <Ionicons
                      name="pricetag-outline"
                      size={12}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.metaText}>{item.category}</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Ionicons
                      name={getPriorityIcon(item.priority)}
                      size={12}
                      color={pColor}
                    />
                    <Text style={[styles.metaText, { color: pColor }]}>
                      {item.priority?.charAt(0).toUpperCase() +
                        item.priority?.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={12}
                      color={colors.accent}
                    />
                    <Text style={[styles.metaText, { color: colors.accent }]}>
                      {(item.replies || []).length}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textSecondary}
                    style={{ marginLeft: "auto" }}
                  />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="mail-open-outline"
                size={40}
                color={colors.accent}
              />
            </View>
            <Text style={styles.emptyTitle}>All Clear!</Text>
            <Text style={styles.emptySub}>
              No support tickets to manage right now.
            </Text>
          </View>
        }
      />

      {/* ── Ticket Detail Modal (slides up from bottom) ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal header — dark green band */}
            <View style={styles.modalHeader}>
              {/* Drag pill */}
              <View style={styles.dragPill} />
              <View style={styles.modalHeaderContent}>
                <View style={styles.modalIconWrap}>
                  <Ionicons
                    name="ticket-outline"
                    size={20}
                    color={colors.headerText}
                  />
                </View>
                <Text style={styles.modalTitle}>Ticket Details</Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={20} color={colors.headerText} />
                </TouchableOpacity>
              </View>
            </View>

            {selectedTicket && (
              <ScrollViewWithDetection
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 36 }}
              >
                {/* Subject */}
                <Text style={styles.modalSubject}>
                  {selectedTicket.subject}
                </Text>

                {/* ── Info Grid ── */}
                <View style={styles.infoGrid}>
                  {[
                    {
                      icon: "person-outline",
                      label: "Customer",
                      value: selectedTicket.userName,
                      bg: colors.accentLight,
                      iconColor: colors.accent,
                    },
                    {
                      icon: "mail-outline",
                      label: "Email",
                      value: selectedTicket.userEmail,
                      bg: colors.statMembersBg,
                      iconColor: colors.statMembersIcon,
                    },
                    {
                      icon: "pricetag-outline",
                      label: "Category",
                      value:
                        selectedTicket.category?.charAt(0).toUpperCase() +
                        selectedTicket.category?.slice(1),
                      bg: "#fef3c7",
                      iconColor: "#f59e0b",
                    },
                    {
                      icon: getPriorityIcon(selectedTicket.priority),
                      label: "Priority",
                      value: selectedTicket.priority?.toUpperCase(),
                      bg: getPriorityColor(selectedTicket.priority) + "18",
                      iconColor: getPriorityColor(selectedTicket.priority),
                      valueColor: getPriorityColor(selectedTicket.priority),
                    },
                  ].map((cell, i) => (
                    <View key={i} style={styles.infoCell}>
                      <View
                        style={[
                          styles.infoCellIcon,
                          { backgroundColor: cell.bg },
                        ]}
                      >
                        <Ionicons
                          name={cell.icon}
                          size={16}
                          color={cell.iconColor}
                        />
                      </View>
                      <Text style={styles.infoCellLabel}>{cell.label}</Text>
                      <Text
                        style={[
                          styles.infoCellValue,
                          cell.valueColor && { color: cell.valueColor },
                        ]}
                        numberOfLines={1}
                      >
                        {cell.value}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* ── Ticket Message ── */}
                <SectionBlock
                  icon="document-text-outline"
                  title="Ticket Message"
                  colors={colors}
                  styles={styles}
                >
                  <View style={styles.messageBox}>
                    <Text style={styles.messageText}>
                      {selectedTicket.message}
                    </Text>
                  </View>
                </SectionBlock>

                {/* ── Status Update ── */}
                <SectionBlock
                  icon="swap-horizontal-outline"
                  title="Update Status"
                  colors={colors}
                  styles={styles}
                >
                  <View style={styles.statusGrid}>
                    {["open", "in-progress", "resolved", "closed"].map(
                      (status) => {
                        const active = newStatus === status;
                        const sCol = getStatusColor(status);
                        return (
                          <TouchableOpacity
                            key={status}
                            style={[
                              styles.statusOption,
                              { borderColor: sCol + "55" },
                              active && {
                                backgroundColor: sCol,
                                borderColor: sCol,
                              },
                            ]}
                            onPress={() => handleStatusChange(status)}
                            activeOpacity={0.75}
                          >
                            <View
                              style={[
                                styles.statusOptionIconWrap,
                                {
                                  backgroundColor: active
                                    ? "rgba(255,255,255,0.2)"
                                    : sCol + "18",
                                },
                              ]}
                            >
                              <Ionicons
                                name={getStatusIcon(status)}
                                size={16}
                                color={active ? "#fff" : sCol}
                              />
                            </View>
                            <Text
                              style={[
                                styles.statusOptionText,
                                active && { color: "#fff" },
                              ]}
                            >
                              {status.charAt(0).toUpperCase() +
                                status.slice(1).replace("-", " ")}
                            </Text>
                          </TouchableOpacity>
                        );
                      },
                    )}
                  </View>
                </SectionBlock>

                {/* ── Conversation ── */}
                <SectionBlock
                  icon="chatbubbles-outline"
                  title={`Conversation (${selectedTicket.replies?.length || 0})`}
                  colors={colors}
                  styles={styles}
                >
                  {selectedTicket.replies &&
                  selectedTicket.replies.length > 0 ? (
                    <View style={styles.conversationWrap}>
                      {selectedTicket.replies.map((reply, idx) => {
                        const isAdmin = reply.from === "admin";
                        return (
                          <View
                            key={idx}
                            style={[
                              styles.bubbleRow,
                              isAdmin
                                ? { justifyContent: "flex-end" }
                                : { justifyContent: "flex-start" },
                            ]}
                          >
                            <View
                              style={[
                                styles.bubble,
                                isAdmin
                                  ? styles.adminBubble
                                  : styles.customerBubble,
                              ]}
                            >
                              <View style={styles.bubbleHeader}>
                                <View style={styles.bubbleSenderRow}>
                                  <Ionicons
                                    name={
                                      isAdmin
                                        ? "build-outline"
                                        : "person-outline"
                                    }
                                    size={12}
                                    color={
                                      isAdmin
                                        ? "rgba(255,255,255,0.85)"
                                        : colors.accent
                                    }
                                  />
                                  <Text
                                    style={[
                                      styles.bubbleSender,
                                      isAdmin && { color: "#fff" },
                                    ]}
                                  >
                                    {isAdmin ? "You (Admin)" : "Customer"}
                                  </Text>
                                </View>
                                <Text
                                  style={[
                                    styles.bubbleTime,
                                    isAdmin && {
                                      color: "rgba(255,255,255,0.65)",
                                    },
                                  ]}
                                >
                                  {new Date(reply.createdAt).toLocaleString()}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.bubbleText,
                                  isAdmin && { color: "#fff" },
                                ]}
                              >
                                {reply.message}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.noRepliesWrap}>
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={32}
                        color={colors.accent + "70"}
                      />
                      <Text style={styles.noRepliesText}>
                        No replies yet.{"\n"}Start the conversation below!
                      </Text>
                    </View>
                  )}
                </SectionBlock>

                {/* ── Reply Input ── */}
                <SectionBlock
                  icon="return-down-forward-outline"
                  title="Add Reply"
                  colors={colors}
                  styles={styles}
                >
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Type your reply here…"
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
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color="#fff" />
                        <Text style={styles.sendBtnText}>Send Reply</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </SectionBlock>
              </ScrollViewWithDetection>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Small reusable section header wrapper ────────────────────────────────────
const SectionBlock = ({ icon, title, colors, styles, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={15} color={colors.accent} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (colors) =>
  StyleSheet.create({
    /* ── Layout ── */
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    /* ── Loading ── */
    loadingWrap: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingIconWrap: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: colors.accentLight,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 14,
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },

    /* ── Header Banner ── */
    headerBanner: {
      backgroundColor: colors.headerBg,
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 20,
      borderBottomLeftRadius: 26,
      borderBottomRightRadius: 26,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
        },
        android: { elevation: 6 },
      }),
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
    },
    headerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "rgba(255,255,255,0.14)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.headerText,
      letterSpacing: 0.2,
    },
    headerSub: {
      fontSize: 12,
      color: "rgba(255,255,255,0.60)",
      marginTop: 2,
    },
    headerRefreshBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(255,255,255,0.12)",
      justifyContent: "center",
      alignItems: "center",
    },

    /* ── Stat Cards ── */
    statRow: {
      flexDirection: "row",
      gap: 8,
    },
    statCard: {
      flex: 1,
      backgroundColor: "rgba(255,255,255,0.09)",
      borderRadius: 14,
      paddingVertical: 11,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.10)",
    },
    statIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 5,
    },
    statValue: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.headerText,
    },
    statLabel: {
      fontSize: 9,
      color: "rgba(255,255,255,0.55)",
      marginTop: 2,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },

    /* ── Filter Chips ── */
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
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    filterChipText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    filterChipTextActive: {
      color: "#fff",
    },
    chipBadge: {
      marginLeft: 6,
      backgroundColor: colors.borderLight,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    chipBadgeActive: {
      backgroundColor: "rgba(255,255,255,0.28)",
    },
    chipBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    chipBadgeTextActive: {
      color: "#fff",
    },

    /* ── Ticket List ── */
    listContent: {
      paddingTop: 4,
      paddingBottom: 24,
    },

    /* ── Ticket Card ── */
    ticketCard: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginBottom: 10,
      borderRadius: 16,
      backgroundColor: colors.card,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.07,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
    },
    cardAccent: {
      width: 4,
    },
    cardBody: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 13,
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
      lineHeight: 20,
    },
    userRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    ticketUser: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    badgeColumn: {
      alignItems: "flex-end",
      gap: 5,
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

    /* ── Empty State ── */
    emptyWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 64,
    },
    emptyIconWrap: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: colors.accentLight,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 18,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    emptySub: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 5,
      textAlign: "center",
    },

    /* ── Modal ── */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    modalCard: {
      width: "100%",
      maxHeight: "94%",
      backgroundColor: colors.card,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.18,
          shadowRadius: 14,
        },
        android: { elevation: 10 },
      }),
    },
    dragPill: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.30)",
      alignSelf: "center",
      marginBottom: 10,
      marginTop: 10,
    },
    modalHeader: {
      backgroundColor: colors.headerBg,
      paddingBottom: 14,
      paddingHorizontal: 16,
    },
    modalHeaderContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    modalIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.14)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    modalTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: "700",
      color: colors.headerText,
    },
    modalClose: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(255,255,255,0.14)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalBody: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    modalSubject: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 16,
      lineHeight: 24,
    },

    /* ── Info Grid ── */
    infoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 20,
    },
    infoCell: {
      width: "47%",
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 13,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    infoCellIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
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
      marginTop: 3,
      textAlign: "center",
    },

    /* ── Section ── */
    section: {
      marginBottom: 20,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
      gap: 8,
    },
    sectionIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.accentLight,
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
      borderRadius: 14,
      padding: 14,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    messageText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 21,
    },

    /* ── Status Grid ── */
    statusGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    statusOption: {
      width: "47%",
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1.5,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    statusOptionIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: "center",
      alignItems: "center",
    },
    statusOptionText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },

    /* ── Conversation ── */
    conversationWrap: {
      marginTop: 2,
    },
    bubbleRow: {
      flexDirection: "row",
      marginBottom: 12,
    },
    bubble: {
      maxWidth: "82%",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
    },
    adminBubble: {
      backgroundColor: colors.accent,
      borderBottomRightRadius: 4,
    },
    customerBubble: {
      backgroundColor: colors.background,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: colors.borderLight,
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
      paddingVertical: 28,
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderStyle: "dashed",
    },
    noRepliesText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: "center",
      paddingHorizontal: 20,
      lineHeight: 18,
    },

    /* ── Reply Input ── */
    replyInput: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 13,
      color: colors.inputText,
      textAlignVertical: "top",
      minHeight: 88,
      marginBottom: 10,
    },
    sendBtn: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 15,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    sendBtnText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
  });

export default AdminSupportTicketsScreen;
