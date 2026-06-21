import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import { apiService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
import HomeSpaceLoader from "../../components/SpaceLoader";

const getBillMeta = (c) => ({
  rent: { icon: "home", color: c.success, bg: c.successBg, label: "Rent" },
  electricity: {
    icon: "flash",
    color: c.electricityColor,
    bg: c.accentSurface,
    label: "Electricity",
  },
  water: { icon: "water", color: c.waterColor, bg: c.infoBg, label: "Water" },
  internet: {
    icon: "wifi",
    color: c.internetColor,
    bg: c.purpleBg,
    label: "Internet",
  },
});

const formatCurrency = (value) =>
  `\u20B1${(Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const AdminRemindersScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const BILL_META = getBillMeta(colors);

  const route = useRoute();
  const { room } = route.params || {};

  const [overduePayments, setOverduePayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [reminderHistory, setReminderHistory] = useState(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [customMessageModalVisible, setCustomMessageModalVisible] =
    useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [customMessage, setCustomMessage] = useState("");

  const fetchOverduePayments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get(
        `/api/v2/admin/reminders/overdue/${room?.id || room?._id}`,
      );
      setOverduePayments(response.overduePayments || []);
    } catch (error) {
      console.error("Error fetching overdue payments:", error);
      Alert.alert("Error", "Failed to load overdue payments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [room?.id || room?._id]);

  useEffect(() => {
    fetchOverduePayments();
  }, [fetchOverduePayments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOverduePayments();
  }, [fetchOverduePayments]);

  const fetchReminderHistory = async (member) => {
    try {
      const response = await apiService.get(
        `/api/v2/admin/reminders/history/${room?.id || room?._id}/${member.memberId}`,
      );
      setReminderHistory(response.history);
      setSelectedMember(member);
      setHistoryModalVisible(true);
    } catch (error) {
      Alert.alert("Error", "Failed to load reminder history");
    }
  };

  const handleSendReminder = async (member) => {
    try {
      setBulkSending(true);
      await apiService.post(
        `/api/v2/admin/reminders/send-reminder/${room?.id || room?._id}/${member.memberId}`,
        {
          customMessage: customMessage || null,
        },
      );

      Alert.alert("Success", `Reminder sent to ${member.memberName}!`);
      setCustomMessage("");
      fetchOverduePayments();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to send reminder",
      );
    } finally {
      setBulkSending(false);
    }
  };

  const handleBulkReminders = async () => {
    if (selectedMembers.size === 0) {
      Alert.alert("Error", "Please select at least one member");
      return;
    }

    try {
      setBulkSending(true);
      await apiService.post(
        `/api/v2/admin/reminders/send-bulk-reminders/${room?.id || room?._id}`,
        {
          memberIds: Array.from(selectedMembers),
          customMessage: customMessage || null,
        },
      );

      Alert.alert(
        "Success",
        `Reminders sent to ${selectedMembers.size} member(s)!`,
      );
      setCustomMessage("");
      setSelectedMembers(new Set());
      setCustomMessageModalVisible(false);
      fetchOverduePayments();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to send bulk reminders",
      );
    } finally {
      setBulkSending(false);
    }
  };

  const toggleMemberSelection = (memberId) => {
    const newSelection = new Set(selectedMembers);
    if (newSelection.has(memberId)) {
      newSelection.delete(memberId);
    } else {
      newSelection.add(memberId);
    }
    setSelectedMembers(newSelection);
  };

  const totalOverdueAmount = useMemo(
    () =>
      overduePayments.reduce(
        (sum, member) => sum + Number(member.totalDue || 0),
        0,
      ),
    [overduePayments],
  );

  const longestOverdueDays = useMemo(
    () =>
      overduePayments.reduce(
        (max, member) => Math.max(max, Number(member.daysOverdue || 0)),
        0,
      ),
    [overduePayments],
  );

  const renderMemberCard = (member) => {
    const isSelected = selectedMembers.has(member.memberId);
    const initials = (member.memberName || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => toggleMemberSelection(member.memberId)}
        style={[styles.memberCard, isSelected && styles.memberCardSelected]}
      >
        {/* Header row */}
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View
              style={[styles.checkbox, isSelected && styles.checkboxSelected]}
            >
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={13}
                  color={colors.textOnAccent}
                />
              )}
            </View>
            <View
              style={[
                styles.memberAvatar,
                {
                  backgroundColor: isSelected
                    ? colors.accentSurface
                    : colors.inputBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: isSelected ? colors.accent : colors.textSecondary },
                ]}
              >
                {initials}
              </Text>
            </View>
            <View style={styles.memberIdentity}>
              <Text style={styles.memberName} numberOfLines={1}>
                {member.memberName}
              </Text>
              <Text style={styles.memberEmail} numberOfLines={1}>
                {member.email}
              </Text>
            </View>
          </View>
          <View style={styles.cardTopRight}>
            <Text
              style={styles.memberAmount}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
            >
              ₱{(member.totalDue || 0).toFixed(2)}
            </Text>
            <View style={styles.overdueBadge}>
              <Ionicons name="alert-circle" size={10} color={colors.error} />
              <Text style={styles.overdueText}>
                {member.daysOverdue}d overdue
              </Text>
            </View>
          </View>
        </View>

        {/* Unpaid bills — BILL_META chips */}
        <View style={styles.unpaidRow}>
          {(member.unpaidBills || []).map((bill) => {
            const meta = BILL_META[bill] || {
              icon: "help-circle",
              color: colors.textTertiary,
              bg: colors.inputBg,
              label: bill,
            };
            return (
              <View
                key={bill}
                style={[styles.billChip, { backgroundColor: meta.bg }]}
              >
                <Ionicons name={meta.icon} size={11} color={meta.color} />
                <Text style={[styles.billChipText, { color: meta.color }]}>
                  {meta.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Action buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.cardActionBtn}
            activeOpacity={0.7}
            onPress={() => fetchReminderHistory(member)}
          >
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.internetColor}
            />
            <Text
              style={[styles.cardActionText, { color: colors.internetColor }]}
            >
              History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cardActionBtn, styles.sendActionBtn]}
            activeOpacity={0.7}
            onPress={() => {
              setSelectedMember(member);
              setCustomMessageModalVisible(true);
            }}
          >
            <Ionicons name="send" size={13} color={colors.textOnAccent} />
            <Text style={styles.sendActionText}>Send</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerWrap}>
        <View style={styles.centerLoader}>
          <HomeSpaceLoader />
        </View>
      </View>
    );
  }

  const hasSelection = selectedMembers.size > 0;

  return (
    <View style={styles.container}>
      <ScrollViewWithDetection
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: hasSelection ? 80 : 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintcolor={colors.accent}
            colors={["#b38604"]}
          />
        }
      >
        {/* Summary */}
        <View style={styles.summaryPanel}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryIconWrap}>
              <Ionicons
                name="notifications"
                size={20}
                color={colors.textOnAccent}
              />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryEyebrow} numberOfLines={1}>
                Payment Reminders
              </Text>
              <Text style={styles.summaryTitle} numberOfLines={1}>
                {room?.name || "Selected Room"}
              </Text>
            </View>
            {overduePayments.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {overduePayments.length}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.summaryStatsRow}>
            <View style={styles.summaryStatCard}>
              <Text
                style={styles.summaryStatValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {overduePayments.length}
              </Text>
              <Text style={styles.summaryStatLabel}>Overdue</Text>
            </View>
            <View style={styles.summaryStatCard}>
              <Text
                style={styles.summaryStatValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.62}
              >
                {formatCurrency(totalOverdueAmount)}
              </Text>
              <Text style={styles.summaryStatLabel}>Total Due</Text>
            </View>
            <View style={styles.summaryStatCard}>
              <Text
                style={styles.summaryStatValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {longestOverdueDays}d
              </Text>
              <Text style={styles.summaryStatLabel}>Longest</Text>
            </View>
          </View>
        </View>

        {overduePayments.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="checkmark-done-circle"
                size={36}
                color={colors.success}
              />
            </View>
            <Text style={styles.emptyTitle}>All Clear!</Text>
            <Text style={styles.emptySubtitle}>
              No overdue payments found. All members are up to date.
            </Text>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLeft}>
                <Ionicons name="people" size={15} color={colors.accent} />
                <Text style={styles.sectionTitle}>Overdue Members</Text>
              </View>
              {hasSelection && (
                <View style={styles.selectionChip}>
                  <Text style={styles.selectionChipText}>
                    {selectedMembers.size} selected
                  </Text>
                </View>
              )}
            </View>

            {overduePayments.map((member) => (
              <View key={`${member.memberId}-${member.daysOverdue}`}>
                {renderMemberCard(member)}
              </View>
            ))}
          </View>
        )}
      </ScrollViewWithDetection>

      {/* Bulk action bar */}
      {hasSelection && (
        <View style={styles.bulkBar}>
          <TouchableOpacity
            style={styles.bulkCancelBtn}
            activeOpacity={0.7}
            onPress={() => setSelectedMembers(new Set())}
          >
            <Ionicons
              name="close-circle-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.bulkCancelText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkSendBtn}
            activeOpacity={0.7}
            onPress={() => setCustomMessageModalVisible(true)}
          >
            <Ionicons name="send" size={14} color={colors.textOnAccent} />
            <Text style={styles.bulkSendText}>
              Send to {selectedMembers.size}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* History Modal */}
      <Modal
        visible={historyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderLeft}>
                <View
                  style={[
                    styles.modalIconWrap,
                    { backgroundColor: colors.purpleBg },
                  ]}
                >
                  <Ionicons
                    name="time"
                    size={20}
                    color={colors.internetColor}
                  />
                </View>
                <View>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    Reminder History
                  </Text>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {selectedMember?.memberName}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => {
                  setHistoryModalVisible(false);
                  setSelectedMember(null);
                }}
              >
                <Ionicons name="close" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {reminderHistory ? (
              <View style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <View style={styles.historyIconWrap}>
                    <Ionicons name="mail" size={16} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyLabel}>
                      Total Reminders Sent
                    </Text>
                    <Text style={styles.historyValue}>
                      {reminderHistory.reminderCount || 0}
                    </Text>
                  </View>
                </View>

                <View style={styles.historySep} />

                <View style={styles.historyRow}>
                  <View style={styles.historyIconWrap}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={colors.accent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyLabel}>Last Reminder</Text>
                    {reminderHistory.lastReminderDate ? (
                      <>
                        <Text style={styles.historyValue}>
                          {reminderHistory.daysAgo} days ago
                        </Text>
                        <Text style={styles.historyDate}>
                          {new Date(
                            reminderHistory.lastReminderDate,
                          ).toLocaleDateString()}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.historyValue}>Never sent</Text>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.loadingLabel}>Loading history...</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeModalBtn}
              activeOpacity={0.7}
              onPress={() => {
                setHistoryModalVisible(false);
                setSelectedMember(null);
              }}
            >
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Message Modal */}
      <Modal
        visible={customMessageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomMessageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderLeft}>
                <View
                  style={[
                    styles.modalIconWrap,
                    { backgroundColor: colors.accentSurface },
                  ]}
                >
                  <Ionicons name="send" size={18} color={colors.accent} />
                </View>
                <View>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    Send Reminder
                  </Text>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {selectedMember
                      ? `To: ${selectedMember.memberName}`
                      : `To: ${selectedMembers.size} selected members`}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.form}>
              <Text style={styles.formLabel}>Custom Message (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add a custom message to the reminder..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={4}
                value={customMessage}
                onChangeText={setCustomMessage}
              />

              <View style={styles.hintRow}>
                <Ionicons
                  name="information-circle-outline"
                  size={13}
                  color={colors.textTertiary}
                />
                <Text style={styles.formHint}>
                  If empty, a default reminder will be sent.
                </Text>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    setCustomMessageModalVisible(false);
                    setCustomMessage("");
                    if (!selectedMember) {
                      setSelectedMembers(new Set());
                    }
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, bulkSending && { opacity: 0.6 }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (selectedMember) {
                      handleSendReminder(selectedMember);
                      setCustomMessageModalVisible(false);
                      setSelectedMember(null);
                    } else {
                      handleBulkReminders();
                    }
                  }}
                  disabled={bulkSending}
                >
                  {bulkSending ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.textOnAccent}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="send"
                        size={14}
                        color={colors.textOnAccent}
                      />
                      <Text style={styles.confirmBtnText}>Send</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    /* ── Layout ── */
    container: { flex: 1, backgroundColor: colors.background },
    centerWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    loadingLabel: { fontSize: 13, color: colors.textTertiary, marginTop: 10 },

    /* ── Summary Strip ── */
    summaryStrip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      marginHorizontal: 14,
      marginTop: 14,
      borderRadius: 14,
      padding: 14,
      gap: 10,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        },
        android: { elevation: 2 },
      }),
    },
    stripIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    stripTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    stripSubtitle: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
    summaryPanel: {
      backgroundColor: colors.card,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow || "#000",
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        },
        android: { elevation: 4 },
      }),
    },
    summaryTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    summaryIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0,
    },
    summaryCopy: {
      flex: 1,
      minWidth: 0,
    },
    summaryEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.text,
      marginTop: 3,
    },
    summaryStatsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
    },
    summaryStatCard: {
      flex: 1,
      minWidth: 0,
      borderRadius: 15,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: 10,
      paddingVertical: 11,
    },
    summaryStatValue: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.text,
      includeFontPadding: false,
    },
    summaryStatLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.35,
      marginTop: 5,
      includeFontPadding: false,
    },
    countBadge: {
      backgroundColor: "#e53935",
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 7,
      flexShrink: 0,
    },
    countBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },

    /* ── Empty State ── */
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      marginHorizontal: 14,
      marginTop: 24,
      padding: 32,
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
        },
        android: { elevation: 1 },
      }),
    },
    emptyIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.successBg,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: "center",
      lineHeight: 18,
    },

    /* ── Section ── */
    section: { paddingHorizontal: 14, marginTop: 18 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sectionLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    selectionChip: {
      backgroundColor: colors.accentSurface,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    selectionChipText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.accent,
    },

    /* ── Member Card ── */
    memberCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow || "#000",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
        },
        android: { elevation: 2 },
      }),
    },
    memberCardSelected: {
      borderWidth: 1.5,
      borderColor: "#b38604",
      backgroundColor: colors.warningBg,
    },
    cardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
    },
    cardTopLeft: {
      flexDirection: "row",
      alignItems: "flex-start",
      flex: 1,
      minWidth: 0,
      gap: 10,
    },
    cardTopRight: {
      alignItems: "flex-end",
      gap: 5,
      maxWidth: 118,
      flexShrink: 0,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.cardAlt,
    },
    checkboxSelected: {
      backgroundColor: colors.accent,
      borderColor: "#b38604",
    },
    memberAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0,
    },
    avatarText: { fontSize: 13, fontWeight: "700" },
    memberIdentity: {
      flex: 1,
      minWidth: 0,
      paddingTop: 1,
    },
    memberName: { fontSize: 15, fontWeight: "800", color: colors.text },
    memberEmail: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
    memberAmount: {
      fontSize: 17,
      fontWeight: "900",
      color: colors.accent,
      textAlign: "right",
      width: "100%",
      includeFontPadding: false,
    },
    overdueBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.errorBg,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    overdueText: { fontSize: 10, fontWeight: "700", color: "#e53935" },

    /* ── Unpaid Bill Chips ── */
    unpaidRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 14,
      marginBottom: 14,
    },
    billChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    billChipText: { fontSize: 11, fontWeight: "600" },

    /* ── Card Actions ── */
    cardActions: {
      flexDirection: "row",
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
      paddingTop: 12,
    },
    cardActionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.cardAlt,
    },
    cardActionText: { fontSize: 12, fontWeight: "600" },
    sendActionBtn: {
      backgroundColor: colors.accent,
      borderColor: "#b38604",
      justifyContent: "center",
    },
    sendActionText: { fontSize: 12, fontWeight: "700", color: "#fff" },

    /* ── Bulk Action Bar ── */
    bulkBar: {
      position: "absolute",
      bottom: 12,
      left: 12,
      right: 12,
      flexDirection: "row",
      gap: 10,
      padding: 10,
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow || "#000",
          shadowOpacity: 0.12,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        },
        android: { elevation: 6 },
      }),
    },
    bulkCancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 13,
      backgroundColor: colors.background,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
    },
    bulkCancelText: {
      color: colors.textSecondary,
      fontWeight: "600",
      fontSize: 13,
    },
    bulkSendBtn: {
      flex: 1.4,
      paddingVertical: 12,
      borderRadius: 13,
      backgroundColor: colors.accent,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
    },
    bulkSendText: { color: "#FFF", fontWeight: "700", fontSize: 13 },

    /* ── Modals ── */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 22,
      width: "100%",
      maxHeight: "85%",
    },
    modalHandle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.skeleton,
      alignSelf: "center",
      marginBottom: 16,
    },
    modalHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalHeaderLeft: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingRight: 10,
    },
    modalIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    modalTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
    modalSubtitle: { fontSize: 13, color: colors.textTertiary, marginTop: 1 },

    /* ── History Card ── */
    historyCard: {
      backgroundColor: colors.cardAlt,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    historyRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 8,
    },
    historyIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 2,
    },
    historySep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.skeleton,
      marginVertical: 4,
    },
    historyLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "600",
    },
    historyValue: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginTop: 2,
    },
    historyDate: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },

    /* ── Form ── */
    form: { maxHeight: 400 },
    formLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      marginTop: 8,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.cardAlt,
      marginBottom: 8,
    },
    textArea: { textAlignVertical: "top", minHeight: 80 },
    hintRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 12,
    },
    formHint: { fontSize: 11, color: colors.textTertiary, fontStyle: "italic" },

    /* ── Modal Buttons ── */
    modalButtons: {
      flexDirection: "row",
      gap: 12,
      marginTop: 14,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    cancelBtnText: {
      color: colors.textSecondary,
      fontWeight: "600",
      fontSize: 14,
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.accent,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
    },
    confirmBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
    closeModalBtn: {
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    closeModalBtnText: {
      color: colors.textSecondary,
      fontWeight: "600",
      fontSize: 14,
    },
  });

export default AdminRemindersScreen;
