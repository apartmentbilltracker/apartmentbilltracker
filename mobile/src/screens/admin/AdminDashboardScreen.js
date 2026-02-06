import React, { useContext, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
  Alert,
  Dimensions,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { roomService, apiService } from "../../services/apiService";

const AdminDashboardScreen = ({ navigation }) => {
  const { state, signOut, switchView } = useContext(AuthContext);
  const isFocused = useIsFocused();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [paymentStats, setPaymentStats] = useState({
    totalCollected: 0,
    totalPending: 0,
    collectionRate: 0,
  });
  const [billingByMonth, setBillingByMonth] = useState([]);
  const [latestBillingCycle, setLatestBillingCycle] = useState(null);

  useEffect(() => {
    fetchRooms();
    fetchBillingTotals();
    fetchPaymentStats();
    fetchLatestBillingCycle();
  }, []);

  // Check if any billing cycle was closed and refresh data
  useEffect(() => {
    if (isFocused) {
      console.log(
        "🔄 [ADMIN DASHBOARD] Screen focused - refreshing all dashboard data",
      );
      // Clear cached payment stats first
      setPaymentStats({
        totalCollected: 0,
        totalPending: 0,
        collectionRate: 0,
      });
      // Refetch all data
      fetchPaymentStats();
      fetchLatestBillingCycle();
      fetchRooms();
      fetchBillingTotals();
    }
  }, [isFocused]);

  const fetchPaymentStats = async () => {
    try {
      // Add timestamp to force fresh data
      const timestamp = new Date().getTime();
      const response = await apiService.get(
        `/api/v2/admin/billing/payment-stats?t=${timestamp}`,
      );
      console.log("🔍 Payment stats response:", response);

      if (response.success && response.data) {
        console.log("✅ Setting payment stats:", response.data);
        setPaymentStats(response.data);
      } else if (response.data) {
        console.log(
          "✅ Setting payment stats (no success flag):",
          response.data,
        );
        setPaymentStats(response.data);
      } else {
        console.log("⚠️  No data in payment stats response");
        setPaymentStats({
          totalCollected: 0,
          totalPending: 0,
          collectionRate: 0,
        });
      }
    } catch (error) {
      console.log("❌ Error fetching payment stats:", error);
      setPaymentStats({
        totalCollected: 0,
        totalPending: 0,
        collectionRate: 0,
      });
    }
  };

  const fetchLatestBillingCycle = async () => {
    try {
      // Fetch latest billing cycle stats
      console.log("🔍 Calling /api/v2/billing-cycles/totals/latest...");
      const response = await apiService.get(
        "/api/v2/billing-cycles/totals/latest",
      );
      // apiService.get() extracts response.data from axios response
      // So response is {success: true, data: {...}} structure
      console.log("📦 Full response received:", response);
      
      let cycleData = null;
      
      // Check if response has nested data structure
      if (response && response.success && response.data && response.data._id) {
        cycleData = response.data;
        console.log("✅ Using response.data structure:", cycleData);
      } else if (response && response._id) {
        // Direct data structure
        cycleData = response;
        console.log("✅ Using direct response structure:", cycleData);
      } else {
        console.log("❌ No valid cycle data in response, got:", response);
      }
      
      if (cycleData) {
        setLatestBillingCycle(cycleData);
        console.log("✅ Latest billing cycle state updated with:", cycleData);
      } else {
        setLatestBillingCycle(null);
      }
    } catch (error) {
      console.log("❌ Error fetching latest billing cycle:", error);
      console.log("Error details:", error.response || error.message);
      setLatestBillingCycle(null);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await roomService.getRooms();
      setRooms(response.rooms || response.data?.rooms || []);
    } catch (error) {
      console.log("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchRooms(),
      fetchBillingTotals(),
      fetchPaymentStats(),
    ]);
    setRefreshing(false);
  };

  const totalMembers = rooms.reduce(
    (sum, room) => sum + (room.members?.length || 0),
    0,
  );

  const fetchBillingTotals = async (months = 6) => {
    try {
      const res = await apiService.get(
        `/api/v2/billing-cycles/totals/month?months=${months}`,
      );
      if (res?.success) setBillingByMonth(res.data || []);
    } catch (error) {
      console.error("Error fetching billing totals:", error);
    }
  };

  const totalBilledLastN = billingByMonth.reduce(
    (s, b) => s + (b.total || 0),
    0,
  );
  const avgPerMonth = billingByMonth.length
    ? totalBilledLastN / billingByMonth.length
    : 0;
  const highest = billingByMonth.reduce(
    (best, b) => (b.total > (best.total || 0) ? b : best),
    {},
  );
  const totalPayorMembers = rooms.reduce(
    (sum, room) => sum + (room.members?.filter((m) => m.isPayer).length || 0),
    0,
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome Back</Text>
          <Text style={styles.userName}>{state.user?.name || "Admin"}</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="bar-chart" size={32} color="#b38604" />
        </View>
      </View>

      {/* Key Metrics - Payment Status */}
      <View style={styles.metricsSection}>
        <View style={styles.metricsHeaderRow}>
          <Text style={styles.metricsTitle}>Payment Collection</Text>
          {latestBillingCycle?.startDate && latestBillingCycle?.endDate && (
            <View style={styles.billingPeriodBadge}>
              <MaterialIcons name="calendar-today" size={12} color="#b38604" />
              <Text style={styles.billingPeriodText}>
                {new Date(latestBillingCycle.startDate).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" },
                )}{" "}
                -{" "}
                {new Date(latestBillingCycle.endDate).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" },
                )}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { backgroundColor: "#4CAF50" }]}>
            <View style={styles.metricHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.metricLabel}>Collected</Text>
            </View>
            <Text style={styles.metricValue}>
              ₱{(latestBillingCycle?.totalCollected || 0).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: "#FF6B6B" }]}>
            <View style={styles.metricHeader}>
              <Ionicons name="alert-circle" size={24} color="#fff" />
              <Text style={styles.metricLabel}>Pending</Text>
            </View>
            <Text style={styles.metricValue}>
              ₱{(latestBillingCycle?.totalPending || 0).toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={styles.collectionRateContainer}>
          <Text style={styles.collectionRateLabel}>Collection Rate</Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, latestBillingCycle?.collectionRate || 0)}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.collectionRateValue}>
            {(latestBillingCycle?.collectionRate || 0).toFixed(0)}%
          </Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.quickStatCard}>
            <View style={styles.quickStatIcon}>
              <Ionicons name="home" size={24} color="#b38604" />
            </View>
            <Text style={styles.quickStatValue}>{rooms.length}</Text>
            <Text style={styles.quickStatLabel}>Rooms</Text>
          </View>
          <View style={styles.quickStatCard}>
            <View style={styles.quickStatIcon}>
              <Ionicons name="people" size={24} color="#17a2b8" />
            </View>
            <Text style={styles.quickStatValue}>{totalMembers}</Text>
            <Text style={styles.quickStatLabel}>Members</Text>
          </View>
          <View style={styles.quickStatCard}>
            <View style={styles.quickStatIcon}>
              <Ionicons name="wallet" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.quickStatValue}>
              ₱{(totalBilledLastN / 1000).toFixed(0)}k
            </Text>
            <Text style={styles.quickStatLabel}>Billed (6mo)</Text>
          </View>
        </View>
      </View>

      {/* Billing Trend Chart */}
      <View style={styles.section}>
        <View style={styles.chartHeaderContainer}>
          <View>
            <Text style={styles.sectionTitle}>Monthly Billing Trend</Text>
            <Text style={styles.chartSubtitle}>6-month overview</Text>
          </View>
          <View style={styles.trendBadge}>
            <Ionicons name="trending-up" size={18} color="#4CAF50" />
          </View>
        </View>

        {billingByMonth.length === 0 ? (
          <Text style={styles.noDataText}>No billing data yet</Text>
        ) : (
          <View style={styles.chartWrapper}>
            {/* Chart Container */}
            <View style={styles.chartContainer}>
              {/* Y-Axis */}
              <View style={styles.yAxisContainer}>
                {(() => {
                  const max = Math.max(
                    ...billingByMonth.map((x) => x.total || 0),
                    1,
                  );
                  const mid = Math.round(max / 2);
                  return (
                    <>
                      <Text style={styles.yAxisLabel}>₱{Math.round(max)}</Text>
                      <Text style={styles.yAxisLabel}>₱{mid}</Text>
                      <Text style={styles.yAxisLabel}>₱0</Text>
                    </>
                  );
                })()}
              </View>

              {/* Bars */}
              <View style={styles.barsContainer}>
                {billingByMonth.map((b) => {
                  const max = Math.max(
                    ...billingByMonth.map((x) => x.total || 0),
                    1,
                  );
                  const heightPercent = Math.round(
                    ((b.total || 0) / max) * 100,
                  );
                  return (
                    <View
                      key={`${b.year}-${b.month}`}
                      style={styles.barWrapper}
                    >
                      <View style={styles.barValueContainer}>
                        <Text style={styles.barAmountText}>
                          ₱{Math.round(b.total || 0)}
                        </Text>
                      </View>
                      <View style={styles.barBackground}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${Math.max(10, heightPercent)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.barMonthLabel}>{b.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Footer Stats */}
            <View style={styles.chartStatsRow}>
              <View style={styles.statBox}>
                <View style={styles.statIconBox}>
                  <Ionicons name="calculator" size={20} color="#2196F3" />
                </View>
                <View style={styles.statTextBox}>
                  <Text style={styles.statLabel}>Avg/Month</Text>
                  <Text style={styles.statValue}>
                    ₱{avgPerMonth.toFixed(0)}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.statBox}>
                <View
                  style={styles.statIconBox}
                  style={{ backgroundColor: "#E8F5E9" }}
                >
                  <Ionicons name="arrow-up" size={20} color="#4CAF50" />
                </View>
                <View style={styles.statTextBox}>
                  <Text style={styles.statLabel}>Highest</Text>
                  <Text style={styles.statValue}>
                    ₱{(highest.total || 0).toFixed(0)}
                  </Text>
                  <Text style={styles.statSubtitle}>
                    {highest.label || `${highest.month}/${highest.year || ""}`}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Rooms Overview */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rooms Overview</Text>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate("RoomManagement")}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="arrow-forward" size={16} color="#b38604" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#b38604"
            style={{ marginTop: 20 }}
          />
        ) : rooms.length === 0 ? (
          <Text style={styles.emptyText}>No rooms created yet</Text>
        ) : (
          rooms.slice(0, 3).map((room) => (
            <TouchableOpacity
              key={room._id}
              style={styles.roomCardNew}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate("BillingStack", {
                  screen: "AdminBilling",
                  params: { roomId: room._id, roomName: room.name },
                })
              }
            >
              <View style={styles.roomCardLeft}>
                <View style={styles.roomIcon}>
                  <Ionicons name="home" size={20} color="#fff" />
                </View>
                <View style={styles.roomInfo}>
                  <Text style={styles.roomNameNew}>{room.name}</Text>
                  <Text style={styles.roomMemberCount}>
                    {room.members?.length || 0} members
                  </Text>
                </View>
              </View>
              <View style={styles.roomCardRight}>
                <Text style={styles.roomMemberBadge}>
                  {room.members?.length || 0}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#b38604" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e8e8",
  },
  headerIcon: {
    backgroundColor: "#fef3e2",
    borderRadius: 12,
    padding: 10,
  },
  greeting: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginTop: 4,
  },
  metricsSection: {
    backgroundColor: "#fff",
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  metricsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  metricLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  metricValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  collectionRateContainer: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 12,
  },
  collectionRateLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#b38604",
    borderRadius: 4,
  },
  collectionRateValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#b38604",
  },
  statsContainer: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  quickStatIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "500",
  },
  section: {
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    color: "#b38604",
    fontSize: 12,
    fontWeight: "600",
  },
  barChartOuter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
  },
  chartHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartSubtitle: {
    fontSize: 13,
    color: "#999",
    marginTop: 2,
  },
  trendBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0F9FF",
    justifyContent: "center",
    alignItems: "center",
  },
  chartWrapper: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    elevation: 2,
  },
  chartContainer: {
    flexDirection: "row",
    marginBottom: 20,
    height: 200,
  },
  yAxisContainer: {
    width: 50,
    justifyContent: "space-between",
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 28,
  },
  yAxisLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "600",
  },
  barsContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingBottom: 20,
  },
  barWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  barValueContainer: {
    marginBottom: 8,
    minHeight: 20,
    justifyContent: "center",
  },
  barAmountText: {
    fontSize: 11,
    color: "#333",
    fontWeight: "700",
  },
  barBackground: {
    width: "100%",
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
  },
  barFill: {
    width: "100%",
    backgroundColor: "#b38604",
    borderRadius: 8,
  },
  barMonthLabel: {
    fontSize: 11,
    color: "#666",
    fontWeight: "600",
    textAlign: "center",
  },
  chartStatsRow: {
    flexDirection: "row",
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 14,
    gap: 0,
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
  },
  statTextBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "500",
  },
  statValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "700",
    marginTop: 2,
  },
  statSubtitle: {
    fontSize: 10,
    color: "#bbb",
    marginTop: 1,
  },
  divider: {
    width: 1,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 10,
  },
  yAxis: {
    width: 48,
    alignItems: "flex-start",
    paddingRight: 8,
  },
  roomCardNew: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  roomCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  roomIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#b38604",
    justifyContent: "center",
    alignItems: "center",
  },
  roomInfo: {
    flex: 1,
  },
  roomNameNew: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  roomMemberCount: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  roomCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roomMemberBadge: {
    backgroundColor: "#f0f0f0",
    color: "#666",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 20,
  },
  noDataText: {
    textAlign: "center",
    color: "#999",
    marginVertical: 20,
  },
  metricsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  billingPeriodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef3e2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  billingPeriodText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
});

export default AdminDashboardScreen;
