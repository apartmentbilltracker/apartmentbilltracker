import React, { useState, useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  roomService,
  billingService,
  apiService,
  presenceService,
} from "../../services/apiService";

const WATER_RATE = 5; // ₱5 per day
const ELECTRICITY_RATE = 16; // ₱16 per kW (per unit)

const AdminBillingScreen = ({ navigation }) => {
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

  useEffect(() => {
    fetchRooms();
  }, []);

  // Re-fetch rooms when screen gains focus so newly created rooms appear immediately
  useEffect(() => {
    if (isFocused) {
      console.log(
        "🔄 [BILLING SCREEN] Screen focused - checking for closed cycle",
      );
      fetchRooms();
      // Check if cycle is closed FIRST before fetching members
      if (selectedRoom) {
        checkAndResetIfCycleClosed();
      }
    }
  }, [isFocused]);

  useEffect(() => {
    if (selectedRoom) {
      // Only fetch room details if we need to (will be checked in checkAndResetIfCycleClosed)
      checkAndResetIfCycleClosed();
    }
  }, [selectedRoom]);

  // Check if current billing cycle is closed and reset amounts if so
  const checkAndResetIfCycleClosed = async () => {
    if (!selectedRoom) return;

    try {
      // First refetch the latest room data to check currentCycleId
      const roomResponse = await roomService.getRoomDetails(selectedRoom._id);
      const latestRoom = roomResponse.room || roomResponse.data?.room;

      if (!latestRoom || !latestRoom.currentCycleId) {
        // No active cycle - reset all amounts and clear members
        console.log(
          "✅ No active cycle - resetting billing amounts and clearing members",
        );
        setStartDate("");
        setEndDate("");
        setRent("");
        setElectricity("");
        setInternet("");
        setPrevReading("");
        setCurrReading("");
        setMembers([]); // Clear members to remove water calculations
        return;
      }

      // Fetch the billing cycle to check its status
      try {
        const response = await apiService.get(
          `/api/v2/billing-cycles/${latestRoom.currentCycleId}`,
        );

        if (response?.data?.status === "completed") {
          // Cycle is closed - reset all amounts and clear members
          console.log(
            "🔄 Billing cycle is closed - resetting amounts and clearing members",
          );
          setStartDate("");
          setEndDate("");
          setRent("");
          setElectricity("");
          setInternet("");
          setPrevReading("");
          setCurrReading("");
          setMembers([]); // Clear members to remove water calculations
          Alert.alert(
            "✅ Cycle Closed",
            "This billing cycle has been completed. All amounts have been reset.",
            [{ text: "OK" }],
          );
          return;
        }
      } catch (cycleError) {
        // If we can't fetch the cycle details, assume it's still active
        // and load the billing data from the room object
        console.log(
          "⚠️  Could not fetch cycle details, loading from room data:",
          cycleError.message,
        );
      }

      // Cycle is still active (either confirmed or couldn't verify, so assume active) - show amounts and load members
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
      // Load members for water calculation since cycle is active
      setMembers(latestRoom.members || []);
    } catch (error) {
      console.log("Error checking cycle status:", error);
      // On error, still try to show the data instead of clearing
      // Only clear if we're sure there's no cycle
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

      // If no room is currently selected or the selected room no longer exists, choose the first room
      if (!selectedRoom || !allRooms.some((r) => r._id === selectedRoom._id)) {
        if (allRooms.length > 0) setSelectedRoom(allRooms[0]);
      }
    } catch (error) {
      console.log("Error fetching rooms:", error);
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
      console.log("Error fetching room details:", error);
    }
  };

  const calculateWaterBill = (presenceDays) => {
    return (presenceDays || 0) * WATER_RATE;
  };

  const calculateTotalWaterBill = () => {
    return members.reduce((total, member) => {
      const presenceDays = member.presence ? member.presence.length : 0;
      return total + calculateWaterBill(presenceDays);
    }, 0);
  };

  // Calculate payor's water share with new formula:
  // = payor's own water + (non-payors' water / payor count)
  const calculatePayorWaterShare = () => {
    const payorCount = members.filter((m) => m.isPayer !== false).length || 1;
    if (payorCount === 0) return 0;

    let payorOwnWater = 0;
    let nonPayorWater = 0;

    members.forEach((member) => {
      const presenceDays = member.presence ? member.presence.length : 0;
      if (member.isPayer !== false) {
        payorOwnWater += calculateWaterBill(presenceDays);
      } else {
        nonPayorWater += calculateWaterBill(presenceDays);
      }
    });

    // Average across payors
    const avgPayorOwnWater = payorOwnWater / payorCount;
    const sharedNonPayorWater = nonPayorWater / payorCount;
    return avgPayorOwnWater + sharedNonPayorWater;
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

      // Step 1: Save billing information (dates and amounts)
      await billingService.saveBilling(selectedRoom._id, {
        start: startDate,
        end: endDate,
        rent: rent ? Number(rent) : undefined,
        electricity: electricity ? Number(electricity) : undefined,
        internet: internet ? Number(internet) : undefined,
        previousReading: prevReading ? Number(prevReading) : undefined,
        currentReading: currReading ? Number(currReading) : undefined,
      });

      // Step 2: AUTOMATICALLY create a new billing cycle to reset member statuses to "pending"
      // This is critical - without this, members will still show as "paid" from previous cycle
      const currentWaterBill = calculateTotalWaterBill();
      const payload = {
        roomId: selectedRoom._id,
        startDate: startDate,
        endDate: endDate,
        rent: parseFloat(rent) || 0,
        electricity: parseFloat(electricity) || 0,
        internet: parseFloat(internet) || 0,
        waterBillAmount: currentWaterBill,
        previousMeterReading: prevReading ? parseFloat(prevReading) : null,
        currentMeterReading: currReading ? parseFloat(currReading) : null,
      };

      // Ensure internet is a valid number, not NaN
      if (isNaN(payload.internet)) {
        payload.internet = 0;
      }

      const createResponse = await apiService.post(
        "/api/v2/billing-cycles/create",
        payload,
      );

      if (!createResponse.success) {
        throw new Error("Failed to create billing cycle");
      }

      console.log(
        "✅ New billing cycle created - member statuses reset to 'pending'",
      );

      await fetchRooms();
      setEditMode(false);
      Alert.alert(
        "Success",
        "Billing period saved and new cycle created - member payment statuses reset to pending",
      );
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
        roomId: selectedRoom._id,
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

      console.log(
        "🔍 Billing Cycle Payload:",
        JSON.stringify(payload, null, 2),
      );
      console.log("📊 Internet value in payload:", payload.internet);

      // Step 2: Create billing cycle with current data
      // Create and immediately close the billing cycle
      const createResponse = await apiService.post(
        "/api/v2/billing-cycles/create",
        payload,
      );

      if (createResponse.success && createResponse.data?._id) {
        // Step 3: Close the cycle
        const cycleId = createResponse.data._id;
        await apiService.put(`/api/v2/billing-cycles/${cycleId}/close`, {});

        // Step 4: Clear presence for all members
        try {
          await apiService.put(
            `/api/v2/rooms/${selectedRoom._id}/clear-presence`,
            {},
          );
        } catch (error) {
          console.error("Error clearing presence:", error);
          // Continue even if presence clearing fails
        }

        // Step 5: Clear the billing information
        await billingService.saveBilling(selectedRoom._id, {
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
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#b38604" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchRooms(true)}
        />
      }
    >
      {/* Room Selector Section */}
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

      {rooms.length === 0 && !loading && !refreshing && (
        <View style={styles.emptyStateContainer}>
          <MaterialIcons name="inbox" size={64} color="#ccc" />
          <Text style={styles.emptyStateTitle}>No Rooms Available</Text>
          <Text style={styles.emptyStateSubtitle}>
            You don't have any rooms yet. Create one to start setting billing
            information.
          </Text>

          <TouchableOpacity
            style={styles.createRoomButton}
            onPress={() =>
              navigation.navigate("RoomStack", {
                screen: "RoomManagement",
                params: { openCreate: true },
              })
            }
          >
            <Text style={styles.createRoomButtonText}>Create Room</Text>
          </TouchableOpacity>
        </View>
      )}

      {selectedRoom && (
        <>
          {/* Billing Summary Cards */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Rent</Text>
              <Text style={styles.summaryValue}>
                ₱{Number(rent || 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Electricity</Text>
              <Text style={styles.summaryValue}>
                ₱{Number(electricity || 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Water</Text>
              <Text style={[styles.summaryValue, { color: "#0066cc" }]}>
                ₱{calculateTotalWaterBill().toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Internet</Text>
              <Text style={[styles.summaryValue, { color: "#9c27b0" }]}>
                ₱{Number(internet || 0).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.summaryCard, styles.totalCard]}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={[styles.summaryValue, { color: "#28a745" }]}>
                ₱{getTotalBilling().toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Quick Access Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Tools</Text>
            <View style={styles.quickAccessContainer}>
              <TouchableOpacity
                style={styles.quickAccessBtn}
                onPress={() =>
                  navigation.navigate("BillingStack", {
                    screen: "PaymentVerification",
                    params: { room: selectedRoom },
                  })
                }
              >
                <Text style={styles.quickAccessBtnIcon}>✓</Text>
                <Text style={styles.quickAccessBtnText}>Verify Payments</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAccessBtn}
                onPress={() =>
                  navigation.navigate("BillingStack", {
                    screen: "FinancialDashboard",
                    params: { room: selectedRoom },
                  })
                }
              >
                <Text style={styles.quickAccessBtnIcon}>📊</Text>
                <Text style={styles.quickAccessBtnText}>
                  Financial Dashboard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAccessBtn}
                onPress={() =>
                  navigation.navigate("BillingStack", {
                    screen: "Adjustments",
                    params: { room: selectedRoom },
                  })
                }
              >
                <Text style={styles.quickAccessBtnIcon}>⚙️</Text>
                <Text style={styles.quickAccessBtnText}>Adjust Charges</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAccessBtn}
                onPress={() =>
                  navigation.navigate("BillingStack", {
                    screen: "Reminders",
                    params: { room: selectedRoom },
                  })
                }
              >
                <Text style={styles.quickAccessBtnIcon}>🔔</Text>
                <Text style={styles.quickAccessBtnText}>Send Reminders</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAccessBtn}
                onPress={() =>
                  navigation.navigate("BillingStack", {
                    screen: "PresenceReminders",
                    params: { room: selectedRoom },
                  })
                }
              >
                <Text style={styles.quickAccessBtnIcon}>📍</Text>
                <Text style={styles.quickAccessBtnText}>Presence Check</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Billing Details Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Billing Details</Text>
              {!editMode ? (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setEditMode(true)}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setEditMode(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2024-01-01"
              value={startDate}
              onChangeText={setStartDate}
              editable={editMode && !saving}
            />

            <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2024-01-31"
              value={endDate}
              onChangeText={setEndDate}
              editable={editMode && !saving}
            />

            <Text style={styles.inputLabel}>Rent (₱)</Text>
            <TextInput
              style={styles.input}
              placeholder="10000"
              value={rent}
              onChangeText={setRent}
              keyboardType="decimal-pad"
              editable={editMode && !saving}
            />

            <Text style={styles.inputLabel}>Electricity (₱)</Text>
            <TextInput
              style={styles.input}
              placeholder="2000"
              value={electricity}
              onChangeText={setElectricity}
              keyboardType="decimal-pad"
              editable={editMode && !saving}
            />

            <Text style={styles.inputLabel}>Internet (₱)</Text>
            <TextInput
              style={styles.input}
              placeholder="999"
              value={internet}
              onChangeText={setInternet}
              keyboardType="decimal-pad"
              editable={editMode && !saving}
            />

            <Text style={styles.inputLabel}>Previous Reading (kW)</Text>
            <TextInput
              style={styles.input}
              placeholder="1234"
              value={prevReading}
              onChangeText={handlePrevReadingChange}
              keyboardType="decimal-pad"
              editable={editMode && !saving}
            />

            <Text style={styles.inputLabel}>Current Reading (kW)</Text>
            <TextInput
              style={styles.input}
              placeholder="1350"
              value={currReading}
              onChangeText={handleCurrReadingChange}
              keyboardType="decimal-pad"
              editable={editMode && !saving}
            />

            {editMode && (
              <>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.buttonDisabled]}
                  onPress={handleSaveBilling}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Billing</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.archiveButton,
                    saving && styles.buttonDisabled,
                  ]}
                  onPress={handleArchiveToBillingCycle}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.archiveButtonText}>
                      📦 Archive & Close Cycle
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Empty State Message */}
          {!editMode && !rent && !electricity && !startDate && (
            <View style={styles.section}>
              <View style={styles.emptyCard}>
                <MaterialIcons name="check-circle" size={48} color="#4CAF50" />
                <Text style={styles.emptyText}>Ready for New Cycle</Text>
                <Text style={styles.emptySubtext}>
                  Click "Edit" to set billing details for the next billing
                  period
                </Text>
              </View>
            </View>
          )}

          {/* Per-Member Water Bills - Only show when there's active billing */}
          {startDate && endDate && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Per-Member Water Bills (₱{WATER_RATE}/day)
              </Text>
              {members.length === 0 ? (
                <Text style={styles.noDataText}>No members in this room</Text>
              ) : (
                <>
                  <FlatList
                    data={members}
                    keyExtractor={(item) => item._id}
                    scrollEnabled={false}
                    renderItem={({ item }) => {
                      const presenceDays = item.presence
                        ? item.presence.length
                        : 0;
                      const waterBill = calculateWaterBill(presenceDays);
                      return (
                        <View style={styles.memberBillRow}>
                          <View style={styles.memberInfo}>
                            <Text style={styles.memberName}>
                              {item.name || item.email || "—"}
                            </Text>
                            <Text style={styles.presenceDays}>
                              {presenceDays} days
                            </Text>
                          </View>
                          <Text style={styles.waterBillAmount}>
                            ₱{waterBill.toFixed(2)}
                          </Text>
                        </View>
                      );
                    }}
                  />
                  <View style={styles.totalWaterBillRow}>
                    <Text style={styles.totalWaterLabel}>
                      Total Water Bill:
                    </Text>
                    <Text style={styles.totalWaterAmount}>
                      ₱{calculateTotalWaterBill().toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
        </>
      )}

      {selectedRoom && (
        <TouchableOpacity
          style={styles.billingCyclesButton}
          onPress={() =>
            navigation.navigate("BillingCycles", {
              roomId: selectedRoom._id,
              roomName: selectedRoom.name,
            })
          }
        >
          <Text style={styles.billingCyclesButtonText}>
            📊 Manage Billing Cycles
          </Text>
        </TouchableOpacity>
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
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
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    fontSize: 14,
    backgroundColor: "#f9f9f9",
  },
  summaryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "#f5f5f5",
  },
  summaryCard: {
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
  summaryLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  saveButton: {
    backgroundColor: "#b38604",
    borderRadius: 6,
    padding: 14,
    alignItems: "center",
    marginTop: 20,
  },
  editButton: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#e0e0e0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  memberBillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  presenceDays: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  waterBillAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  totalWaterBillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 2,
    borderTopColor: "#b38604",
    backgroundColor: "#fffbf0",
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  totalWaterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  totalWaterAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0066cc",
  },
  noDataText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingVertical: 20,
  },
  emptyStateContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginTop: 12,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  createRoomButton: {
    backgroundColor: "#b38604",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createRoomButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  billingCyclesButton: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#b38604",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  billingCyclesButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  archiveButton: {
    marginVertical: 8,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#FF6B6B",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  archiveButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  emptyCard: {
    backgroundColor: "#f0f8f0",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#4CAF50",
    borderStyle: "dashed",
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
    marginTop: 8,
    textAlign: "center",
  },
  quickAccessContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  quickAccessBtn: {
    width: "48%",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#b38604",
  },
  quickAccessBtnIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  quickAccessBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
});

export default AdminBillingScreen;
