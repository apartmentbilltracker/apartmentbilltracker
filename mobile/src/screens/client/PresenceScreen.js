import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { presenceService, roomService } from "../../services/apiService";
import { AuthContext } from "../../context/AuthContext";
import { useTheme } from "../../theme/ThemeContext";

const PresenceScreen = () => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { state } = useContext(AuthContext);
  const userId = state?.user?.id || state?.user?._id;
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);
  const pendingUpdatesRef = useRef(new Set());
  const updateTimeoutRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Whether an admin-configured billing period or an active billing cycle exists for this room
  // Allow marking when either a BillingCycle has been created (currentCycleId) OR the room has billing.start and billing.end set
  const hasActiveCycle = Boolean(
    selectedRoom?.currentCycleId ||
    (selectedRoom?.billing?.start && selectedRoom?.billing?.end),
  );

  const userPaidStatus = useMemo(() => {
    if (!selectedRoom || !userId) return false;
    const userPayment = selectedRoom.memberPayments?.find(
      (mp) => String(mp.member) === String(userId),
    );
    if (!userPayment) return false;
    return (
      userPayment.rentStatus === "paid" &&
      userPayment.electricityStatus === "paid" &&
      userPayment.waterStatus === "paid"
    );
  }, [selectedRoom, userId, selectedRoom?.memberPayments?.length]);

  // Individual user can mark presence only if they have NOT paid for this cycle
  const canMarkPresence = hasActiveCycle && !userPaidStatus;

  const [markedDates, setMarkedDates] = useState([]);
  const markedDatesSet = useMemo(() => new Set(markedDates), [markedDates]);
  const [rangeStartDate, setRangeStartDate] = useState(null);
  const [markingMultiple, setMarkingMultiple] = useState(false);
  const [isMarkingInProgress, setIsMarkingInProgress] = useState(false); // Prevent duplicate requests

  useFocusEffect(
    React.useCallback(() => {
      const refresh = async () => {
        try {
          const response = await roomService.getClientRooms();
          const data = response.data || response;
          const fetchedRooms = data.rooms || data || [];
          setRooms(fetchedRooms);
          if (fetchedRooms.length > 0) {
            setSelectedRoom(fetchedRooms[0]);
            await loadMarkedDates();
          }
        } catch (error) {
          console.error("Error refreshing rooms:", error);
        } finally {
          setLoading(false);
        }
      };
      refresh();
    }, []),
  );

  useEffect(() => {
    if (selectedRoom && (selectedRoom.id || selectedRoom._id)) {
      loadMarkedDates();

      // Auto-set calendar to the billing cycle start month
      if (selectedRoom?.billing?.start) {
        const billingStart = new Date(selectedRoom.billing.start);
        setCurrentMonth(
          new Date(billingStart.getFullYear(), billingStart.getMonth(), 1),
        );
      }
    }
  }, [selectedRoom?.id || selectedRoom?._id]);

  const fetchRooms = async (skipAutoSelect = false) => {
    try {
      setLoading(true);
      const response = await roomService.getClientRooms();
      const data = response.data || response;
      const fetchedRooms = data.rooms || data || [];

      // Backend already filters to show only rooms user is part of (via $or query with memberPayments)
      // So use all returned rooms without additional filtering
      setRooms(fetchedRooms);
      // Skip auto-selection if explicitly requested (e.g., when returning from payment)
      if (!skipAutoSelect && fetchedRooms.length > 0 && !selectedRoom) {
        setSelectedRoom(fetchedRooms[0]);
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
      // Fetch full room data directly to get presence (list endpoint excludes presence)
      const roomResponse = await roomService.getRoomById(
        selectedRoom.id || selectedRoom._id,
      );
      const roomData = roomResponse.data || roomResponse;
      const room = roomData.room || roomData;

      // Find current user's member record in the room
      const currentUserMember = room.members?.find(
        (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
      );

      if (currentUserMember && Array.isArray(currentUserMember.presence)) {
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

    if (!canMarkPresence) {
      Alert.alert(
        "No active billing cycle or billing period",
        "Unable to mark presence because there is no active billing cycle or billing period, or you have already paid all your bills. Please contact your admin.",
      );
      return;
    }

    // Prevent duplicate marking requests
    if (isMarkingInProgress) {
      return;
    }

    const dateStr = formatToYMD(date);

    // Prevent double-clicking the same date
    if (pendingUpdatesRef.current.has(dateStr)) {
      return;
    }

    pendingUpdatesRef.current.add(dateStr);

    // Capture current state for potential revert
    const prevMarked = [...markedDates];
    const isCurrentlyMarked = prevMarked.includes(dateStr);

    // Compute optimistic new state
    const optimisticallyMarked = isCurrentlyMarked
      ? prevMarked.filter((d) => d !== dateStr)
      : [...prevMarked, dateStr];
    const updatedDates = Array.from(new Set(optimisticallyMarked)).sort();

    // Apply optimistic update immediately (instant UI feedback)
    setMarkedDates(updatedDates);
    if (selectedRoom && selectedRoom.members) {
      const updatedMembers = selectedRoom.members.map((m) => {
        if (String(m.user?.id || m.user?._id || m.user) === String(userId)) {
          return { ...m, presence: updatedDates };
        }
        return m;
      });
      setSelectedRoom({ ...selectedRoom, members: updatedMembers });
    }

    // Clear previous timer
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce API call: wait 600ms for user to stop clicking, then send
    updateTimeoutRef.current = setTimeout(async () => {
      // Prevent duplicate API calls
      if (isMarkingInProgress) {
        updateTimeoutRef.current = setTimeout(() => markPresence(date), 300);
        return;
      }

      setIsMarkingInProgress(true);

      try {
        await presenceService.markPresence(
          selectedRoom.id || selectedRoom._id,
          {
            presenceDates: updatedDates,
          },
        );

        pendingUpdatesRef.current.clear();
      } catch (error) {
        // Revert optimistic update on error
        console.error("❌ Error marking presence:", error);
        pendingUpdatesRef.current.clear();
        setMarkedDates(prevMarked);
        if (selectedRoom && selectedRoom.members) {
          const revertedMembers = selectedRoom.members.map((m) => {
            if (
              String(m.user?.id || m.user?._id || m.user) === String(userId)
            ) {
              return { ...m, presence: prevMarked };
            }
            return m;
          });
          setSelectedRoom({ ...selectedRoom, members: revertedMembers });
        }
        Alert.alert("Error", error.message || "Failed to update presence");
      } finally {
        setIsMarkingInProgress(false);
      }
    }, 600); // Increased debounce to 600ms for better batching
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

      await presenceService.markPresence(selectedRoom.id || selectedRoom._id, {
        presenceDates: updatedDates,
      });

      setMarkedDates(updatedDates);

      // Sync to local selectedRoom member
      if (selectedRoom && selectedRoom.members) {
        const updatedMembers = selectedRoom.members.map((m) => {
          if (String(m.user?.id || m.user?._id || m.user) === String(userId)) {
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

      await presenceService.markPresence(selectedRoom.id || selectedRoom._id, {
        presenceDates: updatedDates,
      });

      setMarkedDates(updatedDates);

      // Sync to local selectedRoom member
      if (selectedRoom && selectedRoom.members) {
        const updatedMembers = selectedRoom.members.map((m) => {
          if (String(m.user?.id || m.user?._id || m.user) === String(userId)) {
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

      await presenceService.markPresence(selectedRoom.id || selectedRoom._id, {
        presenceDates: updatedDates,
      });

      setMarkedDates(updatedDates);

      // Sync to local selectedRoom member
      if (selectedRoom && selectedRoom.members) {
        const updatedMembers = selectedRoom.members.map((m) => {
          if (String(m.user?.id || m.user?._id || m.user) === String(userId)) {
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
    return markedDatesSet.has(dateStr);
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

  const calendarDays = useMemo(() => generateCalendarDays(), [currentMonth]);
  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Compute whether prev/next month navigation is within billing cycle range
  const canGoPrevMonth = useMemo(() => {
    if (!selectedRoom?.billing?.start) return true;
    const billingStart = new Date(selectedRoom.billing.start);
    // Allow if currentMonth is after the billing start month
    return (
      currentMonth.getFullYear() > billingStart.getFullYear() ||
      (currentMonth.getFullYear() === billingStart.getFullYear() &&
        currentMonth.getMonth() > billingStart.getMonth())
    );
  }, [currentMonth, selectedRoom?.billing?.start]);

  const canGoNextMonth = useMemo(() => {
    if (!selectedRoom?.billing?.end) return true;
    const billingEnd = new Date(selectedRoom.billing.end);
    // Allow if currentMonth is before the billing end month
    return (
      currentMonth.getFullYear() < billingEnd.getFullYear() ||
      (currentMonth.getFullYear() === billingEnd.getFullYear() &&
        currentMonth.getMonth() < billingEnd.getMonth())
    );
  }, [currentMonth, selectedRoom?.billing?.end]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
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
      {/* ─── HEADER ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="calendar" size={22} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Attendance</Text>
            <Text style={styles.headerSub}>Track your daily presence</Text>
          </View>
        </View>
        {selectedRoom && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {markedDates.length} days
            </Text>
          </View>
        )}
      </View>

      {/* ─── ROOM PILLS ─── */}
      {rooms.length > 0 && (
        <View style={styles.roomPillsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.roomPillsRow}
          >
            {rooms.map((room) => {
              const active =
                (selectedRoom?.id || selectedRoom?._id) ===
                (room.id || room._id);
              return (
                <TouchableOpacity
                  key={room.id || room._id}
                  style={[styles.roomPill, active && styles.roomPillActive]}
                  onPress={() => setSelectedRoom(room)}
                >
                  <Ionicons
                    name="home-outline"
                    size={14}
                    color={active ? "#fff" : "#666"}
                  />
                  <Text
                    style={[
                      styles.roomPillText,
                      active && styles.roomPillTextActive,
                    ]}
                  >
                    {room.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Select room prompt */}
      {!selectedRoom && rooms.length > 0 && (
        <View style={styles.emptyCard}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: colors.accentLight },
            ]}
          >
            <Ionicons name="home-outline" size={36} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>Select a Room</Text>
          <Text style={styles.emptySub}>
            Choose a room above to mark attendance
          </Text>
        </View>
      )}

      {/* ─── MAIN CONTENT ─── */}
      {selectedRoom && canMarkPresence ? (
        <>
          {/* Billing Period Strip */}
          {selectedRoom?.billing?.start && selectedRoom?.billing?.end && (
            <View style={styles.billingStrip}>
              <Ionicons
                name="time-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.billingStripText}>
                Billing Period:{" "}
                {new Date(selectedRoom.billing.start).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" },
                )}
                {" – "}
                {new Date(selectedRoom.billing.end).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", year: "numeric" },
                )}
              </Text>
            </View>
          )}

          {/* ─── QUICK ACTIONS ─── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (marking || markingMultiple) && { opacity: 0.6 },
              ]}
              onPress={markTodayPresence}
              disabled={marking || markingMultiple || !hasActiveCycle}
            >
              {marking || markingMultiple ? (
                <ActivityIndicator color={colors.textOnAccent} size={18} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.textOnAccent}
                  />
                  <Text style={styles.primaryBtnText}>
                    Mark Today's Presence
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.bulkRow}>
              <TouchableOpacity
                style={styles.bulkBtn}
                onPress={() => {
                  if (!hasActiveCycle) {
                    Alert.alert(
                      "No Active Cycle",
                      "No active billing cycle or billing period. Contact your admin.",
                    );
                    return;
                  }
                  markAllCurrentMonth();
                }}
                disabled={markingMultiple || !hasActiveCycle}
              >
                <View
                  style={[styles.bulkIcon, { backgroundColor: colors.infoBg }]}
                >
                  <Ionicons name="calendar" size={16} color={colors.info} />
                </View>
                <Text style={styles.bulkBtnText}>All Month</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bulkBtn}
                onPress={() => {
                  if (!hasActiveCycle) {
                    Alert.alert(
                      "No Active Cycle",
                      "No active billing cycle or billing period. Contact your admin.",
                    );
                    return;
                  }
                  markWorkdaysCurrentMonth();
                }}
                disabled={markingMultiple || !hasActiveCycle}
              >
                <View
                  style={[
                    styles.bulkIcon,
                    { backgroundColor: colors.successBg },
                  ]}
                >
                  <Ionicons name="briefcase" size={16} color={colors.success} />
                </View>
                <Text style={styles.bulkBtnText}>Workdays</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tipRow}>
              <Ionicons
                name="information-circle"
                size={14}
                color={colors.info}
              />
              <Text style={styles.tipText}>
                Tap a date to toggle • Long-press to start a range selection
              </Text>
            </View>
          </View>

          {/* No cycle banner */}
          {!hasActiveCycle && (
            <View style={styles.warnBanner}>
              <Ionicons name="warning" size={16} color="#856404" />
              <Text style={styles.warnText}>
                No active billing cycle. Attendance marking is disabled.
              </Text>
            </View>
          )}

          {/* ─── CALENDAR ─── */}
          <View style={styles.card}>
            <View style={styles.calendarNav}>
              <TouchableOpacity
                style={[styles.navBtn, !canGoPrevMonth && { opacity: 0.25 }]}
                onPress={() => {
                  if (!canGoPrevMonth) return;
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() - 1,
                    ),
                  );
                }}
                disabled={!canGoPrevMonth}
              >
                <Ionicons name="chevron-back" size={20} color={colors.accent} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{monthName}</Text>
              <TouchableOpacity
                style={[styles.navBtn, !canGoNextMonth && { opacity: 0.25 }]}
                onPress={() => {
                  if (!canGoNextMonth) return;
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() + 1,
                    ),
                  );
                }}
                disabled={!canGoNextMonth}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.accent}
                />
              </TouchableOpacity>
            </View>

            {/* Week headers */}
            <View style={styles.weekRow}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <View key={i} style={styles.weekCell}>
                  <Text
                    style={[
                      styles.weekText,
                      (i === 0 || i === 6) && { color: colors.textSecondary },
                    ]}
                  >
                    {d}
                  </Text>
                </View>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.dayGrid}>
              {calendarDays.map((date, index) => {
                if (!date) return <View key={index} style={styles.dayCell} />;

                const markable = isDateMarkable(date);
                const marked = isDateMarked(date);
                const todayFlag = isToday(date);
                const dateYMD = formatToYMD(date);
                const isRangeStart =
                  rangeStartDate && dateYMD === rangeStartDate;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCell,
                      todayFlag && styles.todayCell,
                      marked && styles.markedCell,
                      isRangeStart && styles.rangeCell,
                      !markable && styles.dimCell,
                    ]}
                    onPress={() => {
                      if (!markable) return;
                      if (rangeStartDate) {
                        markDateRange(new Date(rangeStartDate), date);
                      } else {
                        markPresence(date);
                      }
                    }}
                    onLongPress={() => {
                      if (markable)
                        setRangeStartDate(rangeStartDate ? null : dateYMD);
                    }}
                    disabled={!markable}
                    activeOpacity={0.6}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        todayFlag && styles.todayNum,
                        marked && styles.markedNum,
                        !markable && styles.dimText,
                        isRangeStart && { color: "#856404" },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {marked && <View style={styles.markDot} />}
                    {isRangeStart && (
                      <View style={styles.rangeDot}>
                        <Ionicons
                          name="flag"
                          size={8}
                          color={colors.textOnAccent}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    {
                      borderColor: "#1565c0",
                      borderWidth: 2,
                      backgroundColor: colors.infoBg,
                    },
                  ]}
                />
                <Text style={styles.legendLabel}>Today</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#28a745" }]}
                />
                <Text style={styles.legendLabel}>Marked</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: "#ffc107" }]}
                />
                <Text style={styles.legendLabel}>Range</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.skeleton },
                  ]}
                />
                <Text style={styles.legendLabel}>Disabled</Text>
              </View>
            </View>
          </View>

          {/* ─── STATS ─── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Attendance Summary</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <View
                  style={[
                    styles.statIconWrap,
                    { backgroundColor: colors.successBg },
                  ]}
                >
                  <Ionicons
                    name="checkmark-done"
                    size={20}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.statNum}>{markedDates.length}</Text>
                <Text style={styles.statLabel}>Days Marked</Text>
              </View>
              <View style={styles.statBox}>
                <View
                  style={[
                    styles.statIconWrap,
                    { backgroundColor: colors.infoBg },
                  ]}
                >
                  <Ionicons name="water" size={20} color={colors.info} />
                </View>
                <Text style={styles.statNum}>
                  ₱{(markedDates.length * 5).toFixed(0)}
                </Text>
                <Text style={styles.statLabel}>Est. Water Bill</Text>
              </View>
            </View>
          </View>
        </>
      ) : selectedRoom && userPaidStatus ? (
        <View style={styles.emptyCard}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: colors.successBg },
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={36}
              color={colors.success}
            />
          </View>
          <Text style={styles.emptyTitle}>All Bills Paid</Text>
          <Text style={styles.emptySub}>
            You have paid all your bills for this billing period. Attendance
            marking is locked.
          </Text>
        </View>
      ) : selectedRoom ? (
        <View style={styles.emptyCard}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: colors.warningBg },
            ]}
          >
            <Ionicons name="time" size={36} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>No Active Billing Cycle</Text>
          <Text style={styles.emptySub}>
            Waiting for admin to set billing details for this billing period.
          </Text>
        </View>
      ) : null}

      {rooms.length === 0 && (
        <View style={styles.emptyCard}>
          <View
            style={[styles.emptyIconWrap, { backgroundColor: colors.inputBg }]}
          >
            <Ionicons
              name="home-outline"
              size={36}
              color={colors.textTertiary}
            />
          </View>
          <Text style={styles.emptyTitle}>No Rooms Joined</Text>
          <Text style={styles.emptySub}>
            Join a room from Home to start marking attendance.
          </Text>
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },

    /* ─── Header ─── */
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 14,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "#fdf6e3",
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    headerSub: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 1,
    },
    headerBadge: {
      backgroundColor: colors.successBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    headerBadgeText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#28a745",
    },

    /* ─── Room Pills ─── */
    roomPillsWrap: {
      backgroundColor: colors.card,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    roomPillsRow: {
      flexDirection: "row",
      gap: 8,
    },
    roomPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    roomPillActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    roomPillText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    roomPillTextActive: {
      color: colors.textOnAccent,
    },

    /* ─── Billing Strip ─── */
    billingStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginHorizontal: 16,
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.card,
      borderRadius: 10,
      borderLeftWidth: 3,
      borderLeftColor: "#b38604",
    },
    billingStripText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "500",
    },

    /* ─── Cards ─── */
    card: {
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 14,
    },

    /* ─── Primary Button ─── */
    primaryBtn: {
      backgroundColor: "#b38604",
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    primaryBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
    },

    /* ─── Bulk Actions ─── */
    bulkRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 12,
    },
    bulkBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.cardAlt,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    bulkIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    bulkBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },

    /* ─── Tip & Warning ─── */
    tipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.infoBg,
      borderRadius: 8,
    },
    tipText: {
      flex: 1,
      fontSize: 11,
      color: "#1565c0",
      fontWeight: "500",
    },
    warnBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: "#fff8e1",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#ffe082",
    },
    warnText: {
      flex: 1,
      fontSize: 12,
      color: "#856404",
      fontWeight: "600",
    },

    /* ─── Calendar ─── */
    calendarNav: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    navBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#fdf6e3",
      justifyContent: "center",
      alignItems: "center",
    },
    monthLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    weekRow: {
      flexDirection: "row",
      marginBottom: 6,
    },
    weekCell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 6,
    },
    weekText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    dayGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    dayCell: {
      width: "14.28%",
      aspectRatio: 1,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
      borderRadius: 10,
      position: "relative",
    },
    todayCell: {
      backgroundColor: colors.infoBg,
      borderWidth: 2,
      borderColor: "#1565c0",
    },
    markedCell: {
      backgroundColor: colors.successBg,
    },
    rangeCell: {
      backgroundColor: "#fff8e1",
      borderWidth: 2,
      borderColor: "#ffc107",
    },
    dimCell: {
      opacity: 0.3,
    },
    dayNum: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    todayNum: {
      color: "#1565c0",
      fontWeight: "700",
    },
    markedNum: {
      color: "#28a745",
      fontWeight: "700",
    },
    dimText: {
      color: colors.textTertiary,
    },
    markDot: {
      position: "absolute",
      bottom: 4,
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: "#28a745",
    },
    rangeDot: {
      position: "absolute",
      top: 2,
      left: 4,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: "#ffc107",
      justifyContent: "center",
      alignItems: "center",
    },

    /* ─── Legend ─── */
    legendRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 16,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendLabel: {
      fontSize: 11,
      color: colors.textTertiary,
    },

    /* ─── Stats ─── */
    statsRow: {
      flexDirection: "row",
      gap: 12,
    },
    statBox: {
      flex: 1,
      alignItems: "center",
      backgroundColor: colors.cardAlt,
      borderRadius: 12,
      paddingVertical: 16,
    },
    statIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    statNum: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },

    /* ─── Empty States ─── */
    emptyCard: {
      marginHorizontal: 16,
      marginTop: 30,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 30,
      alignItems: "center",
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginTop: 4,
    },
    emptySub: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 6,
      textAlign: "center",
      lineHeight: 18,
    },
  });

export default PresenceScreen;
