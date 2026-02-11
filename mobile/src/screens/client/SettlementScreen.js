import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiService } from "../../services/apiService";
import { roundTo2 as r2 } from "../../utils/helpers";
import { useTheme } from "../../theme/ThemeContext";

const SettlementScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { roomId, roomName } = route.params;
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  const fetchSettlements = async () => {
    try {
      setError("");
      const response = await apiService.getSettlements(roomId, activeTab);
      if (response.success) {
        setSettlements(response.settlements || []);
      }
    } catch (err) {
      console.error("Error fetching settlements:", err);
      setError("Failed to load settlements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchSettlements();
  }, [roomId, activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSettlements();
    setRefreshing(false);
  };

  const handleMarkAsSettled = (settlement) => {
    const debtorName = settlement.debtor?.name || "Debtor";
    const creditorName = settlement.creditor?.name || "Creditor";

    Alert.alert(
      "Confirm Settlement",
      `Mark the ₱${(parseFloat(settlement.amount) || 0).toFixed(2)} settlement between ${debtorName} and ${creditorName} as settled?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const response = await apiService.recordSettlement(
                roomId,
                settlement.debtor?.id ||
                  settlement.debtor?._id ||
                  settlement.debtorId,
                settlement.creditor?.id ||
                  settlement.creditor?._id ||
                  settlement.creditorId,
                settlement.amount,
                settlement.amount,
                "Settled",
              );
              if (response.success) {
                Alert.alert("Success", "Settlement recorded successfully");
                await fetchSettlements();
              }
            } catch (err) {
              Alert.alert("Error", "Failed to record settlement");
            }
          },
        },
      ],
    );
  };

  /* ─── Status helpers ─── */
  const getStatusConfig = (status) => {
    switch (status) {
      case "settled":
        return {
          color: colors.success,
          bg: colors.successBg,
          label: "Settled",
          icon: "checkmark-circle",
        };
      case "partial":
        return {
          color: colors.warning,
          bg: colors.warningBg,
          label: "Partial",
          icon: "pie-chart-outline",
        };
      case "pending":
        return {
          color: colors.error,
          bg: colors.errorBg,
          label: "Pending",
          icon: "time-outline",
        };
      default:
        return {
          color: colors.textTertiary,
          bg: colors.cardAlt,
          label: status || "Unknown",
          icon: "help-circle-outline",
        };
    }
  };

  const tabs = [
    { key: "pending", label: "Pending", icon: "time-outline" },
    { key: "partial", label: "Partial", icon: "pie-chart-outline" },
    { key: "settled", label: "Settled", icon: "checkmark-circle-outline" },
  ];

  /* ─── Summary ─── */
  const totalOwed = settlements.reduce(
    (s, t) => s + (parseFloat(t.amount) || 0),
    0,
  );
  const totalPaid = settlements.reduce(
    (s, t) => s + (parseFloat(t.settlementAmount) || 0),
    0,
  );
  const totalOutstanding = r2(totalOwed - totalPaid);

  /* ─── Loading ─── */
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
            <Text style={styles.headerTitle}>Settlements</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading settlements…</Text>
        </View>
      </View>
    );
  }

  /* ─── Render Card ─── */
  const renderSettlement = ({ item: settlement }) => {
    const sc = getStatusConfig(settlement.status);
    const amount = parseFloat(settlement.amount) || 0;
    const paid = parseFloat(settlement.settlementAmount) || 0;
    const outstanding = amount - paid;
    const progress = amount > 0 ? Math.min(paid / amount, 1) : 0;
    const debtorName = settlement.debtor?.name || "Unknown";
    const creditorName = settlement.creditor?.name || "Unknown";

    return (
      <View style={styles.card}>
        {/* Top: People */}
        <View style={styles.cardTop}>
          {/* Debtor avatar */}
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>
              {debtorName.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.debtorName} numberOfLines={1}>
              {debtorName}
            </Text>
            <View style={styles.owesRow}>
              <Ionicons name="arrow-forward" size={11} color={colors.textSecondary} />
              <Text style={styles.owesText}>owes {creditorName}</Text>
            </View>
          </View>

          {/* Status pill */}
          <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
            <Ionicons name={sc.icon} size={11} color={sc.color} />
            <Text style={[styles.statusLabel, { color: sc.color }]}>
              {sc.label}
            </Text>
          </View>
        </View>

        {/* Amount section */}
        <View style={styles.amountSection}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Total Amount</Text>
            <Text style={styles.amountGold}>₱{amount.toFixed(2)}</Text>
          </View>

          {paid > 0 && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Paid</Text>
              <Text style={styles.paidValue}>₱{paid.toFixed(2)}</Text>
            </View>
          )}

          {outstanding > 0 && settlement.status !== "settled" && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Outstanding</Text>
              <Text style={styles.outstandingValue}>
                ₱{outstanding.toFixed(2)}
              </Text>
            </View>
          )}

          {/* Progress bar for partial */}
          {settlement.status === "partial" && (
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.dateText}>
              {settlement.createdAt
                ? new Date(settlement.createdAt).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "N/A"}
            </Text>
          </View>

          {settlement.status !== "settled" && (
            <TouchableOpacity
              style={styles.settleBtn}
              onPress={() => handleMarkAsSettled(settlement)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={15}
                color={colors.accent}
              />
              <Text style={styles.settleBtnText}>Mark Settled</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  /* ─── Main ─── */
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
          <Text style={styles.headerTitle}>Settlements</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {roomName}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.countBadge}>
            {settlements.length}{" "}
            {settlements.length === 1 ? "record" : "records"}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={active ? "#b38604" : "#94a3b8"}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Summary strip */}
      {settlements.length > 0 && (
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Owed</Text>
            <Text style={[styles.summaryValue, { color: colors.accent }]}>
              ₱{totalOwed.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={[styles.summaryValue, { color: "#22c55e" }]}>
              ₱{totalPaid.toFixed(2)}
            </Text>
          </View>
          {activeTab !== "settled" && totalOutstanding > 0 && (
            <>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Remaining</Text>
                <Text style={[styles.summaryValue, { color: "#ef4444" }]}>
                  ₱{totalOutstanding.toFixed(2)}
                </Text>
              </View>
            </>
          )}
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
      {settlements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="people-outline"
              size={48}
              color={colors.textSecondary}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {activeTab === "settled"
              ? "No Settled Accounts"
              : "No Open Settlements"}
          </Text>
          <Text style={styles.emptyText}>
            {activeTab === "settled"
              ? "Completed settlements will appear here."
              : "Settlements will appear once bills are tracked."}
          </Text>
          <TouchableOpacity
            style={styles.emptyRefresh}
            onPress={fetchSettlements}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.accent} />
            <Text style={styles.emptyRefreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={settlements}
          renderItem={renderSettlement}
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

    /* Tabs */
    tabBar: {
      flexDirection: "row",
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
      gap: 5,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: {
      borderBottomColor: "#b38604",
    },
    tabText: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.textTertiary,
    },
    tabTextActive: {
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
      paddingHorizontal: 16,
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
    summaryLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
      marginBottom: 2,
    },
    summaryValue: {
      fontSize: 15,
      fontWeight: "800",
    },
    summaryDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.skeleton,
      marginHorizontal: 8,
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
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    avatarWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    avatarText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
    },
    debtorName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    owesRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 2,
      gap: 4,
    },
    owesText: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 3,
    },
    statusLabel: {
      fontSize: 10,
      fontWeight: "700",
    },

    /* Amount section */
    amountSection: {
      backgroundColor: colors.cardAlt,
      borderRadius: 10,
      padding: 12,
      marginTop: 12,
    },
    amountRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    amountLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    amountGold: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.accent,
    },
    paidValue: {
      fontSize: 13,
      fontWeight: "600",
      color: "#22c55e",
    },
    outstandingValue: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.error,
    },
    progressTrack: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginTop: 4,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: "#f59e0b",
      borderRadius: 2,
    },

    /* Footer */
    cardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 12,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    dateText: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    settleBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#b38604",
      gap: 5,
    },
    settleBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.accent,
    },
  });

export default SettlementScreen;
