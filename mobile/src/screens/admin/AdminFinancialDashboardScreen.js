import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Alert,
} from "react-native";
import { useRoute, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { apiService, roomService } from "../../services/apiService";

const { width } = Dimensions.get("window");

const AdminFinancialDashboardScreen = ({ navigation }) => {
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

      // Refetch latest room data to get updated currentCycleId
      let latestRoom = room;
      try {
        const roomResponse = await roomService.getRoomDetails(room?._id);
        latestRoom = roomResponse.room || roomResponse.data?.room || room;
      } catch (err) {
        console.log("Warning: Could not refetch room data:", err);
      }

      // First check if the current cycle is closed
      let cycleIsClosed = false;
      if (latestRoom?.currentCycleId) {
        try {
          const cycleResponse = await apiService.get(
            `/api/v2/billing-cycles/${latestRoom.currentCycleId}`,
          );
          cycleIsClosed = cycleResponse?.data?.status === "completed";
          setIsCycleClosed(cycleIsClosed);

          if (cycleIsClosed) {
            console.log(
              "🔄 [FINANCIAL DASHBOARD] Billing cycle is closed - resetting view",
            );
            setDashboard(null);
            setTrends([]);
            return;
          }
        } catch (err) {
          console.log("Error checking cycle status:", err);
        }
      } else {
        // No active cycle
        console.log("ℹ️ [FINANCIAL DASHBOARD] No active cycle found");
        setDashboard(null);
        setTrends([]);
        setIsCycleClosed(true);
        return;
      }

      // Fetch dashboard data only if cycle is not closed
      if (!cycleIsClosed) {
        const response = await apiService.get(
          `/api/v2/admin/financial/dashboard/${latestRoom?._id}`,
        );

        setDashboard(response.dashboard);

        // Fetch trends
        const trendsResponse = await apiService.get(
          `/api/v2/admin/financial/trends/${latestRoom?._id}`,
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
  }, [room?._id, room]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Check if cycle is closed when screen is focused
  useEffect(() => {
    if (isFocused) {
      console.log(
        "🔄 [FINANCIAL DASHBOARD] Screen focused - checking for closed cycle",
      );
      fetchDashboardData();
    }
  }, [isFocused, fetchDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading financial data...</Text>
      </View>
    );
  }

  if (isCycleClosed) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Financial Dashboard</Text>
          <Text style={styles.headerSubtitle}>{room?.name}</Text>
        </View>

        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          </View>

          <Text style={styles.emptyStateTitle}>Billing Cycle Completed</Text>
          <Text style={styles.emptyStateSubtitle}>
            The billing cycle has been successfully closed
          </Text>

          <View style={styles.completionCard}>
            <View style={styles.completionItem}>
              <View style={styles.completionCheckmark}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </View>
              <View style={styles.completionText}>
                <Text style={styles.completionLabel}>All bills collected</Text>
                <Text style={styles.completionDetail}>
                  Payments processed and recorded
                </Text>
              </View>
            </View>

            <View style={styles.completionDivider} />

            <View style={styles.completionItem}>
              <View style={styles.completionCheckmark}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </View>
              <View style={styles.completionText}>
                <Text style={styles.completionLabel}>Data archived</Text>
                <Text style={styles.completionDetail}>
                  Historical records saved
                </Text>
              </View>
            </View>

            <View style={styles.completionDivider} />

            <View style={styles.completionItem}>
              <View style={styles.completionCheckmark}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </View>
              <View style={styles.completionText}>
                <Text style={styles.completionLabel}>Ready for next cycle</Text>
                <Text style={styles.completionDetail}>
                  Create a new billing cycle to continue
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.emptyStateMessage}>
            Amounts have been reset for the new cycle
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial Dashboard</Text>
        <Text style={styles.headerSubtitle}>{dashboard?.roomName}</Text>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiContainer}>
        {/* Total Billed */}
        <View style={[styles.kpiCard, styles.kpiPrimary]}>
          <Text style={styles.kpiLabel}>Total Billed</Text>
          <Text style={styles.kpiValue}>
            ₱{(dashboard?.totalBilled || 0).toFixed(2)}
          </Text>
          <Text style={styles.kpiSubtext}>All cycles</Text>
        </View>

        {/* Total Collected */}
        <View style={[styles.kpiCard, styles.kpiSuccess]}>
          <Text style={styles.kpiLabel}>Collected</Text>
          <Text style={styles.kpiValue}>
            ₱{(dashboard?.totalCollected || 0).toFixed(2)}
          </Text>
          <Text style={styles.kpiSubtext}>Payments received</Text>
        </View>
      </View>

      <View style={styles.kpiContainer}>
        {/* Outstanding */}
        <View style={[styles.kpiCard, styles.kpiWarning]}>
          <Text style={styles.kpiLabel}>Outstanding</Text>
          <Text style={styles.kpiValue}>
            ₱{(dashboard?.outstanding || 0).toFixed(2)}
          </Text>
          <Text style={styles.kpiSubtext}>Pending payment</Text>
        </View>

        {/* Collection Rate */}
        <View style={[styles.kpiCard, styles.kpiInfo]}>
          <Text style={styles.kpiLabel}>Collection Rate</Text>
          <Text style={styles.kpiValue}>{dashboard?.collectionRate}%</Text>
          <Text style={styles.kpiSubtext}>Payment completion</Text>
        </View>
      </View>

      {/* Members Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Room Members</Text>
        <View style={styles.membersGrid}>
          <View style={styles.memberCard}>
            <Text style={styles.memberValue}>{dashboard?.payerCount}</Text>
            <Text style={styles.memberLabel}>Payers</Text>
          </View>
          <View style={styles.memberCard}>
            <Text style={styles.memberValue}>{dashboard?.nonPayerCount}</Text>
            <Text style={styles.memberLabel}>Non-Payers</Text>
          </View>
          <View style={styles.memberCard}>
            <Text style={styles.memberValue}>{dashboard?.totalMembers}</Text>
            <Text style={styles.memberLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Active Cycle Details */}
      {dashboard?.activeCycleId && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Billing Cycle</Text>
          <View style={styles.cycleCard}>
            <Text style={styles.cycleLabel}>Period</Text>
            <Text style={styles.cycleValue}>
              {new Date(dashboard?.activeCycleStart).toLocaleDateString()} -{" "}
              {new Date(dashboard?.activeCycleEnd).toLocaleDateString()}
            </Text>

            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Rent</Text>
                <Text style={styles.breakdownValue}>
                  ₱
                  {(dashboard?.paymentBreakdown?.rent?.expected || 0).toFixed(
                    2,
                  )}
                </Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Electricity</Text>
                <Text style={styles.breakdownValue}>
                  ₱
                  {(
                    dashboard?.paymentBreakdown?.electricity?.expected || 0
                  ).toFixed(2)}
                </Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Water</Text>
                <Text style={styles.breakdownValue}>
                  ₱
                  {(dashboard?.paymentBreakdown?.water?.expected || 0).toFixed(
                    2,
                  )}
                </Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Internet</Text>
                <Text style={styles.breakdownValue}>
                  ₱
                  {(
                    dashboard?.paymentBreakdown?.internet?.expected || 0
                  ).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Payment Status Bars */}
            <View style={styles.statusSection}>
              {/* Rent Status */}
              <View style={styles.statusItem}>
                <View style={styles.statusHeader}>
                  <Text style={styles.statusLabel}>Rent</Text>
                  <Text style={styles.statusPercentage}>
                    {(
                      ((dashboard?.paymentBreakdown?.rent?.collected || 0) /
                        (dashboard?.paymentBreakdown?.rent?.expected || 1)) *
                        100 || 0
                    ).toFixed(0)}
                    %
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${((dashboard?.paymentBreakdown?.rent?.collected || 0) / (dashboard?.paymentBreakdown?.rent?.expected || 1)) * 100 || 0}%`,
                        backgroundColor: "#4CAF50",
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Electricity Status */}
              <View style={styles.statusItem}>
                <View style={styles.statusHeader}>
                  <Text style={styles.statusLabel}>Electricity</Text>
                  <Text style={styles.statusPercentage}>
                    {(
                      ((dashboard?.paymentBreakdown?.electricity?.collected ||
                        0) /
                        (dashboard?.paymentBreakdown?.electricity?.expected ||
                          1)) *
                        100 || 0
                    ).toFixed(0)}
                    %
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${((dashboard?.paymentBreakdown?.electricity?.collected || 0) / (dashboard?.paymentBreakdown?.electricity?.expected || 1)) * 100 || 0}%`,
                        backgroundColor: "#2196F3",
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Water Status */}
              <View style={styles.statusItem}>
                <View style={styles.statusHeader}>
                  <Text style={styles.statusLabel}>Water</Text>
                  <Text style={styles.statusPercentage}>
                    {(
                      ((dashboard?.paymentBreakdown?.water?.collected || 0) /
                        (dashboard?.paymentBreakdown?.water?.expected || 1)) *
                        100 || 0
                    ).toFixed(0)}
                    %
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${((dashboard?.paymentBreakdown?.water?.collected || 0) / (dashboard?.paymentBreakdown?.water?.expected || 1)) * 100 || 0}%`,
                        backgroundColor: "#FF9800",
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Internet Status */}
              <View style={styles.statusItem}>
                <View style={styles.statusHeader}>
                  <Text style={styles.statusLabel}>Internet</Text>
                  <Text style={styles.statusPercentage}>
                    {(
                      ((dashboard?.paymentBreakdown?.internet?.collected || 0) /
                        (dashboard?.paymentBreakdown?.internet?.expected ||
                          1)) *
                        100 || 0
                    ).toFixed(0)}
                    %
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${((dashboard?.paymentBreakdown?.internet?.collected || 0) / (dashboard?.paymentBreakdown?.internet?.expected || 1)) * 100 || 0}%`,
                        backgroundColor: "#9C27B0",
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Billing Trends */}
      {trends.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billing History</Text>
          {trends.map((cycle) => (
            <View key={cycle._id || cycle.cycleNumber} style={styles.trendCard}>
              <View style={styles.trendHeader}>
                <Text style={styles.trendTitle}>
                  Cycle #{cycle.cycleNumber}
                </Text>
                <Text
                  style={[
                    styles.trendStatus,
                    {
                      color:
                        cycle.status === "active"
                          ? "#4CAF50"
                          : cycle.status === "completed"
                            ? "#2196F3"
                            : "#999",
                    },
                  ]}
                >
                  {cycle.status}
                </Text>
              </View>
              <Text style={styles.trendDate}>
                {new Date(cycle.startDate).toLocaleDateString()} -{" "}
                {new Date(cycle.endDate).toLocaleDateString()}
              </Text>
              <View style={styles.trendAmount}>
                <Text style={styles.trendLabel}>Total Billed:</Text>
                <Text style={styles.trendValue}>
                  ₱{cycle.totalBilled.toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate("BillingDetails", { room })}
        >
          <Text style={styles.actionBtnText}>View Collection Status</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate("PaymentVerification", { room })}
        >
          <Text style={styles.actionBtnText}>Verify Payments</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.spacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyStateIcon: {
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: "#999",
    marginBottom: 32,
    textAlign: "center",
  },
  completionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    width: "100%",
  },
  completionItem: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    gap: 16,
  },
  completionCheckmark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  completionText: {
    flex: 1,
  },
  completionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  completionDetail: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  completionDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 8,
  },
  emptyStateMessage: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginTop: 12,
  },
  header: {
    backgroundColor: "#2E86AB",
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#E0E0E0",
    marginTop: 4,
  },
  kpiContainer: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  kpiPrimary: {
    backgroundColor: "#2E86AB",
  },
  kpiSuccess: {
    backgroundColor: "#4CAF50",
  },
  kpiWarning: {
    backgroundColor: "#FF9800",
  },
  kpiInfo: {
    backgroundColor: "#2196F3",
  },
  kpiLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
    fontWeight: "500",
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFF",
    marginBottom: 4,
  },
  kpiSubtext: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },
  section: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  membersGrid: {
    flexDirection: "row",
    gap: 8,
  },
  memberCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  memberValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2E86AB",
  },
  memberLabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  cycleCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  cycleLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  cycleValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#EEE",
    marginBottom: 16,
  },
  breakdownItem: {
    flex: 1,
    alignItems: "center",
  },
  breakdownLabel: {
    fontSize: 11,
    color: "#999",
    marginBottom: 4,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  statusSection: {
    gap: 12,
  },
  statusItem: {
    gap: 6,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  statusPercentage: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#333",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#EEE",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  trendCard: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trendTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  trendStatus: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  trendDate: {
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
  },
  trendAmount: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  trendLabel: {
    fontSize: 12,
    color: "#666",
  },
  trendValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#2E86AB",
  },
  actionSection: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 8,
  },
  actionBtn: {
    backgroundColor: "#2E86AB",
    borderRadius: 8,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
  spacing: {
    height: 20,
  },
});

export default AdminFinancialDashboardScreen;
