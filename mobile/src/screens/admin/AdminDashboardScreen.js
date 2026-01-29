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
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { roomService, apiService } from "../../services/apiService";

const AdminDashboardScreen = ({ navigation }) => {
  const { state, signOut, switchView } = useContext(AuthContext);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchBillingTotals();
  }, []);

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
    await Promise.all([fetchRooms(), fetchBillingTotals()]);
    setRefreshing(false);
  };

  const totalMembers = rooms.reduce(
    (sum, room) => sum + (room.members?.length || 0),
    0,
  );

  const [billingByMonth, setBillingByMonth] = useState([]);
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
  const totalPayerMembers = rooms.reduce(
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
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome</Text>
          <Text style={styles.userName}>{state.user?.name || "Admin"}</Text>
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => switchView("client")}
          >
            <Text style={styles.switchButtonText}>Client View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Ionicons
                name="home-outline"
                size={18}
                color="#6c7a89"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.statLabel}>Total Rooms</Text>
            </View>
            <Text style={styles.statValue}>{rooms.length}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Ionicons
                name="people-outline"
                size={18}
                color="#6c7a89"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.statLabel}>Total Members</Text>
            </View>
            <Text style={styles.statValue}>{totalMembers}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Ionicons
                name="person-circle"
                size={18}
                color="#6c7a89"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.statLabel}>Payer Members</Text>
            </View>
            <Text style={styles.statValue}>{totalPayerMembers}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Ionicons
                name="cash-outline"
                size={18}
                color="#17a2b8"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.statLabel}>Billed (last 6 mo)</Text>
            </View>
            <Text style={styles.statValue}>₱{totalBilledLastN.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Billing - Last 6 months</Text>

        {billingByMonth.length === 0 ? (
          <Text style={styles.noDataText}>No billing data yet</Text>
        ) : (
          <View style={{ paddingVertical: 8 }}>
            {/* Axis + bars */}
            <View style={styles.barChartOuter}>
              <View style={styles.yAxis}>
                {(() => {
                  const max = Math.max(
                    ...billingByMonth.map((x) => x.total || 0),
                    1,
                  );
                  const mid = Math.round(max / 2);
                  return (
                    <>
                      <Text style={styles.axisLabel}>₱{Math.round(max)}</Text>
                      <Text style={styles.axisLabel}>₱{mid}</Text>
                      <Text style={styles.axisLabel}>₱0</Text>
                    </>
                  );
                })()}
              </View>

              <View style={styles.barChartContainer}>
                {billingByMonth.map((b) => {
                  const max = Math.max(
                    ...billingByMonth.map((x) => x.total || 0),
                    1,
                  );
                  const heightPercent = Math.round(
                    ((b.total || 0) / max) * 100,
                  );
                  return (
                    <View key={`${b.year}-${b.month}`} style={styles.barColumn}>
                      <Text style={styles.barValue}>
                        ₱{(b.total || 0).toFixed(0)}
                      </Text>
                      <View
                        style={[
                          styles.bar,
                          { height: `${Math.max(8, heightPercent)}%` },
                        ]}
                      />
                      <Text style={styles.barMonth}>{b.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.chartFooterRow}>
              <Text style={styles.footerSmall}>
                Average/Month: ₱{avgPerMonth.toFixed(2)}
              </Text>
              <Text style={styles.footerSmall}>
                Highest:{" "}
                {highest.label || `${highest.month}/${highest.year || ""}`} ₱
                {(highest.total || 0).toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
          Rooms Overview
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#bdb246"
            style={{ marginTop: 20 }}
          />
        ) : rooms.length === 0 ? (
          <Text style={styles.emptyText}>No rooms created yet</Text>
        ) : (
          rooms.map((room) => (
            <View key={room._id} style={styles.roomCard}>
              <View style={styles.roomCardHeader}>
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={styles.memberBadge}>
                  {room.members?.length || 0}
                </Text>
              </View>
              <Text style={styles.roomDescription}>{room.description}</Text>
              <View style={styles.roomFooter}>
                <View>
                  <Text style={styles.footerLabel}>Billing Period</Text>
                  <Text style={styles.footerValue}>
                    {room.billing?.start && room.billing?.end
                      ? `${new Date(room.billing.start).toLocaleDateString()} - ${new Date(room.billing.end).toLocaleDateString()}`
                      : "Not set"}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  greeting: {
    fontSize: 14,
    color: "#888",
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  switchButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  switchButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  logoutButton: {
    backgroundColor: "#ff6b6b",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "600",
  },
  statsContainer: {
    padding: 16,
    gap: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2d6a6a",
    marginTop: 6,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  roomCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  roomCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  roomName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  memberBadge: {
    backgroundColor: "#2d6a6a",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "600",
  },
  roomDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  barChartOuter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  yAxis: {
    width: 48,
    alignItems: "flex-start",
    paddingRight: 8,
  },
  axisLabel: {
    fontSize: 11,
    color: "#999",
    marginBottom: 12,
  },
  barChartContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 140,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: "70%",
    backgroundColor: "#2d6a6a",
    borderRadius: 6,
  },
  barValue: {
    fontSize: 11,
    color: "#333",
    fontWeight: "700",
    marginBottom: 6,
  },
  barMonth: {
    fontSize: 12,
    marginTop: 8,
    color: "#666",
  },
  chartFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  footerSmall: {
    fontSize: 12,
    color: "#666",
  },
  roomFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  footerLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
  },
  footerValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 20,
  },
});

export default AdminDashboardScreen;
