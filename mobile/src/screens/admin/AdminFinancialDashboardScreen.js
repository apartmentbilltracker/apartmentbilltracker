import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRoute, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { apiService, roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

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
    label: "Wi-Fi",
  },
});

const pct = (collected, expected) => {
  if (!expected) return 0;
  return Math.min(Math.round((collected / expected) * 100), 100);
};

const AdminFinancialDashboardScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const BILL_META = getBillMeta(colors);

  const route = useRoute();
  const isFocused = useIsFocused();
  const { room } = route.params || {};

  const [dashboard, setDashboard] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCycleClosed, setIsCycleClosed] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      let latestRoom = room;
      try {
        const roomResponse = await roomService.getRoomDetails(
          room?.id || room?._id,
        );
        latestRoom = roomResponse.room || roomResponse.data?.room || room;
      } catch (err) {
        console.log("Warning: Could not refetch room data:", err);
      }

      let cycleIsClosed = false;
      if (latestRoom?.currentCycleId) {
        try {
          const cycleResponse = await apiService.get(
            `/api/v2/billing-cycles/${latestRoom.currentCycleId}`,
          );
          const cycleData =
            cycleResponse?.billingCycle || cycleResponse?.data || cycleResponse;
          cycleIsClosed =
            cycleData?.status === "completed" || cycleData?.status === "closed";
          setIsCycleClosed(cycleIsClosed);

          if (cycleIsClosed) {
            setDashboard(null);
            setTrends([]);
            return;
          }
        } catch (err) {
          console.log("Error checking cycle status:", err);
        }
      } else {
        setDashboard(null);
        setTrends([]);
        setIsCycleClosed(true);
        return;
      }

      if (!cycleIsClosed) {
        const response = await apiService.get(
          `/api/v2/admin/financial/dashboard/${latestRoom?.id || latestRoom?._id}`,
        );
        setDashboard(response.dashboard);

        const trendsResponse = await apiService.get(
          `/api/v2/admin/financial/trends/${latestRoom?.id || latestRoom?._id}`,
        );
        setTrends(trendsResponse.trends || []);
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      Alert.alert("Error", "Failed to load financial data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [room?.id, room?._id, room]);

  const hasLoaded = useRef(false);

  useEffect(() => {
    fetchDashboardData();
    hasLoaded.current = true;
  }, [fetchDashboardData]);

  // Re-fetch on screen re-focus (skip initial mount — useEffect above handles it)
  useEffect(() => {
    if (isFocused && hasLoaded.current) fetchDashboardData();
  }, [isFocused, fetchDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ─── Loading ───
  if (loading) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading financial data...</Text>
      </View>
    );
  }

  // ─── Cycle Closed ───
  if (isCycleClosed) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintcolor={colors.accent}
            colors={["#b38604"]}
          />
        }
      >
        {/* Summary strip (room name) */}
        <View style={styles.summaryStrip}>
          <View
            style={[styles.summaryIconWrap, { backgroundColor: colors.infoBg }]}
          >
            <Ionicons name="home" size={16} color={colors.info} />
          </View>
          <Text style={styles.summaryRoomName} numberOfLines={1}>
            {room?.name || "Room"}
          </Text>
        </View>

        <View style={styles.closedWrap}>
          <View style={styles.closedIcon}>
            <Ionicons
              name="checkmark-done-circle"
              size={52}
              color={colors.success}
            />
          </View>
          <Text style={styles.closedTitle}>Billing Cycle Completed</Text>
          <Text style={styles.closedSubtitle}>
            The billing cycle has been successfully closed
          </Text>

          <View style={styles.completionCard}>
            {[
              {
                icon: "card",
                label: "All bills collected",
                detail: "Payments processed and recorded",
              },
              {
                icon: "archive",
                label: "Data archived",
                detail: "Historical records saved",
              },
              {
                icon: "add-circle",
                label: "Ready for next cycle",
                detail: "Create a new billing cycle to continue",
              },
            ].map((item, i) => (
              <React.Fragment key={item.label}>
                {i > 0 && <View style={styles.completionDivider} />}
                <View style={styles.completionItem}>
                  <View style={styles.completionCheckWrap}>
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={colors.textOnAccent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.completionLabel}>{item.label}</Text>
                    <Text style={styles.completionDetail}>{item.detail}</Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>

          <Text style={styles.closedNote}>
            Amounts have been reset for the new cycle
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ─── Active Dashboard ───
  const collectionRate = dashboard?.collectionRate || 0;
  const rateColor =
    collectionRate >= 80
      ? colors.success
      : collectionRate >= 50
        ? colors.electricityColor
        : "#c62828";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
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
      {/* ── Summary Strip ── */}
      <View style={styles.summaryStrip}>
        <View
          style={[styles.summaryIconWrap, { backgroundColor: colors.infoBg }]}
        >
          <Ionicons name="home" size={16} color={colors.info} />
        </View>
        <Text style={styles.summaryRoomName} numberOfLines={1}>
          {dashboard?.roomName || room?.name || "Room"}
        </Text>
        <View style={[styles.rateBadge, { backgroundColor: rateColor + "18" }]}>
          <Text style={[styles.rateBadgeText, { color: rateColor }]}>
            {collectionRate}%
          </Text>
        </View>
        {/* Cycle status badge */}
        <View
          style={{
            backgroundColor: "#fff3e0",
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
            marginLeft: 6,
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: "700", color: "#e65100" }}>
            ACTIVE
          </Text>
        </View>
      </View>

      {/* ── KPI Cards ── */}
      <View style={styles.kpiGrid}>
        {/* Total Billed */}
        <View style={styles.kpiCard}>
          <View
            style={[
              styles.kpiIconWrap,
              { backgroundColor: colors.accentSurface },
            ]}
          >
            <Ionicons name="receipt" size={18} color={colors.accent} />
          </View>
          <Text style={styles.kpiLabel}>Total Billed</Text>
          <Text style={styles.kpiValue}>
            ₱
            {(dashboard?.totalBilled || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>

        {/* Collected */}
        <View style={styles.kpiCard}>
          <View
            style={[styles.kpiIconWrap, { backgroundColor: colors.successBg }]}
          >
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={colors.success}
            />
          </View>
          <Text style={styles.kpiLabel}>Collected</Text>
          <Text style={[styles.kpiValue, { color: colors.success }]}>
            ₱
            {(dashboard?.totalCollected || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>

        {/* Outstanding */}
        <View style={styles.kpiCard}>
          <View
            style={[styles.kpiIconWrap, { backgroundColor: colors.warningBg }]}
          >
            <Ionicons
              name="alert-circle"
              size={18}
              color={colors.electricityColor}
            />
          </View>
          <Text style={styles.kpiLabel}>Outstanding</Text>
          <Text style={[styles.kpiValue, { color: colors.electricityColor }]}>
            ₱
            {(dashboard?.outstanding || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>

        {/* Collection Rate */}
        <View style={styles.kpiCard}>
          <View
            style={[styles.kpiIconWrap, { backgroundColor: rateColor + "18" }]}
          >
            <Ionicons name="trending-up" size={18} color={rateColor} />
          </View>
          <Text style={styles.kpiLabel}>Rate</Text>
          <Text style={[styles.kpiValue, { color: rateColor }]}>
            {collectionRate}%
          </Text>
        </View>
      </View>

      {/* ── Members Summary ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people" size={16} color={colors.accent} />
          <Text style={styles.sectionTitle}>Room Members</Text>
        </View>
        <View style={styles.membersRow}>
          {[
            {
              value: dashboard?.payerCount,
              label: "Payers",
              color: colors.success,
              bg: colors.successBg,
              icon: "checkmark-circle",
            },
            {
              value: dashboard?.nonPayerCount,
              label: "Non-Payers",
              color: colors.error,
              bg: colors.errorBg,
              icon: "close-circle",
            },
            {
              value: dashboard?.totalMembers,
              label: "Total",
              color: colors.waterColor,
              bg: colors.infoBg,
              icon: "people",
            },
          ].map((m) => (
            <View key={m.label} style={styles.memberCard}>
              <View style={[styles.memberIconWrap, { backgroundColor: m.bg }]}>
                <Ionicons name={m.icon} size={16} color={m.color} />
              </View>
              <Text style={[styles.memberValue, { color: m.color }]}>
                {m.value ?? 0}
              </Text>
              <Text style={styles.memberLabel}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Active Cycle Details ── */}
      {dashboard?.activeCycleId && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={16} color={colors.accent} />
            <Text style={styles.sectionTitle}>Active Billing Cycle</Text>
          </View>

          <View style={styles.cycleCard}>
            {/* Period */}
            <View style={styles.cyclePeriodRow}>
              <Ionicons
                name="time-outline"
                size={14}
                color={colors.textTertiary}
              />
              <Text style={styles.cyclePeriodText}>
                {new Date(dashboard?.activeCycleStart).toLocaleDateString()} –{" "}
                {new Date(dashboard?.activeCycleEnd).toLocaleDateString()}
              </Text>
            </View>

            {/* Bill Breakdown Grid */}
            <View style={styles.breakdownGrid}>
              {Object.entries(BILL_META).map(([key, meta]) => {
                const expected =
                  dashboard?.paymentBreakdown?.[key]?.expected || 0;
                return (
                  <View key={key} style={styles.breakdownChip}>
                    <View
                      style={[
                        styles.breakdownChipIcon,
                        { backgroundColor: meta.bg },
                      ]}
                    >
                      <Ionicons name={meta.icon} size={14} color={meta.color} />
                    </View>
                    <View>
                      <Text style={styles.breakdownChipLabel}>
                        {meta.label}
                      </Text>
                      <Text style={styles.breakdownChipValue}>
                        ₱{expected.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Progress Bars */}
            <View style={styles.progressSection}>
              <Text style={styles.progressSectionLabel}>
                Collection Progress
              </Text>
              {Object.entries(BILL_META).map(([key, meta]) => {
                const collected =
                  dashboard?.paymentBreakdown?.[key]?.collected || 0;
                const expected =
                  dashboard?.paymentBreakdown?.[key]?.expected || 0;
                const p = pct(collected, expected);
                return (
                  <View key={key} style={styles.progressItem}>
                    <View style={styles.progressHeader}>
                      <View style={styles.progressLabelRow}>
                        <Ionicons
                          name={meta.icon}
                          size={12}
                          color={meta.color}
                        />
                        <Text style={styles.progressLabel}>{meta.label}</Text>
                      </View>
                      <Text style={[styles.progressPct, { color: meta.color }]}>
                        {p}%
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${p}%`,
                            backgroundColor: meta.color,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* ── Billing History ── */}
      {trends.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bar-chart" size={16} color={colors.accent} />
            <Text style={styles.sectionTitle}>Billing History</Text>
          </View>
          {trends.map((cycle) => {
            const isActive = cycle.status === "active";
            return (
              <View
                key={cycle.id || cycle._id || cycle.cycleNumber}
                style={styles.trendCard}
              >
                <View style={styles.trendTop}>
                  <View style={styles.trendLeft}>
                    <View
                      style={[
                        styles.trendIconWrap,
                        {
                          backgroundColor: isActive
                            ? colors.successBg
                            : colors.infoBg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isActive ? "pulse" : "checkmark-done"}
                        size={16}
                        color={isActive ? colors.success : colors.waterColor}
                      />
                    </View>
                    <View>
                      <Text style={styles.trendTitle}>
                        Cycle #{cycle.cycleNumber}
                      </Text>
                      <View style={styles.trendDateRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={11}
                          color={colors.textTertiary}
                        />
                        <Text style={styles.trendDate}>
                          {new Date(cycle.startDate).toLocaleDateString()} –{" "}
                          {new Date(cycle.endDate).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.trendStatusBadge,
                      {
                        backgroundColor: isActive
                          ? colors.successBg
                          : colors.infoBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.trendStatusText,
                        {
                          color: isActive ? colors.success : colors.waterColor,
                        },
                      ]}
                    >
                      {cycle.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.trendAmountRow}>
                  <Text style={styles.trendAmountLabel}>Total Billed</Text>
                  <Text style={styles.trendAmountValue}>
                    ₱{(cycle.totalBilled || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Quick Actions ── */}
      <View style={styles.actionsSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={16} color={colors.accent} />
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("BillingDetails", { room })}
          >
            <View
              style={[
                styles.actionIconWrap,
                { backgroundColor: colors.infoBg },
              ]}
            >
              <Ionicons name="list" size={20} color={colors.info} />
            </View>
            <Text style={styles.actionLabel}>Collection Status</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("PaymentVerification", { room })}
          >
            <View
              style={[
                styles.actionIconWrap,
                { backgroundColor: colors.successBg },
              ]}
            >
              <Ionicons
                name="checkmark-done"
                size={20}
                color={colors.success}
              />
            </View>
            <Text style={styles.actionLabel}>Verify Payments</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
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

    // ── Summary Strip ──
    summaryStrip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e8e8e8",
      gap: 10,
    },
    summaryIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    summaryRoomName: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    rateBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    rateBadgeText: {
      fontSize: 12,
      fontWeight: "700",
    },

    // ── KPI Grid ──
    kpiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 12,
      paddingTop: 14,
      gap: 8,
    },
    kpiCard: {
      width: "48%",
      flexGrow: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
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
    kpiIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
      marginBottom: 2,
    },
    kpiValue: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
    },

    // ── Section ──
    section: {
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },

    // ── Members ──
    membersRow: {
      flexDirection: "row",
      gap: 8,
    },
    memberCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    memberIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    memberValue: {
      fontSize: 22,
      fontWeight: "800",
    },
    memberLabel: {
      fontSize: 10,
      fontWeight: "500",
      color: colors.textTertiary,
      marginTop: 2,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },

    // ── Cycle Card ──
    cycleCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
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
    cyclePeriodRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 14,
    },
    cyclePeriodText: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.textTertiary,
    },

    // Breakdown Grid
    breakdownGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    breakdownChip: {
      width: "47%",
      flexGrow: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.cardAlt,
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    breakdownChipIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    breakdownChipLabel: {
      fontSize: 10,
      fontWeight: "500",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    breakdownChipValue: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      marginTop: 1,
    },

    // Progress
    progressSection: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
      paddingTop: 14,
      gap: 12,
    },
    progressSectionLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    progressItem: {
      gap: 5,
    },
    progressHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    progressLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    progressLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    progressPct: {
      fontSize: 12,
      fontWeight: "700",
    },
    progressTrack: {
      height: 6,
      backgroundColor: colors.inputBg,
      borderRadius: 3,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 3,
    },

    // ── Trends ──
    trendCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    trendTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    trendLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    trendIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    trendTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    trendDateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
    },
    trendDate: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    trendStatusBadge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
    },
    trendStatusText: {
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    trendAmountRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    trendAmountLabel: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.textTertiary,
    },
    trendAmountValue: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.accent,
    },

    // ── Actions ──
    actionsSection: {
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    actionsRow: {
      gap: 8,
    },
    actionCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      gap: 12,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    actionIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    actionLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },

    // ── Closed State ──
    closedWrap: {
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 36,
    },
    closedIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.successBg,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 18,
    },
    closedTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
    },
    closedSubtitle: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: "center",
      marginBottom: 28,
      lineHeight: 18,
    },
    completionCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: 16,
      width: "100%",
      marginBottom: 20,
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
    completionItem: {
      flexDirection: "row",
      paddingHorizontal: 18,
      paddingVertical: 10,
      alignItems: "center",
      gap: 14,
    },
    completionCheckWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.success,
      justifyContent: "center",
      alignItems: "center",
    },
    completionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    completionDetail: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 1,
    },
    completionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.skeleton,
      marginHorizontal: 18,
      marginVertical: 4,
    },
    closedNote: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: "center",
    },
  });

export default AdminFinancialDashboardScreen;
