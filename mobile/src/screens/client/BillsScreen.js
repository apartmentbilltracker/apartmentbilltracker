import React, { useState, useEffect, useContext } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Image,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { roomService } from "../../services/apiService";
import { AuthContext } from "../../context/AuthContext";

const colors = {
  primary: "#bdb246",
  dark: "#1a1a1a",
  lightGray: "#f5f5f5",
  border: "#e0e0e0",
  success: "#27ae60",
  danger: "#e74c3c",
};

const WATER_BILL_PER_DAY = 5; // 5 pesos per day

const BillsScreen = ({ navigation }) => {
  const { state } = useContext(AuthContext);
  const isFocused = useIsFocused();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [memberPresence, setMemberPresence] = useState({}); // { memberId: presenceArray }
  const [receiptHTML, setReceiptHTML] = useState(null); // HTML for receipt modal
  const [receiptData, setReceiptData] = useState(null); // Structured receipt data
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedMemberPresence, setSelectedMemberPresence] = useState(null); // For presence modal
  const [showPresenceModal, setShowPresenceModal] = useState(false);
  const [presenceMonth, setPresenceMonth] = useState(new Date()); // For calendar navigation

  const userId = state?.user?._id;

  useEffect(() => {
    fetchRooms();
  }, []);

  // Refetch whenever user profile changes (name or avatar)
  useEffect(() => {
    console.log("User profile changed, refetching rooms");
    fetchRooms();
  }, [state.user?.name, state.user?.avatar?.url]);

  useEffect(() => {
    if (selectedRoom) {
      loadMemberPresence(selectedRoom._id);
    }
  }, [selectedRoom]);

  const loadMemberPresence = async (roomId) => {
    try {
      console.log("Loading presence for room:", roomId);

      // Fetch the room data directly - presence is already embedded in members
      const roomResponse = await roomService.getRoomById(roomId);
      const roomData = roomResponse.data || roomResponse;
      const room = roomData.room || roomData;

      console.log("Room data with members:", room.members);

      // Extract presence by member from room members
      if (room?.members) {
        const presenceMap = {};
        room.members.forEach((member) => {
          presenceMap[member._id] = member.presence || [];
          console.log(`Member ${member.user?.name} presence:`, member.presence);
        });
        setMemberPresence(presenceMap);
        console.log("Member presence map:", presenceMap);
      }
    } catch (error) {
      console.error("Error loading member presence:", error);
    }
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);
      console.log("Fetching rooms...");
      const response = await roomService.getRooms();
      console.log("Bills Screen - getRooms response:", response);
      // Handle response structure from fetch API: response = { data, status }
      const data = response.data || response;
      const fetchedRooms = data.rooms || data || [];
      console.log("Bills Screen - fetched rooms:", fetchedRooms);
      console.log(
        "Bills Screen - first room members:",
        fetchedRooms[0]?.members,
      );

      // Filter to show only rooms user is part of
      const userRooms = fetchedRooms.filter((room) =>
        room.members?.some(
          (m) => String(m.user?._id || m.user) === String(userId),
        ),
      );

      console.log("Bills Screen - user rooms:", userRooms);
      setRooms(userRooms);

      // Update selectedRoom with fresh data or set to first room
      if (selectedRoom && userRooms.length > 0) {
        // Find the updated version of the currently selected room
        const updatedSelectedRoom = userRooms.find(
          (room) => room._id === selectedRoom._id,
        );
        if (updatedSelectedRoom) {
          setSelectedRoom(updatedSelectedRoom);
          console.log("Updated selectedRoom with fresh data");
        }
      } else if (userRooms.length > 0) {
        setSelectedRoom(userRooms[0]);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error.message);
      console.error("Error details:", error);
      Alert.alert("Error", "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRooms();
    if (selectedRoom) {
      await loadMemberPresence(selectedRoom._id);
    }
    setRefreshing(false);
  };

  const calculateBillShare = () => {
    if (!selectedRoom?.billing) return null;

    const billing = selectedRoom.billing;
    const members = selectedRoom.members || [];
    const payorCount = Math.max(
      1,
      members.filter((m) => m.isPayer).length || 1,
    );

    const rentPerPayor = billing.rent ? billing.rent / payorCount : 0;
    const electricityPerPayor = billing.electricity
      ? billing.electricity / payorCount
      : 0;
    const waterPerPayor = calculateTotalWaterBill() / payorCount;

    return {
      rent: rentPerPayor,
      electricity: electricityPerPayor,
      water: waterPerPayor,
      total: rentPerPayor + electricityPerPayor + waterPerPayor,
      payorCount,
    };
  };

  const calculateTotalWaterBill = () => {
    if (!selectedRoom?.members) return 0;
    let totalDays = 0;
    selectedRoom.members.forEach((member) => {
      const presence = memberPresence[member._id] || [];
      totalDays += presence.length;
    });
    return totalDays * WATER_BILL_PER_DAY;
  };

  const calculateMemberWaterBill = (memberId) => {
    const presence = memberPresence[memberId] || [];
    return presence.length * WATER_BILL_PER_DAY;
  };

  // Calendar helper functions for presence modal
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatToYMD = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const generateCalendarDays = () => {
    const year = presenceMonth.getFullYear();
    const month = presenceMonth.getMonth();
    const daysInMonth = getDaysInMonth(presenceMonth);
    const firstDay = getFirstDayOfMonth(presenceMonth);
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
    if (!date || !selectedMemberPresence) return false;
    const dateStr = formatToYMD(date);
    return selectedMemberPresence.dates.some((d) => formatToYMD(d) === dateStr);
  };

  const exportBillingData = async () => {
    try {
      if (!selectedRoom || !billing?.start || !billing?.end) {
        Alert.alert("Error", "No active billing period to export");
        return;
      }

      const startDate = billing.start
        ? new Date(billing.start).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "Not set";
      const endDate = billing.end
        ? new Date(billing.end).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "Not set";

      const totalWater = calculateTotalWaterBill().toFixed(2);
      const grandTotal = (
        (billing.rent || 0) +
        (billing.electricity || 0) +
        parseFloat(totalWater)
      ).toFixed(2);

      // Generate receipt-style HTML
      const receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Billing Receipt - ${selectedRoom.name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace; 
              background-color: #f5f5f5;
              padding: 20px;
            }
            .receipt-container {
              max-width: 500px;
              margin: 0 auto;
              background-color: white;
              padding: 30px 20px;
              border: 1px solid #ddd;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #333;
              padding-bottom: 15px;
              margin-bottom: 15px;
            }
            .header h1 {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .header p {
              font-size: 12px;
              color: #666;
              margin: 2px 0;
            }
            .section {
              margin: 15px 0;
              border-bottom: 1px dashed #999;
              padding-bottom: 10px;
            }
            .section-title {
              font-weight: bold;
              font-size: 13px;
              margin-bottom: 8px;
              text-transform: uppercase;
            }
            .row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              margin: 5px 0;
            }
            .label { flex: 1; }
            .value { text-align: right; font-weight: bold; min-width: 80px; }
            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 14px;
              font-weight: bold;
              margin-top: 10px;
              padding-top: 10px;
              border-top: 2px solid #333;
            }
            .total-label { flex: 1; }
            .total-value { text-align: right; }
            .member-list {
              font-size: 11px;
              line-height: 1.4;
            }
            .member-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin: 5px 0;
              padding: 5px;
              background-color: #f9f9f9;
              border-radius: 3px;
            }
            .member-name { flex: 1; }
            .member-days { width: 40px; text-align: center; }
            .member-water { width: 60px; text-align: right; }
            .member-status { width: 80px; text-align: right; font-weight: bold; }
            .your-share {
              background-color: #fffde7;
              border: 2px solid #fbc02d;
              padding: 10px;
              margin: 10px 0;
              border-radius: 5px;
            }
            .your-share-title {
              font-weight: bold;
              font-size: 12px;
              margin-bottom: 8px;
              color: #f57f17;
            }
            .footer {
              text-align: center;
              font-size: 10px;
              color: #999;
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px dashed #ccc;
            }
            .divider-line { height: 2px; background-color: #000; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <!-- Header -->
            <div class="header">
              <h1>BILLING RECEIPT</h1>
              <p>${selectedRoom.name}</p>
              <p>Apartment Bill Tracker</p>
            </div>

            <!-- Billing Period -->
            <div class="section">
              <div class="section-title">Billing Period</div>
              <div class="row">
                <span class="label">From:</span>
                <span class="value">${startDate}</span>
              </div>
              <div class="row">
                <span class="label">To:</span>
                <span class="value">${endDate}</span>
              </div>
            </div>

            <!-- Total Bills Summary -->
            <div class="section">
              <div class="section-title">Bills Summary</div>
              <div class="row">
                <span class="label">Rent</span>
                <span class="value">₱${(billing.rent || 0).toFixed(2)}</span>
              </div>
              <div class="row">
                <span class="label">Electricity</span>
                <span class="value">₱${(billing.electricity || 0).toFixed(2)}</span>
              </div>
              <div class="row">
                <span class="label">Water Bill</span>
                <span class="value">₱${totalWater}</span>
              </div>
              <div class="total-row">
                <span class="total-label">TOTAL BILLS</span>
                <span class="total-value">₱${grandTotal}</span>
              </div>
            </div>

            <!-- Members & Water Bill -->
            <div class="section">
              <div class="section-title">Members Breakdown</div>
              <div class="member-list">
                ${selectedRoom.members
                  .map(
                    (member) => `
                  <div class="member-item">
                    <span class="member-name">${member.user?.name || "Unknown"}</span>
                    <span class="member-days">${(memberPresence[member._id] || []).length}d</span>
                    <span class="member-water">₱${calculateMemberWaterBill(member._id).toFixed(2)}</span>
                    <span class="member-status">${member.isPayer ? "Payor" : "Non-Payor"}</span>
                  </div>
                `,
                  )
                  .join("")}
              </div>
            </div>

            ${
              isUserPayor && billShare
                ? `
            <!-- Your Share -->
            <div class="your-share">
              <div class="your-share-title">YOUR SHARE (PAYOR)</div>
              <div class="row">
                <span class="label">Rent Share:</span>
                <span class="value">₱${billShare.rent.toFixed(2)}</span>
              </div>
              <div class="row">
                <span class="label">Electricity:</span>
                <span class="value">₱${billShare.electricity.toFixed(2)}</span>
              </div>
              <div class="row">
                <span class="label">Water Share:</span>
                <span class="value">₱${billShare.water.toFixed(2)}</span>
              </div>
              <div class="divider-line"></div>
              <div class="total-row" style="border-top: none; padding-top: 0;">
                <span class="total-label">AMOUNT DUE</span>
                <span class="total-value">₱${billShare.total.toFixed(2)}</span>
              </div>
              <div class="row" style="font-size: 10px; color: #666; margin-top: 5px;">
                <span class="label">Split among ${billShare.payorCount} payor(s)</span>
              </div>
            </div>
            `
                : ""
            }

            <!-- Footer -->
            <div class="footer">
              <p>Generated: ${new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })} ${new Date().toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}</p>
              <p>Please keep this receipt for your records</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Prepare structured receipt data
      const receipt = {
        roomName: selectedRoom.name,
        startDate,
        endDate,
        totalWater,
        grandTotal,
        bills: {
          rent: (billing.rent || 0).toFixed(2),
          electricity: (billing.electricity || 0).toFixed(2),
          water: totalWater,
          total: grandTotal,
        },
        members: selectedRoom.members.map((member) => ({
          name: member.user?.name || "Unknown",
          presenceDays: (memberPresence[member._id] || []).length,
          waterBill: calculateMemberWaterBill(member._id).toFixed(2),
          isPayer: member.isPayer,
          billShare:
            member.isPayer && billShare
              ? {
                  rent: billShare.rent.toFixed(2),
                  electricity: billShare.electricity.toFixed(2),
                  water: billShare.water.toFixed(2),
                  total: billShare.total.toFixed(2),
                }
              : null,
        })),
        userShare:
          isUserPayor && billShare
            ? {
                rent: billShare.rent.toFixed(2),
                electricity: billShare.electricity.toFixed(2),
                water: billShare.water.toFixed(2),
                total: billShare.total.toFixed(2),
                payerCount: billShare.payerCount,
              }
            : null,
        generatedDate: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        generatedTime: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setReceiptData(receipt);
      setShowReceiptModal(true);

      Alert.alert(
        "Success",
        "Receipt displayed. You can take a screenshot or use device print function.",
      );
    } catch (error) {
      console.error("Error exporting billing data:", error);
      Alert.alert("Error", "Failed to export billing receipt");
    }
  };

  const currentUserMember = selectedRoom?.members?.find(
    (m) => String(m.user?._id || m.user) === String(userId),
  );

  const billShare = calculateBillShare();
  const billing = selectedRoom?.billing || {};
  const isUserPayor = currentUserMember?.isPayer || false;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#bdb246" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Billing Details</Text>
            <Text style={styles.headerSubtitle}>
              View your share of expenses
            </Text>
          </View>
          {selectedRoom && billing?.start && billing?.end && (
            <TouchableOpacity
              style={styles.exportButton}
              onPress={exportBillingData}
            >
              <MaterialIcons name="file-download" size={24} color="white" />
            </TouchableOpacity>
          )}
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
                onPress={() => {
                  setSelectedRoom(room);
                  loadMemberPresence(room._id);
                }}
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
            {billing?.start && billing?.end ? (
              <>
                {/* Billing Period */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Billing Period</Text>
                  <View style={styles.infoCard}>
                    <View style={styles.periodItem}>
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#bdb246"
                      />
                      <View style={styles.periodInfo}>
                        <Text style={styles.periodLabel}>Start Date</Text>
                        <Text style={styles.periodValue}>
                          {billing.start
                            ? new Date(billing.start).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )
                            : "Not set"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.periodItem}>
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#bdb246"
                      />
                      <View style={styles.periodInfo}>
                        <Text style={styles.periodLabel}>End Date</Text>
                        <Text style={styles.periodValue}>
                          {billing.end
                            ? new Date(billing.end).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )
                            : "Not set"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Total Bills Overview */}
                {billing.start &&
                billing.end &&
                (billing.rent || billing.electricity) ? (
                  <>
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Total Bills</Text>
                      <View style={styles.totalBillsGrid}>
                        {/* Row 1 */}
                        <View style={styles.totalBillsRow}>
                          <View style={styles.totalBillCard}>
                            <View style={styles.totalBillIconContainer}>
                              <MaterialIcons
                                name="house"
                                size={24}
                                color="#bdb246"
                              />
                            </View>
                            <Text style={styles.totalBillLabel}>Rent</Text>
                            <Text style={styles.totalBillAmount}>
                              ₱{billing.rent || 0}
                            </Text>
                          </View>

                          <View style={styles.totalBillCard}>
                            <View style={styles.totalBillIconContainer}>
                              <MaterialIcons
                                name="flash-on"
                                size={24}
                                color="#ff9800"
                              />
                            </View>
                            <Text style={styles.totalBillLabel}>
                              Electricity
                            </Text>
                            <Text style={styles.totalBillAmount}>
                              ₱{billing.electricity || 0}
                            </Text>
                          </View>
                        </View>

                        {/* Row 2 */}
                        <View style={styles.totalBillsRow}>
                          <View style={styles.totalBillCard}>
                            <View style={styles.totalBillIconContainer}>
                              <Ionicons
                                name="water"
                                size={24}
                                color="#2196F3"
                              />
                            </View>
                            <Text style={styles.totalBillLabel}>Water</Text>
                            <Text style={styles.totalBillAmount}>
                              ₱{calculateTotalWaterBill().toFixed(2)}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.totalBillCard,
                              styles.totalBillCardHighlight,
                            ]}
                          >
                            <View style={styles.totalBillIconContainer}>
                              <MaterialIcons
                                name="monetization-on"
                                size={24}
                                color="#28a745"
                              />
                            </View>
                            <Text style={styles.totalBillLabel}>Total</Text>
                            <Text
                              style={[
                                styles.totalBillAmount,
                                { color: "#28a745" },
                              ]}
                            >
                              ₱
                              {(
                                (billing.rent || 0) +
                                (billing.electricity || 0) +
                                calculateTotalWaterBill()
                              ).toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </>
                ) : null}

                {/* Your Share */}
                {billShare && isUserPayor && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Share</Text>
                    <View style={styles.yourShareCard}>
                      <View style={styles.shareRow}>
                        <View style={styles.shareItem}>
                          <Text style={styles.shareLabel}>Rent Share</Text>
                          <Text style={styles.shareValue}>
                            ₱{billShare.rent.toFixed(2)}
                          </Text>
                          <Text style={styles.shareNote}>
                            Split among {billShare.payorCount} payor(s)
                          </Text>
                        </View>
                      </View>
                      <View style={styles.shareDivider} />
                      <View style={styles.shareRow}>
                        <View style={styles.shareItem}>
                          <Text style={styles.shareLabel}>
                            Electricity Share
                          </Text>
                          <Text style={styles.shareValue}>
                            ₱{billShare.electricity.toFixed(2)}
                          </Text>
                          <Text style={styles.shareNote}>
                            Split among {billShare.payorCount} payor(s)
                          </Text>
                        </View>
                      </View>
                      <View style={styles.shareDivider} />
                      <View style={styles.shareRow}>
                        <View style={styles.shareItem}>
                          <Text style={styles.shareLabel}>Water Share</Text>
                          <Text style={styles.shareValue}>
                            ₱{billShare.water.toFixed(2)}
                          </Text>
                          <Text style={styles.shareNote}>
                            Split among {billShare.payorCount} payor(s)
                          </Text>
                        </View>
                      </View>
                      <View style={styles.shareDivider} />
                      <View style={styles.shareTotal}>
                        <Text style={styles.totalLabel}>Total Due</Text>
                        <Text style={styles.totalAmount}>
                          ₱{billShare.total.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {!isUserPayor && (
                  <View style={styles.section}>
                    <View style={styles.nonPayorCard}>
                      <MaterialIcons name="info" size={24} color="#17a2b8" />
                      <Text style={styles.nonPayorText}>
                        You are not a payor for this room
                      </Text>
                      <Text style={styles.nonPayorSubtext}>
                        Only payors see billing shares
                      </Text>
                    </View>
                  </View>
                )}

                {/* Members Breakdown */}
                {selectedRoom.members && selectedRoom.members.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      Room Members & Water Bill
                    </Text>
                    {selectedRoom.members.map((member, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.memberCard}
                        onPress={() => {
                          setSelectedMemberPresence({
                            name: member.user?.name || "Unknown",
                            dates: memberPresence[member._id] || [],
                          });
                          setShowPresenceModal(true);
                        }}
                        activeOpacity={0.7}
                      >
                        {member.user?.avatar?.url ? (
                          <Image
                            source={{ uri: member.user.avatar.url }}
                            style={styles.memberIconImage}
                          />
                        ) : (
                          <View style={styles.memberIcon}>
                            <Text style={styles.memberIconText}>
                              {(member.user?.name || "M")
                                .charAt(0)
                                .toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>
                            {member.user?.name || "Unknown"}
                          </Text>
                          {/* <Text style={styles.memberEmail}>
                          {member.user?.email || "N/A"}
                        </Text> */}
                          <Text style={styles.memberPresence}>
                            Presence:{" "}
                            {(memberPresence[member._id] || []).length} days
                          </Text>
                        </View>
                        <View style={styles.memberWaterBill}>
                          <Text style={styles.waterBillLabel}>Water Bill</Text>
                          <Text style={styles.waterBillAmount}>
                            ₱{calculateMemberWaterBill(member._id).toFixed(2)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.memberBadgeContainer,
                            member.isPayer
                              ? styles.payorBadge
                              : styles.nonPayorBadge,
                          ]}
                        >
                          <Text style={[styles.payorBadgeText]}>
                            {member.isPayer ? "Payor" : "Non-Payor"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Meter Readings */}
                {(billing.previousReading !== undefined ||
                  billing.currentReading !== undefined) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Meter Readings</Text>
                    <View style={styles.readingsCard}>
                      <View style={styles.readingItem}>
                        <Text style={styles.readingLabel}>
                          Previous Reading
                        </Text>
                        <Text style={styles.readingValue}>
                          {billing.previousReading || "N/A"}
                        </Text>
                      </View>
                      <View style={styles.readingDivider} />
                      <View style={styles.readingItem}>
                        <Text style={styles.readingLabel}>Current Reading</Text>
                        <Text style={styles.readingValue}>
                          {billing.currentReading || "N/A"}
                        </Text>
                      </View>
                      <View style={styles.readingDivider} />
                      <View style={styles.readingItem}>
                        <Text style={styles.readingLabel}>Usage</Text>
                        <Text style={styles.readingValue}>
                          {billing.currentReading && billing.previousReading
                            ? billing.currentReading - billing.previousReading
                            : "N/A"}{" "}
                          Units
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.section}>
                <View style={styles.emptyCard}>
                  <MaterialIcons
                    name="hourglass-empty"
                    size={48}
                    color="#bdb246"
                  />
                  <Text style={styles.emptyText}>No Active Billing Cycle</Text>
                  <Text style={styles.emptySubtext}>
                    Waiting for admin to set billing details for this billing
                    period
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {rooms.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="inbox" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No Rooms Joined</Text>
            <Text style={styles.emptySubtext}>
              Join a room from Home to view billing
            </Text>
          </View>
        )}

        {selectedRoom && (
          <TouchableOpacity
            style={styles.billingHistoryButton}
            onPress={() =>
              navigation.navigate("BillingHistory", {
                roomId: selectedRoom._id,
                roomName: selectedRoom.name,
              })
            }
          >
            <Text style={styles.billingHistoryButtonText}>
              📜 View Billing History
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Receipt Modal */}
      <Modal
        visible={showReceiptModal}
        animationType="slide"
        onRequestClose={() => setShowReceiptModal(false)}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
            <MaterialIcons name="close" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Billing Receipt</Text>
          <View style={{ width: 28 }} />
        </View>
        {receiptData && (
          <ScrollView style={styles.receiptContainer}>
            {/* Header */}
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptTitle}>BILLING RECEIPT</Text>
              <Text style={styles.receiptRoomName}>{receiptData.roomName}</Text>
              <Text style={styles.receiptSubtitle}>Apartment Bill Tracker</Text>
            </View>

            {/* Billing Period */}
            <View style={styles.receiptSection}>
              <Text style={styles.receiptSectionTitle}>Billing Period</Text>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>From:</Text>
                <Text style={styles.receiptValue}>{receiptData.startDate}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>To:</Text>
                <Text style={styles.receiptValue}>{receiptData.endDate}</Text>
              </View>
            </View>

            {/* Bills Summary */}
            <View style={styles.receiptSection}>
              <Text style={styles.receiptSectionTitle}>Bills Summary</Text>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Rent</Text>
                <Text style={styles.receiptAmount}>
                  ₱{receiptData.bills.rent}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Electricity</Text>
                <Text style={styles.receiptAmount}>
                  ₱{receiptData.bills.electricity}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Water Bill</Text>
                <Text style={styles.receiptAmount}>
                  ₱{receiptData.bills.water}
                </Text>
              </View>
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptTotalLabel}>TOTAL BILLS</Text>
                <Text style={styles.receiptTotalAmount}>
                  ₱{receiptData.bills.total}
                </Text>
              </View>
            </View>

            {/* Members */}
            <View style={styles.receiptSection}>
              <Text style={styles.receiptSectionTitle}>
                Members Breakdown (Water Bill)
              </Text>
              {receiptData.members.map((member, idx) => (
                <View key={idx} style={styles.receiptMemberItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receiptMemberName}>{member.name}</Text>
                    <Text style={styles.receiptMemberDays}>
                      {member.presenceDays} days presence
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.receiptMemberWater}>
                      ₱{member.waterBill}
                    </Text>
                    <Text
                      style={[
                        styles.receiptMemberStatus,
                        { color: member.isPayer ? "#28a745" : "#666" },
                      ]}
                    >
                      {member.isPayer ? "Payer" : "Non-Payer"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Bill Per Member (for payors) */}
            {receiptData.members.some((m) => m.isPayer) && (
              <View style={styles.receiptSection}>
                <Text style={styles.receiptSectionTitle}>Bill Per Member</Text>
                {receiptData.members.map(
                  (member, idx) =>
                    member.isPayer &&
                    member.billShare && (
                      <View key={idx} style={styles.receiptBillPerMemberItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.receiptBillPerMemberName}>
                            {member.name}
                          </Text>
                          <Text style={styles.receiptBillPerMemberSubtext}>
                            Payor
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <View style={styles.receiptBillPerMemberBreakdown}>
                            <Text style={styles.receiptBillPerMemberDetail}>
                              Rent: ₱{member.billShare.rent}
                            </Text>
                            <Text style={styles.receiptBillPerMemberDetail}>
                              Elec: ₱{member.billShare.electricity}
                            </Text>
                            <Text style={styles.receiptBillPerMemberDetail}>
                              Water: ₱{member.billShare.water}
                            </Text>
                          </View>
                          <Text style={styles.receiptBillPerMemberTotal}>
                            Total: ₱{member.billShare.total}
                          </Text>
                        </View>
                      </View>
                    ),
                )}
              </View>
            )}

            {/* Your Share */}
            {receiptData.userShare && (
              <View style={styles.receiptYourShare}>
                <Text style={styles.receiptSectionTitle}>
                  YOUR SHARE (PAYOR)
                </Text>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Rent Share:</Text>
                  <Text style={styles.receiptAmount}>
                    ₱{receiptData.userShare.rent}
                  </Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Electricity:</Text>
                  <Text style={styles.receiptAmount}>
                    ₱{receiptData.userShare.electricity}
                  </Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Water Share:</Text>
                  <Text style={styles.receiptAmount}>
                    ₱{receiptData.userShare.water}
                  </Text>
                </View>
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>AMOUNT DUE</Text>
                  <Text style={styles.receiptTotalAmount}>
                    ₱{receiptData.userShare.total}
                  </Text>
                </View>
                <Text style={styles.receiptPayorNote}>
                  Split among {receiptData.userShare.payorCount} payor(s)
                </Text>
              </View>
            )}

            {/* Footer */}
            <View style={styles.receiptFooter}>
              <Text style={styles.receiptFooterText}>
                Generated: {receiptData.generatedDate}{" "}
                {receiptData.generatedTime}
              </Text>
              <Text style={styles.receiptFooterText}>
                Please keep this receipt for your records
              </Text>
              <Text style={styles.receiptFooterText}>
                Take a screenshot or use device print function to save as PDF
              </Text>
            </View>
          </ScrollView>
        )}
      </Modal>

      {/* Presence Modal */}
      <Modal
        visible={showPresenceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPresenceModal(false)}
      >
        <View style={styles.presenceModalOverlay}>
          <View style={styles.presenceModalContainer}>
            {/* Header */}
            <View style={styles.presenceModalHeader}>
              <Text style={styles.presenceModalTitle}>
                {selectedMemberPresence?.name}
              </Text>
              <TouchableOpacity
                style={styles.presenceModalCloseBtn}
                onPress={() => setShowPresenceModal(false)}
              >
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.presenceModalContent}>
              {/* Calendar Navigation */}
              <View style={styles.presenceCalendarHeader}>
                <TouchableOpacity
                  onPress={() =>
                    setPresenceMonth(
                      new Date(
                        presenceMonth.getFullYear(),
                        presenceMonth.getMonth() - 1,
                      ),
                    )
                  }
                >
                  <Ionicons name="chevron-back" size={28} color="#bdb246" />
                </TouchableOpacity>

                <Text style={styles.presenceMonthYear}>
                  {presenceMonth.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setPresenceMonth(
                      new Date(
                        presenceMonth.getFullYear(),
                        presenceMonth.getMonth() + 1,
                      ),
                    )
                  }
                >
                  <Ionicons name="chevron-forward" size={28} color="#bdb246" />
                </TouchableOpacity>
              </View>

              {/* Week Days Header */}
              <View style={styles.presenceWeekDaysContainer}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <View key={day} style={styles.presenceWeekDayHeader}>
                      <Text style={styles.presenceWeekDayText}>{day}</Text>
                    </View>
                  ),
                )}
              </View>

              {/* Calendar Days Grid */}
              <View style={styles.presenceCalendarDaysContainer}>
                {generateCalendarDays().map((date, index) => (
                  <View
                    key={index}
                    style={[
                      styles.presenceDayCell,
                      !date && styles.presenceEmptyCell,
                      date && isDateMarked(date) && styles.presenceMarkedCell,
                    ]}
                  >
                    {date ? (
                      <>
                        <Text
                          style={[
                            styles.presenceDayText,
                            isDateMarked(date) && styles.presenceMarkedDayText,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                        {isDateMarked(date) && (
                          <View style={styles.presenceCheckmarkContainer}>
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color="#fff"
                            />
                          </View>
                        )}
                      </>
                    ) : null}
                  </View>
                ))}
              </View>

              {/* Summary */}
              <View style={styles.presenceSummary}>
                <View style={styles.presenceSummaryItem}>
                  <View style={styles.presenceSummaryIcon} />
                  <Text style={styles.presenceSummaryText}>
                    Marked: {selectedMemberPresence?.dates?.length || 0} days
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerContent: {
    flex: 1,
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
  exportButton: {
    backgroundColor: "#bdb246",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
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
  infoCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 14,
  },
  periodItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  periodInfo: {
    marginLeft: 12,
    flex: 1,
  },
  periodLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  periodValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 8,
  },
  totalBillsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  totalBillsGrid: {
    gap: 12,
  },
  totalBillsRow: {
    flexDirection: "row",
    gap: 12,
  },
  totalBillCard: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  totalBillCardHighlight: {
    backgroundColor: "#e8f5e9",
    borderWidth: 2,
    borderColor: "#28a745",
  },
  totalBillIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  totalBillLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 8,
  },
  totalBillAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  yourShareCard: {
    backgroundColor: "#f0f8ff",
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#bdb246",
    overflow: "hidden",
  },
  shareRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  shareItem: {
    flex: 1,
  },
  shareLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
    marginBottom: 4,
  },
  shareValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  shareNote: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  shareDivider: {
    height: 1,
    backgroundColor: "#cee4ee",
    marginHorizontal: 14,
  },
  shareTotal: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#e0f2f7",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 13,
    color: "#333",
    fontWeight: "600",
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#bdb246",
  },
  nonPayorCard: {
    backgroundColor: "#d1ecf1",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#17a2b8",
  },
  nonPayorText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0c5460",
    marginTop: 8,
  },
  nonPayorSubtext: {
    fontSize: 12,
    color: "#0c5460",
    marginTop: 4,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  memberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#bdb246",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberIconImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: "#bdb246",
  },
  memberIconText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
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
    color: "#666",
    marginTop: 2,
  },
  memberPresence: {
    fontSize: 11,
    color: "#17a2b8",
    marginTop: 4,
    fontWeight: "500",
  },
  memberWaterBill: {
    marginRight: 10,
    alignItems: "flex-end",
  },
  waterBillLabel: {
    fontSize: 10,
    color: "#666",
    fontWeight: "500",
  },
  waterBillAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2196F3",
    marginTop: 2,
  },
  payorBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  payorBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "white",
  },
  nonPayorBadge: {
    backgroundColor: "#b8b8b8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nonPayorBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  memberBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  memberBadge: {
    backgroundColor: "#e7e7e7",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  memberBadgeText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 11,
  },
  readingsCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 14,
  },
  readingItem: {
    paddingVertical: 10,
  },
  readingLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
    marginBottom: 4,
  },
  readingValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  readingDivider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 8,
  },
  emptyCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    paddingVertical: 30,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    marginTop: 40,
  },
  modalHeader: {
    backgroundColor: "#bdb246",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
  },
  receiptContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  receiptHeader: {
    backgroundColor: "white",
    paddingVertical: 20,
    alignItems: "center",
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: "#bdb246",
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  receiptRoomName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 5,
  },
  receiptSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },
  receiptSection: {
    backgroundColor: "white",
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 10,
    borderRadius: 6,
  },
  receiptSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 8,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  receiptLabel: {
    fontSize: 12,
    color: "#666",
  },
  receiptValue: {
    fontSize: 12,
    color: "#999",
  },
  receiptAmount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#28a745",
  },
  receiptTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#333",
  },
  receiptTotalLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
  },
  receiptTotalAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#28a745",
  },
  receiptMemberItem: {
    flexDirection: "row",
    backgroundColor: "#fafafa",
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#bdb246",
  },
  receiptMemberName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  receiptMemberDays: {
    fontSize: 11,
    color: "#17a2b8",
    marginTop: 3,
  },
  receiptMemberWater: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2196F3",
  },
  receiptMemberStatus: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  receiptBillPerMemberItem: {
    flexDirection: "row",
    backgroundColor: "#f0f8ff",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  receiptBillPerMemberName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },
  receiptBillPerMemberSubtext: {
    fontSize: 10,
    color: "#2196F3",
    marginTop: 2,
    fontWeight: "600",
  },
  receiptBillPerMemberBreakdown: {
    marginBottom: 8,
    alignItems: "flex-end",
  },
  receiptBillPerMemberDetail: {
    fontSize: 11,
    color: "#555",
    marginVertical: 2,
  },
  receiptBillPerMemberTotal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2196F3",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#2196F3",
  },
  receiptYourShare: {
    backgroundColor: "#fffde7",
    borderWidth: 2,
    borderColor: "#fbc02d",
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 10,
    borderRadius: 6,
  },
  receiptPayorNote: {
    fontSize: 11,
    color: "#f57f17",
    marginTop: 8,
    fontWeight: "500",
  },
  receiptFooter: {
    backgroundColor: "white",
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 15,
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  receiptFooterText: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    marginVertical: 3,
  },
  billingHistoryButton: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#6c63ff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  billingHistoryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  // Presence Modal Styles
  presenceModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  presenceModalContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    maxHeight: "80%",
    width: "100%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  presenceModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  presenceModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    flex: 1,
  },
  presenceModalCloseBtn: {
    padding: 4,
  },
  presenceModalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  presenceCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  presenceDatesList: {
    gap: 10,
  },
  presenceDateItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f0f8f5",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#28a745",
  },
  presenceDateIcon: {
    marginRight: 12,
  },
  presenceDateText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  presenceEmptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  presenceEmptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },

  // New Calendar Styles for Presence Modal
  presenceCalendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  presenceMonthYear: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  presenceWeekDaysContainer: {
    flexDirection: "row",
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  presenceWeekDayHeader: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  presenceWeekDayText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  presenceCalendarDaysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  presenceDayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    marginHorizontal: 2,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    position: "relative",
  },
  presenceEmptyCell: {
    backgroundColor: "transparent",
  },
  presenceMarkedCell: {
    backgroundColor: "#28a745",
  },
  presenceDayText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  presenceMarkedDayText: {
    color: "#fff",
    fontWeight: "600",
  },
  presenceCheckmark: {
    position: "relative",
  },
  presenceCheckmarkContainer: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#27ae60",
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  presenceSummary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    marginBottom: 16,
  },
  presenceSummaryItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  presenceSummaryIcon: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: "#28a745",
    marginRight: 10,
  },
  presenceSummaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
});

export default BillsScreen;
