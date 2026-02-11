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

const MyBugReportsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { state } = useContext(AuthContext);
  const [bugReports, setBugReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [newResponse, setNewResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBugReports();
    const unsubscribe = navigation.addListener("focus", () => {
      fetchBugReports();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchBugReports = async () => {
    try {
      setLoading(true);
      const response = await supportService.getUserBugReports();
      setBugReports(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error("Error fetching bug reports:", error);
      Alert.alert("Error", "Failed to load your bug reports");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchBugReports().then(() => setRefreshing(false));
  }, []);

  const handleViewDetails = async (report) => {
    try {
      const response = await supportService.getBugReportDetails(
        report.id || report._id,
      );
      setSelectedReport(response?.data || response);
      setDetailsVisible(true);
      try {
        await supportService.markBugReportAsRead(report.id || report._id);
        setBugReports(
          bugReports.map((r) =>
            (r.id || r._id) === (report.id || report._id)
              ? { ...r, isReadByUser: true }
              : r,
          ),
        );
      } catch (error) {
        console.error("Error marking bug report as read:", error);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load bug report details");
    }
  };

  const handleAddResponse = async () => {
    if (!newResponse.trim()) {
      Alert.alert("Validation", "Please enter your message");
      return;
    }
    setSubmitting(true);
    try {
      await supportService.addBugReportResponse(
        selectedReport.id || selectedReport._id,
        newResponse,
      );
      Alert.alert("Success", "Response added successfully");
      setNewResponse("");
      const response = await supportService.getBugReportDetails(
        selectedReport.id || selectedReport._id,
      );
      setSelectedReport(response?.data || response);
      setBugReports(
        bugReports.map((r) =>
          (r.id || r._id) === (selectedReport.id || selectedReport._id)
            ? { ...r, isReadByAdmin: false }
            : r,
        ),
      );
    } catch (error) {
      Alert.alert("Error", "Failed to add response");
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Helpers ─── */
  const getSeverityConfig = (severity) => {
    switch (severity) {
      case "critical":
        return {
          color: "#991b1b",
          bg: colors.errorBg,
          label: "Critical",
          icon: "alert-circle",
        };
      case "high":
        return {
          color: colors.error,
          bg: colors.errorBg,
          label: "High",
          icon: "warning-outline",
        };
      case "medium":
        return {
          color: colors.warning,
          bg: colors.warningBg,
          label: "Medium",
          icon: "alert-outline",
        };
      case "low":
        return {
          color: colors.success,
          bg: colors.successBg,
          label: "Low",
          icon: "information-circle-outline",
        };
      default:
        return {
          color: colors.textSecondary,
          bg: colors.cardAlt,
          label: severity || "Unknown",
          icon: "help-circle-outline",
        };
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "new":
        return {
          color: colors.info,
          bg: colors.infoBg,
          label: "New",
          icon: "sparkles-outline",
        };
      case "in-review":
        return {
          color: colors.warning,
          bg: colors.warningBg,
          label: "In Review",
          icon: "eye-outline",
        };
      case "acknowledged":
        return {
          color: "#8b5cf6",
          bg: colors.purpleBg,
          label: "Acknowledged",
          icon: "checkmark-done-outline",
        };
      case "fixed":
        return {
          color: colors.success,
          bg: colors.successBg,
          label: "Fixed",
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

  const getModuleIcon = (module) => {
    const m = (module || "").toLowerCase();
    if (m.includes("bill") || m.includes("payment")) return "card-outline";
    if (m.includes("room")) return "home-outline";
    if (m.includes("auth") || m.includes("login")) return "lock-closed-outline";
    if (m.includes("notification")) return "notifications-outline";
    if (m.includes("profile") || m.includes("account")) return "person-outline";
    return "bug-outline";
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

  const safeCapitalize = (str) => {
    if (!str || typeof str !== "string") return "";
    return str
      .split("-")
      .map((w) => (w.charAt(0) || "").toUpperCase() + w.slice(1))
      .join(" ");
  };

  /* ─── Loading ─── */
  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading bug reports…</Text>
      </View>
    );
  }

  /* ─── Render Card ─── */
  const renderReport = ({ item }) => {
    const sc = getStatusConfig(item.status);
    const sev = getSeverityConfig(item.severity);
    const hasUnread =
      !item.isReadByUser && item.responses && item.responses.length > 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleViewDetails(item)}
        activeOpacity={0.7}
      >
        {/* Left icon */}
        <View style={[styles.cardIcon, { backgroundColor: sev.bg }]}>
          <Ionicons
            name={getModuleIcon(item.module)}
            size={18}
            color={sev.color}
          />
        </View>

        {/* Content */}
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {hasUnread && <View style={styles.unreadDot} />}
          </View>

          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.cardMeta}>
            {/* Severity */}
            <View style={[styles.pill, { backgroundColor: sev.bg }]}>
              <Ionicons name={sev.icon} size={10} color={sev.color} />
              <Text style={[styles.pillText, { color: sev.color }]}>
                {sev.label}
              </Text>
            </View>

            {/* Status */}
            <View style={[styles.pill, { backgroundColor: sc.bg }]}>
              <Ionicons name={sc.icon} size={10} color={sc.color} />
              <Text style={[styles.pillText, { color: sc.color }]}>
                {sc.label}
              </Text>
            </View>

            {/* Responses */}
            <View style={styles.metaItem}>
              <Ionicons name="chatbubble-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.metaText}>{item.responses?.length || 0}</Text>
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
      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Ionicons name="bug-outline" size={16} color={colors.accent} />
        <Text style={styles.summaryText}>
          {bugReports.length} {bugReports.length === 1 ? "report" : "reports"}
        </Text>
      </View>

      {/* Empty */}
      {bugReports.length === 0 ? (
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
              name="bug-outline"
              size={48}
              color={colors.textSecondary}
            />
          </View>
          <Text style={styles.emptyTitle}>No Bug Reports</Text>
          <Text style={styles.emptyText}>
            When you report a bug, it will appear here.
          </Text>
          <TouchableOpacity style={styles.emptyRefresh} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={16} color={colors.accent} />
            <Text style={styles.emptyRefreshText}>Refresh</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          data={bugReports}
          renderItem={renderReport}
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

      {/* ─── Bug Report Details Modal ─── */}
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
                <Text style={styles.modalTitle}>Bug Report Details</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {selectedReport?.title}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setDetailsVisible(false)}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedReport && (
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 30 }}
              >
                {/* Info pills */}
                <View style={styles.infoPillRow}>
                  {(() => {
                    const sc = getStatusConfig(selectedReport.status);
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
                    const sev = getSeverityConfig(selectedReport.severity);
                    return (
                      <View
                        style={[styles.infoPill, { backgroundColor: sev.bg }]}
                      >
                        <Ionicons name={sev.icon} size={13} color={sev.color} />
                        <Text
                          style={[styles.infoPillText, { color: sev.color }]}
                        >
                          {sev.label} Severity
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
                      name={getModuleIcon(selectedReport.module)}
                      size={13}
                      color={colors.accent}
                    />
                    <Text
                      style={[styles.infoPillText, { color: colors.accent }]}
                    >
                      {selectedReport.module}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Description</Text>
                  <View style={styles.descriptionBox}>
                    <Text style={styles.descriptionBoxText}>
                      {selectedReport.description}
                    </Text>
                  </View>
                </View>

                {/* Conversation */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    Team Responses ({selectedReport.responses?.length || 0})
                  </Text>

                  {selectedReport.responses &&
                  selectedReport.responses.length > 0 ? (
                    selectedReport.responses.map((resp, index) => {
                      const isUser = resp.from === "user";
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
                                {isUser ? "You" : "Dev Team"}
                              </Text>
                              <Text
                                style={[
                                  styles.bubbleTime,
                                  isUser
                                    ? { color: "rgba(255,255,255,0.7)" }
                                    : { color: "#94a3b8" },
                                ]}
                              >
                                {formatTimeAgo(resp.createdAt)}
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
                              {resp.message}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.noRepliesWrap}>
                      <Ionicons
                        name="construct-outline"
                        size={24}
                        color={colors.textTertiary}
                      />
                      <Text style={styles.noRepliesText}>
                        No responses yet. Team is working on it!
                      </Text>
                    </View>
                  )}
                </View>

                {/* Comment input */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Add Comment</Text>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Add additional information about the bug…"
                    placeholderTextColor={colors.placeholder}
                    multiline
                    numberOfLines={4}
                    value={newResponse}
                    onChangeText={setNewResponse}
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
                      {submitting ? "Posting…" : "Post Comment"}
                    </Text>
                  </TouchableOpacity>
                </View>
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

    /* Summary */
    summaryBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
      gap: 6,
    },
    summaryText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
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
    cardDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
      marginBottom: 8,
    },
    cardMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
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

    /* Description box */
    descriptionBox: {
      backgroundColor: colors.cardAlt,
      borderRadius: 12,
      padding: 14,
      borderLeftWidth: 3,
      borderLeftColor: "#b38604",
    },
    descriptionBoxText: {
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

export default MyBugReportsScreen;
