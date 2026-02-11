import React, { useState, useEffect, useContext, useMemo } from "react";
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
  Dimensions,
} from "react-native";
import { MaterialIcons, Ionicons, FontAwesome } from "@expo/vector-icons";
import { roomService, billingCycleService } from "../../services/apiService";
import { AuthContext } from "../../context/AuthContext";
import { roundTo2 as r2 } from "../../utils/helpers";
import { useTheme } from "../../theme/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const WATER_BILL_PER_DAY = 5; // 5 pesos per day

const BillsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { state } = useContext(AuthContext);
  const isFocused = useIsFocused();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeCycle, setActiveCycle] = useState(null); // Active billing cycle with memberCharges
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [memberPresence, setMemberPresence] = useState({}); // { memberId: presenceArray }
  const [receiptHTML, setReceiptHTML] = useState(null); // HTML for receipt modal
  const [receiptData, setReceiptData] = useState(null); // Structured receipt data
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedMemberPresence, setSelectedMemberPresence] = useState(null); // For presence modal
  const [showPresenceModal, setShowPresenceModal] = useState(false);
  const [presenceMonth, setPresenceMonth] = useState(new Date()); // For calendar navigation

  const userId = state?.user?.id || state?.user?._id;

  useEffect(() => {
    if (isFocused) {
      // Always reset selectedRoom when returning to this screen
      setSelectedRoom(null); // Reset selected room to show default fallback
      // Then fetch rooms WITH auto-selection to load fresh payment data
      fetchRooms(false); // Pass false to auto-select first room (CRITICAL for payment updates!)
    }
  }, [isFocused]);

  // Refetch whenever user profile changes (name or avatar)
  useEffect(() => {
    console.log("User profile changed, refetching rooms");
    fetchRooms();
  }, [state.user?.name, state.user?.avatar?.url]);

  useEffect(() => {
    if (selectedRoom) {
      loadMemberPresence(selectedRoom.id || selectedRoom._id);
      fetchActiveBillingCycle(selectedRoom.id || selectedRoom._id); // Fetch active cycle for accurate charges
      console.log("📍 BillsScreen - selectedRoom changed");
      console.log("   Room ID:", selectedRoom.id || selectedRoom._id);
      console.log("   memberPayments:", selectedRoom.memberPayments);
      console.log("   billing:", selectedRoom.billing);
      if (
        selectedRoom.memberPayments &&
        selectedRoom.memberPayments.length > 0
      ) {
        console.log("   First memberPayment:", selectedRoom.memberPayments[0]);
      }
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
          presenceMap[member.id || member._id] = member.presence || [];
          console.log(`Member ${member.user?.name} presence:`, member.presence);
        });
        setMemberPresence(presenceMap);
        console.log("Member presence map:", presenceMap);
      }
    } catch (error) {
      console.error("Error loading member presence:", error);
    }
  };

  const fetchActiveBillingCycle = async (roomId) => {
    try {
      console.log("🔄 Fetching active billing cycle for room:", roomId);
      const response = await billingCycleService.getBillingCycles(roomId);
      console.log("📦 getBillingCycles response:", response);

      // Response could be: array directly, or { billingCycles: array }
      let cycles = Array.isArray(response)
        ? response
        : response?.billingCycles || response?.data || [];
      console.log("📋 Parsed cycles:", cycles);

      // Find active cycle
      const active = cycles.find((c) => c.status === "active");
      if (active) {
        setActiveCycle(active);
        console.log(
          "✅ Active cycle found:",
          active.id || active._id,
          "with memberCharges count:",
          active.memberCharges?.length,
        );
        console.log(
          "   memberCharges:",
          JSON.stringify(active.memberCharges, null, 2),
        );
      } else {
        console.log("⚠️ No active cycle found in", cycles.length, "cycles");
        setActiveCycle(null);
      }
    } catch (error) {
      console.error("❌ Error fetching active billing cycle:", error);
      setActiveCycle(null);
    }
  };

  const fetchRooms = async (skipAutoSelect = false) => {
    try {
      setLoading(true);
      console.log("Fetching rooms...");
      const response = await roomService.getClientRooms();
      console.log("Bills Screen - getClientRooms response:", response);
      // Handle response structure from fetch API: response = { data, status }
      const data = response.data || response;
      const fetchedRooms = data.rooms || data || [];
      console.log("Bills Screen - fetched rooms:", fetchedRooms);
      console.log(
        "Bills Screen - first room members:",
        fetchedRooms[0]?.members,
      );

      // Backend already filters to show only rooms user is part of (via $or query with memberPayments)
      // So use all returned rooms without additional filtering
      console.log("Bills Screen - user rooms:", fetchedRooms);
      setRooms(fetchedRooms);

      // Update selectedRoom with fresh data or set to first room
      // Skip auto-selection if explicitly requested (e.g., when returning from payment)
      if (!skipAutoSelect) {
        if (selectedRoom && fetchedRooms.length > 0) {
          // Find the updated version of the currently selected room
          const updatedSelectedRoom = fetchedRooms.find(
            (room) =>
              (room.id || room._id) === (selectedRoom.id || selectedRoom._id),
          );
          if (updatedSelectedRoom) {
            setSelectedRoom(updatedSelectedRoom);
            console.log("Updated selectedRoom with fresh data");
          }
        } else if (fetchedRooms.length > 0) {
          setSelectedRoom(fetchedRooms[0]);
        }
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
      await loadMemberPresence(selectedRoom.id || selectedRoom._id);
    }
    setRefreshing(false);
  };

  const calculateBillShare = () => {
    if (!selectedRoom?.billing || !userId) return null;

    // PRIORITY 1: Use activeCycle memberCharges if available AND populated
    if (activeCycle?.memberCharges?.length > 0) {
      console.log("💼 calculateBillShare: Using activeCycle memberCharges");
      const userCharge = activeCycle.memberCharges.find(
        (c) => String(c.userId) === String(userId),
      );
      if (userCharge) {
        console.log("   Found user charge:", {
          water: userCharge.waterBillShare,
          rent: userCharge.rentShare,
          electricity: userCharge.electricityShare,
          internet: userCharge.internetShare,
          total: userCharge.totalDue,
        });
        return {
          rent: userCharge.rentShare || 0,
          electricity: userCharge.electricityShare || 0,
          internet: userCharge.internetShare || 0,
          water: userCharge.waterBillShare || 0,
          total: userCharge.totalDue || 0,
          payorCount: activeCycle.memberCharges.filter((c) => c.isPayer).length,
        };
      }
    }

    // FALLBACK: Calculate from room data if no active cycle or empty memberCharges
    console.log(
      activeCycle
        ? "⚠️ calculateBillShare: activeCycle found but memberCharges empty, using fallback"
        : "⚠️ calculateBillShare: No activeCycle yet, using fallback calculation",
    );
    const billing = selectedRoom.billing;
    const members = selectedRoom.members || [];
    const payorCount = Math.max(
      1,
      members.filter((m) => m.isPayer).length || 1,
    );

    const rentPerPayor = billing.rent ? r2(billing.rent / payorCount) : 0;
    const electricityPerPayor = billing.electricity
      ? r2(billing.electricity / payorCount)
      : 0;
    const internetPerPayor = billing.internet
      ? r2(billing.internet / payorCount)
      : 0;

    // Calculate water share inline in fallback to avoid timing issues
    // Get current user's member object
    const currentUserMember = selectedRoom.members.find(
      (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
    );

    let waterShare = 0;
    if (
      currentUserMember?.isPayer &&
      memberPresence[currentUserMember.id || currentUserMember._id]
    ) {
      // Current user's own water consumption
      const userPresenceDays =
        memberPresence[currentUserMember.id || currentUserMember._id]?.length ||
        0;
      const userOwnWater = userPresenceDays * WATER_BILL_PER_DAY;

      // Non-payors' water to split
      let nonPayorWater = 0;
      members.forEach((m) => {
        if (!m.isPayer) {
          const presenceDays = memberPresence[m.id || m._id]?.length || 0;
          nonPayorWater += presenceDays * WATER_BILL_PER_DAY;
        }
      });

      const sharedNonPayorWater =
        payorCount > 0 ? r2(nonPayorWater / payorCount) : 0;
      waterShare = r2(userOwnWater + sharedNonPayorWater);
      console.log(
        `   Fallback water calc: own=${userOwnWater}, shared=${sharedNonPayorWater}, total=${waterShare}`,
      );
    }

    return {
      rent: rentPerPayor,
      electricity: electricityPerPayor,
      internet: internetPerPayor,
      water: waterShare,
      total: r2(
        rentPerPayor + electricityPerPayor + internetPerPayor + waterShare,
      ),
      payorCount,
    };
  };

  const calculateTotalWaterBill = () => {
    // Total water = ALL members' presence days × ₱5 (including non-payors)
    if (!selectedRoom?.members || selectedRoom.members.length === 0) return 0;
    let totalDays = 0;
    selectedRoom.members.forEach((member) => {
      const presence = memberPresence[member.id || member._id] || [];
      totalDays += presence.length;
    });
    const result = totalDays * WATER_BILL_PER_DAY;
    // Ensure we always return a number, never undefined
    return typeof result === "number" ? result : 0;
  };

  // Check if current user has paid all their bills
  const hasUserPaidAllBills = () => {
    if (!selectedRoom || !userId) return false;

    console.log("🔍 BillsScreen - Checking payment status for user:", userId);
    console.log("   memberPayments available:", selectedRoom.memberPayments);

    // Find user's payment status
    const userPayment = selectedRoom.memberPayments?.find(
      (mp) => String(mp.member) === String(userId),
    );

    console.log("   userPayment found:", userPayment);

    if (!userPayment) return false;

    // User has paid all bills if all statuses are "paid"
    const allPaid =
      userPayment.rentStatus === "paid" &&
      userPayment.electricityStatus === "paid" &&
      userPayment.waterStatus === "paid" &&
      userPayment.internetStatus === "paid";

    console.log(
      "   rentStatus:",
      userPayment.rentStatus,
      "electricityStatus:",
      userPayment.electricityStatus,
      "waterStatus:",
      userPayment.waterStatus,
      "internetStatus:",
      userPayment.internetStatus,
      "allPaid:",
      allPaid,
    );

    return allPaid;
  };

  // Calculate individual member's water consumption (for "Room Members & Water Bill" section)
  const calculateMemberWaterBill = (memberId) => {
    // Show INDIVIDUAL water consumption (days × ₱5)
    // Non-payors' portion is NOT added here - only show what this member consumed
    if (!selectedRoom?.members) return 0;

    const member = selectedRoom.members.find(
      (m) => (m.id || m._id) === memberId,
    );
    if (!member) return 0;

    const presence = memberPresence[memberId] || [];
    const result = presence.length * WATER_BILL_PER_DAY;
    return typeof result === "number" ? result : 0;
  };

  const calculateMemberWaterShare = (memberId) => {
    // Show what PAYOR needs to PAY (own consumption + split of non-payors)
    // This is displayed in the "Your Share" section
    // For non-payors, returns 0
    if (!selectedRoom?.members) return 0;

    const member = selectedRoom.members.find(
      (m) => (m.id || m._id) === memberId,
    );
    if (!member) return 0;

    // Non-payors always pay ₱0 for water
    if (!member.isPayer) return 0;

    // PRIORITY 1: Use active billing cycle data if populated
    if (activeCycle?.memberCharges?.length > 0 && userId) {
      console.log(
        `💧 calculateMemberWaterShare: Using activeCycle memberCharges for ${memberId}`,
      );
      const userCharge = activeCycle.memberCharges.find(
        (c) => String(c.userId) === String(memberId),
      );
      if (userCharge && userCharge.isPayer) {
        console.log(
          `   Found user charge water share: ${userCharge.waterBillShare}`,
        );
        return userCharge.waterBillShare || 0;
      }
    }

    // FALLBACK: Manual calculation from room data
    console.log(
      `⚠️ calculateMemberWaterShare: No activeCycle, using fallback for ${memberId}`,
    );
    const payorCount =
      selectedRoom.members.filter((m) => m.isPayer).length || 1;
    let nonPayorWater = 0;

    selectedRoom.members.forEach((member) => {
      if (!member.isPayer) {
        const presenceDays =
          memberPresence[member.id || member._id]?.length || 0;
        nonPayorWater += presenceDays * WATER_BILL_PER_DAY;
      }
    });

    const presence = memberPresence[memberId] || [];
    const memberOwnWater = presence.length * WATER_BILL_PER_DAY;
    const sharedNonPayorWater =
      payorCount > 0 ? r2(nonPayorWater / payorCount) : 0;

    console.log(
      `   Fallback: own=${memberOwnWater}, shared=${sharedNonPayorWater}, total=${memberOwnWater + sharedNonPayorWater}`,
    );
    const result = r2(memberOwnWater + sharedNonPayorWater);
    return typeof result === "number" ? result : 0;
  };

  // Get water breakdown details for display
  const getWaterShareBreakdown = () => {
    if (!selectedRoom?.members || !userId) return null;

    const currentUserMember = selectedRoom.members.find(
      (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
    );

    if (!currentUserMember?.isPayer) return null;

    // PRIORITY 1: Use backend-computed breakdown from activeCycle
    if (activeCycle?.memberCharges?.length > 0) {
      const userCharge = activeCycle.memberCharges.find(
        (c) => String(c.userId) === String(userId),
      );
      if (userCharge && userCharge.isPayer) {
        const ownWater = userCharge.waterOwn || 0;
        const sharedNonPayorWater = userCharge.waterSharedNonpayor || 0;
        return {
          ownWater,
          nonPayorWater:
            sharedNonPayorWater *
            (activeCycle.memberCharges.filter((c) => c.isPayer).length || 1),
          sharedNonPayorWater,
          payorCount:
            activeCycle.memberCharges.filter((c) => c.isPayer).length || 1,
          totalWaterShare:
            userCharge.waterBillShare || r2(ownWater + sharedNonPayorWater),
        };
      }
    }

    // FALLBACK: Calculate from local presence data
    const payorCount =
      selectedRoom.members.filter((m) => m.isPayer).length || 1;

    const userPresence =
      memberPresence[currentUserMember.id || currentUserMember._id]?.length ||
      0;
    const ownWater = userPresence * WATER_BILL_PER_DAY;

    let nonPayorWater = 0;
    selectedRoom.members.forEach((member) => {
      if (!member.isPayer) {
        const presenceDays =
          memberPresence[member.id || member._id]?.length || 0;
        nonPayorWater += presenceDays * WATER_BILL_PER_DAY;
      }
    });

    const sharedNonPayorWater =
      payorCount > 0 ? r2(nonPayorWater / payorCount) : 0;
    const totalWaterShare = r2(ownWater + sharedNonPayorWater);

    return {
      ownWater,
      nonPayorWater,
      sharedNonPayorWater,
      payorCount,
      totalWaterShare,
    };
  };

  // Check if payment is allowed based on billing cycle end date
  const isPaymentAllowed = () => {
    if (!selectedRoom?.billing?.end) return true; // Allow if no end date

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to midnight for fair date comparison

    const endDate = new Date(selectedRoom.billing.end);
    endDate.setHours(0, 0, 0, 0); // Reset time to midnight

    // Payment allowed if today >= endDate
    return today >= endDate;
  };

  // Get formatted end date for display
  const getFormattedEndDate = () => {
    if (!selectedRoom?.billing?.end) return "";
    return new Date(selectedRoom.billing.end).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Calendar helper functions for presence modal
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    // Use UTC to avoid timezone issues
    const firstDay = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), 1),
    ).getUTCDay();
    console.log(
      `Calendar Debug: ${date.getMonth() + 1}/${date.getFullYear()} starts on day ${firstDay} (0=Sun, 4=Thu)`,
    );
    return firstDay;
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

    console.log(
      `Generating calendar: ${year}-${month + 1}, ${daysInMonth} days, starting on day ${firstDay}`,
    );

    // Add empty cells for days before month starts (Sunday = 0)
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    // Pad remaining cells to complete 6 weeks (42 days)
    while (days.length < 42) {
      days.push(null);
    }

    console.log(`Calendar grid size: ${days.length} cells`);
    return days;
  };

  const canGoToPreviousMonth = () => {
    if (!billing?.start) return false;
    const billingStart = new Date(billing.start);
    const prevMonth = new Date(
      presenceMonth.getFullYear(),
      presenceMonth.getMonth() - 1,
      1,
    );
    return (
      prevMonth >=
      new Date(billingStart.getFullYear(), billingStart.getMonth(), 1)
    );
  };

  const canGoToNextMonth = () => {
    if (!billing?.end) return false;
    const billingEnd = new Date(billing.end);
    const nextMonth = new Date(
      presenceMonth.getFullYear(),
      presenceMonth.getMonth() + 1,
      1,
    );
    return (
      nextMonth <= new Date(billingEnd.getFullYear(), billingEnd.getMonth(), 1)
    );
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

      const totalWaterValue = calculateTotalWaterBill() || 0;
      const totalWater = (
        typeof totalWaterValue === "number" ? totalWaterValue : 0
      ).toFixed(2);
      const grandTotal = (
        (billing.rent || 0) +
        (billing.electricity || 0) +
        parseFloat(totalWater) +
        (billing.internet || 0)
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
              <div class="section-title">Members Breakdown & Payment Status</div>
              <div class="member-list">
                ${selectedRoom.members
                  .map((member) => {
                    const memberPayment = selectedRoom.memberPayments?.find(
                      (mp) =>
                        (mp.member?.id || mp.member?._id) ===
                          (member.user?.id || member.user?._id) ||
                        mp.member === (member.user?.id || member.user?._id),
                    );
                    const rentStatus = memberPayment?.rentStatus || "unpaid";
                    const electricityStatus =
                      memberPayment?.electricityStatus || "unpaid";
                    const waterStatus = memberPayment?.waterStatus || "unpaid";
                    const internetStatus =
                      memberPayment?.internetStatus || "unpaid";

                    return `
                  <div class="member-item">
                    <div style="display: flex; flex-direction: column; width: 100%;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span class="member-name">${member.user?.name || "Unknown"}</span>
                        <span class="member-status">${member.isPayer ? "Payor" : "Non-Payor"}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666;">
                        <span>Rent: ${rentStatus === "paid" ? "✓ Paid" : "Unpaid"}</span>
                        <span>Electricity: ${electricityStatus === "paid" ? "✓ Paid" : "Unpaid"}</span>
                        <span>Water: ${waterStatus === "paid" ? "✓ Paid" : "Unpaid"}</span>
                        <span>Internet: ${internetStatus === "paid" ? "✓ Paid" : "Unpaid"}</span>
                      </div>
                    </div>
                  </div>
                `;
                  })
                  .join("")}
              </div>
            </div>

            ${
              isUserPayor && currentUserMember
                ? (() => {
                    // Use backend memberCharges when available
                    const uc =
                      activeCycle?.memberCharges?.length > 0
                        ? activeCycle.memberCharges.find(
                            (c) =>
                              String(c.userId) ===
                              String(
                                currentUserMember.id || currentUserMember._id,
                              ),
                          )
                        : null;
                    const pc =
                      selectedRoom.members.filter((m) => m.isPayer).length || 1;
                    const _rent = uc?.isPayer
                      ? uc.rentShare || 0
                      : billing.rent
                        ? r2(billing.rent / pc)
                        : 0;
                    const _elec = uc?.isPayer
                      ? uc.electricityShare || 0
                      : billing.electricity
                        ? r2(billing.electricity / pc)
                        : 0;
                    const _water = calculateMemberWaterShare(
                      currentUserMember.id || currentUserMember._id,
                    );
                    const _net = uc?.isPayer
                      ? uc.internetShare || 0
                      : billing.internet
                        ? r2(billing.internet / pc)
                        : 0;
                    const _total = uc?.isPayer
                      ? uc.totalDue || 0
                      : r2(_rent + _elec + _water + _net);
                    const wb = getWaterShareBreakdown();
                    return `
            <!-- Your Share -->
            <div class="your-share">
              <div class="your-share-title">YOUR SHARE (PAYOR)</div>
              <div class="row">
                <span class="label">Rent Share:</span>
                <span class="value">₱${_rent.toFixed(2)}</span>
              </div>
              <div class="row">
                <span class="label">Electricity:</span>
                <span class="value">₱${_elec.toFixed(2)}</span>
              </div>
              <div class="row">
                <span class="label">Water Share:</span>
                <span class="value">₱${_water.toFixed(2)}</span>
              </div>
              ${
                wb
                  ? `
              <div class="row" style="font-size: 10px; color: #666; margin-top: 3px;">
                <span class="label">Your consumption: ₱${wb.ownWater.toFixed(2)}</span>
              </div>
              ${
                wb.sharedNonPayorWater > 0
                  ? `
              <div class="row" style="font-size: 10px; color: #666; margin-top: 1px;">
                <span class="label">+ Non-payors share: ₱${wb.sharedNonPayorWater.toFixed(2)}</span>
              </div>
              `
                  : ""
              }
              `
                  : ""
              }
              <div class="row">
                <span class="label">Internet:</span>
                <span class="value">₱${_net.toFixed(2)}</span>
              </div>
              <div class="divider-line"></div>
              <div class="total-row" style="border-top: none; padding-top: 0;">
                <span class="total-label">AMOUNT DUE</span>
                <span class="total-value">₱${_total.toFixed(2)}</span>
              </div>
              <div class="row" style="font-size: 10px; color: #666; margin-top: 5px;">
                <span class="label">Split among ${pc} payor(s)</span>
              </div>
            </div>
            `;
                  })()
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
      // Calculate individual payor shares based on their presence days
      const payorCount =
        selectedRoom.members.filter((m) => m.isPayer).length || 1;
      // PRIORITY 1: Use backend memberCharges for per-member shares
      const backendCharges =
        activeCycle?.memberCharges?.length > 0
          ? activeCycle.memberCharges
          : null;

      const rentPerPayor = billing.rent ? r2(billing.rent / payorCount) : 0;
      const electricityPerPayor = billing.electricity
        ? r2(billing.electricity / payorCount)
        : 0;
      const internetPerPayor = billing.internet
        ? r2(billing.internet / payorCount)
        : 0;

      // Helper to get backend charge for a member
      const getBackendCharge = (memberId) =>
        backendCharges?.find((c) => String(c.userId) === String(memberId)) ||
        null;

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
          internet: (billing.internet || 0).toFixed(2),
          total: (
            (billing.rent || 0) +
            (billing.electricity || 0) +
            parseFloat(totalWater) +
            (billing.internet || 0)
          ).toFixed(2),
        },
        members: selectedRoom.members.map((member) => {
          const mid = member.id || member._id;
          const bc = getBackendCharge(
            member.user?.id || member.user?._id || mid,
          );
          const useBE = bc?.isPayer;
          return {
            name: member.user?.name || "Unknown",
            presenceDays: (memberPresence[mid] || []).length,
            waterBill: calculateMemberWaterBill(mid).toFixed(2),
            isPayer: member.isPayer,
            billShare: member.isPayer
              ? {
                  rent: (useBE ? bc.rentShare : rentPerPayor).toFixed(2),
                  electricity: (useBE
                    ? bc.electricityShare
                    : electricityPerPayor
                  ).toFixed(2),
                  water: (useBE
                    ? bc.waterBillShare
                    : calculateMemberWaterShare(mid)
                  ).toFixed(2),
                  internet: (useBE
                    ? bc.internetShare
                    : internetPerPayor
                  ).toFixed(2),
                  total: (useBE
                    ? bc.totalDue
                    : r2(
                        rentPerPayor +
                          electricityPerPayor +
                          calculateMemberWaterShare(mid) +
                          internetPerPayor,
                      )
                  ).toFixed(2),
                }
              : null,
          };
        }),
        userShare:
          isUserPayor && currentUserMember
            ? (() => {
                const uid = currentUserMember.id || currentUserMember._id;
                const bc = getBackendCharge(userId || uid);
                const useBE = bc?.isPayer;
                return {
                  rent: (useBE ? bc.rentShare : rentPerPayor).toFixed(2),
                  electricity: (useBE
                    ? bc.electricityShare
                    : electricityPerPayor
                  ).toFixed(2),
                  water: (useBE
                    ? bc.waterBillShare
                    : calculateMemberWaterShare(uid)
                  ).toFixed(2),
                  internet: (useBE
                    ? bc.internetShare
                    : internetPerPayor
                  ).toFixed(2),
                  waterBreakdown: getWaterShareBreakdown()
                    ? {
                        ownWater: getWaterShareBreakdown().ownWater.toFixed(2),
                        nonPayorShare:
                          getWaterShareBreakdown().sharedNonPayorWater.toFixed(
                            2,
                          ),
                      }
                    : null,
                  total: (useBE
                    ? bc.totalDue
                    : r2(
                        rentPerPayor +
                          electricityPerPayor +
                          calculateMemberWaterShare(uid) +
                          internetPerPayor,
                      )
                  ).toFixed(2),
                  payorCount: payorCount,
                };
              })()
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
    (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
  );

  const billShare = calculateBillShare();
  const billing = selectedRoom?.billing || {};
  const isUserPayor = currentUserMember?.isPayer || false;

  // Merge meter readings from both billing (room data) and activeCycle (direct fetch)
  const previousReading =
    billing.previousReading ??
    activeCycle?.previousMeterReading ??
    activeCycle?.previous_meter_reading ??
    null;
  const currentReading =
    billing.currentReading ??
    activeCycle?.currentMeterReading ??
    activeCycle?.current_meter_reading ??
    null;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Helper for formatted currency
  const fmt = (v) =>
    `₱${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#b38604"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ─── HEADER ─── */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBg}>
                <MaterialIcons
                  name="receipt-long"
                  size={20}
                  color={colors.textOnAccent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Bills & Payments</Text>
                <Text style={styles.headerSubtitle}>
                  {selectedRoom ? selectedRoom.name : "Select a room to view"}
                </Text>
              </View>
            </View>
          </View>
          {selectedRoom && billing?.start && billing?.end && (
            <TouchableOpacity
              style={styles.exportButton}
              onPress={exportBillingData}
            >
              <MaterialIcons name="share" size={18} color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>

        {/* ─── ROOM SELECTOR ─── */}
        {rooms.length > 0 && (
          <View style={styles.roomSelectorContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
            >
              {rooms.map((room) => {
                const isActive =
                  (selectedRoom?.id || selectedRoom?._id) ===
                  (room.id || room._id);
                return (
                  <TouchableOpacity
                    key={room.id || room._id}
                    style={[styles.roomPill, isActive && styles.roomPillActive]}
                    onPress={() => {
                      setSelectedRoom(room);
                      loadMemberPresence(room.id || room._id);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.roomPillDot,
                        isActive && styles.roomPillDotActive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.roomPillText,
                        isActive && styles.roomPillTextActive,
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

        {/* No room selected prompt */}
        {!selectedRoom && rooms.length > 0 && (
          <View style={styles.contentPadding}>
            <View style={styles.promptCard}>
              <View style={styles.promptIconCircle}>
                <MaterialIcons
                  name="touch-app"
                  size={28}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.promptTitle}>Select a Room</Text>
              <Text style={styles.promptSubtext}>
                Choose a room above to view your billing details
              </Text>
            </View>
          </View>
        )}

        {selectedRoom && (
          <>
            {billing?.start && billing?.end && !hasUserPaidAllBills() ? (
              <View style={styles.contentPadding}>
                {/* ─── BILLING PERIOD CARD ─── */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardIconBg}>
                      <Ionicons
                        name="calendar"
                        size={16}
                        color={colors.textOnAccent}
                      />
                    </View>
                    <Text style={styles.cardTitle}>Billing Period</Text>
                  </View>
                  <View style={styles.periodRow}>
                    <View style={styles.periodBlock}>
                      <Text style={styles.periodBlockLabel}>Start</Text>
                      <Text style={styles.periodBlockDate}>
                        {new Date(billing.start).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                      <Text style={styles.periodBlockYear}>
                        {new Date(billing.start).getFullYear()}
                      </Text>
                    </View>
                    <View style={styles.periodArrow}>
                      <MaterialIcons
                        name="arrow-forward"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </View>
                    <View style={styles.periodBlock}>
                      <Text style={styles.periodBlockLabel}>End</Text>
                      <Text style={styles.periodBlockDate}>
                        {new Date(billing.end).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                      <Text style={styles.periodBlockYear}>
                        {new Date(billing.end).getFullYear()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ─── TOTAL BILLS OVERVIEW ─── */}
                {billing.start &&
                  billing.end &&
                  (billing.rent || billing.electricity) && (
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View
                          style={[
                            styles.cardIconBg,
                            { backgroundColor: "#27ae60" },
                          ]}
                        >
                          <MaterialIcons
                            name="assessment"
                            size={16}
                            color={colors.textOnAccent}
                          />
                        </View>
                        <Text style={styles.cardTitle}>Total Bills</Text>
                      </View>

                      <View style={styles.billGrid}>
                        <View style={styles.billGridItem}>
                          <View
                            style={[
                              styles.billIconCircle,
                              { backgroundColor: colors.warningBg },
                            ]}
                          >
                            <MaterialIcons
                              name="house"
                              size={18}
                              color="#e65100"
                            />
                          </View>
                          <Text style={styles.billGridLabel}>Rent</Text>
                          <Text style={styles.billGridAmount}>
                            {fmt(billing.rent)}
                          </Text>
                        </View>
                        <View style={styles.billGridItem}>
                          <View
                            style={[
                              styles.billIconCircle,
                              { backgroundColor: colors.warningBg },
                            ]}
                          >
                            <MaterialIcons
                              name="flash-on"
                              size={18}
                              color={colors.electricityColor}
                            />
                          </View>
                          <Text style={styles.billGridLabel}>Electricity</Text>
                          <Text style={styles.billGridAmount}>
                            {fmt(billing.electricity)}
                          </Text>
                        </View>
                        <View style={styles.billGridItem}>
                          <View
                            style={[
                              styles.billIconCircle,
                              { backgroundColor: colors.infoBg },
                            ]}
                          >
                            <Ionicons
                              name="water"
                              size={18}
                              color={colors.info}
                            />
                          </View>
                          <Text style={styles.billGridLabel}>Water</Text>
                          <Text style={styles.billGridAmount}>
                            {fmt(calculateTotalWaterBill())}
                          </Text>
                        </View>
                        <View style={styles.billGridItem}>
                          <View
                            style={[
                              styles.billIconCircle,
                              { backgroundColor: colors.purpleBg },
                            ]}
                          >
                            <MaterialIcons
                              name="wifi"
                              size={18}
                              color={colors.internetColor}
                            />
                          </View>
                          <Text style={styles.billGridLabel}>Internet</Text>
                          <Text style={styles.billGridAmount}>
                            {fmt(billing.internet)}
                          </Text>
                        </View>
                      </View>

                      {/* Grand Total */}
                      <View style={styles.grandTotalStrip}>
                        <Text style={styles.grandTotalLabel}>Total</Text>
                        <Text style={styles.grandTotalAmount}>
                          {fmt(
                            (billing.rent || 0) +
                              (billing.electricity || 0) +
                              calculateTotalWaterBill() +
                              (billing.internet || 0),
                          )}
                        </Text>
                      </View>
                    </View>
                  )}

                {/* ─── METER READINGS ─── */}
                {(previousReading != null || currentReading != null) && (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View
                        style={[
                          styles.cardIconBg,
                          { backgroundColor: "#ff9800" },
                        ]}
                      >
                        <MaterialIcons
                          name="speed"
                          size={16}
                          color={colors.textOnAccent}
                        />
                      </View>
                      <Text style={styles.cardTitle}>Meter Readings</Text>
                    </View>
                    <View style={styles.meterRow}>
                      <View style={styles.meterBlock}>
                        <Text style={styles.meterLabel}>Previous</Text>
                        <Text style={styles.meterValue}>
                          {previousReading != null ? previousReading : "—"}
                        </Text>
                        <Text style={styles.meterUnit}>kWh</Text>
                      </View>
                      <View style={styles.meterDivider} />
                      <View style={styles.meterBlock}>
                        <Text style={styles.meterLabel}>Current</Text>
                        <Text style={styles.meterValue}>
                          {currentReading != null ? currentReading : "—"}
                        </Text>
                        <Text style={styles.meterUnit}>kWh</Text>
                      </View>
                      <View style={styles.meterDivider} />
                      <View style={styles.meterBlock}>
                        <Text style={styles.meterLabel}>Usage</Text>
                        <Text style={[styles.meterValue, { color: "#e65100" }]}>
                          {currentReading != null && previousReading != null
                            ? currentReading - previousReading
                            : "—"}
                        </Text>
                        <Text style={styles.meterUnit}>kWh</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* ─── MEMBERS & WATER BILL ─── */}
                {selectedRoom.members && selectedRoom.members.length > 0 && (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View
                        style={[
                          styles.cardIconBg,
                          { backgroundColor: "#2196F3" },
                        ]}
                      >
                        <MaterialIcons
                          name="group"
                          size={16}
                          color={colors.textOnAccent}
                        />
                      </View>
                      <Text style={styles.cardTitle}>Members & Water</Text>
                      <View style={styles.memberCountBadge}>
                        <Text style={styles.memberCountText}>
                          {selectedRoom.members.length}
                        </Text>
                      </View>
                    </View>
                    {selectedRoom.members.map((member, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.memberRow,
                          idx < selectedRoom.members.length - 1 &&
                            styles.memberRowBorder,
                        ]}
                        onPress={() => {
                          setSelectedMemberPresence({
                            name: member.user?.name || "Unknown",
                            dates:
                              memberPresence[member.id || member._id] || [],
                          });
                          setShowPresenceModal(true);
                        }}
                        activeOpacity={0.6}
                      >
                        {member.user?.avatar?.url ? (
                          <Image
                            source={{ uri: member.user.avatar.url }}
                            style={styles.memberAvatar}
                          />
                        ) : (
                          <View style={styles.memberAvatarPlaceholder}>
                            <Text style={styles.memberAvatarText}>
                              {(member.user?.name || "M")
                                .charAt(0)
                                .toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {member.user?.name || "Unknown"}
                          </Text>
                          <View style={styles.memberMeta}>
                            <Ionicons
                              name="calendar-outline"
                              size={11}
                              color={colors.textTertiary}
                            />
                            <Text style={styles.memberPresenceText}>
                              {
                                (memberPresence[member.id || member._id] || [])
                                  .length
                              }{" "}
                              days
                            </Text>
                          </View>
                        </View>
                        <View style={styles.memberWaterCol}>
                          <Text style={styles.memberWaterAmount}>
                            {fmt(
                              calculateMemberWaterBill(member.id || member._id),
                            )}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.roleBadge,
                            member.isPayer
                              ? styles.roleBadgePayor
                              : styles.roleBadgeNon,
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleBadgeText,
                              member.isPayer
                                ? styles.roleBadgeTextPayor
                                : styles.roleBadgeTextNon,
                            ]}
                          >
                            {member.isPayer ? "Payor" : "Non-Payor"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* ─── YOUR SHARE ─── */}
                {billShare && isUserPayor && (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View
                        style={[
                          styles.cardIconBg,
                          { backgroundColor: colors.accent },
                        ]}
                      >
                        <MaterialIcons
                          name="person"
                          size={16}
                          color={colors.textOnAccent}
                        />
                      </View>
                      <Text style={styles.cardTitle}>Your Share</Text>
                    </View>

                    <View style={styles.shareList}>
                      {[
                        {
                          label: "Rent",
                          value: billShare.rent,
                          icon: "house",
                          color: "#e65100",
                        },
                        {
                          label: "Electricity",
                          value: billShare.electricity,
                          icon: "flash-on",
                          color: colors.electricityColor,
                        },
                        {
                          label: "Internet",
                          value: billShare.internet,
                          icon: "wifi",
                          color: colors.internetColor,
                        },
                      ].map((item, i) => (
                        <View key={i} style={styles.shareItem}>
                          <View style={styles.shareItemLeft}>
                            <MaterialIcons
                              name={item.icon}
                              size={18}
                              color={item.color}
                            />
                            <Text style={styles.shareItemLabel}>
                              {item.label}
                            </Text>
                          </View>
                          <View style={styles.shareItemRight}>
                            <Text style={styles.shareItemValue}>
                              {fmt(item.value)}
                            </Text>
                            <Text
                              style={styles.shareItemNote}
                            >{`÷ ${billShare.payorCount}`}</Text>
                          </View>
                        </View>
                      ))}

                      {/* Water share with breakdown */}
                      <View style={styles.shareItem}>
                        <View style={styles.shareItemLeft}>
                          <Ionicons
                            name="water"
                            size={18}
                            color={colors.info}
                          />
                          <View>
                            <Text style={styles.shareItemLabel}>Water</Text>
                            {getWaterShareBreakdown() && (
                              <Text style={styles.waterBreakdownNote}>
                                Own: {fmt(getWaterShareBreakdown().ownWater)}
                                {getWaterShareBreakdown().sharedNonPayorWater >
                                0
                                  ? ` + Shared: ${fmt(getWaterShareBreakdown().sharedNonPayorWater)}`
                                  : ""}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.shareItemRight}>
                          <Text style={styles.shareItemValue}>
                            {fmt(billShare.water)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Total Due */}
                    <View style={styles.totalDueStrip}>
                      <Text style={styles.totalDueLabel}>Total Due</Text>
                      <Text style={styles.totalDueAmount}>
                        {fmt(billShare.total)}
                      </Text>
                    </View>

                    {/* Pay Now / Locked */}
                    {isPaymentAllowed() ? (
                      <TouchableOpacity
                        style={styles.payNowButton}
                        onPress={() => {
                          if (selectedRoom && billShare) {
                            navigation.navigate("PaymentMethod", {
                              roomId: selectedRoom.id || selectedRoom._id,
                              roomName: selectedRoom.name,
                              amount: billShare.total,
                              billType: "total",
                            });
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons
                          name="payment"
                          size={20}
                          color={colors.textOnAccent}
                        />
                        <Text style={styles.payNowButtonText}>Pay Now</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.paymentLockedBox}>
                        <MaterialIcons
                          name="lock-clock"
                          size={20}
                          color={colors.electricityColor}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.paymentLockedText}>
                            Payment opens on {getFormattedEndDate()}
                          </Text>
                          <Text style={styles.paymentLockedSubtext}>
                            Return on the billing end date to pay
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Non-Payor Notice */}
                {!isUserPayor && (
                  <View style={styles.nonPayorCard}>
                    <MaterialIcons
                      name="info-outline"
                      size={22}
                      color="#0277bd"
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.nonPayorText}>
                        You are not a payor for this room
                      </Text>
                      <Text style={styles.nonPayorSubtext}>
                        Only payors can view billing shares
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : hasUserPaidAllBills() ? (
              <View style={styles.contentPadding}>
                <View style={styles.statusCard}>
                  <View
                    style={[
                      styles.statusIconCircle,
                      { backgroundColor: colors.successBg },
                    ]}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={40}
                      color={colors.success}
                    />
                  </View>
                  <Text style={styles.statusTitle}>All Bills Paid</Text>
                  <Text style={styles.statusSubtext}>
                    You have paid all bills for this billing period
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.contentPadding}>
                <View style={styles.statusCard}>
                  <View
                    style={[
                      styles.statusIconCircle,
                      { backgroundColor: colors.warningBg },
                    ]}
                  >
                    <MaterialIcons
                      name="hourglass-empty"
                      size={40}
                      color="#f9a825"
                    />
                  </View>
                  <Text style={styles.statusTitle}>
                    No Active Billing Cycle
                  </Text>
                  <Text style={styles.statusSubtext}>
                    Waiting for admin to set billing details
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {rooms.length === 0 && (
          <View style={styles.contentPadding}>
            <View style={styles.statusCard}>
              <View
                style={[
                  styles.statusIconCircle,
                  { backgroundColor: colors.inputBg },
                ]}
              >
                <MaterialIcons
                  name="meeting-room"
                  size={40}
                  color={colors.textTertiary}
                />
              </View>
              <Text style={styles.statusTitle}>No Rooms Joined</Text>
              <Text style={styles.statusSubtext}>
                Join a room from Home to view billing
              </Text>
            </View>
          </View>
        )}

        {/* ─── ACTION BUTTONS ─── */}
        {selectedRoom && (
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() =>
                navigation.navigate("BillingHistory", {
                  roomId: selectedRoom.id || selectedRoom._id,
                  roomName: selectedRoom.name,
                })
              }
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIconBg,
                  { backgroundColor: colors.purpleBg },
                ]}
              >
                <MaterialIcons name="history" size={20} color="#5e35b1" />
              </View>
              <Text style={styles.actionCardText}>Billing History</Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() =>
                navigation.navigate("PaymentHistory", {
                  roomId: selectedRoom.id || selectedRoom._id,
                  roomName: selectedRoom.name,
                })
              }
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIconBg,
                  { backgroundColor: colors.warningBg },
                ]}
              >
                <MaterialIcons name="payment" size={20} color="#e65100" />
              </View>
              <Text style={styles.actionCardText}>Payment History</Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() =>
                navigation.navigate("Settlement", {
                  roomId: selectedRoom.id || selectedRoom._id,
                  roomName: selectedRoom.name,
                })
              }
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIconBg,
                  { backgroundColor: colors.successBg },
                ]}
              >
                <FontAwesome
                  name="handshake-o"
                  size={18}
                  color={colors.success}
                />
              </View>
              <Text style={styles.actionCardText}>Settlements</Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ─── RECEIPT MODAL ─── */}
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
              <Text style={styles.receiptSubtitleText}>
                Apartment Bill Tracker
              </Text>
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
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Internet</Text>
                <Text style={styles.receiptAmount}>
                  ₱{receiptData.bills.internet}
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
                        {
                          color: member.isPayer
                            ? colors.success
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {member.isPayer ? "Payer" : "Non-Payer"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Bill Per Member */}
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
                            <Text style={styles.receiptBillPerMemberDetail}>
                              Internet: ₱{member.billShare.internet}
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
                  <Text style={styles.receiptLabel}>Internet Share:</Text>
                  <Text style={styles.receiptAmount}>
                    ₱{receiptData.userShare.internet}
                  </Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Water Share:</Text>
                  <Text style={styles.receiptAmount}>
                    ₱{receiptData.userShare.water}
                  </Text>
                </View>
                {receiptData.userShare.waterBreakdown && (
                  <View style={[styles.receiptRow, { marginTop: 0 }]}>
                    <Text
                      style={[
                        styles.receiptLabel,
                        {
                          fontSize: 11,
                          color: colors.textSecondary,
                          fontStyle: "italic",
                        },
                      ]}
                    >
                      <Ionicons
                        name="information-circle-outline"
                        size={14}
                        color={colors.textSecondary}
                      />{" "}
                      Your consumption: ₱
                      {receiptData.userShare.waterBreakdown.ownWater}
                      {parseFloat(
                        receiptData.userShare.waterBreakdown.nonPayorShare,
                      ) > 0 && (
                        <Text>
                          {" "}
                          + Non-payors share: ₱
                          {receiptData.userShare.waterBreakdown.nonPayorShare}
                        </Text>
                      )}
                    </Text>
                  </View>
                )}
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

      {/* ─── PRESENCE MODAL ─── */}
      <Modal
        visible={showPresenceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPresenceModal(false)}
      >
        <View style={styles.presenceModalOverlay}>
          <View style={styles.presenceModalContainer}>
            <View style={styles.presenceModalHeader}>
              <Text style={styles.presenceModalTitle}>
                {selectedMemberPresence?.name}
              </Text>
              <TouchableOpacity
                style={styles.presenceModalCloseBtn}
                onPress={() => setShowPresenceModal(false)}
              >
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.presenceModalContent}>
              <View style={styles.presenceCalendarHeader}>
                <TouchableOpacity
                  disabled={!canGoToPreviousMonth()}
                  onPress={() =>
                    setPresenceMonth(
                      new Date(
                        presenceMonth.getFullYear(),
                        presenceMonth.getMonth() - 1,
                      ),
                    )
                  }
                >
                  <Ionicons
                    name="chevron-back"
                    size={28}
                    color={
                      canGoToPreviousMonth()
                        ? colors.accent
                        : colors.textTertiary
                    }
                  />
                </TouchableOpacity>
                <Text style={styles.presenceMonthYear}>
                  {presenceMonth.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
                <TouchableOpacity
                  disabled={!canGoToNextMonth()}
                  onPress={() =>
                    setPresenceMonth(
                      new Date(
                        presenceMonth.getFullYear(),
                        presenceMonth.getMonth() + 1,
                      ),
                    )
                  }
                >
                  <Ionicons
                    name="chevron-forward"
                    size={28}
                    color={
                      canGoToNextMonth() ? colors.accent : colors.textTertiary
                    }
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.presenceWeekDaysContainer}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <View key={day} style={styles.presenceWeekDayHeader}>
                      <Text style={styles.presenceWeekDayText}>{day}</Text>
                    </View>
                  ),
                )}
              </View>
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
                      <Text
                        style={[
                          styles.presenceDayText,
                          isDateMarked(date) && styles.presenceMarkedDayText,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
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

const createStyles = (colors) =>
  StyleSheet.create({
    // ─── LAYOUT ───
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
    contentPadding: {
      paddingHorizontal: 16,
    },

    // ─── HEADER ───
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerContent: {
      flex: 1,
    },
    headerTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
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
    headerSubtitle: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    exportButton: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    // ─── ROOM PILLS ───
    roomSelectorContainer: {
      paddingVertical: 14,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    roomPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.cardAlt,
      gap: 8,
    },
    roomPillActive: {
      backgroundColor: colors.accent,
    },
    roomPillDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textTertiary,
    },
    roomPillDotActive: {
      backgroundColor: colors.textOnAccent,
    },
    roomPillText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    roomPillTextActive: {
      color: colors.textOnAccent,
    },

    // ─── PROMPT ───
    promptCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 30,
      marginTop: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    promptIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 14,
    },
    promptTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    promptSubtext: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 6,
      textAlign: "center",
    },

    // ─── CARD (shared) ───
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      marginTop: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 12,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    cardIconBg: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },

    // ─── BILLING PERIOD ───
    periodRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    periodBlock: {
      flex: 1,
      alignItems: "center",
    },
    periodBlockLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    periodBlockDate: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      marginTop: 4,
    },
    periodBlockYear: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    periodArrow: {
      paddingHorizontal: 12,
    },

    // ─── BILL GRID ───
    billGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 10,
    },
    billGridItem: {
      width: (SCREEN_WIDTH - 76) / 2,
      backgroundColor: colors.cardAlt,
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 12,
      alignItems: "center",
    },
    billIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    billGridLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
      marginBottom: 4,
    },
    billGridAmount: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    grandTotalStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.successBg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    grandTotalLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.success,
    },
    grandTotalAmount: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.success,
    },

    // ─── METER READINGS ───
    meterRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    meterBlock: {
      flex: 1,
      alignItems: "center",
    },
    meterLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
      marginBottom: 4,
    },
    meterValue: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
    },
    meterUnit: {
      fontSize: 10,
      color: colors.textTertiary,
      marginTop: 2,
    },
    meterDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.badgeBg,
    },

    // ─── MEMBERS ───
    memberCountBadge: {
      backgroundColor: colors.infoBg,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    memberCountText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.waterColor,
    },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    memberRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    memberAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      marginRight: 10,
      backgroundColor: colors.skeleton,
    },
    memberAvatarPlaceholder: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    memberAvatarText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    memberMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 3,
    },
    memberPresenceText: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    memberWaterCol: {
      marginRight: 10,
      alignItems: "flex-end",
    },
    memberWaterAmount: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.waterColor,
    },
    roleBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    roleBadgePayor: {
      backgroundColor: colors.successBg,
    },
    roleBadgeNon: {
      backgroundColor: colors.background,
    },
    roleBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    roleBadgeTextPayor: {
      color: colors.success,
    },
    roleBadgeTextNon: {
      color: colors.textTertiary,
    },

    // ─── YOUR SHARE ───
    shareList: {
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    shareItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    shareItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    shareItemLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    shareItemRight: {
      alignItems: "flex-end",
    },
    shareItemValue: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    shareItemNote: {
      fontSize: 10,
      color: colors.textTertiary,
      marginTop: 2,
    },
    waterBreakdownNote: {
      fontSize: 10,
      color: colors.textTertiary,
      marginTop: 2,
      fontStyle: "italic",
    },
    totalDueStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.accentSurface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalDueLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.accent,
    },
    totalDueAmount: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.accent,
    },
    payNowButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 0,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    payNowButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#fff",
    },
    paymentLockedBox: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.accentSurface,
      gap: 12,
    },
    paymentLockedText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#ef6c00",
    },
    paymentLockedSubtext: {
      fontSize: 11,
      color: "#f57c00",
      marginTop: 2,
    },

    // ─── NON-PAYOR ───
    nonPayorCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.infoBg,
      borderRadius: 12,
      padding: 16,
      marginTop: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nonPayorText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#01579b",
    },
    nonPayorSubtext: {
      fontSize: 12,
      color: "#0277bd",
      marginTop: 2,
    },

    // ─── STATUS CARDS ───
    statusCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 30,
      marginTop: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    statusTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    statusSubtext: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 6,
      textAlign: "center",
      lineHeight: 18,
    },

    // ─── ACTION SECTION ───
    actionsSection: {
      paddingHorizontal: 16,
      marginTop: 20,
      gap: 8,
    },
    actionCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionIconBg: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    actionCardText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
    },

    // ─── RECEIPT MODAL ───
    modalHeader: {
      backgroundColor: colors.accent,
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
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    receiptHeader: {
      backgroundColor: colors.card,
      paddingVertical: 20,
      alignItems: "center",
      marginBottom: 15,
      borderBottomWidth: 2,
      borderBottomColor: "#b38604",
    },
    receiptTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    receiptRoomName: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginTop: 5,
    },
    receiptSubtitleText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 3,
    },
    receiptSection: {
      backgroundColor: colors.card,
      paddingHorizontal: 15,
      paddingVertical: 12,
      marginBottom: 10,
      borderRadius: 6,
    },
    receiptSectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 10,
      textTransform: "uppercase",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 8,
    },
    receiptRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    receiptLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    receiptValue: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    receiptAmount: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.success,
    },
    receiptTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 10,
      marginTop: 8,
      borderTopWidth: 2,
      borderTopColor: colors.text,
    },
    receiptTotalLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    receiptTotalAmount: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.success,
    },
    receiptMemberItem: {
      flexDirection: "row",
      backgroundColor: colors.cardAlt,
      paddingVertical: 10,
      paddingHorizontal: 10,
      marginBottom: 8,
      borderRadius: 4,
      borderLeftWidth: 3,
      borderLeftColor: "#b38604",
    },
    receiptMemberName: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.text,
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
      backgroundColor: colors.infoBg,
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
      color: colors.text,
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
      color: colors.textSecondary,
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
      backgroundColor: colors.warningBg,
      borderWidth: 2,
      borderColor: "#fbc02d",
      paddingHorizontal: 15,
      paddingVertical: 12,
      marginBottom: 10,
      borderRadius: 6,
    },
    receiptPayorNote: {
      fontSize: 11,
      color: colors.electricityColor,
      marginTop: 8,
      fontWeight: "500",
    },
    receiptFooter: {
      backgroundColor: colors.card,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 15,
      marginBottom: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    receiptFooterText: {
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: "center",
      marginVertical: 3,
    },

    // ─── PRESENCE MODAL ───
    presenceModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    presenceModalContainer: {
      backgroundColor: colors.card,
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
      backgroundColor: colors.cardAlt,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    presenceModalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    presenceModalCloseBtn: {
      padding: 4,
    },
    presenceModalContent: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
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
      color: colors.text,
    },
    presenceWeekDaysContainer: {
      flexDirection: "row",
      marginBottom: 8,
      paddingHorizontal: 0,
    },
    presenceWeekDayHeader: {
      width: "14.285%",
      alignItems: "center",
      paddingVertical: 8,
    },
    presenceWeekDayText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    presenceCalendarDaysContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 0,
      marginBottom: 16,
      justifyContent: "space-between",
    },
    presenceDayCell: {
      width: "14.285%",
      aspectRatio: 1,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 2,
      marginHorizontal: 0,
      borderRadius: 8,
      backgroundColor: colors.background,
      position: "relative",
    },
    presenceEmptyCell: {
      backgroundColor: "transparent",
    },
    presenceMarkedCell: {
      backgroundColor: colors.success,
    },
    presenceDayText: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
    },
    presenceMarkedDayText: {
      color: "#fff",
      fontWeight: "600",
    },
    presenceSummary: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.cardAlt,
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
      backgroundColor: colors.success,
      marginRight: 10,
    },
    presenceSummaryText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
  });

export default BillsScreen;
