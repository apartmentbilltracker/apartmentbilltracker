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
} from "react-native";
import { roomService } from "../../services/apiService";

const AdminAttendanceScreen = () => {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [viewMode, setViewMode] = useState("list"); // "list" view for mobile

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
    } catch (error) {
      console.log("Error fetching room details:", error);
    }
  };

  const getDaysInMonth = (yearMonth) => {
    const [year, month] = yearMonth.split("-");
    return new Date(year, month, 0).getDate();
  };

  const getMonthName = (yearMonth) => {
    const [year, month] = yearMonth.split("-");
    return new Date(year, month - 1).toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
  };

  const isDatePresent = (member, dateString) => {
    return member.presence && member.presence.includes(dateString);
  };

  const getMonthPresenceCount = (member) => {
    if (!member.presence) return 0;
    const [year, month] = selectedMonth.split("-");
    return member.presence.filter((date) => date.startsWith(`${year}-${month}`))
      .length;
  };

  const getTotalPresence = (member) => {
    return member.presence ? member.presence.length : 0;
  };

  const getAttendancePercentage = (presenceCount, totalDays) => {
    return totalDays > 0 ? ((presenceCount / totalDays) * 100).toFixed(1) : 0;
  };

  const previousMonth = () => {
    const [year, month] = selectedMonth.split("-");
    const date = new Date(year, month - 2);
    const newMonth = String(date.getMonth() + 1).padStart(2, "0");
    const newYear = date.getFullYear();
    setSelectedMonth(`${newYear}-${newMonth}`);
  };

  const nextMonth = () => {
    const [year, month] = selectedMonth.split("-");
    const date = new Date(year, month);
    const newMonth = String(date.getMonth() + 1).padStart(2, "0");
    const newYear = date.getFullYear();
    setSelectedMonth(`${newYear}-${newMonth}`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#bdb246" />
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

      {selectedRoom && (
        <>
          {/* Month Navigation */}
          <View style={styles.monthSection}>
            <TouchableOpacity
              style={styles.monthButton}
              onPress={previousMonth}
            >
              <Text style={styles.monthButtonText}>← Prev</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{getMonthName(selectedMonth)}</Text>
            <TouchableOpacity style={styles.monthButton} onPress={nextMonth}>
              <Text style={styles.monthButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>

          {/* Members Attendance */}
          {members.length === 0 ? (
            <View style={styles.section}>
              <Text style={styles.noDataText}>No members in this room</Text>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Attendance Summary</Text>
              <FlatList
                data={members}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const daysInMonth = getDaysInMonth(selectedMonth);
                  const monthPresenceCount = getMonthPresenceCount(item);
                  const totalPresence = getTotalPresence(item);
                  const attendanceRate = getAttendancePercentage(
                    monthPresenceCount,
                    daysInMonth,
                  );

                  return (
                    <View key={item._id} style={styles.memberCard}>
                      <View style={styles.memberHeader}>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>
                            {item.name || item.email || "—"}
                          </Text>
                          <Text style={styles.memberEmail}>
                            {item.email || "—"}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.attendanceBadge,
                            attendanceRate >= 80
                              ? styles.attendanceGood
                              : styles.attendanceWarning,
                          ]}
                        >
                          <Text style={styles.attendanceText}>
                            {attendanceRate}%
                          </Text>
                        </View>
                      </View>

                      <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                          <Text style={styles.statLabel}>This Month</Text>
                          <Text style={styles.statValue}>
                            {monthPresenceCount}/{daysInMonth}
                          </Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statLabel}>All Time</Text>
                          <Text style={styles.statValue}>{totalPresence}</Text>
                        </View>
                      </View>

                      {/* Days Grid */}
                      <View style={styles.daysGrid}>
                        {(() => {
                          const [year, month] = selectedMonth.split("-");
                          const firstDay = new Date(
                            year,
                            month - 1,
                            1,
                          ).getDay();
                          const daysInMonth = new Date(
                            year,
                            month,
                            0,
                          ).getDate();
                          const cells = [];

                          // Days of month
                          for (let day = 1; day <= daysInMonth; day++) {
                            const dateString = `${year}-${month}-${String(day).padStart(2, "0")}`;
                            const isPresent = isDatePresent(item, dateString);

                            cells.push(
                              <View
                                key={day}
                                style={[
                                  styles.dayCell,
                                  isPresent
                                    ? styles.dayPresent
                                    : styles.dayAbsent,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.dayCellText,
                                    isPresent && styles.dayPresentText,
                                  ]}
                                >
                                  {day}
                                </Text>
                              </View>,
                            );
                          }

                          return cells;
                        })()}
                      </View>
                    </View>
                  );
                }}
              />
            </View>
          )}
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
    borderColor: "#bdb246",
    backgroundColor: "#fffbf0",
  },
  roomOptionText: {
    fontSize: 14,
    color: "#666",
  },
  roomOptionTextActive: {
    color: "#bdb246",
    fontWeight: "600",
  },
  monthSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  monthButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
  },
  monthButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    flex: 1,
  },
  memberCard: {
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    borderLeftWidth: 4,
    borderLeftColor: "#bdb246",
    padding: 12,
  },
  memberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  memberEmail: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  attendanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 60,
    alignItems: "center",
  },
  attendanceGood: {
    backgroundColor: "#d4edda",
  },
  attendanceWarning: {
    backgroundColor: "#fff3cd",
  },
  attendanceText: {
    fontWeight: "700",
    fontSize: 12,
    color: "#333",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#e8f4f8",
    borderRadius: 6,
    padding: 8,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  dayCell: {
    width: "13.33%", // 7 days per row, minus gap
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
    marginBottom: 2,
  },
  dayPresent: {
    backgroundColor: "#28a745",
  },
  dayAbsent: {
    backgroundColor: "#e0e0e0",
  },
  dayCellText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#999",
  },
  dayPresentText: {
    color: "#fff",
  },
  noDataText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 20,
  },
});

export default AdminAttendanceScreen;
