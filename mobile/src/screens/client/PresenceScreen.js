import React, { useState, useEffect, useContext, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { presenceService, roomService } from "../../services/apiService";
import { AuthContext } from "../../context/AuthContext";

const PresenceScreen = () => {
  const { state } = useContext(AuthContext);
  const isFocused = useIsFocused();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);
  const pendingUpdatesRef = useRef(new Set());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Whether an admin-configured billing period or an active billing cycle exists for this room
  // Allow marking when either a BillingCycle has been created (currentCycleId) OR the room has billing.start and billing.end set
  const hasActiveCycle = Boolean(
    selectedRoom?.currentCycleId ||
    (selectedRoom?.billing?.start && selectedRoom?.billing?.end),
  );
  const [markedDates, setMarkedDates] = useState([]);
  const [rangeStartDate, setRangeStartDate] = useState(null);
  const [markingMultiple, setMarkingMultiple] = useState(false);

  const userId = state?.user?._id;

  useEffect(() => {
    fetchRooms();
  }, []);

  // Refetch rooms when screen gains focus to get updated billing info
  useEffect(() => {
    if (isFocused) {
      fetchRooms();
    }
  }, [isFocused]);

  useEffect(() => {
    if (selectedRoom) {
      loadMarkedDates();
    }
  }, [selectedRoom, currentMonth]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await roomService.getRooms();
      console.log("Presence Screen - getRooms response:", response);
      // Handle response structure from fetch API: response = { data, status }
      const data = response.data || response;
      const fetchedRooms = data.rooms || data || [];
      console.log("Presence Screen - fetched rooms:", fetchedRooms);

      // Filter to only show rooms user is part of
      const userRooms = fetchedRooms.filter((room) =>
        room.members?.some(
          (m) => String(m.user?._id || m.user) === String(userId),
        ),
      );

      setRooms(userRooms);
      if (userRooms.length > 0 && !selectedRoom) {
        setSelectedRoom(userRooms[0]);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
      Alert.alert("Error", "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  };

  const loadMarkedDates = async () => {
    if (!selectedRoom || !userId) return;

    try {
      // Find current user's member record in the room
      const currentUserMember = selectedRoom.members?.find(
        (m) => String(m.user?._id || m.user) === String(userId),
      );

      if (currentUserMember && Array.isArray(currentUserMember.presence)) {
        console.log("Loaded presence dates:", currentUserMember.presence);
        // Normalize presence dates to YYYY-MM-DD local format
        const normalized = currentUserMember.presence
          .map((d) => formatToYMD(d))
          .filter(Boolean);
        setMarkedDates(normalized);
      } else {
        setMarkedDates([]);
      }
    } catch (error) {
      console.error("Error loading marked dates:", error);
    }
  };

  const markPresence = async (date) => {
    if (!selectedRoom || !userId) return;

    if (!hasActiveCycle) {
      Alert.alert(
        "No active billing cycle or billing period",
        "Unable to mark presence because there is no active billing cycle or billing period. Please contact your admin.",
      );
      return;
    }

    const dateStr = formatToYMD(date);

    // Avoid duplicate pending updates for the same date
    if (pendingUpdatesRef.current.has(dateStr)) {
      console.log("Presence update pending for", dateStr);
      return;
    }

    // Capture current state for potential revert
    const prevMarked = [...markedDates];
    const isCurrentlyMarked = prevMarked.includes(dateStr);

    // Compute optimistic new state
    const optimisticallyMarked = isCurrentlyMarked
      ? prevMarked.filter((d) => d !== dateStr)
      : [...prevMarked, dateStr];
    const updatedDates = Array.from(new Set(optimisticallyMarked)).sort();

    // Apply optimistic update immediately
    setMarkedDates(updatedDates);
    if (selectedRoom && selectedRoom.members) {
      const updatedMembers = selectedRoom.members.map((m) => {
        if (String(m.user?._id || m.user) === String(userId)) {
          return { ...m, presence: updatedDates };
        }
        return m;
      });
      setSelectedRoom({ ...selectedRoom, members: updatedMembers });
    }

    // Mark as pending to prevent repeated taps
    pendingUpdatesRef.current.add(dateStr);

    // Send update in background
    try {
      await presenceService.markPresence(selectedRoom._id, {
        presenceDates: updatedDates,
      });
      // Success: remove pending flag
      pendingUpdatesRef.current.delete(dateStr);
      console.log("Presence update succeeded for", dateStr);
    } catch (error) {
      // Revert optimistic update
      pendingUpdatesRef.current.delete(dateStr);
      console.error("Error marking presence:", error);
      setMarkedDates(prevMarked);
      if (selectedRoom && selectedRoom.members) {
        const revertedMembers = selectedRoom.members.map((m) => {
          if (String(m.user?._id || m.user) === String(userId)) {
            return { ...m, presence: prevMarked };
          }
          return m;
        });
        setSelectedRoom({ ...selectedRoom, members: revertedMembers });
      }
      Alert.alert("Error", error.message || "Failed to update presence");
    }
  };

  const markTodayPresence = async () => {
    if (!hasActiveCycle) {
      Alert.alert(
        "No active billing cycle or billing period",
        "Unable to mark presence because there is no active billing cycle or billing period. Please contact your admin.",
      );
      return;
    }
    await markPresence(new Date());
  };

  const markAllCurrentMonth = async () => {
    if (!selectedRoom || !userId) return;

    if (!hasActiveCycle) {
      Alert.alert(
        "No active billing cycle or billing period",
        "Unable to mark presence because there is no active billing cycle or billing period. Please contact your admin.",
      );
      return;
    }

    try {
      setMarkingMultiple(true);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const daysInMonth = getDaysInMonth(currentMonth);

      let datesToAdd = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        if (isDateMarkable(date)) {
          const dateStr = formatToYMD(date);
          datesToAdd.push(dateStr);
        }
      }

      // Merge with existing marked dates
      let updatedDates = [...new Set([...markedDates, ...datesToAdd])];
      updatedDates.sort();

      console.log("Marking all month dates:", datesToAdd.length, "dates");

      await presenceService.markPresence(selectedRoom._id, {
        presenceDates: updatedDates,
      });

      setMarkedDates(updatedDates);

      // Sync to local selectedRoom member
      if (selectedRoom && selectedRoom.members) {
        const updatedMembers = selectedRoom.members.map((m) => {
          if (String(m.user?._id || m.user) === String(userId)) {
            return { ...m, presence: updatedDates };
          }
          return m;
        });
        setSelectedRoom({ ...selectedRoom, members: updatedMembers });
      }

      Alert.alert(
        "Success",
        `Marked ${datesToAdd.length} dates in ${currentMonth.toLocaleDateString("en-US", { month: "long" })}`,
      );
    } catch (error) {
      console.error("Error marking all month:", error);
      Alert.alert("Error", error.message || "Failed to mark all dates");
    } finally {
      setMarkingMultiple(false);
    }
  };

  const markWorkdaysCurrentMonth = async () => {
    if (!selectedRoom || !userId) return;

    if (!hasActiveCycle) {
      Alert.alert(
        "No active billing cycle or billing period",
        "Unable to mark presence because there is no active billing cycle or billing period. Please contact your admin.",
      );
      return;
    }

    try {
      setMarkingMultiple(true);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const daysInMonth = getDaysInMonth(currentMonth);

      let datesToAdd = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        // 1 = Monday, 2 = Tuesday, ..., 5 = Friday (0 = Sunday, 6 = Saturday)
        const isWorkday = dayOfWeek > 0 && dayOfWeek < 6;

        if (isDateMarkable(date) && isWorkday) {
          const dateStr = formatToYMD(date);
          datesToAdd.push(dateStr);
        }
      }

      let updatedDates = [...new Set([...markedDates, ...datesToAdd])];
      updatedDates.sort();

      console.log("Marking workdays:", datesToAdd.length, "dates");

      await presenceService.markPresence(selectedRoom._id, {
        presenceDates: updatedDates,
      });

      setMarkedDates(updatedDates);

      // Sync to local selectedRoom member
      if (selectedRoom && selectedRoom.members) {
        const updatedMembers = selectedRoom.members.map((m) => {
          if (String(m.user?._id || m.user) === String(userId)) {
            return { ...m, presence: updatedDates };
          }
          return m;
        });
        setSelectedRoom({ ...selectedRoom, members: updatedMembers });
      }

      Alert.alert(
        "Success",
        `Marked ${datesToAdd.length} workdays in ${currentMonth.toLocaleDateString("en-US", { month: "long" })}`,
      );
    } catch (error) {
      console.error("Error marking workdays:", error);
      Alert.alert("Error", error.message || "Failed to mark workdays");
    } finally {
      setMarkingMultiple(false);
    }
  };

  const markDateRange = async (startDate, endDate) => {
    if (!selectedRoom || !userId) return;

    if (!hasActiveCycle) {
      Alert.alert(
        "No active billing cycle or billing period",
        "Unable to mark presence because there is no active billing cycle or billing period. Please contact your admin.",
      );
      return;
    }

    try {
      setMarkingMultiple(true);
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        Alert.alert("Error", "Start date must be before end date");
        setMarkingMultiple(false);
        return;
      }

      let datesToAdd = [];
      const currentDate = new Date(start);

      while (currentDate <= end) {
        if (isDateMarkable(currentDate)) {
          const dateStr = formatToYMD(currentDate);
          datesToAdd.push(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      let updatedDates = [...new Set([...markedDates, ...datesToAdd])];
      updatedDates.sort();

      console.log("Marking date range:", datesToAdd.length, "dates");

      await presenceService.markPresence(selectedRoom._id, {
        presenceDates: updatedDates,
      });

      setMarkedDates(updatedDates);

      // Sync to local selectedRoom member
      if (selectedRoom && selectedRoom.members) {
        const updatedMembers = selectedRoom.members.map((m) => {
          if (String(m.user?._id || m.user) === String(userId)) {
            return { ...m, presence: updatedDates };
          }
          return m;
        });
        setSelectedRoom({ ...selectedRoom, members: updatedMembers });
      }

      Alert.alert(
        "Success",
        `Marked ${datesToAdd.length} dates from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
      );
      setRangeStartDate(null);
    } catch (error) {
      console.error("Error marking date range:", error);
      Alert.alert("Error", error.message || "Failed to mark date range");
    } finally {
      setMarkingMultiple(false);
    }
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  // Format a Date object or date string to YYYY-MM-DD (local date)
  const formatToYMD = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const isDateMarked = (date) => {
    if (!date) return false;
    const dateStr = formatToYMD(date);
    return markedDates.includes(dateStr);
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isPastDate = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isFutureDate = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };

  const isDateInBillingRange = (date) => {
    if (!date || !selectedRoom?.billing) return false;
    const dateStr = formatToYMD(date);
    const billingStartStr = formatToYMD(new Date(selectedRoom.billing.start));
    const billingEndStr = formatToYMD(new Date(selectedRoom.billing.end));
    if (!billingStartStr || !billingEndStr) return false;
    return dateStr >= billingStartStr && dateStr <= billingEndStr;
  };

  const isDateMarkable = (date) => {
    // Can only mark dates that are:
    // - There is an active billing cycle created by admin
    // - Within billing range
    // - Not in the future
    return hasActiveCycle && isDateInBillingRange(date) && !isFutureDate(date);
  };

  const calendarDays = generateCalendarDays();
  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#bdb246" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mark Attendance</Text>
        <Text style={styles.headerSubtitle}>Track your daily presence</Text>
      </View>

      {/* Room Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Room</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {rooms.map((room) => (
            <TouchableOpacity
              key={room._id}
              style={[
                styles.roomSelector,
                selectedRoom?._id === room._id && styles.roomSelectorActive,
              ]}
              onPress={() => setSelectedRoom(room)}
            >
              <Text
                style={[
                  styles.roomSelectorText,
                  selectedRoom?._id === room._id &&
                    styles.roomSelectorTextActive,
                ]}
              >
                {room.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {selectedRoom && (
        <>
          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            {/* Primary Action */}
            <TouchableOpacity
              style={[
                styles.markButton,
                (marking || markingMultiple || !hasActiveCycle) &&
                  styles.buttonDisabled,
              ]}
              onPress={() => {
                if (!hasActiveCycle) {
                  Alert.alert(
                    "No active billing cycle or billing period",
                    "Unable to mark presence because there is no active billing cycle or billing period. Please contact your admin.",
                  );
                  return;
                }
                markTodayPresence();
              }}
              disabled={marking || markingMultiple || !hasActiveCycle}
            >
              {marking || markingMultiple ? (
                <ActivityIndicator color="#fff" size={18} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.markButtonText}>
                    Mark Today's Presence
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Bulk Actions */}
            <Text style={styles.bulkActionLabel}>Bulk Mark</Text>
            <View style={styles.bulkActionsContainer}>
              <TouchableOpacity
                style={[styles.bulkButton, styles.bulkButtonPrimary]}
                onPress={() => {
                  if (!hasActiveCycle) {
                    Alert.alert(
                      "No active billing cycle or billing period",
                      "Unable to mark presence because there is no active billing cycle or billing period. Please contact your admin.",
                    );
                    return;
                  }
                  markAllCurrentMonth();
                }}
                disabled={markingMultiple || !hasActiveCycle}
              >
                <MaterialIcons
                  name="calendar-today"
                  size={18}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.bulkButtonText}>All Month</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.bulkButton, styles.bulkButtonSecondary]}
                onPress={() => {
                  if (!hasActiveCycle) {
                    Alert.alert(
                      "No active billing cycle or billing period",
                      "Unable to mark presence because there is no active billing cycle or billing period. Please contact your admin.",
                    );
                    return;
                  }
                  markWorkdaysCurrentMonth();
                }}
                disabled={markingMultiple || !hasActiveCycle}
              >
                <MaterialIcons
                  name="work"
                  size={18}
                  color="#666"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.bulkButtonTextSecondary}>Workdays</Text>
              </TouchableOpacity>
            </View>

            {/* Range Selection Helper Text */}
            <View style={styles.rangeHelperContainer}>
              <MaterialIcons name="info" size={16} color="#17a2b8" />
              <Text style={styles.rangeHelperText}>
                Tap a date to toggle presence. Long-press to start a range, then
                tap another date to complete the range.
              </Text>
            </View>

            {/* No active billing cycle notice */}
            {!hasActiveCycle && (
              <View style={styles.noCycleBanner}>
                <MaterialIcons name="error-outline" size={16} color="#856404" />
                <Text style={styles.noCycleText}>
                  No active billing cycle or billing period. Attendance marking
                  is disabled. Please contact your admin.
                </Text>
              </View>
            )}
          </View>

          {/* Calendar */}
          <View style={styles.section}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() - 1,
                    ),
                  )
                }
              >
                <Ionicons name="chevron-back" size={24} color="#bdb246" />
              </TouchableOpacity>

              <Text style={styles.monthYear}>{monthName}</Text>

              <TouchableOpacity
                onPress={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() + 1,
                    ),
                  )
                }
              >
                <Ionicons name="chevron-forward" size={24} color="#bdb246" />
              </TouchableOpacity>
            </View>

            {/* Calendar Days Header */}
            <View style={styles.weekDaysContainer}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <View key={day} style={styles.weekDayHeader}>
                  <Text style={styles.weekDayText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.calendarDaysContainer}>
              {calendarDays.map((date, index) => {
                const isMarkable = date && isDateMarkable(date);
                const isFuture = date && isFutureDate(date);
                const dateYMD = date ? formatToYMD(date) : null;
                const isRangeStart =
                  date && rangeStartDate && dateYMD === rangeStartDate;

                const handleDatePress = () => {
                  if (!isMarkable) return;

                  if (rangeStartDate) {
                    // Complete the range
                    markDateRange(new Date(rangeStartDate), date);
                  } else {
                    // Toggle single date presence
                    markPresence(date);
                  }
                };

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCell,
                      !date && styles.emptyCell,
                      date && isToday(date) && styles.todayCell,
                      date && isDateMarked(date) && styles.markedCell,
                      !isMarkable && styles.disabledCell,
                      isRangeStart && styles.rangeStartCell,
                    ]}
                    onPress={handleDatePress}
                    disabled={!isMarkable}
                    onLongPress={() => {
                      if (isMarkable) {
                        // Long press toggles range start/clear
                        if (!rangeStartDate) {
                          setRangeStartDate(dateYMD);
                        } else {
                          setRangeStartDate(null);
                        }
                      }
                    }}
                  >
                    {date && (
                      <>
                        <Text
                          style={[
                            styles.dayNumber,
                            isToday(date) && styles.todayNumber,
                            isDateMarked(date) && styles.markedNumber,
                            !isMarkable && styles.disabledText,
                            isRangeStart && styles.rangeStartText,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                        {isDateMarked(date) && (
                          <View style={styles.markedIndicator}>
                            <Ionicons name="checkmark" size={12} color="#fff" />
                          </View>
                        )}
                        {isRangeStart && (
                          <View style={styles.rangeStartIndicator}>
                            <MaterialIcons name="flag" size={10} color="#fff" />
                          </View>
                        )}
                        {isFuture && (
                          <Text
                            style={{
                              fontSize: 8,
                              color: "#999",
                              marginTop: 2,
                            }}
                          >
                            Future
                          </Text>
                        )}
                        {date && !isDateInBillingRange(date) && !isFuture && (
                          <Text
                            style={{
                              fontSize: 7,
                              color: "#999",
                              marginTop: 2,
                            }}
                          >
                            Out Range
                          </Text>
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={styles.legendToday} />
                <Text style={styles.legendText}>Today</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={styles.legendMarked} />
                <Text style={styles.legendText}>Marked</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={styles.legendDisabled} />
                <Text style={styles.legendText}>Unavailable</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={styles.legendRange} />
                <Text style={styles.legendText}>Range</Text>
              </View>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attendance Summary</Text>
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <MaterialIcons name="check-circle" size={28} color="#28a745" />
                <Text style={styles.statValue}>{markedDates.length}</Text>
                <Text style={styles.statLabel}>Days Marked</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="water" size={28} color="#2196F3" />
                <Text style={styles.statValue}>
                  ₱{(markedDates.length * 5).toFixed(2)}
                </Text>
                <Text style={styles.statLabel}>Water Bill</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {rooms.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialIcons name="inbox" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No Rooms Joined</Text>
          <Text style={styles.emptySubtext}>
            Join a room from Home to mark attendance
          </Text>
        </View>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  roomSelector: {
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  roomSelectorActive: {
    backgroundColor: "#bdb246",
    borderColor: "#bdb246",
  },
  roomSelectorText: {
    color: "#333",
    fontWeight: "600",
    fontSize: 13,
  },
  roomSelectorTextActive: {
    color: "#fff",
  },
  markButton: {
    backgroundColor: "#bdb246",
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  markButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  monthYear: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  weekDaysContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekDayHeader: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  calendarDaysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    position: "relative",
  },
  emptyCell: {
    backgroundColor: "transparent",
  },
  todayCell: {
    backgroundColor: "#e8f4f8",
    borderWidth: 2,
    borderColor: "#17a2b8",
  },
  markedCell: {
    backgroundColor: "#d4edda",
    borderWidth: 2,
    borderColor: "#28a745",
  },
  disabledCell: {
    opacity: 0.5,
    backgroundColor: "#f0f0f0",
  },
  disabledText: {
    color: "#999",
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  todayNumber: {
    color: "#17a2b8",
  },
  markedNumber: {
    color: "#28a745",
  },
  markedIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#28a745",
    justifyContent: "center",
    alignItems: "center",
  },
  rangeStartCell: {
    backgroundColor: "#fff3cd",
    borderWidth: 2,
    borderColor: "#ffc107",
  },
  rangeStartText: {
    color: "#856404",
  },
  rangeStartIndicator: {
    position: "absolute",
    top: 2,
    left: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffc107",
    justifyContent: "center",
    alignItems: "center",
  },
  bulkActionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginTop: 12,
    marginBottom: 8,
  },
  bulkActionsContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  bulkButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  bulkButtonPrimary: {
    backgroundColor: "#17a2b8",
  },
  bulkButtonSecondary: {
    backgroundColor: "#e8f5e9",
    borderWidth: 1,
    borderColor: "#28a745",
  },
  bulkButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  bulkButtonTextSecondary: {
    color: "#666",
    fontWeight: "600",
    fontSize: 12,
  },
  rangeHelperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e1f5fe",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  rangeHelperText: {
    flex: 1,
    fontSize: 11,
    color: "#01579b",
    fontWeight: "500",
  },
  noCycleBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff3cd",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#ffeeba",
  },
  noCycleText: {
    flex: 1,
    fontSize: 12,
    color: "#856404",
    fontWeight: "600",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendToday: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#17a2b8",
  },
  legendMarked: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#28a745",
  },
  legendDisabled: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  legendRange: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ffc107",
  },
  legendText: {
    fontSize: 12,
    color: "#666",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
});

export default PresenceScreen;
