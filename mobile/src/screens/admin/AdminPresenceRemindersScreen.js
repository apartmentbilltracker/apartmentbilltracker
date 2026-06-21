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
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { apiService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import {
  ScrollViewWithDetection,
  FlatListWithDetection,
} from "../../components/ScrollDetectionWrappers";
import HomeSpaceLoader from "../../components/SpaceLoader";

const formatShortDate = (date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const AdminPresenceRemindersScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const route = useRoute();
  const { room } = route.params || {};

  const [membersWithoutPresence, setMembersWithoutPresence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customMessageModalVisible, setCustomMessageModalVisible] =
    useState(false);
  const [sending, setSending] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [customMessage, setCustomMessage] = useState("");
  const [bulkMode, setBulkMode] = useState(false);

  const fetchMembersWithoutPresence = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get(
        `/api/v2/admin/reminders/presence/${room?.id || room?._id}`,
      );
      setMembersWithoutPresence(response.membersWithoutPresence || []);
    } catch (error) {
      console.error("Error fetching members:", error);
      Alert.alert("Error", "Failed to load members without presence");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [room?.id || room?._id]);

  useEffect(() => {
    fetchMembersWithoutPresence();
  }, [fetchMembersWithoutPresence]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMembersWithoutPresence();
  }, [fetchMembersWithoutPresence]);

  const handleSendReminder = async (member) => {
    try {
      setSending(true);
      await apiService.post(
        `/api/v2/admin/reminders/send-presence/${room?.id || room?._id}/${member.memberId}`,
        {
          customMessage: customMessage || null,
        },
      );

      Alert.alert("Success", `Presence reminder sent to ${member.memberName}!`);
      setCustomMessage("");
      setCustomMessageModalVisible(false);
      fetchMembersWithoutPresence();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to send reminder",
      );
    } finally {
      setSending(false);
    }
  };

  const handleBulkReminders = async () => {
    if (selectedMembers.size === 0) {
      Alert.alert("Error", "Please select at least one member");
      return;
    }

    try {
      setSending(true);
      await apiService.post(
        `/api/v2/admin/reminders/send-presence-bulk/${room?.id || room?._id}`,
        {
          customMessage: customMessage || null,
        },
      );

      Alert.alert(
        "Success",
        `Presence reminders sent to ${selectedMembers.size} members!`,
      );
      setCustomMessage("");
      setSelectedMembers(new Set());
      setCustomMessageModalVisible(false);
      setBulkMode(false);
      fetchMembersWithoutPresence();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to send reminders",
      );
    } finally {
      setSending(false);
    }
  };

  const toggleMemberSelection = (memberId) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const missingCount = membersWithoutPresence.length;
  const selectedCount = selectedMembers.size;

  const renderMember = ({ item }) => {
    const isSelected = selectedMembers.has(item.memberId);
    const initials = (item.memberName || "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          if (bulkMode) {
            toggleMemberSelection(item.memberId);
          }
        }}
        style={[
          styles.memberCard,
          isSelected && bulkMode && styles.memberCardSelected,
        ]}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            {bulkMode && (
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
            )}
            <View
              style={[
                styles.memberAvatar,
                {
                  backgroundColor:
                    isSelected && bulkMode
                      ? colors.accentSurface
                      : colors.inputBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  {
                    color:
                      isSelected && bulkMode
                        ? colors.accent
                        : colors.textSecondary,
                  },
                ]}
              >
                {initials}
              </Text>
            </View>
            <View style={styles.memberIdentity}>
              <Text style={styles.memberName} numberOfLines={1}>
                {item.memberName}
              </Text>
              <Text style={styles.memberEmail} numberOfLines={1}>
                {item.memberEmail}
              </Text>
            </View>
          </View>

          {!bulkMode && (
            <TouchableOpacity
              style={styles.sendCardBtn}
              activeOpacity={0.7}
              onPress={() => {
                setSelectedMembers(new Set([item.memberId]));
                setCustomMessageModalVisible(true);
              }}
            >
              <Ionicons name="send" size={13} color={colors.textOnAccent} />
              <Text style={styles.sendCardText}>Send</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusChip}>
            <Ionicons name="close-circle" size={12} color={colors.error} />
            <Text style={styles.statusChipText}>Not marked today</Text>
          </View>
          <View style={styles.dateChip}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color={colors.textTertiary}
            />
            <Text style={styles.dateChipText}>
              {formatShortDate(new Date())}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && membersWithoutPresence.length === 0) {
    return (
      <View style={styles.centerWrap}>
        <View style={styles.centerLoader}>
          <HomeSpaceLoader />
        </View>
      </View>
    );
  }

  const hasSelection = bulkMode && selectedMembers.size > 0;
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summaryPanel}>
        <View style={styles.summaryTopRow}>
          <View style={styles.summaryIconWrap}>
            <Ionicons name="hand-left" size={20} color={colors.textOnAccent} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryEyebrow} numberOfLines={1}>
              Presence Reminders
            </Text>
            <Text style={styles.summaryTitle} numberOfLines={1}>
              {room?.name || "Selected Room"}
            </Text>
          </View>
          {missingCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{missingCount}</Text>
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
              {missingCount}
            </Text>
            <Text style={styles.summaryStatLabel}>Missing</Text>
          </View>
          <View style={styles.summaryStatCard}>
            <Text
              style={styles.summaryStatValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {formatShortDate(new Date())}
            </Text>
            <Text style={styles.summaryStatLabel}>Today</Text>
          </View>
          <View style={styles.summaryStatCard}>
            <Text
              style={styles.summaryStatValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {bulkMode ? selectedCount : "1:1"}
            </Text>
            <Text style={styles.summaryStatLabel}>
              {bulkMode ? "Selected" : "Mode"}
            </Text>
          </View>
        </View>
      </View>
      {membersWithoutPresence.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="checkmark-done-circle"
              size={36}
              color={colors.success}
            />
          </View>
          <Text style={styles.emptyTitle}>All Present!</Text>
          <Text style={styles.emptySubtitle}>
            Every member has already marked their presence for today.
          </Text>
        </View>
      ) : (
        <>
        {/* Mode Toggle */}
        <View style={styles.modeBar}>
          <TouchableOpacity
            style={[styles.modeBtn, !bulkMode && styles.modeBtnActive]}
            activeOpacity={0.7}
            onPress={() => {
              setBulkMode(false);
              setSelectedMembers(new Set());
            }}
          >
            <Ionicons
              name="person"
              size={14}
              color={!bulkMode ? "#fff" : "#999"}
            />
            <Text
              style={[
                styles.modeBtnText,
                !bulkMode && styles.modeBtnTextActive,
              ]}
            >
              Individual
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, bulkMode && styles.modeBtnActive]}
            activeOpacity={0.7}
            onPress={() => {
              setBulkMode(true);
              setSelectedMembers(new Set());
            }}
          >
            <Ionicons
              name="people"
              size={14}
              color={bulkMode ? "#fff" : "#999"}
            />
            <Text
              style={[styles.modeBtnText, bulkMode && styles.modeBtnTextActive]}
            >
              Bulk
            </Text>
          </TouchableOpacity>
          {hasSelection && (
            <View style={styles.selectionChip}>
              <Text style={styles.selectionChipText}>
                {selectedMembers.size} selected
              </Text>
            </View>
          )}
        </View>

        <FlatListWithDetection
          data={membersWithoutPresence}
          renderItem={renderMember}
          keyExtractor={(item) => item.memberId}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintcolor={colors.accent}
              colors={["#b38604"]}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: hasSelection ? 96 : 24,
          }}
          showsVerticalScrollIndicator={false}
        />

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
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.textOnAccent} />
              ) : (
                <>
                  <Ionicons name="send" size={14} color={colors.textOnAccent} />
                  <Text style={styles.bulkSendText}>
                    Send to {selectedMembers.size}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
        </>
      )}

      {/* Send Reminder Modal */}
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
                  <Ionicons name="hand-left" size={18} color={colors.accent} />
                </View>
                <View style={styles.modalTitleCopy}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {bulkMode
                      ? `Send to ${selectedMembers.size} Members`
                      : "Presence Reminder"}
                  </Text>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {room?.name || "Room"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => {
                  setCustomMessageModalVisible(false);
                  setCustomMessage("");
                  if (!bulkMode) setSelectedMembers(new Set());
                }}
              >
                <Ionicons name="close" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollViewWithDetection
              style={styles.form}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.formLabel}>Custom Message (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add a custom message to the reminder..."
                placeholderTextColor={colors.textTertiary}
                value={customMessage}
                onChangeText={setCustomMessage}
                multiline
                numberOfLines={4}
              />

              <View style={styles.hintRow}>
                <Ionicons
                  name="information-circle-outline"
                  size={13}
                  color={colors.textTertiary}
                />
                <Text style={styles.formHint}>
                  If empty, the formal default message below will be sent.
                </Text>
              </View>

              <View style={styles.previewBox}>
                <View style={styles.previewHeader}>
                  <Ionicons
                    name="document-text-outline"
                    size={13}
                    color={colors.accent}
                  />
                  <Text style={styles.previewLabel}>
                    Default Message Preview
                  </Text>
                </View>
                <Text style={styles.previewText}>
                  Dear [Member Name],{"\n\n"}We hope you are doing well. This is
                  a friendly reminder to please mark your daily presence for
                  today, {today}, in the PropFlow application.
                  {"\n\n"}Room: {room?.name || "[Room Name]"}
                  {"\n\n"}Accurate attendance records are essential for
                  computing fair and transparent billing among all room
                  occupants. Marking your presence each day ensures that utility
                  costs are distributed proportionally based on actual
                  occupancy.{"\n\n"}
                  If you have already recorded your attendance for today, please
                  disregard this notice.{"\n\n"}Thank you for your cooperation.
                  {"\n\n"}Best regards,{"\n"}
                  {room?.name || "[Room]"} Management
                </Text>
              </View>
            </ScrollViewWithDetection>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                activeOpacity={0.7}
                onPress={() => {
                  setCustomMessageModalVisible(false);
                  setCustomMessage("");
                  if (!bulkMode) setSelectedMembers(new Set());
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, sending && { opacity: 0.6 }]}
                activeOpacity={0.7}
                onPress={() => {
                  if (bulkMode) {
                    handleBulkReminders();
                  } else {
                    const member = membersWithoutPresence.find(
                      (m) => m.memberId === Array.from(selectedMembers)[0],
                    );
                    if (member) {
                      handleSendReminder(member);
                    }
                  }
                }}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.textOnAccent} />
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

    /* ── Mode Toggle ── */
    modeBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 14,
      marginBottom: 4,
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: 6,
    },
    modeBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 13,
    },
    modeBtnActive: {
      backgroundColor: colors.accent,
      borderColor: "#b38604",
    },
    modeBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    modeBtnTextActive: { color: "#fff" },
    selectionChip: {
      backgroundColor: colors.accentSurface,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
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
      alignItems: "center",
      gap: 10,
    },
    cardTopLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      minWidth: 0,
      gap: 10,
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
    },
    memberName: { fontSize: 15, fontWeight: "800", color: colors.text },
    memberEmail: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
    statusRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      marginTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
      paddingTop: 10,
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.errorBg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statusChipText: { fontSize: 11, fontWeight: "600", color: "#e53935" },
    dateChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    dateChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    sendCardBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      flexShrink: 0,
    },
    sendCardText: { fontSize: 12, fontWeight: "700", color: "#fff" },

    /* ── Bulk Bar ── */
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

    /* ── Modal ── */
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
    modalTitleCopy: {
      flex: 1,
      minWidth: 0,
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
    form: { maxHeight: 420 },
    formLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
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
      marginBottom: 14,
    },
    formHint: { fontSize: 11, color: colors.textTertiary, fontStyle: "italic" },
    previewBox: {
      backgroundColor: colors.cardAlt,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    previewHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    previewLabel: { fontSize: 11, fontWeight: "700", color: colors.accent },
    previewText: { fontSize: 11, color: colors.textSecondary, lineHeight: 17 },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
      marginTop: 16,
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
  });

export default AdminPresenceRemindersScreen;
