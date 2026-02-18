import React, { useState, useEffect, useMemo } from "react";
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
const BG = "#f5f6fa";
const TEXT = "#1a1a2e";
const CARD = "#fff";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const AdminBugReportsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBug, setSelectedBug] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchAllBugReports();
    const unsubscribe = navigation.addListener("focus", () => {
      fetchAllBugReports();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchAllBugReports = async () => {
    setLoading(true);
    try {
      const response = await supportService.getAllBugReports();
      setBugs(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error("Error fetching bug reports:", error);
      Alert.alert("Error", "Failed to load bug reports");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await supportService.getAllBugReports();
      setBugs(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleBugPress = async (bugId) => {
    try {
      const details = await supportService.getBugReportDetails(bugId);
      setSelectedBug(details?.data || details);
      setNewStatus(details?.data?.status || details?.status);
      setModalVisible(true);
      try {
        await supportService.markBugReportAsRead(bugId);
        setBugs(
          bugs.map((b) =>
            (b.id || b._id) === bugId ? { ...b, isReadByAdmin: true } : b,
          ),
        );
      } catch (error) {
        console.error("Error marking bug report as read:", error);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load bug details");
    }
  };

  const handleAddResponse = async () => {
    if (!responseText.trim()) {
      Alert.alert("Validation", "Please enter a response message");
      return;
    }
    setSubmitting(true);
    try {
      await supportService.addBugReportResponse(
        selectedBug.id || selectedBug._id,
        responseText,
      );
      const updatedBug = {
        ...selectedBug,
        responses: [
          ...(selectedBug.responses || []),
          { from: "admin", message: responseText, createdAt: new Date() },
        ],
        isReadByAdmin: false,
      };
      setSelectedBug(updatedBug);
      setResponseText("");
      Alert.alert("Success", "Response added successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to add response");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (status) => {
    setSubmitting(true);
    try {
      await supportService.updateBugReportStatus(
        selectedBug.id || selectedBug._id,
        status,
      );
      const updatedBug = { ...selectedBug, status };
      setSelectedBug(updatedBug);
      setNewStatus(status);
      Alert.alert("Success", "Bug status updated");
    } catch (error) {
      Alert.alert("Error", "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "critical":
        return "#dc2626";
      case "high":
        return "#ef4444";
      case "medium":
        return "#f59e0b";
      case "low":
        return "#10b981";
      default:
        return "#6b7280";
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case "critical":
        return "nuclear";
      case "high":
        return "flame";
      case "medium":
        return "warning";
      case "low":
        return "leaf";
      default:
        return "help-circle";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "new":
        return "#3b82f6";
      case "in-review":
        return "#f59e0b";
      case "acknowledged":
        return "#8b5cf6";
      case "fixed":
        return "#10b981";
      case "closed":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "new":
        return "sparkles";
      case "in-review":
        return "eye";
      case "acknowledged":
        return "checkmark-done";
      case "fixed":
        return "checkmark-circle";
      case "closed":
        return "lock-closed";
      default:
        return "help-circle";
    }
  };

  const filteredBugs = bugs.filter((b) => {
    const severityMatch =
      severityFilter === "all" || b.severity === severityFilter;
    const statusMatch = statusFilter === "all" || b.status === statusFilter;
    return severityMatch && statusMatch;
  });

  const bugCounts = {
    total: bugs.length,
    critical: bugs.filter((b) => b.severity === "critical").length,
    high: bugs.filter((b) => b.severity === "high").length,
    open: bugs.filter((b) => b.status === "new" || b.status === "in-review")
      .length,
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.loadingIconWrap}>
          <Ionicons name="bug-outline" size={32} color={GOLD} />
        </View>
        <ActivityIndicator
          size="large"
          color={GOLD}
          style={{ marginTop: 16 }}
        />
        <Text style={styles.loadingText}>Loading bug reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{bugCounts.total}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: "#dc2626" }]}>
            {bugCounts.critical}
          </Text>
          <Text style={styles.summaryLabel}>Critical</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: "#ef4444" }]}>
            {bugCounts.high}
          </Text>
          <Text style={styles.summaryLabel}>High</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: "#3b82f6" }]}>
            {bugCounts.open}
          </Text>
          <Text style={styles.summaryLabel}>Open</Text>
        </View>
      </View>

      {/* Severity Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.filterRow}
      >
        <Text style={styles.filterLabel}>Severity:</Text>
        {[
          { key: "all", label: "All", icon: "list" },
          { key: "critical", label: "Critical", icon: "nuclear" },
          { key: "high", label: "High", icon: "flame" },
          { key: "medium", label: "Medium", icon: "warning" },
          { key: "low", label: "Low", icon: "leaf" },
        ].map((tab) => {
          const active = severityFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setSeverityFilter(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={13}
                color={active ? "#fff" : MUTED}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bug Reports List */}
      <FlatList
        data={filteredBugs}
        keyExtractor={(item) => item.id || item._id}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[GOLD]}
            tintColor={GOLD}
          />
        }
        renderItem={({ item }) => {
          const sevColor = getSeverityColor(item.severity);
          const statColor = getStatusColor(item.status);
          const hasUnread =
            !item.isReadByAdmin && item.responses && item.responses.length > 0;
          return (
            <TouchableOpacity
              style={styles.bugCard}
              onPress={() => handleBugPress(item.id || item._id)}
              activeOpacity={0.7}
            >
              {/* Left accent bar */}
              <View
                style={[styles.cardAccent, { backgroundColor: sevColor }]}
              />

              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.bugTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.reporterRow}>
                      <Ionicons name="person-outline" size={12} color={MUTED} />
                      <Text style={styles.bugReporter}>{item.userName}</Text>
                    </View>
                  </View>

                  <View style={styles.badgeColumn}>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: sevColor + "15" },
                      ]}
                    >
                      <Ionicons
                        name={getSeverityIcon(item.severity)}
                        size={11}
                        color={sevColor}
                      />
                      <Text style={[styles.badgeText, { color: sevColor }]}>
                        {item.severity?.charAt(0).toUpperCase() +
                          item.severity?.slice(1)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: statColor + "15" },
                      ]}
                    >
                      <Ionicons
                        name={getStatusIcon(item.status)}
                        size={11}
                        color={statColor}
                      />
                      <Text style={[styles.badgeText, { color: statColor }]}>
                        {item.status
                          ?.split("-")
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(" ")}
                      </Text>
                    </View>
                    {hasUnread && <View style={styles.unreadDot} />}
                  </View>
                </View>

                <View style={styles.cardSeparator} />

                <View style={styles.cardMetaRow}>
                  <View style={styles.metaChip}>
                    <Ionicons name="cube-outline" size={12} color={MUTED} />
                    <Text style={styles.metaText}>{item.module}</Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={12}
                      color={GOLD}
                    />
                    <Text style={[styles.metaText, { color: GOLD }]}>
                      {(item.responses || []).length} responses
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
              <Ionicons name="bug-outline" size={40} color={GOLD} />
            </View>
            <Text style={styles.emptyTitle}>No Bug Reports</Text>
            <Text style={styles.emptySub}>No reports match your filters</Text>
          </View>
        }
      />

      {/* Bug Details Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="bug-outline" size={22} color={GOLD} />
              </View>
              <Text style={styles.modalTitle}>Bug Report Details</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>

            {selectedBug && (
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 30 }}
              >
                {/* Bug Title */}
                <Text style={styles.modalSubject}>{selectedBug.title}</Text>

                {/* Info Grid */}
                <View style={styles.infoGrid}>
                  <View style={styles.infoCell}>
                    <View
                      style={[
                        styles.infoCellIcon,
                        { backgroundColor: GOLD + "18" },
                      ]}
                    >
                      <Ionicons name="person-outline" size={16} color={GOLD} />
                    </View>
                    <Text style={styles.infoCellLabel}>Reporter</Text>
                    <Text style={styles.infoCellValue} numberOfLines={1}>
                      {selectedBug.userName}
                    </Text>
                  </View>
                  <View style={styles.infoCell}>
                    <View
                      style={[
                        styles.infoCellIcon,
                        { backgroundColor: "#10b981" + "18" },
                      ]}
                    >
                      <Ionicons name="mail-outline" size={16} color="#10b981" />
                    </View>
                    <Text style={styles.infoCellLabel}>Email</Text>
                    <Text style={styles.infoCellValue} numberOfLines={1}>
                      {selectedBug.userEmail}
                    </Text>
                  </View>
                  <View style={styles.infoCell}>
                    <View
                      style={[
                        styles.infoCellIcon,
                        { backgroundColor: "#8b5cf6" + "18" },
                      ]}
                    >
                      <Ionicons name="cube-outline" size={16} color="#8b5cf6" />
                    </View>
                    <Text style={styles.infoCellLabel}>Module</Text>
                    <Text style={styles.infoCellValue}>
                      {selectedBug.module?.charAt(0).toUpperCase() +
                        selectedBug.module?.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.infoCell}>
                    <View
                      style={[
                        styles.infoCellIcon,
                        {
                          backgroundColor:
                            getSeverityColor(selectedBug.severity) + "18",
                        },
                      ]}
                    >
                      <Ionicons
                        name={getSeverityIcon(selectedBug.severity)}
                        size={16}
                        color={getSeverityColor(selectedBug.severity)}
                      />
                    </View>
                    <Text style={styles.infoCellLabel}>Severity</Text>
                    <Text
                      style={[
                        styles.infoCellValue,
                        { color: getSeverityColor(selectedBug.severity) },
                      ]}
                    >
                      {selectedBug.severity?.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconWrap}>
                      <Ionicons
                        name="document-text-outline"
                        size={16}
                        color={GOLD}
                      />
                    </View>
                    <Text style={styles.sectionTitle}>Description</Text>
                  </View>
                  <View style={styles.messageBox}>
                    <Text style={styles.messageText}>
                      {selectedBug.description}
                    </Text>
                  </View>
                </View>

                {/* Status Update */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconWrap}>
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={16}
                        color={GOLD}
                      />
                    </View>
                    <Text style={styles.sectionTitle}>Update Status</Text>
                  </View>
                  <View style={styles.statusGrid}>
                    {[
                      "new",
                      "in-review",
                      "acknowledged",
                      "fixed",
                      "closed",
                    ].map((status) => {
                      const active = newStatus === status;
                      const sCol = getStatusColor(status);
                      return (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusOption,
                            active && {
                              backgroundColor: sCol,
                              borderColor: sCol,
                            },
                          ]}
                          onPress={() => handleStatusChange(status)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={getStatusIcon(status)}
                            size={16}
                            color={active ? "#fff" : sCol}
                          />
                          <Text
                            style={[
                              styles.statusOptionText,
                              active && { color: colors.textOnAccent },
                            ]}
                          >
                            {status
                              .split("-")
                              .map(
                                (w) => w.charAt(0).toUpperCase() + w.slice(1),
                              )
                              .join(" ")}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Timeline / Responses */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconWrap}>
                      <Ionicons
                        name="chatbubbles-outline"
                        size={16}
                        color={GOLD}
                      />
                    </View>
                    <Text style={styles.sectionTitle}>
                      Timeline ({(selectedBug.responses || []).length})
                    </Text>
                  </View>

                  {/* Original Report */}
                  <View style={styles.timelineItem}>
                    <View
                      style={[
                        styles.timelineDot,
                        {
                          backgroundColor: getSeverityColor(
                            selectedBug.severity,
                          ),
                        },
                      ]}
                    >
                      <Ionicons
                        name="bug-outline"
                        size={14}
                        color={colors.textOnAccent}
                      />
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineFrom}>Bug Report</Text>
                      <Text style={styles.timelineText} numberOfLines={3}>
                        {selectedBug.description}
                      </Text>
                      <Text style={styles.timelineTime}>
                        {new Date(selectedBug.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {/* Responses */}
                  {(selectedBug.responses || []).map((response, index) => {
                    const isAdmin = response.from === "admin";
                    return (
                      <View
                        key={index}
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
                            isAdmin ? styles.adminBubble : styles.userBubble,
                          ]}
                        >
                          <View style={styles.bubbleHeader}>
                            <View style={styles.bubbleSenderRow}>
                              <Ionicons
                                name={
                                  isAdmin ? "build-outline" : "person-outline"
                                }
                                size={12}
                                color={isAdmin ? "#fff" : TEXT}
                              />
                              <Text
                                style={[
                                  styles.bubbleSender,
                                  isAdmin && { color: colors.textOnAccent },
                                ]}
                              >
                                {isAdmin ? "You (Admin)" : selectedBug.userName}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.bubbleTime,
                                isAdmin && { color: "rgba(255,255,255,0.7)" },
                              ]}
                            >
                              {new Date(response.createdAt).toLocaleString()}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.bubbleText,
                              isAdmin && { color: colors.textOnAccent },
                            ]}
                          >
                            {response.message}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Response Input */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconWrap}>
                      <Ionicons
                        name="return-down-forward-outline"
                        size={16}
                        color={GOLD}
                      />
                    </View>
                    <Text style={styles.sectionTitle}>Add Response</Text>
                  </View>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Type your response here..."
                    placeholderTextColor={colors.placeholder}
                    multiline
                    numberOfLines={4}
                    value={responseText}
                    onChangeText={setResponseText}
                    editable={!submitting}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, submitting && { opacity: 0.6 }]}
                    onPress={handleAddResponse}
                    disabled={submitting}
                    activeOpacity={0.8}
                  >
                    {submitting ? (
                      <ActivityIndicator
                        color={colors.textOnAccent}
                        size="small"
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="send"
                          size={18}
                          color={colors.textOnAccent}
                        />
                        <Text style={styles.sendBtnText}>Send Response</Text>
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

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
    loadingText: { marginTop: 12, color: MUTED, fontSize: 14 },

    /* Summary */
    summaryStrip: {
      flexDirection: "row",
      backgroundColor: CARD,
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 8,
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        android: { elevation: 3 },
      }),
    },
    summaryItem: { flex: 1, alignItems: "center" },
    summaryValue: { fontSize: 20, fontWeight: "800", color: GOLD },
    summaryLabel: {
      fontSize: 11,
      color: MUTED,
      marginTop: 2,
      fontWeight: "500",
    },
    summaryDivider: {
      width: StyleSheet.hairlineWidth,
      height: 28,
      backgroundColor: BORDER,
    },

    /* Filters */
    filterRow: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      alignItems: "center",
    },
    filterLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: TEXT,
      marginRight: 4,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: CARD,
      borderWidth: 1,
      borderColor: BORDER,
    },
    filterChipActive: { backgroundColor: GOLD, borderColor: GOLD },
    filterChipText: { fontSize: 12, color: MUTED, fontWeight: "600" },
    filterChipTextActive: { color: "#fff" },

    /* Bug Cards */
    bugCard: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginBottom: 10,
      borderRadius: 14,
      backgroundColor: CARD,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
    cardAccent: { width: 4 },
    cardBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
    cardTopRow: { flexDirection: "row", alignItems: "flex-start" },
    bugTitle: { fontSize: 15, fontWeight: "700", color: TEXT, marginBottom: 4 },
    reporterRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    bugReporter: { fontSize: 12, color: MUTED },
    badgeColumn: { alignItems: "flex-end", gap: 4 },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 4,
    },
    badgeText: { fontSize: 10, fontWeight: "700" },
    unreadDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#ef4444",
      borderWidth: 2,
      borderColor: CARD,
    },
    cardSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: BORDER,
      marginVertical: 10,
    },
    cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 11, color: MUTED, fontWeight: "500" },

    /* Empty */
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
    emptyTitle: { fontSize: 16, fontWeight: "700", color: TEXT },
    emptySub: { fontSize: 13, color: MUTED, marginTop: 4 },

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
      backgroundColor: CARD,
      borderRadius: 18,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: { elevation: 8 },
      }),
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: BORDER,
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
    modalTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: TEXT },
    modalClose: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    modalBody: { paddingHorizontal: 16, paddingTop: 10 },
    modalSubject: {
      fontSize: 16,
      fontWeight: "700",
      color: TEXT,
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
    infoCellLabel: { fontSize: 11, color: MUTED, fontWeight: "600" },
    infoCellValue: {
      fontSize: 12,
      color: TEXT,
      fontWeight: "700",
      marginTop: 2,
      textAlign: "center",
    },

    /* Section */
    section: { marginBottom: 18 },
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
    sectionTitle: { fontSize: 14, fontWeight: "700", color: TEXT },
    messageBox: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      borderLeftWidth: 3,
      borderLeftColor: GOLD,
    },
    messageText: { fontSize: 13, color: colors.text, lineHeight: 20 },

    /* Status Grid */
    statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    statusOption: {
      width: "47%",
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: BORDER,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    statusOptionText: { fontSize: 11, fontWeight: "700", color: MUTED },

    /* Timeline */
    timelineItem: { flexDirection: "row", marginBottom: 16 },
    timelineDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    timelineContent: { flex: 1 },
    timelineFrom: {
      fontSize: 12,
      fontWeight: "700",
      color: TEXT,
      marginBottom: 4,
    },
    timelineText: { fontSize: 13, color: MUTED, lineHeight: 19 },
    timelineTime: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },

    /* Conversation Bubbles */
    bubbleRow: { flexDirection: "row", marginBottom: 12 },
    bubble: {
      maxWidth: "82%",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
    },
    adminBubble: { backgroundColor: GOLD, borderBottomRightRadius: 4 },
    userBubble: {
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
    bubbleSenderRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    bubbleSender: { fontSize: 11, fontWeight: "700", color: TEXT },
    bubbleTime: { fontSize: 10, color: MUTED },
    bubbleText: { fontSize: 13, lineHeight: 19, color: TEXT },

    /* Reply Input */
    replyInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 13,
      color: TEXT,
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
    sendBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  });

export default AdminBugReportsScreen;
