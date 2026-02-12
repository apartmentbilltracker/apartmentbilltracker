import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import { apiService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const getBillColors = (c) => ({
  electricity: { bg: c.accentSurface, text: c.electricityColor, icon: "flash" },
  water: { bg: c.infoBg, text: c.waterColor, icon: "water" },
  wifi: { bg: c.purpleBg, text: c.internetColor, icon: "wifi" },
  rent: { bg: c.successBg, text: c.success, icon: "home" },
  default: { bg: c.accentSurface, text: c.accent, icon: "receipt" },
});

const AdminPaymentVerificationScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const BILL_COLORS = getBillColors(colors);
  const getBillStyle = (billType) => {
    const key = (billType || "").toLowerCase();
    return BILL_COLORS[key] || BILL_COLORS.default;
  };

  const route = useRoute();
  const { room } = route.params || {};

  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchPendingPayments = useCallback(async () => {
    try {
      const response = await apiService.get(
        `/api/v2/payments/admin/pending/${room?.id || room?._id}`,
      );
      setPendingPayments(response.pendingPayments || []);
    } catch (error) {
      console.error("Error fetching pending payments:", error);
      Alert.alert("Error", "Failed to load pending payments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [room?.id || room?._id]);

  useEffect(() => {
    fetchPendingPayments();
  }, [fetchPendingPayments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPendingPayments();
  }, [fetchPendingPayments]);

  const handleVerifyPayment = async () => {
    if (!selectedPayment) return;

    try {
      setProcessing(true);
      await apiService.post(
        `/api/v2/payments/admin/verify/${selectedPayment.id || selectedPayment._id}`,
        {
          status: "completed",
          billType: selectedPayment.billType,
          memberId: selectedPayment.memberId,
          roomId: room.id || room._id,
        },
      );

      Alert.alert("Success", `${selectedPayment.billType} payment verified!`);
      setVerifyModalVisible(false);
      setSelectedPayment(null);
      fetchPendingPayments();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Verification failed",
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedPayment || !rejectReason.trim()) {
      Alert.alert("Error", "Please provide a reason for rejection");
      return;
    }

    try {
      setProcessing(true);
      await apiService.post(
        `/api/v2/payments/admin/reject/${selectedPayment.id || selectedPayment._id}`,
        {
          billType: selectedPayment.billType,
          memberId: selectedPayment.memberId,
          roomId: room.id || room._id,
          reason: rejectReason,
        },
      );

      Alert.alert("Success", "Payment rejected and reset to pending");
      setModalVisible(false);
      setSelectedPayment(null);
      setRejectReason("");
      fetchPendingPayments();
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Rejection failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedPayment || !noteText.trim()) {
      Alert.alert("Error", "Please enter a note");
      return;
    }

    try {
      setProcessing(true);
      await apiService.post(
        `/api/v2/payments/admin/add-note/${room.id || room._id}`,
        {
          memberId: selectedPayment.memberId,
          billType: selectedPayment.billType,
          note: noteText,
        },
      );

      Alert.alert("Success", "Note added successfully");
      setNoteText("");
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to add note",
      );
    } finally {
      setProcessing(false);
    }
  };

  const totalAmount = pendingPayments.reduce(
    (sum, p) => sum + (p.amount || 0),
    0,
  );

  const renderPaymentItem = ({ item }) => {
    const bill = getBillStyle(item.billType);

    return (
      <TouchableOpacity
        style={styles.paymentCard}
        activeOpacity={0.7}
        onPress={() => {
          setSelectedPayment(item);
          setVerifyModalVisible(true);
        }}
      >
        {/* Card Top */}
        <View style={styles.cardTop}>
          <View style={[styles.billIconWrap, { backgroundColor: bill.bg }]}>
            <Ionicons name={bill.icon} size={18} color={bill.text} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.memberName} numberOfLines={1}>
              {item.memberName}
            </Text>
            <View style={styles.dueDateRow}>
              <Ionicons
                name="calendar-outline"
                size={12}
                color={colors.textTertiary}
              />
              <Text style={styles.dueDateText}>
                Due {new Date(item.dueDate).toLocaleDateString()}
              </Text>
            </View>
          </View>
          <View style={[styles.billBadge, { backgroundColor: bill.bg }]}>
            <Text style={[styles.billBadgeText, { color: bill.text }]}>
              {(item.billType || "").toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Amount Row */}
        <View style={styles.amountRow}>
          <View style={styles.amountLeft}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amountValue}>
              ₱{(item.amount || 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.statusChip}>
            <View style={styles.statusDot} />
            <Text style={styles.statusChipText}>Awaiting Review</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.verifyBtn}
            onPress={() => {
              setSelectedPayment(item);
              setVerifyModalVisible(true);
            }}
          >
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.textOnAccent}
            />
            <Text style={styles.verifyBtnText}>Verify</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => {
              setSelectedPayment(item);
              setModalVisible(true);
            }}
          >
            <Ionicons name="close-circle" size={16} color="#c62828" />
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading payments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <View
            style={[
              styles.summaryIconWrap,
              { backgroundColor: colors.accentSurface },
            ]}
          >
            <Ionicons name="time" size={16} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.summaryValue}>{pendingPayments.length}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <View
            style={[
              styles.summaryIconWrap,
              { backgroundColor: colors.successBg },
            ]}
          >
            <Ionicons name="cash" size={16} color={colors.success} />
          </View>
          <View>
            <Text style={styles.summaryValue}>₱{totalAmount.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
        </View>
        {room?.name ? (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <View
                style={[
                  styles.summaryIconWrap,
                  { backgroundColor: colors.infoBg },
                ]}
              >
                <Ionicons name="home" size={16} color={colors.info} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {room.name}
                </Text>
                <Text style={styles.summaryLabel}>Room</Text>
              </View>
            </View>
          </>
        ) : null}
      </View>

      {pendingPayments.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="checkmark-done-circle"
              size={48}
              color={colors.success}
            />
          </View>
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptySubtitle}>
            No pending payments to verify right now.
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={16} color={colors.accent} />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={pendingPayments}
          renderItem={renderPaymentItem}
          keyExtractor={(item) => `${item.id || item._id}-${item.billType}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintcolor={colors.accent}
              colors={["#b38604"]}
            />
          }
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              {pendingPayments.length} payment
              {pendingPayments.length !== 1 ? "s" : ""} awaiting review
            </Text>
          }
          ListFooterComponent={<View style={{ height: 24 }} />}
        />
      )}

      {/* ── Rejection Modal ── */}
      <Modal
        visible={modalVisible && !verifyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setModalVisible(false);
          setRejectReason("");
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandleRow}>
              <View style={styles.modalHandle} />
            </View>

            <View style={styles.modalTitleRow}>
              <View
                style={[
                  styles.modalTitleIcon,
                  { backgroundColor: colors.errorBg },
                ]}
              >
                <Ionicons name="close-circle" size={22} color="#c62828" />
              </View>
              <Text style={styles.modalTitle}>Reject Payment</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setModalVisible(false);
                  setSelectedPayment(null);
                  setRejectReason("");
                }}
              >
                <Ionicons name="close" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Payment summary */}
            <View style={styles.modalSummaryCard}>
              <View style={styles.modalSummaryRow}>
                <Ionicons
                  name="person-outline"
                  size={15}
                  color={colors.textSecondary}
                />
                <Text style={styles.modalSummaryText}>
                  {selectedPayment?.memberName}
                </Text>
              </View>
              <View style={styles.modalSummaryRow}>
                <Ionicons
                  name="receipt-outline"
                  size={15}
                  color={colors.textSecondary}
                />
                <Text style={styles.modalSummaryText}>
                  {(selectedPayment?.billType || "").toUpperCase()}
                </Text>
              </View>
              <View style={styles.modalSummaryRow}>
                <Ionicons
                  name="cash-outline"
                  size={15}
                  color={colors.textSecondary}
                />
                <Text style={[styles.modalSummaryText, { fontWeight: "700" }]}>
                  ₱{(selectedPayment?.amount || 0).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Reason Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Rejection Reason *</Text>
              <View style={[styles.inputWrap, styles.textAreaWrap]}>
                <Ionicons
                  name="chatbubble-outline"
                  size={16}
                  color={colors.accent}
                  style={{ marginTop: 2 }}
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter reason for rejection..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  editable={!processing}
                />
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setModalVisible(false);
                  setSelectedPayment(null);
                  setRejectReason("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: "#c62828" },
                  processing && styles.btnDisabled,
                ]}
                onPress={handleRejectPayment}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color={colors.textOnAccent} size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={colors.textOnAccent}
                    />
                    <Text style={styles.modalConfirmText}>Reject Payment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Verify Modal ── */}
      <Modal
        visible={verifyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setVerifyModalVisible(false);
          setNoteText("");
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandleRow}>
              <View style={styles.modalHandle} />
            </View>

            <View style={styles.modalTitleRow}>
              <View
                style={[
                  styles.modalTitleIcon,
                  { backgroundColor: colors.successBg },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={colors.success}
                />
              </View>
              <Text style={styles.modalTitle}>Verify Payment</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setVerifyModalVisible(false);
                  setSelectedPayment(null);
                  setNoteText("");
                }}
              >
                <Ionicons name="close" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 340 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Payment summary */}
              <View style={styles.modalSummaryCard}>
                <View style={styles.modalSummaryRow}>
                  <Ionicons
                    name="person-outline"
                    size={15}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.modalSummaryText}>
                    {selectedPayment?.memberName}
                  </Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Ionicons
                    name="receipt-outline"
                    size={15}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.modalSummaryText}>
                    {(selectedPayment?.billType || "").toUpperCase()}
                  </Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Ionicons
                    name="cash-outline"
                    size={15}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[styles.modalSummaryText, { fontWeight: "700" }]}
                  >
                    ₱{(selectedPayment?.amount || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.modalSummaryRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.modalSummaryText}>
                    Due{" "}
                    {selectedPayment?.dueDate
                      ? new Date(selectedPayment.dueDate).toLocaleDateString()
                      : "N/A"}
                  </Text>
                </View>
              </View>

              {/* Note Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Add Note (Optional)</Text>
                <View style={[styles.inputWrap, styles.textAreaWrap]}>
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color={colors.accent}
                    style={{ marginTop: 2 }}
                  />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Any notes about this payment..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    value={noteText}
                    onChangeText={setNoteText}
                    editable={!processing}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setVerifyModalVisible(false);
                  setSelectedPayment(null);
                  setNoteText("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: colors.success },
                  processing && styles.btnDisabled,
                ]}
                onPress={handleVerifyPayment}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color={colors.textOnAccent} size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={colors.textOnAccent}
                    />
                    <Text style={styles.modalConfirmText}>Verify Payment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    loadingText: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 12,
    },

    // Summary Strip
    summaryStrip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e8e8e8",
      gap: 12,
    },
    summaryItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 1,
    },
    summaryIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    summaryValue: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    summaryLabel: {
      fontSize: 10,
      fontWeight: "500",
      color: colors.textTertiary,
      marginTop: -1,
    },
    summaryDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.skeleton,
    },

    // List
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    listHeader: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
      marginBottom: 10,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    // Payment Card
    paymentCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 10,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    billIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    cardInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    dueDateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 3,
    },
    dueDateText: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    billBadge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
    },
    billBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.5,
    },

    amountRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    amountLeft: {},
    amountLabel: {
      fontSize: 10,
      fontWeight: "500",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    amountValue: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      marginTop: 1,
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.accentSurface,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.electricityColor,
    },
    statusChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.electricityColor,
    },

    cardActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
    },
    verifyBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.success,
      paddingVertical: 11,
      borderRadius: 10,
    },
    verifyBtnText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
    },
    rejectBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: "#fce4ec",
      paddingVertical: 11,
      borderRadius: 10,
    },
    rejectBtnText: {
      color: "#c62828",
      fontSize: 13,
      fontWeight: "700",
    },

    // Empty
    emptyWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingBottom: 60,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.successBg,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: "center",
      lineHeight: 18,
      marginBottom: 20,
    },
    refreshBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.accentSurface,
    },
    refreshBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },

    // Modals (bottom sheet style)
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: Platform.OS === "ios" ? 36 : 24,
      maxHeight: "85%",
    },
    modalHandleRow: {
      alignItems: "center",
      paddingTop: 10,
      paddingBottom: 4,
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.skeleton,
    },
    modalTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 10,
    },
    modalTitleIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    modalTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    modalCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },

    // Modal Summary Card
    modalSummaryCard: {
      backgroundColor: colors.cardAlt,
      borderRadius: 12,
      padding: 14,
      marginHorizontal: 20,
      marginBottom: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    modalSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    modalSummaryText: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
    },

    // Form Fields
    fieldGroup: {
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 6,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    textAreaWrap: {
      alignItems: "flex-start",
      paddingVertical: 12,
    },
    input: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      paddingVertical: 12,
    },
    textArea: {
      minHeight: 70,
      textAlignVertical: "top",
      paddingVertical: 0,
    },

    // Modal Buttons
    modalBtnRow: {
      flexDirection: "row",
      paddingHorizontal: 20,
      gap: 10,
      marginTop: 16,
    },
    modalCancelBtn: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    modalCancelText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    modalConfirmBtn: {
      flex: 2,
      flexDirection: "row",
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    modalConfirmText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
    },
    btnDisabled: {
      opacity: 0.6,
    },
  });

export default AdminPaymentVerificationScreen;
