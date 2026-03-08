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
  paymentService,
} from "../../services/apiService";
import { roundTo2 as r2 } from "../../utils/helpers";
import { screenCache } from "../../hooks/useScreenCache";
import { useTheme } from "../../theme/ThemeContext";
import AnimatedAmount from "../../components/AnimatedAmount";

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
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);

  const isFocused = useIsFocused();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rent, setRent] = useState("");
  const [electricity, setElectricity] = useState("");
  const [internet, setInternet] = useState("");
  const [prevReading, setPrevReading] = useState("");
  const [currReading, setCurrReading] = useState("");
  const [cycleCompleted, setCycleCompleted] = useState(false);
  const [priorUnpaidData, setPriorUnpaidData] = useState(null);
  const [waterMode, setWaterMode] = useState("presence");
  const [waterFixed, setWaterFixed] = useState("");
  // "by_room" = one total split among payors;  "per_person" = amount charged per payor
  const [waterFixedType, setWaterFixedType] = useState("by_room");
  const [savingWaterMode, setSavingWaterMode] = useState(false);
  // true = host manually closed the cycle; false = auto-completed when all payors paid
  const [cycleClosedManually, setCycleClosedManually] = useState(false);
  const [pendingVerifCount, setPendingVerifCount] = useState(0);
  // Prevents checkAndResetIfCycleClosed from repopulating old values after
  // the host explicitly starts a new cycle from the completed-cycle screen.
  const [newCycleMode, setNewCycleMode] = useState(false);

  // Fetch rooms on mount and when screen regains focus
  useEffect(() => {
    if (isFocused) {
      // Show cached rooms instantly while fresh data loads
      screenCache.read("admin_billing_rooms").then((cached) => {
        if (cached?.rooms && cached.rooms.length > 0) {
          setRooms(cached.rooms);
          const current = selectedRoom?.id || selectedRoom?._id;
          const match = current
            ? cached.rooms.find((r) => r.id === current || r._id === current)
            : null;
          if (!selectedRoom) setSelectedRoom(match || cached.rooms[0] || null);
        }
      });
      fetchRooms();
    }
  }, [isFocused]);

  // Refresh pending verif count whenever the screen regains focus
  useEffect(() => {
    if (isFocused && selectedRoom) {
      const roomId = selectedRoom.id || selectedRoom._id;
      paymentService
        .getPaymentHistory(roomId)
        .then((res) => {
          const payments = res?.payments || res?.data || [];
          setPendingVerifCount(
            payments.filter(
              (p) => p.status === "pending" || p.status === "submitted",
            ).length,
          );
        })
        .catch(() => {});
    }
  }, [isFocused, selectedRoom]);

  // Load billing state whenever the selected room changes
  useEffect(() => {
    if (selectedRoom) {
      // Clear previous room's data immediately to prevent flash of wrong room's amounts
      setRent("");
      setElectricity("");
      setInternet("");
      setStartDate("");
      setEndDate("");
      setPrevReading("");
      setCurrReading("");
      setMembers([]);
      setCycleCompleted(false);
      setCycleClosedManually(false);
      setPriorUnpaidData(null);
      setNewCycleMode(false); // reset on room switch

      // Preload from cache for instant display (skip if host just started a new cycle)
      const roomId = selectedRoom.id || selectedRoom._id;
      if (!newCycleMode) {
        screenCache.read("admin_billing_cycle_" + roomId).then((cached) => {
          if (cached) {
            if (cached.rent !== undefined) setRent(cached.rent);
            if (cached.electricity !== undefined)
              setElectricity(cached.electricity);
            if (cached.internet !== undefined) setInternet(cached.internet);
            if (cached.startDate !== undefined) setStartDate(cached.startDate);
            if (cached.endDate !== undefined) setEndDate(cached.endDate);
            if (cached.prevReading !== undefined)
              setPrevReading(cached.prevReading);
            if (cached.currReading !== undefined)
              setCurrReading(cached.currReading);
            if (cached.cycleCompleted !== undefined)
              setCycleCompleted(cached.cycleCompleted);
            if (cached.members !== undefined) setMembers(cached.members);
          }
        });
        checkAndResetIfCycleClosed();
      }
      // Only hit the overdue endpoint when the room actually has outstanding
      // balances — avoids a backend round-trip on every room switch.
      if (
        selectedRoom.hasPriorUnpaid ||
        selectedRoom.cycleStatus === "cycle_closed"
      ) {
        fetchPriorUnpaid(roomId);
      }
      // Load water billing mode from current room
      if (selectedRoom) {
        setWaterMode(
          selectedRoom.waterBillingMode ||
            selectedRoom.water_billing_mode ||
            "presence",
        );
        setWaterFixed(
          String(
            selectedRoom.waterFixedAmount ||
              selectedRoom.water_fixed_amount ||
              "",
          ),
        );
        setWaterFixedType(
          selectedRoom.waterFixedType ||
            selectedRoom.water_fixed_type ||
            "by_room",
        );
      }
    }
  }, [selectedRoom]);

  // Fetch outstanding balances from prior closed cycles
  const fetchPriorUnpaid = async (roomId) => {
    try {
      const res = await apiService.get(
        `/api/v2/admin/reminders/overdue/${roomId}`,
      );
      const payments = res?.overduePayments || [];
      if (payments.length === 0) {
        setPriorUnpaidData(null);
        return;
      }
      const total = payments.reduce((s, m) => s + (m.totalDue || 0), 0);
      setPriorUnpaidData({
        members: payments,
        total,
        cycleInfo: res.cycleInfo || null,
      });
    } catch (_) {
      setPriorUnpaidData(null);
    }
  };

  // Check if current billing cycle is closed and update state accordingly
  const checkAndResetIfCycleClosed = async () => {
    if (!selectedRoom) return;

    const roomId = selectedRoom.id || selectedRoom._id;
    const writeCycleCache = (billing, cycleCompleted, roomMembers) => {
      if (!billing) return;
      screenCache.write("admin_billing_cycle_" + roomId, {
        cycleCompleted,
        rent: String(billing.rent || ""),
        electricity: String(billing.electricity || ""),
        internet: String(billing.internet || ""),
        startDate: billing.start
          ? new Date(billing.start).toISOString().split("T")[0]
          : "",
        endDate: billing.end
          ? new Date(billing.end).toISOString().split("T")[0]
          : "",
        prevReading: String(billing.previousReading || ""),
        currReading: String(billing.currentReading || ""),
        members: roomMembers || [],
      });
    };

    try {
      // First refetch the latest room data
      const roomResponse = await roomService.getRoomDetails(
        selectedRoom.id || selectedRoom._id,
      );
      const latestRoom = roomResponse.room || roomResponse.data?.room;

      // Check if room has cycleStatus from backend
      if (
        (latestRoom?.cycleStatus === "completed" ||
          latestRoom?.cycleStatus === "cycle_closed") &&
        latestRoom?.billing
      ) {
        setCycleCompleted(true);
        setCycleClosedManually(latestRoom?.cycleStatus === "cycle_closed");
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
        writeCycleCache(billing, true, latestRoom.members || []);
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
        screenCache.clear("admin_billing_cycle_" + roomId);
        return;
      }

      // Fetch the billing cycle to check its status
      try {
        const response = await apiService.get(
          `/api/v2/billing-cycles/${latestRoom.currentCycleId}`,
        );

        const cycleStatus = response?.data?.status;
        if (cycleStatus === "completed" || cycleStatus === "cycle_closed") {
          setCycleCompleted(true);
          setCycleClosedManually(cycleStatus === "cycle_closed");
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
            writeCycleCache(billing, true, latestRoom.members || []);
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
      writeCycleCache(billing, false, latestRoom.members || []);
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
      screenCache.write("admin_billing_rooms", { rooms: allRooms });

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
    if (waterMode === "fixed_monthly") {
      const fixedAmt = parseFloat(waterFixed) || 0;
      if (waterFixedType === "per_person") {
        const payorCount = Math.max(
          1,
          members.filter((m) => m.isPayer !== false).length,
        );
        return r2(fixedAmt * payorCount);
      }
      return fixedAmt; // by_room: the total entered IS the total
    }
    return members.reduce((total, member) => {
      const presenceDays = getFilteredPresenceDays(member);
      return total + calculateWaterBill(presenceDays);
    }, 0);
  };

  const handleSaveWaterMode = async () => {
    if (!selectedRoom) return;
    if (
      waterMode === "fixed_monthly" &&
      (!waterFixed || parseFloat(waterFixed) <= 0)
    ) {
      Alert.alert(
        "Validation",
        "Please enter a valid fixed water amount greater than 0.",
      );
      return;
    }
    try {
      setSavingWaterMode(true);
      await roomService.updateRoom(selectedRoom.id || selectedRoom._id, {
        name: selectedRoom.name,
        water_billing_mode: waterMode,
        water_fixed_amount: parseFloat(waterFixed) || 0,
        water_fixed_type: waterFixedType,
      });
      setSelectedRoom((prev) => ({
        ...prev,
        waterBillingMode: waterMode,
        water_billing_mode: waterMode,
        waterFixedAmount: parseFloat(waterFixed) || 0,
        water_fixed_amount: parseFloat(waterFixed) || 0,
        waterFixedType: waterFixedType,
        water_fixed_type: waterFixedType,
      }));
      Alert.alert("Saved", "Water billing settings updated successfully.");
    } catch (err) {
      Alert.alert("Error", "Failed to save water settings. Please try again.");
    } finally {
      setSavingWaterMode(false);
    }
  };

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
        setNewCycleMode(false); // new cycle exists on server now — normal mode
      } else {
        // EXISTING CYCLE: Update the active cycle
        const updateResponse = await apiService.put(
          `/api/v2/billing-cycles/${selectedRoom.currentCycleId}`,
          {
            rent: cyclePayload.rent,
            electricity: cyclePayload.electricity,
            waterBillAmount: cyclePayload.waterBillAmount,
            internet: cyclePayload.internet,
            previousMeterReading: cyclePayload.previousMeterReading,
            currentMeterReading: cyclePayload.currentMeterReading,
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

      // Also save water billing mode if it changed
      const origWaterMode =
        selectedRoom.waterBillingMode ||
        selectedRoom.water_billing_mode ||
        "presence";
      const origWaterFixed = String(
        selectedRoom.waterFixedAmount || selectedRoom.water_fixed_amount || "",
      );
      const origWaterFixedType =
        selectedRoom.waterFixedType ||
        selectedRoom.water_fixed_type ||
        "by_room";
      if (
        waterMode !== origWaterMode ||
        (waterMode === "fixed_monthly" &&
          (String(waterFixed) !== origWaterFixed ||
            waterFixedType !== origWaterFixedType))
      ) {
        try {
          await roomService.updateRoom(selectedRoom.id || selectedRoom._id, {
            name: selectedRoom.name,
            water_billing_mode: waterMode,
            water_fixed_amount: parseFloat(waterFixed) || 0,
            water_fixed_type: waterFixedType,
          });
          setSelectedRoom((prev) => ({
            ...prev,
            waterBillingMode: waterMode,
            water_billing_mode: waterMode,
            waterFixedAmount: parseFloat(waterFixed) || 0,
            water_fixed_amount: parseFloat(waterFixed) || 0,
            waterFixedType: waterFixedType,
            water_fixed_type: waterFixedType,
          }));
        } catch (e) {
          console.error("Failed to save water mode:", e);
        }
      }

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

        // Step 6: Save water billing mode if changed
        const origWaterModeA =
          selectedRoom.waterBillingMode ||
          selectedRoom.water_billing_mode ||
          "presence";
        const origWaterFixedA = String(
          selectedRoom.waterFixedAmount ||
            selectedRoom.water_fixed_amount ||
            "",
        );
        const origWaterFixedTypeA =
          selectedRoom.waterFixedType ||
          selectedRoom.water_fixed_type ||
          "by_room";
        if (
          waterMode !== origWaterModeA ||
          (waterMode === "fixed_monthly" &&
            (String(waterFixed) !== origWaterFixedA ||
              waterFixedType !== origWaterFixedTypeA))
        ) {
          try {
            await roomService.updateRoom(selectedRoom.id || selectedRoom._id, {
              name: selectedRoom.name,
              water_billing_mode: waterMode,
              water_fixed_amount: parseFloat(waterFixed) || 0,
              water_fixed_type: waterFixedType,
            });
          } catch (e) {
            console.error("Failed to save water mode on archive:", e);
          }
        }

        // Reset form
        setStartDate("");
        setEndDate("");
        setRent("");
        setElectricity("");
        setInternet("");
        setPrevReading("");
        setCurrReading("");
        setCycleCompleted(false);
        setEditMode(false);

        // Clear stale cache so the form doesn't repopulate with old values
        screenCache.clear(
          "admin_billing_cycle_" + (selectedRoom.id || selectedRoom._id),
        );

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

  // Only block the screen on first ever load (before any cache exists)
  if (loading && !refreshing && rooms.length === 0) {
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

      {/* ─── ROOM SELECTOR ─── */}
      {rooms.length > 1 ? (
        <View style={styles.roomDropdownContainer}>
          <TouchableOpacity
            style={styles.roomDropdownButton}
            onPress={() => setRoomDropdownOpen(!roomDropdownOpen)}
            activeOpacity={0.7}
          >
            <View style={styles.roomDropdownLeft}>
              <View
                style={[
                  styles.roomDropdownDot,
                  { backgroundColor: colors.accent },
                ]}
              />
              <Text style={styles.roomDropdownButtonText} numberOfLines={1}>
                {selectedRoom?.name || "Select Room"}
              </Text>
            </View>
            <View style={styles.roomDropdownRight}>
              <Text style={styles.roomDropdownCount}>{rooms.length} rooms</Text>
              <Ionicons
                name={roomDropdownOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textSecondary}
              />
            </View>
          </TouchableOpacity>

          {roomDropdownOpen && (
            <View style={styles.roomDropdownList}>
              {rooms.map((room) => {
                const active =
                  selectedRoom?.id === room.id ||
                  selectedRoom?._id === room._id;
                const memberCount = room.members?.length || 0;
                return (
                  <TouchableOpacity
                    key={room.id || room._id}
                    style={[
                      styles.roomDropdownItem,
                      active && styles.roomDropdownItemActive,
                    ]}
                    onPress={() => {
                      setSelectedRoom(room);
                      setRoomDropdownOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.roomDropdownItemLeft}>
                      <View
                        style={[
                          styles.roomDropdownItemDot,
                          {
                            backgroundColor: active
                              ? colors.accent
                              : colors.textTertiary,
                          },
                        ]}
                      />
                      <View>
                        <Text
                          style={[
                            styles.roomDropdownItemText,
                            active && styles.roomDropdownItemTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {room.name}
                        </Text>
                        <Text style={styles.roomDropdownItemSub}>
                          {memberCount} member{memberCount !== 1 ? "s" : ""}
                          {room.cycleStatus === "active"
                            ? " • Active cycle"
                            : room.cycleStatus === "completed"
                              ? " • Cycle completed"
                              : room.cycleStatus === "cycle_closed"
                                ? " • Cycle closed"
                                : " • No cycle"}
                        </Text>
                      </View>
                    </View>
                    {active && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.accent}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      ) : rooms.length === 1 ? (
        <View style={styles.roomPillBar}>
          <View style={styles.roomPillContent}>
            <View style={[styles.roomPill, styles.roomPillActive]}>
              <View
                style={[
                  styles.roomPillDot,
                  { backgroundColor: colors.textOnAccent },
                ]}
              />
              <Text style={[styles.roomPillText, styles.roomPillTextActive]}>
                {rooms[0].name}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

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
            {/* ─── OUTSTANDING BALANCE BANNER ─── */}
            {priorUnpaidData && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginTop: 12,
                  backgroundColor: "#fff8e1",
                  borderRadius: 14,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#ffe082",
                  borderLeftWidth: 4,
                  borderLeftColor: "#f9a825",
                }}
              >
                {/* Header */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <MaterialIcons name="warning" size={22} color="#f9a825" />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: "#7b5800",
                      marginLeft: 8,
                      flex: 1,
                    }}
                  >
                    Outstanding Balance Remaining
                  </Text>
                </View>

                {/* Total amount */}
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: "#e65100",
                    marginBottom: 4,
                  }}
                >
                  ₱{priorUnpaidData.total.toFixed(2)}
                </Text>

                {/* Billing period */}
                {priorUnpaidData.cycleInfo?.startDate &&
                  priorUnpaidData.cycleInfo?.endDate && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 4,
                        gap: 4,
                      }}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={13}
                        color="#7b5800"
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          color: "#7b5800",
                          opacity: 0.85,
                        }}
                      >
                        Billing period:{" "}
                        {new Date(
                          priorUnpaidData.cycleInfo.startDate,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        —{" "}
                        {new Date(
                          priorUnpaidData.cycleInfo.endDate,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                    </View>
                  )}

                {/* Member count */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 14,
                    gap: 4,
                  }}
                >
                  <Ionicons name="people-outline" size={13} color="#7b5800" />
                  <Text
                    style={{ fontSize: 12, color: "#7b5800", opacity: 0.85 }}
                  >
                    {priorUnpaidData.members.length} member
                    {priorUnpaidData.members.length !== 1 ? "s" : ""} haven't
                    settled their bill
                    {priorUnpaidData.members.length !== 1 ? "s" : ""}
                  </Text>
                </View>

                {/* Per-member list */}
                {priorUnpaidData.members.map((m) => (
                  <View
                    key={m.memberId}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 6,
                      borderTopWidth: 1,
                      borderTopColor: "#ffe082",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#7b5800",
                        fontWeight: "600",
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {m.memberName}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#e65100",
                        fontWeight: "700",
                      }}
                    >
                      ₱{(m.totalDue || 0).toFixed(2)}
                    </Text>
                  </View>
                ))}

                {/* Action button */}
                <TouchableOpacity
                  style={{
                    marginTop: 12,
                    backgroundColor: "#f9a825",
                    borderRadius: 10,
                    paddingVertical: 11,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                  }}
                  onPress={() =>
                    navigation.navigate("Reminders", { room: selectedRoom })
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons name="notifications" size={16} color="#fff" />
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "700",
                      fontSize: 14,
                    }}
                  >
                    Send Reminders to Unpaid Members
                  </Text>
                </TouchableOpacity>
              </View>
            )}

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
                    {cycleClosedManually
                      ? "Billing Cycle Closed"
                      : "All Payors Paid!"}
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
                  {cycleClosedManually
                    ? "This cycle was manually closed. All amounts are shown below for reference. Create a new billing cycle when ready."
                    : "This billing cycle has been auto-completed (all payors paid). Amounts are shown below for reference. Create a new billing cycle when ready."}
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
                    // Clear stale cache so old values don't repopulate the form
                    screenCache.clear(
                      "admin_billing_cycle_" +
                        (selectedRoom.id || selectedRoom._id),
                    );
                    setNewCycleMode(true); // suppress checkAndResetIfCycleClosed
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
                      billing: null,
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
                  <AnimatedAmount
                    value={parseFloat(rent) || 0}
                    formatter={fmt}
                    style={styles.summaryCellAmount}
                  />
                </View>
                <View style={styles.summaryCell}>
                  <View
                    style={[
                      styles.summaryDot,
                      { backgroundColor: colors.electricityColor },
                    ]}
                  />
                  <Text style={styles.summaryCellLabel}>Electricity</Text>
                  <AnimatedAmount
                    value={parseFloat(electricity) || 0}
                    formatter={fmt}
                    style={styles.summaryCellAmount}
                  />
                </View>
                <View style={styles.summaryCell}>
                  <View
                    style={[
                      styles.summaryDot,
                      { backgroundColor: colors.waterColor },
                    ]}
                  />
                  <Text style={styles.summaryCellLabel}>Water</Text>
                  <AnimatedAmount
                    value={calculateTotalWaterBill()}
                    formatter={fmt}
                    style={styles.summaryCellAmount}
                  />
                </View>
                <View style={styles.summaryCell}>
                  <View
                    style={[
                      styles.summaryDot,
                      { backgroundColor: colors.internetColor },
                    ]}
                  />
                  <Text style={styles.summaryCellLabel}>Internet</Text>
                  <AnimatedAmount
                    value={parseFloat(internet) || 0}
                    formatter={fmt}
                    style={styles.summaryCellAmount}
                  />
                </View>
              </View>
              <View style={styles.totalBar}>
                <Text style={styles.totalBarLabel}>Total Billing</Text>
                <AnimatedAmount
                  value={getTotalBilling()}
                  formatter={fmt}
                  style={styles.totalBarAmount}
                />
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
                    {pendingVerifCount > 0 && (
                      <View
                        style={{
                          position: "absolute",
                          top: -4,
                          right: -4,
                          minWidth: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: "#e74c3c",
                          alignItems: "center",
                          justifyContent: "center",
                          paddingHorizontal: 3,
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 9,
                            fontWeight: "700",
                            lineHeight: 12,
                          }}
                        >
                          {pendingVerifCount > 99 ? "99+" : pendingVerifCount}
                        </Text>
                      </View>
                    )}
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

              {/* kWh usage preview shown whenever both readings are valid */}
              {prevReading &&
                currReading &&
                Number(currReading) > Number(prevReading) && (
                  <View style={styles.usagePreviewRow}>
                    <MaterialIcons
                      name="trending-up"
                      size={14}
                      color="#e65100"
                    />
                    <Text style={styles.usagePreviewText}>
                      {(Number(currReading) - Number(prevReading)).toFixed(0)}{" "}
                      kWh used × ₱{ELECTRICITY_RATE}/kWh = {fmt(electricity)}
                    </Text>
                  </View>
                )}

              {/* Electricity — editable input in edit mode, read-only strip in view mode */}
              {editMode ? (
                <View style={styles.inputPairRow}>
                  <View style={[styles.inputPairCol, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>
                      Electricity{" "}
                      <Text
                        style={{ color: colors.textTertiary, fontSize: 10 }}
                      >
                        (auto-filled · tap to override)
                      </Text>
                    </Text>
                    <View style={styles.fieldWrapper}>
                      <Ionicons
                        name="flash"
                        size={15}
                        color={colors.electricityColor}
                      />
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="0.00"
                        value={electricity}
                        onChangeText={setElectricity}
                        keyboardType="decimal-pad"
                        editable={!saving}
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>
                  </View>
                </View>
              ) : (
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
              )}

              {/* Water Billing Mode */}
              <Text style={[styles.formSectionLabel, { marginTop: 4 }]}>
                WATER BILLING MODE
              </Text>
              <View style={styles.waterModeToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.waterModeBtn,
                    waterMode === "presence" && styles.waterModeBtnActive,
                  ]}
                  onPress={() =>
                    editMode && !saving && setWaterMode("presence")
                  }
                  disabled={!editMode || saving}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="partly-sunny"
                    size={14}
                    color={
                      waterMode === "presence"
                        ? colors.textOnAccent
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.waterModeBtnText,
                      waterMode === "presence" && styles.waterModeBtnTextActive,
                    ]}
                  >
                    {"\u20B1"}5/day Presence
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.waterModeBtn,
                    waterMode === "fixed_monthly" && styles.waterModeBtnActive,
                  ]}
                  onPress={() =>
                    editMode && !saving && setWaterMode("fixed_monthly")
                  }
                  disabled={!editMode || saving}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="lock-closed"
                    size={14}
                    color={
                      waterMode === "fixed_monthly"
                        ? colors.textOnAccent
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.waterModeBtnText,
                      waterMode === "fixed_monthly" &&
                        styles.waterModeBtnTextActive,
                    ]}
                  >
                    Fixed Monthly
                  </Text>
                </TouchableOpacity>
              </View>
              {/* Water mode description */}
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  paddingHorizontal: 16,
                  marginTop: 6,
                  marginBottom: 6,
                  lineHeight: 17,
                }}
              >
                {waterMode === "fixed_monthly"
                  ? waterFixedType === "per_person"
                    ? "A fixed amount is charged per paying member each month. Total scales with member count."
                    : "One fixed total for the whole room, split equally among all paying members."
                  : "Each member is charged \u20B15 per day they mark themselves as present in the room."}
              </Text>

              {/* Fixed Monthly sub-options: By Room vs Per Person */}
              {waterMode === "fixed_monthly" && (
                <View style={styles.waterSubToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.waterSubBtn,
                      waterFixedType === "by_room" && styles.waterSubBtnActive,
                    ]}
                    onPress={() =>
                      editMode && !saving && setWaterFixedType("by_room")
                    }
                    disabled={!editMode || saving}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="home"
                      size={13}
                      color={
                        waterFixedType === "by_room"
                          ? colors.info
                          : colors.textTertiary
                      }
                    />
                    <Text
                      style={[
                        styles.waterSubBtnText,
                        waterFixedType === "by_room" &&
                          styles.waterSubBtnTextActive,
                      ]}
                    >
                      By Room
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.waterSubBtn,
                      waterFixedType === "per_person" &&
                        styles.waterSubBtnActive,
                    ]}
                    onPress={() =>
                      editMode && !saving && setWaterFixedType("per_person")
                    }
                    disabled={!editMode || saving}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="person"
                      size={13}
                      color={
                        waterFixedType === "per_person"
                          ? colors.info
                          : colors.textTertiary
                      }
                    />
                    <Text
                      style={[
                        styles.waterSubBtnText,
                        waterFixedType === "per_person" &&
                          styles.waterSubBtnTextActive,
                      ]}
                    >
                      Per Person
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {editMode && waterMode === "fixed_monthly" && (
                <View
                  style={[
                    styles.fieldWrapper,
                    { marginHorizontal: 16, marginTop: 4 },
                  ]}
                >
                  <Text style={styles.pesoPrefix}>{"\u20B1"}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder={
                      waterFixedType === "per_person"
                        ? "Amount per person"
                        : "Fixed total for the room"
                    }
                    value={waterFixed}
                    onChangeText={setWaterFixed}
                    keyboardType="decimal-pad"
                    editable={!saving}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              )}
              {!editMode && (
                <View style={[styles.electricityStrip, { marginTop: 4 }]}>
                  <View style={styles.electricityStripLeft}>
                    <Ionicons name="water" size={16} color={colors.info} />
                    <Text
                      style={[
                        styles.electricityStripLabel,
                        { color: colors.info },
                      ]}
                    >
                      Water (
                      {waterMode === "fixed_monthly"
                        ? waterFixedType === "per_person"
                          ? `\u20B1${parseFloat(waterFixed) || 0}/person`
                          : `\u20B1${parseFloat(waterFixed) || 0}/room`
                        : `\u20B1${WATER_RATE}/day Presence`}
                      )
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.electricityStripAmount,
                      { color: colors.info },
                    ]}
                  >
                    {fmt(calculateTotalWaterBill())}
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              {editMode && (
                <View style={[styles.formActions, { paddingBottom: 8 }]}>
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
                </View>
              )}

              {/* Archive & Close — visible outside edit mode so host can finalize anytime */}
              {!cycleCompleted && (rent || electricity || startDate) && (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingBottom: 16,
                    paddingTop: editMode ? 0 : 12,
                  }}
                >
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
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textTertiary,
                      textAlign: "center",
                      marginTop: 6,
                      lineHeight: 15,
                    }}
                  >
                    Saves final amounts, closes this cycle, and clears presence
                    for the next billing period.
                  </Text>
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

            {/* ─── FIXED WATER BILL CARD ─── */}
            {startDate &&
              endDate &&
              waterMode === "fixed_monthly" &&
              (() => {
                const fixedAmt = parseFloat(waterFixed) || 0;
                const payorCount = Math.max(
                  1,
                  members.filter((m) => m.isPayer !== false).length,
                );
                const totalWater =
                  waterFixedType === "per_person"
                    ? r2(fixedAmt * payorCount)
                    : fixedAmt;
                const perPayor =
                  waterFixedType === "per_person"
                    ? fixedAmt
                    : r2(fixedAmt / payorCount);
                return (
                  <View style={styles.waterCard}>
                    <View style={styles.waterCardHeader}>
                      <Ionicons name="water" size={18} color={colors.info} />
                      <Text style={styles.waterCardTitle}>
                        Fixed Water Bill
                      </Text>
                      <View
                        style={{
                          marginLeft: 8,
                          backgroundColor: colors.infoBg || "#e3f2fd",
                          borderRadius: 6,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: colors.info,
                          }}
                        >
                          {waterFixedType === "per_person"
                            ? "PER PERSON"
                            : "BY ROOM"}
                        </Text>
                      </View>
                    </View>

                    {waterFixedType === "per_person" ? (
                      /* Per-person breakdown */
                      <View
                        style={{ paddingHorizontal: 16, paddingBottom: 16 }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                            marginBottom: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              color: colors.textSecondary,
                            }}
                          >
                            Rate per person
                          </Text>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "700",
                              color: colors.text,
                            }}
                          >
                            {fmt(fixedAmt)}
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingVertical: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                            marginBottom: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              color: colors.textSecondary,
                            }}
                          >
                            Paying members
                          </Text>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "700",
                              color: colors.text,
                            }}
                          >
                            {payorCount}{" "}
                            {payorCount === 1 ? "person" : "people"}
                          </Text>
                        </View>
                        {members
                          .filter((m) => m.isPayer !== false)
                          .map((m) => (
                            <View
                              key={m.id || m._id || m.email}
                              style={styles.memberRow}
                            >
                              <View style={styles.memberAvatar}>
                                <Text style={styles.memberAvatarText}>
                                  {(m.name || m.email || "?")
                                    .charAt(0)
                                    .toUpperCase()}
                                </Text>
                              </View>
                              <View style={styles.memberMeta}>
                                <Text
                                  style={styles.memberName}
                                  numberOfLines={1}
                                >
                                  {m.name || m.email || "\u2014"}
                                </Text>
                                <Text style={styles.memberDays}>
                                  fixed per person
                                </Text>
                              </View>
                              <Text style={styles.memberWater}>
                                {fmt(fixedAmt)}
                              </Text>
                            </View>
                          ))}
                        <View style={styles.waterTotalRow}>
                          <Text style={styles.waterTotalLabel}>
                            {fmt(fixedAmt)} × {payorCount} = Total Water
                          </Text>
                          <Text style={styles.waterTotalAmount}>
                            {fmt(totalWater)}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      /* By-room breakdown */
                      <View
                        style={{ padding: 16, alignItems: "center", gap: 6 }}
                      >
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 13,
                            textAlign: "center",
                          }}
                        >
                          Fixed total for this room
                        </Text>
                        <Text
                          style={{
                            color: colors.text,
                            fontWeight: "800",
                            fontSize: 26,
                            marginTop: 4,
                          }}
                        >
                          {fmt(fixedAmt)}
                        </Text>
                        <Text
                          style={{ color: colors.textSecondary, fontSize: 12 }}
                        >
                          ÷ {payorCount} payor{payorCount !== 1 ? "s" : ""} ={" "}
                          {fmt(perPayor)} each
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}
            {startDate && endDate && waterMode !== "fixed_monthly" && (
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

    // ─── ROOM DROPDOWN ───
    roomDropdownContainer: {
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
      zIndex: 10,
    },
    roomDropdownButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    roomDropdownLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    roomDropdownDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    roomDropdownButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    roomDropdownRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    roomDropdownCount: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.textTertiary,
      backgroundColor: colors.card,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: "hidden",
    },
    roomDropdownList: {
      marginTop: 8,
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    roomDropdownItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    roomDropdownItemActive: {
      backgroundColor: colors.accentLight || colors.accent + "15",
    },
    roomDropdownItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    roomDropdownItemDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    roomDropdownItemText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    roomDropdownItemTextActive: {
      color: colors.accent,
    },
    roomDropdownItemSub: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 1,
    },

    // ─── ROOM PILL (single room) ───
    roomPillBar: {
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 10,
    },
    roomPillContent: { paddingHorizontal: 16, flexDirection: "row", gap: 8 },
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
    usagePreviewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    usagePreviewText: {
      fontSize: 12,
      color: "#e65100",
      fontWeight: "500",
    },
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

    // ─── WATER MODE TOGGLE ───
    waterModeToggleRow: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginTop: 6,
      marginBottom: 8,
      gap: 8,
    },
    waterModeBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    waterModeBtnActive: {
      backgroundColor: colors.info,
      borderColor: colors.info,
    },
    waterModeBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    waterModeBtnTextActive: {
      color: colors.textOnAccent,
    },

    // ─── FIXED WATER SUB-TOGGLE (By Room / Per Person) ───
    waterSubToggleRow: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginTop: 2,
      marginBottom: 8,
      gap: 8,
    },
    waterSubBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    waterSubBtnActive: {
      backgroundColor: colors.infoBg || "#e3f2fd",
      borderColor: colors.info,
    },
    waterSubBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    waterSubBtnTextActive: {
      color: colors.info,
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
