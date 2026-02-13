import React, { useState, useEffect, useMemo } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import {
  roomService,
  billingService,
  apiService,
  presenceService,
} from "../../services/apiService";
import { roundTo2 as r2 } from "../../utils/helpers";
import { useTheme } from "../../theme/ThemeContext";

const WATER_RATE = 5; // ₱5 per day
const ELECTRICITY_RATE = 16; // ₱16 per kW (per unit)

const AdminBillingScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const isFocused = useIsFocused();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rent, setRent] = useState("");
  const [electricity, setElectricity] = useState("");
  const [internet, setInternet] = useState("");
  const [prevReading, setPrevReading] = useState("");
  const [currReading, setCurrReading] = useState("");
  const [cycleCompleted, setCycleCompleted] = useState(false);

  // Fetch rooms on mount and when screen regains focus
  useEffect(() => {
    if (isFocused) {
      fetchRooms();
    }
  }, [isFocused]);

  // Load billing state whenever the selected room changes
  useEffect(() => {
    if (selectedRoom) {
      checkAndResetIfCycleClosed();
    }
  }, [selectedRoom]);

  // Check if current billing cycle is closed and update state accordingly
  const checkAndResetIfCycleClosed = async () => {
    if (!selectedRoom) return;

    try {
      // First refetch the latest room data
      const roomResponse = await roomService.getRoomDetails(
        selectedRoom.id || selectedRoom._id,
      );
      const latestRoom = roomResponse.room || roomResponse.data?.room;

      // Check if room has cycleStatus from backend
      if (latestRoom?.cycleStatus === "completed" && latestRoom?.billing) {
        setCycleCompleted(true);
        const billing = latestRoom.billing;
        setStartDate(
          billing.start
            ? new Date(billing.start).toISOString().split("T")[0]
            : "",
        );
        setEndDate(
          billing.end ? new Date(billing.end).toISOString().split("T")[0] : "",
        );
        setRent(String(billing.rent || ""));
        setElectricity(String(billing.electricity || ""));
        setInternet(String(billing.internet || ""));
        setPrevReading(String(billing.previousReading || ""));
        setCurrReading(String(billing.currentReading || ""));
        setMembers(latestRoom.members || []);
        return;
      }

      if (!latestRoom || !latestRoom.currentCycleId) {
        // No active cycle and no completed cycle — reset all amounts
        setCycleCompleted(false);
        setStartDate("");
        setEndDate("");
        setRent("");
        setElectricity("");
        setInternet("");
        setPrevReading("");
        setCurrReading("");
        setMembers([]);
        return;
      }

      // Fetch the billing cycle to check its status
      try {
        const response = await apiService.get(
          `/api/v2/billing-cycles/${latestRoom.currentCycleId}`,
        );

        const cycleStatus = response?.data?.status;
        if (cycleStatus === "completed" || cycleStatus === "closed") {
          setCycleCompleted(true);
          const billing = latestRoom.billing;
          if (billing) {
            setStartDate(
              billing.start
                ? new Date(billing.start).toISOString().split("T")[0]
                : "",
            );
            setEndDate(
              billing.end
                ? new Date(billing.end).toISOString().split("T")[0]
                : "",
            );
            setRent(String(billing.rent || ""));
            setElectricity(String(billing.electricity || ""));
            setInternet(String(billing.internet || ""));
            setPrevReading(String(billing.previousReading || ""));
            setCurrReading(String(billing.currentReading || ""));
            setMembers(latestRoom.members || []);
          }
          return;
        }
      } catch (cycleError) {
        // Could not fetch cycle details, loading from room data
      }

      // Cycle is still active — show amounts normally
      setCycleCompleted(false);
      const billing = latestRoom.billing;
      setStartDate(
        billing.start
          ? new Date(billing.start).toISOString().split("T")[0]
          : "",
      );
      setEndDate(
        billing.end ? new Date(billing.end).toISOString().split("T")[0] : "",
      );
      setRent(String(billing.rent || ""));
      setElectricity(String(billing.electricity || ""));
      setInternet(String(billing.internet || ""));
      setPrevReading(String(billing.previousReading || ""));
      setCurrReading(String(billing.currentReading || ""));
      setMembers(latestRoom.members || []);
    } catch (error) {
      console.error("Error checking cycle status:", error);
      const billing = selectedRoom.billing;
      if (billing && billing.rent) {
        setStartDate(
          billing.start
            ? new Date(billing.start).toISOString().split("T")[0]
            : "",
        );
        setEndDate(
          billing.end ? new Date(billing.end).toISOString().split("T")[0] : "",
        );
        setRent(String(billing.rent || ""));
        setElectricity(String(billing.electricity || ""));
        setPrevReading(String(billing.previousReading || ""));
        setCurrReading(String(billing.currentReading || ""));
        setMembers(selectedRoom.members || []);
      }
    }
  };

  const fetchRooms = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await roomService.getRooms();
      const allRooms = response.rooms || response.data?.rooms || [];
      setRooms(allRooms);

      // Always update selectedRoom to the latest data so billing state refreshes on focus
      const currentId = selectedRoom?.id || selectedRoom?._id;
      const updatedRoom = currentId
        ? allRooms.find((r) => r.id === currentId || r._id === currentId)
        : null;
      setSelectedRoom(updatedRoom || allRooms[0] || null);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  const fetchRoomDetails = async (roomId) => {
    try {
      const response = await roomService.getRoomDetails(roomId);
      const room = response.room || response.data?.room;
      setMembers(room.members || []);
    } catch (error) {
      console.error("Error fetching room details:", error);
    }
  };

  const calculateWaterBill = (presenceDays) => {
    return (presenceDays || 0) * WATER_RATE;
  };

  const calculateTotalWaterBill = () => {
    return members.reduce((total, member) => {
      const presenceDays = getFilteredPresenceDays(member);
      return total + calculateWaterBill(presenceDays);
    }, 0);
  };

  // Filter presence days to only count those within the current cycle dates
  const getFilteredPresenceDays = (member) => {
    if (!member.presence || !Array.isArray(member.presence)) return 0;
    if (!startDate || !endDate) return member.presence.length; // no dates set yet, show all
    const cycleStart = new Date(startDate);
    const cycleEnd = new Date(endDate);
    cycleEnd.setHours(23, 59, 59, 999);
    return member.presence.filter((day) => {
      const d = new Date(day);
      return d >= cycleStart && d <= cycleEnd;
    }).length;
  };

  // Calculate payor's water share with new formula:
  // = payor's own water + (non-payors' water / payor count)
  const calculatePayorWaterShare = () => {
    const payorCount = members.filter((m) => m.isPayer !== false).length || 1;
    if (payorCount === 0) return 0;

    let payorOwnWater = 0;
    let nonPayorWater = 0;

    members.forEach((member) => {
      const presenceDays = getFilteredPresenceDays(member);
      if (member.isPayer !== false) {
        payorOwnWater += calculateWaterBill(presenceDays);
      } else {
        nonPayorWater += calculateWaterBill(presenceDays);
      }
    });

    // Average across payors
    const avgPayorOwnWater = r2(payorOwnWater / payorCount);
    const sharedNonPayorWater = r2(nonPayorWater / payorCount);
    return r2(avgPayorOwnWater + sharedNonPayorWater);
  };

  const getTotalBilling = () => {
    const rentValue = Number(rent || 0);
    const electricityValue = Number(electricity || 0);
    const waterBill = calculateTotalWaterBill();
    const internetValue = Number(internet || 0);
    return rentValue + electricityValue + waterBill + internetValue;
  };

  // Calculate electricity amount from meter readings
  const calculateElectricityFromReadings = (prev, curr) => {
    const p = Number(prev || 0);
    const c = Number(curr || 0);
    if (isNaN(p) || isNaN(c)) return "";
    const usage = c - p;
    if (usage <= 0) return ""; // invalid or zero usage
    const amount = usage * ELECTRICITY_RATE;
    return amount.toFixed(2);
  };

  const handlePrevReadingChange = (text) => {
    setPrevReading(text);
    const computed = calculateElectricityFromReadings(text, currReading);
    setElectricity(computed === "" ? "" : String(computed));
  };

  const handleCurrReadingChange = (text) => {
    setCurrReading(text);
    const computed = calculateElectricityFromReadings(prevReading, text);
    setElectricity(computed === "" ? "" : String(computed));
  };

  const handleSaveBilling = async () => {
    if (!selectedRoom) return;

    // Comprehensive validation
    if (!startDate || !endDate) {
      Alert.alert(
        "❌ Missing Dates",
        "Please set BOTH start and end billing period dates",
      );
      return;
    }

    if (!rent && !electricity && !prevReading && !currReading) {
      Alert.alert(
        "⚠️ Empty Billing",
        "Please enter at least Rent, Electricity amounts, or meter readings",
      );
      return;
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (startDateObj >= endDateObj) {
      Alert.alert(
        "❌ Invalid Date Range",
        "Start date must be before end date",
      );
      return;
    }

    try {
      setSaving(true);

      // Step 1: Save billing information to room object
      await billingService.saveBilling(selectedRoom.id || selectedRoom._id, {
        start: startDate,
        end: endDate,
        rent: rent ? Number(rent) : undefined,
        electricity: electricity ? Number(electricity) : undefined,
        internet: internet ? Number(internet) : undefined,
        previousReading: prevReading ? Number(prevReading) : undefined,
        currentReading: currReading ? Number(currReading) : undefined,
      });

      // Step 2: Check if an active billing cycle exists
      const currentWaterBill = calculateTotalWaterBill();
      let internetValue = parseFloat(internet);
      if (isNaN(internetValue)) {
        internetValue = 0;
      }

      const cyclePayload = {
        roomId: selectedRoom.id || selectedRoom._id,
        startDate: startDate,
        endDate: endDate,
        rent: parseFloat(rent) || 0,
        electricity: parseFloat(electricity) || 0,
        waterBillAmount: currentWaterBill,
        internet: internetValue,
        previousMeterReading: prevReading ? parseFloat(prevReading) : null,
        currentMeterReading: currReading ? parseFloat(currReading) : null,
      };

      if (!selectedRoom.currentCycleId) {
        const createResponse = await apiService.post(
          "/api/v2/billing-cycles",
          cyclePayload,
        );

        if (!createResponse.success) {
          throw new Error("Failed to create billing cycle");
        }

        Alert.alert(
          "Success",
          "Billing cycle created with current member presence. Click Archive & Close Cycle when ready to finalize.",
        );
      } else {
        // EXISTING CYCLE: Update the active cycle
        const updateResponse = await apiService.put(
          `/api/v2/billing-cycles/${selectedRoom.currentCycleId}`,
          {
            memberCharges: undefined, // Let backend recompute with current presence
            totalBilledAmount: undefined,
            billBreakdown: undefined,
            rent: cyclePayload.rent,
            electricity: cyclePayload.electricity,
            waterBillAmount: cyclePayload.waterBillAmount,
            internet: cyclePayload.internet,
          },
        );

        if (!updateResponse.success) {
          throw new Error("Failed to update billing cycle");
        }

        Alert.alert(
          "Success",
          "Billing amounts updated. Member presence preserved. Click Archive & Close Cycle when ready.",
        );
      }

      await fetchRooms();
      setEditMode(false);
    } catch (error) {
      console.error("Error saving billing:", error);
      Alert.alert(
        "Error",
        error.response?.data?.message ||
          error.message ||
          "Failed to save billing",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToBillingCycle = async () => {
    if (!selectedRoom) return;

    if (!startDate || !endDate || !rent || !electricity) {
      Alert.alert("Error", "Please fill in all billing information first");
      return;
    }

    try {
      setSaving(true);

      // Step 1: Store the current billing data before clearing
      const currentWaterBill = calculateTotalWaterBill();
      let internetValue = parseFloat(internet);
      if (isNaN(internetValue)) {
        internetValue = undefined; // Don't send if not entered, let backend use fallback
      }
      const payload = {
        roomId: selectedRoom.id || selectedRoom._id,
        startDate: startDate,
        endDate: endDate,
        rent: parseFloat(rent),
        electricity: parseFloat(electricity),
        waterBillAmount: currentWaterBill,
        previousMeterReading: prevReading ? parseFloat(prevReading) : null,
        currentMeterReading: currReading ? parseFloat(currReading) : null,
      };

      // Only include internet if it was explicitly entered
      if (internetValue !== undefined && internetValue > 0) {
        payload.internet = internetValue;
      }

      // Step 2: Create billing cycle with current data
      // Create and immediately close the billing cycle
      const createResponse = await apiService.post(
        "/api/v2/billing-cycles",
        payload,
      );

      if (
        createResponse.success &&
        (createResponse.data?.id || createResponse.data?._id)
      ) {
        // Step 3: Close the cycle
        const cycleId = createResponse.data.id || createResponse.data._id;
        await apiService.put(`/api/v2/billing-cycles/${cycleId}/close`, {});

        // Step 4: Clear presence for all members
        try {
          await apiService.put(
            `/api/v2/rooms/${selectedRoom.id || selectedRoom._id}/clear-presence`,
            {},
          );
        } catch (error) {
          console.error("Error clearing presence:", error);
          // Continue even if presence clearing fails
        }

        // Step 5: Clear the billing information
        await billingService.saveBilling(selectedRoom.id || selectedRoom._id, {
          start: null,
          end: null,
          rent: 0,
          electricity: 0,
          previousReading: null,
          currentReading: null,
        });

        // Reset form
        setStartDate("");
        setEndDate("");
        setRent("");
        setElectricity("");
        setPrevReading("");
        setCurrReading("");
        setEditMode(false);

        Alert.alert(
          "Success",
          "Billing cycle archived and cleared. Ready for next month!",
        );

        // Wait a moment and then refresh data
        setTimeout(() => {
          fetchRooms();
        }, 500);
      }
    } catch (error) {
      console.error("Archive error:", error);
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to archive billing cycle",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerLoader}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const fmt = (v) =>
    "\u20B1" +
    (parseFloat(v) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <View style={styles.container}>
      {/* ─── HEADER ─── */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconBg}>
            <MaterialIcons
              name="receipt-long"
              size={20}
              color={colors.textOnAccent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Billing Management</Text>
            <Text style={styles.headerSubtitle}>
              {selectedRoom ? selectedRoom.name : "Select a room"}
            </Text>
          </View>
        </View>
      </View>

      {/* ─── ROOM PILLS ─── */}
      {rooms.length > 0 && (
        <View style={styles.roomPillBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.roomPillContent}
          >
            {rooms.map((room) => {
              const active =
                selectedRoom?.id === room.id || selectedRoom?._id === room._id;
              return (
                <TouchableOpacity
                  key={room.id || room._id}
                  style={[styles.roomPill, active && styles.roomPillActive]}
                  onPress={() => setSelectedRoom(room)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.roomPillDot,
                      {
                        backgroundColor: active
                          ? colors.textOnAccent
                          : colors.textTertiary,
                      },
                    ]}
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchRooms(true)}
            colors={["#b38604"]}
          />
        }
      >
        {/* ─── NO ROOMS EMPTY STATE ─── */}
        {rooms.length === 0 && !loading && !refreshing && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialIcons
                name="meeting-room"
                size={40}
                color={colors.textSecondary}
              />
            </View>
            <Text style={styles.emptyTitle}>No Rooms Available</Text>
            <Text style={styles.emptySubtext}>
              Create a room to start setting billing information.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() =>
                navigation.navigate("RoomStack", {
                  screen: "RoomManagement",
                  params: { openCreate: true },
                })
              }
              activeOpacity={0.8}
            >
              <Ionicons
                name="add-circle"
                size={18}
                color={colors.textOnAccent}
              />
              <Text style={styles.emptyBtnText}>Create Room</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedRoom && (
          <>
            {/* ─── CYCLE COMPLETED BANNER ─── */}
            {cycleCompleted && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginTop: 12,
                  backgroundColor: colors.successBg || "#e8f5e9",
                  borderRadius: 14,
                  padding: 16,
                  borderLeftWidth: 4,
                  borderLeftColor: colors.success || "#27ae60",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <MaterialIcons
                    name="check-circle"
                    size={24}
                    color={colors.success || "#27ae60"}
                  />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: colors.success || "#27ae60",
                      marginLeft: 8,
                    }}
                  >
                    All Payors Paid!
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginBottom: 14,
                    lineHeight: 18,
                  }}
                >
                  This billing cycle has been auto-completed. All amounts are
                  shown below for reference. Create a new billing cycle when
                  ready.
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.accent,
                    borderRadius: 10,
                    paddingVertical: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onPress={async () => {
                    // Clear presence data on server so new cycle starts fresh
                    try {
                      await apiService.put(
                        `/api/v2/rooms/${selectedRoom.id || selectedRoom._id}/clear-presence`,
                        {},
                      );
                    } catch (e) {
                      // Could not clear presence, not critical
                    }
                    setCycleCompleted(false);
                    setStartDate("");
                    setEndDate("");
                    setRent("");
                    setElectricity("");
                    setInternet("");
                    setPrevReading("");
                    setCurrReading("");
                    setMembers((prev) =>
                      prev.map((m) => ({ ...m, presence: [] })),
                    );
                    // Clear currentCycleId so new save creates a fresh cycle
                    setSelectedRoom((prev) => ({
                      ...prev,
                      currentCycleId: null,
                    }));
                    setEditMode(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="add-circle"
                    size={18}
                    color={colors.textOnAccent}
                  />
                  <Text
                    style={{
                      color: colors.textOnAccent,
                      fontWeight: "700",
                      fontSize: 14,
                      marginLeft: 6,
                    }}
                  >
                    Create New Billing Cycle
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── BILLING SUMMARY GRID ─── */}
            <View style={styles.summarySection}>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}>
                  <View
                    style={[styles.summaryDot, { backgroundColor: "#e65100" }]}
                  />
                  <Text style={styles.summaryCellLabel}>Rent</Text>
                  <Text style={styles.summaryCellAmount}>{fmt(rent)}</Text>
                </View>
                <View style={styles.summaryCell}>
                  <View
                    style={[
                      styles.summaryDot,
                      { backgroundColor: colors.electricityColor },
                    ]}
                  />
                  <Text style={styles.summaryCellLabel}>Electricity</Text>
                  <Text style={styles.summaryCellAmount}>
                    {fmt(electricity)}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <View
                    style={[
                      styles.summaryDot,
                      { backgroundColor: colors.waterColor },
                    ]}
                  />
                  <Text style={styles.summaryCellLabel}>Water</Text>
                  <Text style={styles.summaryCellAmount}>
                    {fmt(calculateTotalWaterBill())}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <View
                    style={[
                      styles.summaryDot,
                      { backgroundColor: colors.internetColor },
                    ]}
                  />
                  <Text style={styles.summaryCellLabel}>Internet</Text>
                  <Text style={styles.summaryCellAmount}>{fmt(internet)}</Text>
                </View>
              </View>
              <View style={styles.totalBar}>
                <Text style={styles.totalBarLabel}>Total Billing</Text>
                <Text style={styles.totalBarAmount}>
                  {fmt(getTotalBilling())}
                </Text>
              </View>
            </View>

            {/* ─── ADMIN TOOLS ─── */}
            <View style={styles.toolsSection}>
              <Text style={styles.sectionLabel}>ADMIN TOOLS</Text>
              <View style={styles.toolsGrid}>
                <TouchableOpacity
                  style={styles.toolCard}
                  onPress={() =>
                    navigation.navigate("BillingStack", {
                      screen: "PaymentVerification",
                      params: { room: selectedRoom },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.toolIconBg,
                      { backgroundColor: colors.successBg },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.success}
                    />
                  </View>
                  <Text style={styles.toolCardText}>Verify{"\n"}Payments</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolCard}
                  onPress={() =>
                    navigation.navigate("BillingStack", {
                      screen: "FinancialDashboard",
                      params: { room: selectedRoom },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.toolIconBg,
                      { backgroundColor: colors.infoBg },
                    ]}
                  >
                    <Ionicons name="bar-chart" size={20} color={colors.info} />
                  </View>
                  <Text style={styles.toolCardText}>
                    Financial{"\n"}Dashboard
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolCard}
                  onPress={() =>
                    navigation.navigate("BillingStack", {
                      screen: "Adjustments",
                      params: { room: selectedRoom },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.toolIconBg,
                      { backgroundColor: colors.warningBg },
                    ]}
                  >
                    <Ionicons name="settings" size={20} color="#e65100" />
                  </View>
                  <Text style={styles.toolCardText}>Adjust{"\n"}Charges</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolCard}
                  onPress={() =>
                    navigation.navigate("BillingStack", {
                      screen: "Reminders",
                      params: { room: selectedRoom },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.toolIconBg,
                      { backgroundColor: colors.errorBg },
                    ]}
                  >
                    <Ionicons name="notifications" size={20} color="#c62828" />
                  </View>
                  <Text style={styles.toolCardText}>Send{"\n"}Reminders</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toolCard}
                  onPress={() =>
                    navigation.navigate("BillingStack", {
                      screen: "PresenceReminders",
                      params: { room: selectedRoom },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.toolIconBg,
                      { backgroundColor: colors.purpleBg },
                    ]}
                  >
                    <Ionicons
                      name="location"
                      size={20}
                      color={colors.internetColor}
                    />
                  </View>
                  <Text style={styles.toolCardText}>Presence{"\n"}Check</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ─── BILLING DETAILS FORM ─── */}
            <View style={styles.formCard}>
              <View style={styles.formCardHeader}>
                <View style={styles.formCardHeaderLeft}>
                  <Ionicons
                    name="document-text"
                    size={18}
                    color={colors.accent}
                  />
                  <Text style={styles.formCardTitle}>Billing Details</Text>
                  {cycleCompleted && (
                    <View
                      style={{
                        backgroundColor: "#e8f5e9",
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        marginLeft: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: "#27ae60",
                        }}
                      >
                        COMPLETED
                      </Text>
                    </View>
                  )}
                </View>
                {!editMode ? (
                  <TouchableOpacity
                    style={[
                      styles.editBadge,
                      cycleCompleted && { opacity: 0.4 },
                    ]}
                    onPress={() => {
                      if (cycleCompleted) {
                        Alert.alert(
                          "Cycle Completed",
                          "This billing cycle is complete. Tap 'Create New Billing Cycle' above to start a new one.",
                        );
                        return;
                      }
                      setEditMode(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="pencil"
                      size={13}
                      color={colors.textOnAccent}
                    />
                    <Text style={styles.editBadgeText}>Edit</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.cancelBadge}
                    onPress={() => setEditMode(false)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="close"
                      size={13}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.cancelBadgeText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Billing Period */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 2,
                }}
              >
                <Text style={[styles.formSectionLabel, { marginBottom: 0 }]}>
                  BILLING PERIOD
                </Text>
                {cycleCompleted ? (
                  <View
                    style={{
                      backgroundColor: "#e8f5e9",
                      borderRadius: 6,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      marginLeft: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: "#27ae60",
                      }}
                    >
                      COMPLETED
                    </Text>
                  </View>
                ) : startDate && endDate ? (
                  <View
                    style={{
                      backgroundColor: "#fff3e0",
                      borderRadius: 6,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      marginLeft: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: "#e65100",
                      }}
                    >
                      ACTIVE
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.dateRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.fieldLabel}>Start Date</Text>
                  <View style={styles.fieldWrapper}>
                    <Ionicons
                      name="calendar-outline"
                      size={15}
                      color={colors.accent}
                    />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="YYYY-MM-DD"
                      value={startDate}
                      onChangeText={setStartDate}
                      editable={editMode && !saving}
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
                <View style={styles.dateArrow}>
                  <MaterialIcons
                    name="arrow-forward"
                    size={14}
                    color={colors.textSecondary}
                  />
                </View>
                <View style={styles.dateCol}>
                  <Text style={styles.fieldLabel}>End Date</Text>
                  <View style={styles.fieldWrapper}>
                    <Ionicons
                      name="calendar-outline"
                      size={15}
                      color={colors.accent}
                    />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="YYYY-MM-DD"
                      value={endDate}
                      onChangeText={setEndDate}
                      editable={editMode && !saving}
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
              </View>

              {/* Bill Amounts */}
              <Text style={styles.formSectionLabel}>BILL AMOUNTS</Text>
              <View style={styles.inputPairRow}>
                <View style={styles.inputPairCol}>
                  <Text style={styles.fieldLabel}>Rent</Text>
                  <View style={styles.fieldWrapper}>
                    <Text style={styles.pesoPrefix}>{"\u20B1"}</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="0.00"
                      value={rent}
                      onChangeText={setRent}
                      keyboardType="decimal-pad"
                      editable={editMode && !saving}
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
                <View style={styles.inputPairCol}>
                  <Text style={styles.fieldLabel}>Internet</Text>
                  <View style={styles.fieldWrapper}>
                    <Text style={styles.pesoPrefix}>{"\u20B1"}</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="0.00"
                      value={internet}
                      onChangeText={setInternet}
                      keyboardType="decimal-pad"
                      editable={editMode && !saving}
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
              </View>

              {/* Meter Readings & Electricity */}
              <Text style={styles.formSectionLabel}>METER READINGS</Text>
              <View style={styles.inputPairRow}>
                <View style={styles.inputPairCol}>
                  <Text style={styles.fieldLabel}>Previous (kWh)</Text>
                  <View style={styles.fieldWrapper}>
                    <MaterialIcons
                      name="speed"
                      size={15}
                      color={colors.textTertiary}
                    />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="0"
                      value={prevReading}
                      onChangeText={handlePrevReadingChange}
                      keyboardType="decimal-pad"
                      editable={editMode && !saving}
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
                <View style={styles.inputPairCol}>
                  <Text style={styles.fieldLabel}>Current (kWh)</Text>
                  <View style={styles.fieldWrapper}>
                    <MaterialIcons
                      name="speed"
                      size={15}
                      color={colors.textTertiary}
                    />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="0"
                      value={currReading}
                      onChangeText={handleCurrReadingChange}
                      keyboardType="decimal-pad"
                      editable={editMode && !saving}
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
              </View>

              {/* Electricity computed */}
              <View style={styles.electricityStrip}>
                <View style={styles.electricityStripLeft}>
                  <Ionicons
                    name="flash"
                    size={16}
                    color={colors.electricityColor}
                  />
                  <Text style={styles.electricityStripLabel}>
                    Electricity ({"\u20B1"}
                    {ELECTRICITY_RATE}/kWh)
                  </Text>
                </View>
                <Text style={styles.electricityStripAmount}>
                  {fmt(electricity)}
                </Text>
              </View>

              {/* Action Buttons */}
              {editMode && (
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && styles.btnDisabled]}
                    onPress={handleSaveBilling}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    {saving ? (
                      <ActivityIndicator
                        color={colors.textOnAccent}
                        size="small"
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={colors.textOnAccent}
                        />
                        <Text style={styles.saveBtnText}>Save Billing</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.archiveBtn, saving && styles.btnDisabled]}
                    onPress={handleArchiveToBillingCycle}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    {saving ? (
                      <ActivityIndicator
                        color={colors.textOnAccent}
                        size="small"
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="archive"
                          size={16}
                          color={colors.textOnAccent}
                        />
                        <Text style={styles.archiveBtnText}>
                          Archive & Close Cycle
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ─── READY FOR NEW CYCLE ─── */}
            {!editMode && !rent && !electricity && !startDate && (
              <View style={styles.readyCard}>
                <View style={styles.readyIconCircle}>
                  <Ionicons
                    name="checkmark-circle"
                    size={32}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.readyTitle}>Ready for New Cycle</Text>
                <Text style={styles.readySubtext}>
                  Tap "Edit" above to set billing details for the next period
                </Text>
              </View>
            )}

            {/* ─── PER-MEMBER WATER BILLS ─── */}
            {startDate && endDate && (
              <View style={styles.waterCard}>
                <View style={styles.waterCardHeader}>
                  <Ionicons name="water" size={18} color={colors.info} />
                  <Text style={styles.waterCardTitle}>
                    Water Bills ({"\u20B1"}
                    {WATER_RATE}/day)
                  </Text>
                </View>

                {members.length === 0 ? (
                  <View style={styles.noMembersRow}>
                    <Ionicons
                      name="people-outline"
                      size={18}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.noMembersText}>
                      No members in this room
                    </Text>
                  </View>
                ) : (
                  <>
                    {members.map((item) => {
                      const presenceDays = getFilteredPresenceDays(item);
                      const waterBill = calculateWaterBill(presenceDays);
                      return (
                        <View
                          key={item.id || item._id || item.email}
                          style={styles.memberRow}
                        >
                          <View style={styles.memberAvatar}>
                            <Text style={styles.memberAvatarText}>
                              {(item.name || item.email || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.memberMeta}>
                            <Text style={styles.memberName} numberOfLines={1}>
                              {item.name || item.email || "\u2014"}
                            </Text>
                            <Text style={styles.memberDays}>
                              {presenceDays} day{presenceDays !== 1 ? "s" : ""}{" "}
                              present
                            </Text>
                          </View>
                          <Text style={styles.memberWater}>
                            {fmt(waterBill)}
                          </Text>
                        </View>
                      );
                    })}

                    <View style={styles.waterTotalRow}>
                      <Text style={styles.waterTotalLabel}>Total Water</Text>
                      <Text style={styles.waterTotalAmount}>
                        {fmt(calculateTotalWaterBill())}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* ─── MANAGE BILLING CYCLES ─── */}
            <TouchableOpacity
              style={styles.cyclesBtn}
              onPress={() =>
                navigation.navigate("BillingCycles", {
                  roomId: selectedRoom.id || selectedRoom._id,
                  roomName: selectedRoom.name,
                })
              }
              activeOpacity={0.8}
            >
              <Ionicons name="calendar" size={18} color={colors.accent} />
              <Text style={styles.cyclesBtnText}>Manage Billing Cycles</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.accent}
              />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    // ─── LAYOUT ───
    container: { flex: 1, backgroundColor: colors.background },
    centerLoader: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },

    // ─── HEADER ───
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 14,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    headerIconBg: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.3,
    },
    headerSubtitle: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },

    // ─── ROOM PILLS ───
    roomPillBar: {
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 10,
    },
    roomPillContent: { paddingHorizontal: 16, gap: 8 },
    roomPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background,
      gap: 6,
    },
    roomPillActive: { backgroundColor: colors.accent },
    roomPillDot: { width: 6, height: 6, borderRadius: 3 },
    roomPillText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    roomPillTextActive: { color: colors.textOnAccent },

    // ─── EMPTY STATE ───
    emptyState: { alignItems: "center", paddingVertical: 50 },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    emptySubtext: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 6,
      textAlign: "center",
      paddingHorizontal: 40,
    },
    emptyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 18,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 10,
      backgroundColor: colors.accent,
    },
    emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

    // ─── SUMMARY GRID ───
    summarySection: { marginHorizontal: 16, marginTop: 14 },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    summaryCell: {
      width: (Dimensions.get("window").width - 48) / 2,
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 6 },
    summaryCellLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
      marginBottom: 2,
    },
    summaryCellAmount: { fontSize: 16, fontWeight: "700", color: colors.text },
    totalBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.successBg,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginTop: 8,
      borderWidth: 1,
      borderColor: "#d4edd4",
    },
    totalBarLabel: { fontSize: 14, fontWeight: "600", color: colors.success },
    totalBarAmount: { fontSize: 20, fontWeight: "800", color: colors.success },

    // ─── ADMIN TOOLS ───
    toolsSection: { marginHorizontal: 16, marginTop: 18 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textTertiary,
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    toolsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    toolCard: {
      width: (Dimensions.get("window").width - 62) / 3,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 8,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    toolIconBg: {
      width: 38,
      height: 38,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    toolCardText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 15,
    },

    // ─── BILLING FORM CARD ───
    formCard: {
      marginHorizontal: 16,
      marginTop: 18,
      backgroundColor: colors.card,
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    formCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    formCardHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    formCardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    editBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: colors.info,
    },
    editBadgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
    cancelBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: colors.inputBg,
    },
    cancelBadgeText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
    formSectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textTertiary,
      letterSpacing: 0.5,
      marginTop: 16,
      marginBottom: 8,
      paddingHorizontal: 16,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 5,
    },
    fieldWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: colors.cardAlt,
      gap: 8,
    },
    fieldInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    pesoPrefix: { fontSize: 14, fontWeight: "700", color: colors.accent },
    dateRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 16,
    },
    dateCol: { flex: 1 },
    dateArrow: { paddingHorizontal: 8, paddingBottom: 12 },
    inputPairRow: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    inputPairCol: { flex: 1 },
    electricityStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginHorizontal: 16,
      marginTop: 6,
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.accentSurface,
      borderRadius: 8,
    },
    electricityStripLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    electricityStripLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.electricityColor,
    },
    electricityStripAmount: {
      fontSize: 15,
      fontWeight: "700",
      color: "#e65100",
    },

    // ─── FORM ACTIONS ───
    formActions: { paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: 10,
      backgroundColor: colors.accent,
      shadowColor: "#b38604",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    archiveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: 10,
      backgroundColor: "#ef5350",
    },
    archiveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    btnDisabled: { opacity: 0.5 },

    // ─── READY CARD ───
    readyCard: {
      marginHorizontal: 16,
      marginTop: 18,
      backgroundColor: colors.successBg,
      borderRadius: 14,
      paddingVertical: 28,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#d4edd4",
    },
    readyIconCircle: { marginBottom: 10 },
    readyTitle: { fontSize: 15, fontWeight: "700", color: colors.success },
    readySubtext: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 6,
      textAlign: "center",
      paddingHorizontal: 30,
    },

    // ─── WATER CARD ───
    waterCard: {
      marginHorizontal: 16,
      marginTop: 18,
      backgroundColor: colors.card,
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    waterCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    waterCardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    noMembersRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 24,
    },
    noMembersText: { fontSize: 13, color: colors.textTertiary },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    memberAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.infoBg,
      justifyContent: "center",
      alignItems: "center",
    },
    memberAvatarText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.waterColor,
    },
    memberMeta: { flex: 1 },
    memberName: { fontSize: 13, fontWeight: "600", color: colors.text },
    memberDays: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
    memberWater: { fontSize: 14, fontWeight: "700", color: colors.text },
    waterTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.infoBg,
    },
    waterTotalLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.waterColor,
    },
    waterTotalAmount: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.waterColor,
    },

    // ─── CYCLES BUTTON ───
    cyclesBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 18,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: "#b38604",
    },
    cyclesBtnText: { fontSize: 14, fontWeight: "700", color: colors.accent },
  });

export default AdminBillingScreen;
