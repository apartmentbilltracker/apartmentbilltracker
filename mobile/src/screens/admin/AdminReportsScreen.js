import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { roomService } from "../../services/apiService";

const WATER_RATE = 5; // ₱5 per day

const AdminReportsScreen = () => {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      fetchRoomDetails(selectedRoom._id);
    }
  }, [selectedRoom]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await roomService.getRooms();
      const allRooms = response.rooms || response.data?.rooms || [];
      setRooms(allRooms);
      if (allRooms.length > 0) {
        setSelectedRoom(allRooms[0]);
      }
    } catch (error) {
      console.log("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoomDetails = async (roomId) => {
    try {
      const response = await roomService.getRoomDetails(roomId);
      const room = response.room || response.data?.room;
      setMembers(room.members || []);
      calculateStats(room);
    } catch (error) {
      console.log("Error fetching room details:", error);
    }
  };

  const calculateStats = (room) => {
    const roomMembers = room.members || [];
    const totalMembers = roomMembers.length;
    const totalPresenceDays = roomMembers.reduce(
      (sum, m) => sum + (m.presence ? m.presence.length : 0),
      0,
    );
    const totalWaterBill = roomMembers.reduce((sum, m) => {
      const presenceDays = m.presence ? m.presence.length : 0;
      return sum + presenceDays * WATER_RATE;
    }, 0);
    const rent = room.billing?.rent || 0;
    const electricity = room.billing?.electricity || 0;
    const totalBilling = rent + electricity + totalWaterBill;

    setStats({
      totalMembers,
      totalPresenceDays,
      totalWaterBill,
      rent,
      electricity,
      totalBilling,
    });
  };

  const generateCSVContent = () => {
    if (!selectedRoom || !members.length) {
      Alert.alert("Error", "No data to export");
      return "";
    }

    let csv = `Room Report: ${selectedRoom.name}\n`;
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;

    if (stats) {
      csv += `ROOM STATISTICS\n`;
      csv += `Total Members,${stats.totalMembers}\n`;
      csv += `Total Presence Days,${stats.totalPresenceDays}\n`;
      csv += `Rent,${stats.rent}\n`;
      csv += `Electricity,${stats.electricity}\n`;
      csv += `Water Bill (₱${WATER_RATE}/day),${stats.totalWaterBill.toFixed(2)}\n`;
      csv += `Total Billing,${stats.totalBilling.toFixed(2)}\n\n`;
    }

    csv += `MEMBER DETAILS\n`;
    csv += `Name,Email,Presence Days,Water Bill (₱)\n`;
    members.forEach((member) => {
      const presenceDays = member.presence ? member.presence.length : 0;
      const waterBill = presenceDays * WATER_RATE;
      csv += `"${member.name || "—"}","${member.email || "—"}",${presenceDays},${waterBill.toFixed(2)}\n`;
    });

    return csv;
  };

  const handleExportCSV = async () => {
    const csvContent = generateCSVContent();
    if (!csvContent) return;

    try {
      await Share.share({
        message: csvContent,
        title: `${selectedRoom.name} Report`,
        url: `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to export report");
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#b38604" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Room Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Room</Text>
        <FlatList
          data={rooms}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.roomOption,
                selectedRoom?._id === item._id && styles.roomOptionActive,
              ]}
              onPress={() => setSelectedRoom(item)}
            >
              <Text
                style={[
                  styles.roomOptionText,
                  selectedRoom?._id === item._id && styles.roomOptionTextActive,
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {selectedRoom && stats && (
        <>
          {/* Export Button */}
          <View style={styles.exportSection}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExportCSV}
            >
              <Text style={styles.exportButtonText}>📥 Export CSV Report</Text>
            </TouchableOpacity>
          </View>

          {/* Statistics Summary */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Members</Text>
              <Text style={styles.statValue}>{stats.totalMembers}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Presence Days</Text>
              <Text style={[styles.statValue, { color: "#0066cc" }]}>
                {stats.totalPresenceDays}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Rent</Text>
              <Text style={styles.statValue}>₱{stats.rent.toFixed(2)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Electricity</Text>
              <Text style={styles.statValue}>
                ₱{stats.electricity.toFixed(2)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Water</Text>
              <Text style={[styles.statValue, { color: "#00a8e8" }]}>
                ₱{stats.totalWaterBill.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.statCard, styles.totalCard]}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={[styles.statValue, { color: "#28a745" }]}>
                ₱{stats.totalBilling.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Member Analytics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Member Analytics</Text>
            {members.length === 0 ? (
              <Text style={styles.noDataText}>No members in this room</Text>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const presenceDays = item.presence ? item.presence.length : 0;
                  const waterBill = presenceDays * WATER_RATE;
                  const percentOfTotal =
                    stats.totalPresenceDays > 0
                      ? (
                          (presenceDays / stats.totalPresenceDays) *
                          100
                        ).toFixed(1)
                      : 0;

                  return (
                    <View style={styles.memberCard}>
                      <View style={styles.memberHeader}>
                        <Text style={styles.memberName}>
                          {item.name || item.email || "—"}
                        </Text>
                        <Text style={styles.percentBadge}>
                          {percentOfTotal}%
                        </Text>
                      </View>
                      <View style={styles.memberStats}>
                        <View style={styles.memberStatItem}>
                          <Text style={styles.memberStatLabel}>
                            Presence Days
                          </Text>
                          <Text style={styles.memberStatValue}>
                            {presenceDays}
                          </Text>
                        </View>
                        <View style={styles.memberStatItem}>
                          <Text style={styles.memberStatLabel}>Water Bill</Text>
                          <Text style={styles.memberStatValue}>
                            ₱{waterBill.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                      {item.email && (
                        <Text style={styles.memberEmail}>{item.email}</Text>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  section: {
    padding: 16,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  exportSection: {
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  exportButton: {
    backgroundColor: "#28a745",
    borderRadius: 6,
    padding: 14,
    alignItems: "center",
  },
  exportButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  roomOption: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  roomOptionActive: {
    borderColor: "#b38604",
    backgroundColor: "#fffbf0",
  },
  roomOptionText: {
    fontSize: 14,
    color: "#666",
  },
  roomOptionTextActive: {
    color: "#b38604",
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "#f5f5f5",
  },
  statCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  totalCard: {
    borderWidth: 2,
    borderColor: "#28a745",
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  memberCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#b38604",
  },
  memberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  percentBadge: {
    backgroundColor: "#0066cc",
    color: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "600",
  },
  memberStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  memberStatItem: {
    flex: 1,
  },
  memberStatLabel: {
    fontSize: 11,
    color: "#999",
    marginBottom: 2,
  },
  memberStatValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  memberEmail: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  noDataText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 20,
  },
});

export default AdminReportsScreen;
