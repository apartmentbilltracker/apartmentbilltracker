import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const PaymentHistoryScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { roomId, roomName } = route.params;
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchPaymentHistory = async () => {
    try {
      setError("");
      const response = await apiService.getTransactions(roomId);
      if (response.success) {
        // Filter out cancelled/deleted transactions on the client side too
        const valid = (response.transactions || []).filter(
          (t) => t.status !== "cancelled" && t.status !== "deleted",
        );
        setPayments(valid);
      } else {
        setError("No transactions found");
      }
    } catch (err) {
      console.error("Error fetching payment history:", err);
      setError("Failed to load payment history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentHistory();
  }, [roomId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPaymentHistory();
    setRefreshing(false);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /* ─── Bill helpers ─── */
  const getBillIcon = (type) => {
    switch (type) {
      case "rent":
        return "home-outline";
      case "electricity":
        return "flash-outline";
      case "water":
        return "water-outline";
      case "internet":
        return "wifi-outline";
      default:
        return "receipt-outline";
    }
  };

  const getBillLabel = (type) => {
    const labels = {
      rent: "Rent",
      electricity: "Electricity",
      water: "Water",
      internet: "Internet",
      total: "Total Bill",
    };
    return (
      labels[type] ||
      (type ? type.charAt(0).toUpperCase() + type.slice(1) : "Payment")
    );
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case "gcash":
        return "phone-portrait-outline";
      case "bank_transfer":
        return "business-outline";
      case "cash":
        return "cash-outline";
      default:
        return "card-outline";
    }
  };

  const formatMethod = (method) => {
    if (!method) return "Cash";
    return method
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "verified":
      case "completed":
        return {
          color: colors.success,
          bg: colors.successBg,
          label: "Verified",
          icon: "checkmark-circle",
        };
      case "pending":
        return {
          color: colors.warning,
          bg: colors.warningBg,
          label: "Pending",
          icon: "time-outline",
        };
      case "rejected":
        return {
          color: colors.error,
          bg: colors.errorBg,
          label: "Rejected",
          icon: "close-circle",
        };
      default:
        return {
          color: colors.textTertiary,
          bg: colors.cardAlt,
          label: status
            ? status.charAt(0).toUpperCase() + status.slice(1)
            : "Unknown",
          icon: "help-circle-outline",
        };
    }
  };

  /* ─── Summary ─── */
  const totalPaid = payments
    .filter((p) => p.status === "verified" || p.status === "completed")
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const totalPending = payments
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  /* ─── Reference helper ─── */
  const getReference = (payment) => {
    return (
      payment.reference ||
      payment.gcash?.referenceNumber ||
      payment.bankTransfer?.referenceNumber ||
      payment.cash?.receiptNumber ||
      null
    );
  };

  /* ─── Loading State ─── */
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Payment History</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading transactions…</Text>
        </View>
      </View>
    );
  }

  /* ─── Render Payment Card ─── */
  const renderPayment = ({ item: payment }) => {
    const sc = getStatusConfig(payment.status);
    const ref = getReference(payment);

    return (
      <View style={styles.card}>
        {/* Top Row */}
        <View style={styles.cardTop}>
          <View style={styles.billIconWrap}>
            <Ionicons
              name={getBillIcon(payment.billType)}
              size={18}
              color={colors.accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.billLabel}>
              {getBillLabel(payment.billType)}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons
                name={getMethodIcon(payment.paymentMethod)}
                size={12}
                color={colors.textSecondary}
              />
              <Text style={styles.metaText}>
                {formatMethod(payment.paymentMethod)}
              </Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>
                {formatDate(payment.transactionDate)}
              </Text>
            </View>
          </View>
          <View style={styles.amountWrap}>
            <Text style={styles.amount}>
              ₱{(parseFloat(payment.amount) || 0).toFixed(2)}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
              <Ionicons name={sc.icon} size={11} color={sc.color} />
              <Text style={[styles.statusText, { color: sc.color }]}>
                {sc.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Reference / Details */}
        {ref && (
          <View style={styles.refRow}>
            <Ionicons name="document-text-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.refLabel}>Ref:</Text>
            <Text style={styles.refValue} numberOfLines={1}>
              {ref}
            </Text>
          </View>
        )}

        {payment.bankTransfer?.bankName && (
          <View style={styles.refRow}>
            <Ionicons name="business-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.refLabel}>Bank:</Text>
            <Text style={styles.refValue}>{payment.bankTransfer.bankName}</Text>
          </View>
        )}
      </View>
    );
  };

  /* ─── Main Render ─── */
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Payment History</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {roomName}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.countBadge}>
            {payments.length} {payments.length === 1 ? "record" : "records"}
          </Text>
        </View>
      </View>

      {/* Summary Strip */}
      {payments.length > 0 && (
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: "#22c55e" }]} />
            <Text style={styles.summaryLabel}>Verified</Text>
            <Text style={[styles.summaryValue, { color: "#22c55e" }]}>
              ₱{totalPaid.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: "#f59e0b" }]} />
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={[styles.summaryValue, { color: "#f59e0b" }]}>
              ₱{totalPending.toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {/* Error */}
      {error ? (
        <View style={styles.errorBar}>
          <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* List / Empty */}
      {payments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="receipt-outline"
              size={48}
              color={colors.textSecondary}
            />
          </View>
          <Text style={styles.emptyTitle}>No Payments Yet</Text>
          <Text style={styles.emptyText}>
            Completed payments will appear here.
          </Text>
          <TouchableOpacity
            style={styles.emptyRefresh}
            onPress={fetchPaymentHistory}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.accent} />
            <Text style={styles.emptyRefreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={payments}
          renderItem={renderPayment}
          keyExtractor={(item, i) => item.id || item._id || String(i)}
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
    </View>
  );
};

/* ═══════════════════════ STYLES ═══════════════════════ */
const createStyles = (colors) =>
  StyleSheet.create({
    /* Layout */
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 12,
      fontSize: 13,
      color: colors.textTertiary,
    },

    /* Header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    headerRight: {
      width: 60,
      alignItems: "flex-end",
    },
    countBadge: {
      fontSize: 11,
      color: colors.accent,
      fontWeight: "600",
    },

    /* Summary */
    summaryStrip: {
      flexDirection: "row",
      backgroundColor: colors.card,
      marginHorizontal: 14,
      marginTop: 14,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    summaryItem: {
      flex: 1,
      alignItems: "center",
    },
    summaryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginBottom: 6,
    },
    summaryLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
      marginBottom: 2,
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: "800",
    },
    summaryDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.skeleton,
      marginHorizontal: 12,
    },

    /* Error */
    errorBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.errorBg,
      borderRadius: 10,
      marginHorizontal: 14,
      marginTop: 10,
      padding: 10,
      gap: 8,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: "500",
    },

    /* Empty */
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
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
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    billIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.warningBg,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    billLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 3,
      gap: 4,
    },
    metaText: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    metaDot: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    amountWrap: {
      alignItems: "flex-end",
    },
    amount: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.accent,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      marginTop: 4,
      gap: 3,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "700",
    },

    /* Reference row */
    refRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
      gap: 6,
    },
    refLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    refValue: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      flex: 1,
    },
  });

export default PaymentHistoryScreen;
