import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import {
  roomService,
  billingCycleService,
  paymentService,
} from "../../services/apiService";
import { AuthContext } from "../../context/AuthContext";
import { roundTo2 as r2 } from "../../utils/helpers";
import {
  generatePaymentReceipt as generatePaymentReceiptUtil,
  downloadPaymentReceiptImage,
} from "../../utils/receiptGenerator";
import { useTheme } from "../../theme/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const WATER_BILL_PER_DAY = 5; // 5 pesos per day

/** Filter a presence array to only include days within start..end */
const filterPresenceByDates = (presenceArr, start, end) => {
  if (!presenceArr || !Array.isArray(presenceArr)) return [];
  if (!start || !end) return presenceArr; // no dates → show all
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return presenceArr.filter((day) => {
    const d = new Date(day);
    return d >= s && d <= e;
  });
};

const BillsScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();

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
  const [showPaymentReceipt, setShowPaymentReceipt] = useState(false); // For payment receipt display
  const [paymentReceiptData, setPaymentReceiptData] = useState(null); // Payment receipt data
  const [selectedMemberPresence, setSelectedMemberPresence] = useState(null); // For presence modal
  const [showPresenceModal, setShowPresenceModal] = useState(false);
  const [presenceMonth, setPresenceMonth] = useState(new Date()); // For calendar navigation
  const [userPendingPayment, setUserPendingPayment] = useState(null); // submitted/rejected payment
  const [outstandingBalance, setOutstandingBalance] = useState({
    totalOutstanding: 0,
    unpaidCycles: [],
  }); // unpaid charges from closed billing cycles
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const viewShotRef = useRef(null);
  const billingStmtRef = useRef(null);
  const paymentReceiptRef = useRef(null); // For payment receipt capture
  const [showBillingStmt, setShowBillingStmt] = useState(false);

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
    fetchRooms();
  }, [state.user?.name, state.user?.avatar?.url]);

  useEffect(() => {
    if (selectedRoom) {
      const roomId = selectedRoom.id || selectedRoom._id;
      // Clear previous room data immediately
      setActiveCycle(null);
      setUserPendingPayment(null);
      setOutstandingBalance({ totalOutstanding: 0, unpaidCycles: [] });
      extractMemberPresence(selectedRoom);
      // Fire independently — billing cycle renders first, payment status overlays when ready
      fetchActiveBillingCycle(roomId);
      fetchUserPendingPayment(roomId);
      fetchOutstandingBalance(roomId);
    }
  }, [selectedRoom]);

  // Immediately refresh outstanding balance and active billing cycle when returning from payment with refresh param
  useEffect(() => {
    if (route.params?.refresh && selectedRoom) {
      const roomId = selectedRoom.id || selectedRoom._id;
      fetchOutstandingBalance(roomId);
      fetchActiveBillingCycle(roomId); // Refresh the active billing cycle to get updated payment status
      // Clear the param so repeated navigation doesn't trigger multiple refreshes
      route.params.refresh = false;
    }
  }, [route.params?.refresh, selectedRoom]);

  // Extract presence from already-loaded room data — no extra API call needed
  const extractMemberPresence = (room) => {
    if (room?.members) {
      const presenceMap = {};
      room.members.forEach((member) => {
        presenceMap[member.id || member._id] = member.presence || [];
      });
      setMemberPresence(presenceMap);
    }
  };

  const fetchActiveBillingCycle = async (roomId) => {
    try {
      const cycleResponse = await billingCycleService.getBillingCycles(roomId);
      let cycles = Array.isArray(cycleResponse)
        ? cycleResponse
        : cycleResponse?.billingCycles || cycleResponse?.data || [];
      const active = cycles.find((c) => c.status === "active");
      if (active) {
        setActiveCycle(active);
      } else {
        // No active cycle — use the most recent completed cycle so billing
        // summary still displays correct water/total after auto-close
        const mostRecent = cycles
          .filter((c) => c.status === "completed" || c.status === "closed")
          .sort(
            (a, b) =>
              new Date(b.closedAt || b.closed_at || b.endDate || b.end_date) -
              new Date(a.closedAt || a.closed_at || a.endDate || a.end_date),
          )[0];
        setActiveCycle(mostRecent || null);
      }
    } catch (error) {
      console.error("Error fetching active billing cycle:", error);
      setActiveCycle(null);
    }
  };

  // Runs independently so it never delays the billing/button render
  const fetchUserPendingPayment = async (roomId) => {
    try {
      const response = await paymentService.getPaymentHistory(roomId);
      const payments = response?.payments || [];
      const pending = payments.find(
        (p) => p.status === "submitted" || p.status === "rejected",
      );
      setUserPendingPayment(pending || null);
    } catch (_) {
      setUserPendingPayment(null);
    }
  };

  // Fetch unpaid charges from CLOSED billing cycles for this user
  const fetchOutstandingBalance = async (roomId) => {
    try {
      const res = await billingCycleService.getOutstandingBalance(roomId);
      setOutstandingBalance({
        totalOutstanding: res?.totalOutstanding || 0,
        unpaidCycles: res?.unpaidCycles || [],
      });
    } catch (_) {
      setOutstandingBalance({ totalOutstanding: 0, unpaidCycles: [] });
    }
  };

  const fetchRooms = async (skipAutoSelect = false) => {
    try {
      setLoading(true);
      const response = await roomService.getClientRooms();
      const data = response.data || response;
      const fetchedRooms = data.rooms || data || [];

      setRooms(fetchedRooms);

      if (!skipAutoSelect) {
        if (selectedRoom && fetchedRooms.length > 0) {
          const updatedSelectedRoom = fetchedRooms.find(
            (room) =>
              (room.id || room._id) === (selectedRoom.id || selectedRoom._id),
          );
          if (updatedSelectedRoom) {
            setSelectedRoom(updatedSelectedRoom);
          }
        } else if (fetchedRooms.length > 0) {
          setSelectedRoom(fetchedRooms[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching rooms:", error.message);
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

  const getStatementTypeAndFilename = () => {
    // Determine if current user is a payor
    const currentMember = selectedRoom?.members?.find(
      (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
    );
    const isPayor = currentMember?.isPayer;

    const roomName = selectedRoom?.name || "Room";
    const startDate = new Date(selectedRoom.billing.start);
    const endDate = new Date(selectedRoom.billing.end);

    // Format: RoomName_StatementType_StartDate_EndDate
    const dateFormat = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
    const statementType = isPayor ? "Payor" : "NonPayor";
    const filename = `${roomName}_${statementType}_Statement_${dateFormat}`;

    return {
      isPayor,
      statementType,
      filename,
      currentMember,
    };
  };

  const downloadBillingImage = async () => {
    try {
      if (!selectedRoom?.billing) {
        Alert.alert("Error", "No billing information available");
        return;
      }

      setDownloadingPDF(true);

      const billShare = calculateBillShare();
      if (!billShare) {
        Alert.alert("Error", "Could not calculate bill shares");
        setDownloadingPDF(false);
        return;
      }

      const { isPayor, filename } = getStatementTypeAndFilename();

      // Show the hidden billing statement view
      setShowBillingStmt(true);

      // Wait a moment for the view to render
      setTimeout(async () => {
        try {
          // Capture the billing statement
          if (billingStmtRef.current) {
            const uri = await billingStmtRef.current.capture();

            // Request permissions
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === "granted") {
              // Save to gallery with descriptive filename
              const asset = await MediaLibrary.createAssetAsync(uri);
              await MediaLibrary.createAlbumAsync(
                "BillingStatements",
                asset,
                false,
              );

              // Different success messages for payor vs non-payor
              const successMessage = isPayor
                ? `Payor invoice saved as "${filename}"`
                : `Non-payor statement saved as "${filename}"`;

              Alert.alert("Success", successMessage);
            } else {
              Alert.alert("Permission Denied", "Cannot access photo library");
            }
          } else {
            Alert.alert("Error", "Could not capture billing statement");
          }
        } catch (error) {
          Alert.alert("Error", "Failed to save image: " + error.message);
        } finally {
          setShowBillingStmt(false);
          setDownloadingPDF(false);
        }
      }, 500);
    } catch (error) {
      setDownloadingPDF(false);
      Alert.alert("Error", "Failed to export image: " + error.message);
    }
  };

  const generatePaymentReceipt = async (paymentMethod, amountPaid) => {
    try {
      if (!selectedRoom?.billing) {
        Alert.alert("Error", "No billing information available");
        return;
      }

      // Generate unique receipt number and barcode at creation time
      const receiptNumber = `RCP${Date.now()}`.slice(0, 12);
      const barcodeNumber = Math.random()
        .toString()
        .slice(2, 14)
        .padEnd(12, "0");
      const transactionDate = new Date();

      // Payment method details
      const paymentMethodText =
        {
          cash: "CASH PAYMENT",
          bank_transfer: "BANK TRANSFER",
          gcash: "GCASH PAYMENT",
        }[paymentMethod] || "PAYMENT";

      const paymentDetails =
        {
          cash: "Payment received in cash",
          bank_transfer: "Bank transfer verified",
          gcash: "GCash transaction verified",
        }[paymentMethod] || "Payment processed";

      // Use ISO format for consistency with database storage
      const isoDateTime = transactionDate.toISOString();
      // Format time in local timezone for display
      const hours = String(transactionDate.getHours()).padStart(2, "0");
      const minutes = String(transactionDate.getMinutes()).padStart(2, "0");
      const seconds = String(transactionDate.getSeconds()).padStart(2, "0");

      const receipt = {
        receiptNumber,
        barcodeNumber,
        transactionDate: transactionDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
        transactionTime: `${hours}:${minutes}:${seconds}`,
        paymentMethod,
        paymentMethodText,
        paymentDetails,
        amountPaid,
        tenantName: state?.user?.name || "Tenant",
        roomName: selectedRoom.name || "Room",
        roomAddress: "General Maxilom, Carreta, Cebu City, Philippines, 6000",
        managerInfo: "Apartment Bill Tracker",
        amountWords: convertNumberToWords(amountPaid),
      };

      setPaymentReceiptData(receipt);
      setShowPaymentReceipt(true);

      return receipt;
    } catch (error) {
      Alert.alert("Error", "Failed to generate receipt: " + error.message);
    }
  };

  const downloadPaymentReceipt = async () => {
    try {
      setDownloadingPDF(true);

      // Wait for view to render
      setTimeout(async () => {
        try {
          if (paymentReceiptRef.current) {
            const uri = await paymentReceiptRef.current.capture();

            // Request permissions
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === "granted") {
              const asset = await MediaLibrary.createAssetAsync(uri);
              await MediaLibrary.createAlbumAsync(
                "PaymentReceipts",
                asset,
                false,
              );

              const filename = `Receipt_${paymentReceiptData?.receiptNumber}`;
              Alert.alert("Success", `Payment receipt saved as "${filename}"`);
            } else {
              Alert.alert("Permission Denied", "Cannot access photo library");
            }
          }
        } catch (error) {
          Alert.alert("Error", "Failed to save receipt: " + error.message);
        } finally {
          setShowPaymentReceipt(false);
          setDownloadingPDF(false);
        }
      }, 500);
    } catch (error) {
      setDownloadingPDF(false);
      Alert.alert("Error", "Failed to download receipt: " + error.message);
    }
  };

  const convertNumberToWords = (num) => {
    const ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
    ];
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    if (num === 0) return "Zero";

    const wholePart = Math.floor(num);
    const decimalPart = Math.round((num - wholePart) * 100);

    let words = "";

    if (wholePart >= 1000) {
      words += ones[Math.floor(wholePart / 1000)] + " Thousand ";
    }
    if (wholePart % 1000 >= 100) {
      words += ones[Math.floor((wholePart % 1000) / 100)] + " Hundred ";
    }
    if (wholePart % 100 >= 20) {
      words += tens[Math.floor((wholePart % 100) / 10)];
      if (wholePart % 10 > 0) {
        words += " " + ones[wholePart % 10];
      }
    } else if (wholePart % 100 > 0) {
      words += ones[wholePart % 100];
    }

    words = words.trim() + " Pesos";

    if (decimalPart > 0) {
      words += " and " + decimalPart + " Cents";
    }

    return words;
  };

  const calculateBillShare = () => {
    if (!selectedRoom?.billing || !userId) return null;

    // PRIORITY 1: Use activeCycle memberCharges if available AND populated
    if (activeCycle?.memberCharges?.length > 0) {
      const userCharge = activeCycle.memberCharges.find(
        (c) => String(c.userId) === String(userId),
      );
      if (userCharge) {
        return {
          rent: userCharge.rentShare || 0,
          electricity: userCharge.electricityShare || 0,
          internet: userCharge.internetShare || 0,
          water:
            userCharge.isPayer !== false
              ? userCharge.waterBillShare || 0
              : userCharge.waterOwn || 0,
          customCharges: userCharge.custom_charges_share || 0,
          total: userCharge.totalDue || 0,
          payorCount: activeCycle.memberCharges.filter((c) => c.isPayer).length,
        };
      }
    }

    // FALLBACK: Calculate from room data if no active cycle or empty memberCharges
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

    // Check water billing mode
    const isFixedWater =
      selectedRoom.waterBillingMode === "fixed_monthly" ||
      selectedRoom.water_billing_mode === "fixed_monthly";

    // Get current user's member object
    const currentUserMember = selectedRoom.members.find(
      (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
    );

    let waterShare = 0;
    if (isFixedWater) {
      // Fixed monthly: only charge when an active billing cycle exists
      if (activeCycle) {
        const fixedTotal =
          parseFloat(
            selectedRoom.waterFixedAmount ||
              selectedRoom.water_fixed_amount ||
              0,
          ) || 0;
        const isPerPerson =
          (selectedRoom.waterFixedType || selectedRoom.water_fixed_type) ===
          "per_person";
        if (isPerPerson) {
          // All members see the per-person rate for water display
          waterShare = fixedTotal;
        } else if (currentUserMember?.isPayer) {
          waterShare = r2(fixedTotal / payorCount);
        }
      }
    } else if (
      currentUserMember?.isPayer &&
      memberPresence[currentUserMember.id || currentUserMember._id]
    ) {
      // Presence-based: current user's own water consumption
      const userPresenceDays = getFilteredPresence(
        currentUserMember.id || currentUserMember._id,
      ).length;
      const userOwnWater = userPresenceDays * WATER_BILL_PER_DAY;

      // Non-payors' water to split
      let nonPayorWater = 0;
      members.forEach((m) => {
        if (!m.isPayer) {
          const presenceDays = getFilteredPresence(m.id || m._id).length;
          nonPayorWater += presenceDays * WATER_BILL_PER_DAY;
        }
      });

      const sharedNonPayorWater =
        payorCount > 0 ? r2(nonPayorWater / payorCount) : 0;
      waterShare = r2(userOwnWater + sharedNonPayorWater);
    }

    // Calculate custom charges share for payors
    let customChargesShare = 0;
    if (currentUserMember?.isPayer && activeCycle?.customCharges?.length > 0) {
      const totalCustomCharges = activeCycle.customCharges.reduce(
        (sum, c) => sum + parseFloat(c.amount || 0),
        0,
      );
      customChargesShare =
        totalCustomCharges > 0 ? r2(totalCustomCharges / payorCount) : 0;
    }

    return {
      rent: rentPerPayor,
      electricity: electricityPerPayor,
      internet: internetPerPayor,
      water: waterShare,
      customCharges: customChargesShare,
      total: r2(
        rentPerPayor +
          electricityPerPayor +
          internetPerPayor +
          waterShare +
          customChargesShare,
      ),
      payorCount,
    };
  };

  // Helper: get filtered presence days for a member (within current billing cycle dates)
  const getFilteredPresence = (memberId) => {
    const raw = memberPresence[memberId] || [];
    return filterPresenceByDates(
      raw,
      selectedRoom?.billing?.start,
      selectedRoom?.billing?.end,
    );
  };

  const calculateTotalWaterBill = () => {
    // Fixed monthly: only show if an active billing cycle exists
    if (
      selectedRoom?.waterBillingMode === "fixed_monthly" ||
      selectedRoom?.water_billing_mode === "fixed_monthly"
    ) {
      if (!activeCycle) return 0;
      const fixedAmt =
        parseFloat(
          selectedRoom?.waterFixedAmount ||
            selectedRoom?.water_fixed_amount ||
            0,
        ) || 0;
      const isPerPerson =
        (selectedRoom?.waterFixedType || selectedRoom?.water_fixed_type) ===
        "per_person";
      if (isPerPerson) {
        const allMembersCount = Math.max(
          1,
          (selectedRoom.members || []).length,
        );
        return r2(fixedAmt * allMembersCount);
      }
      return fixedAmt;
    }
    // Presence-based: total members' presence days within billing period × ₱5
    if (!selectedRoom?.members || selectedRoom.members.length === 0) return 0;
    let totalDays = 0;
    selectedRoom.members.forEach((member) => {
      totalDays += getFilteredPresence(member.id || member._id).length;
    });
    const result = totalDays * WATER_BILL_PER_DAY;
    return typeof result === "number" ? result : 0;
  };

  // Check if current user has paid all their bills
  const hasUserPaidAllBills = () => {
    if (!selectedRoom || !userId) return false;

    const userPayment = selectedRoom.memberPayments?.find(
      (mp) => String(mp.member) === String(userId),
    );
    if (!userPayment) return false;

    const hasCustomCharges =
      activeCycle?.customCharges && activeCycle.customCharges.length > 0;

    return (
      userPayment.rentStatus === "paid" &&
      userPayment.electricityStatus === "paid" &&
      userPayment.waterStatus === "paid" &&
      userPayment.internetStatus === "paid" &&
      (!hasCustomCharges || userPayment.customChargesStatus === "paid")
    );
  };

  // Calculate individual member's water consumption (for "Room Members & Water Bill" section)
  const calculateMemberWaterBill = (memberId) => {
    if (!selectedRoom?.members) return 0;

    // Fixed monthly: only show per-member amount when an active billing cycle exists
    if (
      selectedRoom.waterBillingMode === "fixed_monthly" ||
      selectedRoom.water_billing_mode === "fixed_monthly"
    ) {
      if (!activeCycle) return 0;
      const fixedTotal =
        parseFloat(
          selectedRoom.waterFixedAmount || selectedRoom.water_fixed_amount || 0,
        ) || 0;
      // per_person: each member pays the full per-person rate
      const isPerPerson =
        (selectedRoom.waterFixedType || selectedRoom.water_fixed_type) ===
        "per_person";
      if (isPerPerson) return fixedTotal;
      const memberCount = Math.max(1, selectedRoom.members.length);
      return r2(fixedTotal / memberCount);
    }

    // Presence-based: per member's own days
    const member = selectedRoom.members.find(
      (m) => (m.id || m._id) === memberId,
    );
    if (!member) return 0;

    const presence = getFilteredPresence(memberId);
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

    // Non-payors always see their per-person water allocation,
    // but pay ₱0 for water (absorbed by payors)
    if (!member.isPayer) {
      const isPerPerson =
        (selectedRoom.waterFixedType || selectedRoom.water_fixed_type) ===
        "per_person";
      const isFixed =
        selectedRoom.waterBillingMode === "fixed_monthly" ||
        selectedRoom.water_billing_mode === "fixed_monthly";
      if (isFixed && isPerPerson && activeCycle) {
        return (
          parseFloat(
            selectedRoom.waterFixedAmount ||
              selectedRoom.water_fixed_amount ||
              0,
          ) || 0
        );
      }
      return 0;
    }

    // PRIORITY 1: Use active billing cycle data if populated
    if (activeCycle?.memberCharges?.length > 0 && userId) {
      const userCharge = activeCycle.memberCharges.find(
        (c) => String(c.userId) === String(memberId),
      );
      if (userCharge && userCharge.isPayer) {
        return userCharge.waterBillShare || 0;
      }
    }

    // FALLBACK: Manual calculation from room data (filtered by billing dates)
    const payorCount =
      selectedRoom.members.filter((m) => m.isPayer).length || 1;

    // Fixed monthly fallback (only when active cycle exists)
    if (
      selectedRoom.waterBillingMode === "fixed_monthly" ||
      selectedRoom.water_billing_mode === "fixed_monthly"
    ) {
      if (!activeCycle) return 0;
      const fixedTotal =
        parseFloat(
          selectedRoom.waterFixedAmount || selectedRoom.water_fixed_amount || 0,
        ) || 0;
      // per_person: payer pays their own full rate (no division needed)
      const isPerPerson =
        (selectedRoom.waterFixedType || selectedRoom.water_fixed_type) ===
        "per_person";
      if (isPerPerson) return fixedTotal;
      return r2(fixedTotal / payorCount);
    }

    // Presence-based fallback
    let nonPayorWater = 0;

    selectedRoom.members.forEach((member) => {
      if (!member.isPayer) {
        const presenceDays = getFilteredPresence(
          member.id || member._id,
        ).length;
        nonPayorWater += presenceDays * WATER_BILL_PER_DAY;
      }
    });

    const presence = getFilteredPresence(memberId);
    const memberOwnWater = presence.length * WATER_BILL_PER_DAY;
    const sharedNonPayorWater =
      payorCount > 0 ? r2(nonPayorWater / payorCount) : 0;

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

    // FALLBACK: Calculate from local presence data (filtered by billing dates)
    const payorCount =
      selectedRoom.members.filter((m) => m.isPayer).length || 1;

    const userPresence = getFilteredPresence(
      currentUserMember.id || currentUserMember._id,
    ).length;
    const ownWater = userPresence * WATER_BILL_PER_DAY;

    let nonPayorWater = 0;
    selectedRoom.members.forEach((member) => {
      if (!member.isPayer) {
        const presenceDays = getFilteredPresence(
          member.id || member._id,
        ).length;
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
    // Payments allowed on active cycles and manually closed cycles
    // Only block if cycle is completed (auto-closed after all paid)
    if (activeCycle?.status === "completed") {
      return false;
    }

    // Allow payments on "closed" status (manually closed by host) even if past end date
    if (activeCycle?.status === "closed") {
      return true;
    }

    // For active cycles, check if we're past the billing end date
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

  // Check if there's a new active cycle (when current is closed)
  const hasNewActiveCycle = () => {
    // If current cycle is not closed, return false
    if (activeCycle?.status !== "closed") return false;

    // If there's an active cycle in the cycles list OR selectedRoom has currentCycleId,
    // then a new cycle was created
    try {
      if (selectedRoom?.currentCycleId) return true;

      // Fallback: Check if we can fetch cycles and find an active one
      // This is handled by fetchActiveBillingCycle which prioritizes active cycles
      return false;
    } catch (_) {
      return false;
    }
  };

  const getCustomChargeIcon = (chargeName) => {
    const name = chargeName?.toLowerCase() || "";
    if (name.includes("maintenance")) return "home-repair-service";
    if (name.includes("groceries") || name.includes("grocery"))
      return "local-grocery-store";
    if (name.includes("housekeeping")) return "cleaning-services";
    if (name.includes("cleaning")) return "cleaning-services";
    if (name.includes("parking")) return "local-parking";
    if (name.includes("pet") || name.includes("pets")) return "pets";
    if (name.includes("laundry")) return "local-laundry-service";
    return "add-home"; // fallback
  };

  // Calendar helper functions for presence modal
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    const firstDay = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), 1),
    ).getUTCDay();
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
              })} ${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}</p>
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
      const customChargesPerPayor = customChargesTotal
        ? r2(customChargesTotal / payorCount)
        : 0;

      // Helper to get backend charge for a member
      const getBackendCharge = (memberId) =>
        backendCharges?.find((c) => String(c.userId) === String(memberId)) ||
        null;

      // Parse custom charges
      let customCharges = [];
      let customChargesTotal = 0;
      if (activeCycle?.customCharges) {
        try {
          customCharges = Array.isArray(activeCycle.customCharges)
            ? activeCycle.customCharges
            : typeof activeCycle.customCharges === "string"
              ? JSON.parse(activeCycle.customCharges)
              : [];
          customChargesTotal = customCharges.reduce(
            (sum, c) => sum + parseFloat(c.amount || 0),
            0,
          );
        } catch (_) {
          customCharges = [];
          customChargesTotal = 0;
        }
      }

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
          customCharges: customCharges.map((c) => ({
            name: c.name || "Charge",
            amount: parseFloat(c.amount || 0).toFixed(2),
          })),
          total: (
            (billing.rent || 0) +
            (billing.electricity || 0) +
            parseFloat(totalWater) +
            (billing.internet || 0) +
            customChargesTotal
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
            presenceDays: getFilteredPresence(mid).length,
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
                  customCharges: (useBE
                    ? bc.custom_charges_share || 0
                    : customChargesPerPayor
                  ).toFixed(2),
                  total: (useBE
                    ? bc.totalDue
                    : r2(
                        rentPerPayor +
                          electricityPerPayor +
                          calculateMemberWaterShare(mid) +
                          internetPerPayor +
                          customChargesPerPayor,
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
                  customCharges: (useBE
                    ? bc.custom_charges_share || 0
                    : customChargesPerPayor
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
                          internetPerPayor +
                          customChargesPerPayor,
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
        generatedTime: `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
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
                      extractMemberPresence(room);
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
            {/* ─── OUTSTANDING BALANCE BANNER ─── */}
            {isUserPayor && outstandingBalance.totalOutstanding > 0 && (
              <View style={styles.contentPadding}>
                <View style={styles.outstandingCard}>
                  <View style={styles.outstandingCardHeader}>
                    <MaterialIcons name="warning" size={20} color="#c62828" />
                    <Text style={styles.outstandingCardTitle}>
                      Outstanding Balance
                    </Text>
                    <Text style={styles.outstandingCardTotal}>
                      {fmt(outstandingBalance.totalOutstanding)}
                    </Text>
                  </View>
                  <Text style={styles.outstandingCardSubtitle}>
                    You have unpaid bills from{" "}
                    {outstandingBalance.unpaidCycles.length} previous billing{" "}
                    {outstandingBalance.unpaidCycles.length === 1
                      ? "cycle"
                      : "cycles"}
                    . Please settle these with your host.
                  </Text>
                  {outstandingBalance.unpaidCycles.map((cycle, idx) => {
                    // A submitted or pending payment already exists for this cycle —
                    // hide the Pay button so the user can't double-submit.
                    const cycleAlreadySubmitted =
                      userPendingPayment &&
                      (userPendingPayment.status === "submitted" ||
                        userPendingPayment.status === "pending") &&
                      userPendingPayment.billing_cycle_start ===
                        cycle.startDate;

                    return (
                      <View key={idx} style={styles.outstandingCycleRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.outstandingCycleLabel}>
                            Cycle #{cycle.cycleNumber}
                          </Text>
                          <Text style={styles.outstandingCyclePeriod}>
                            {new Date(cycle.startDate).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" },
                            )}{" "}
                            –{" "}
                            {new Date(cycle.endDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 6 }}>
                          <Text style={styles.outstandingCycleAmount}>
                            {fmt(cycle.totalDue)}
                          </Text>
                          {cycleAlreadySubmitted ? (
                            /* Already submitted — show status badge instead of Pay */
                            <View
                              style={{
                                backgroundColor: "#fff8e1",
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderWidth: 1,
                                borderColor: "#f9a825",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <MaterialIcons
                                name="hourglass-top"
                                size={12}
                                color="#f9a825"
                              />
                              <Text
                                style={{
                                  color: "#e65100",
                                  fontSize: 11,
                                  fontWeight: "700",
                                }}
                              >
                                Awaiting Verification
                              </Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={{
                                backgroundColor: "#c62828",
                                borderRadius: 8,
                                paddingHorizontal: 14,
                                paddingVertical: 6,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              }}
                              onPress={() => {
                                if (selectedRoom) {
                                  navigation.navigate("PaymentMethod", {
                                    roomId: selectedRoom.id || selectedRoom._id,
                                    roomName: selectedRoom.name,
                                    amount: cycle.totalDue,
                                    billType: "total",
                                    billingCycleId: cycle.cycleId,
                                  });
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <MaterialIcons
                                name="payment"
                                size={14}
                                color="#fff"
                              />
                              <Text
                                style={{
                                  color: "#fff",
                                  fontSize: 12,
                                  fontWeight: "700",
                                }}
                              >
                                Pay
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {billing?.start && billing?.end && !hasUserPaidAllBills() ? (
              <View style={styles.contentPadding}>
                {/* ─── CYCLE CLOSED WARNING ─── */}
                {isUserPayor &&
                  selectedRoom?.cycleStatus === "cycle_closed" && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#fff3e0",
                        borderColor: "#e65100",
                        borderWidth: 1,
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 12,
                        marginTop: 12,
                        gap: 10,
                      }}
                    >
                      <MaterialIcons name="warning" size={20} color="#e65100" />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: "#e65100",
                            fontWeight: "700",
                            fontSize: 13,
                          }}
                        >
                          Billing Cycle Closed
                        </Text>
                        <Text style={{ color: "#bf360c", fontSize: 12 }}>
                          This billing cycle has been closed by your host.
                          Please settle your outstanding payment.
                        </Text>
                      </View>
                    </View>
                  )}

                {/* Non-Payor Notice */}
                {!isUserPayor &&
                  (() => {
                    const payors = (selectedRoom?.members || []).filter(
                      (m) => m.isPayer,
                    );
                    const allPayorsPaid =
                      payors.length > 0 &&
                      payors.every((p) => {
                        const pmt = selectedRoom.memberPayments?.find(
                          (mp) =>
                            String(mp.member) ===
                            String(p.user?.id || p.user?._id || p.user),
                        );
                        return (
                          pmt?.rentStatus === "paid" &&
                          pmt?.electricityStatus === "paid" &&
                          pmt?.waterStatus === "paid" &&
                          (pmt?.internetStatus === "paid" || !billing?.internet)
                        );
                      });

                    if (allPayorsPaid) {
                      return (
                        <View
                          style={[
                            styles.nonPayorCard,
                            {
                              borderColor: colors.success || "#4caf50",
                              backgroundColor: colors.successBg || "#e8f5e9",
                            },
                          ]}
                        >
                          <MaterialIcons
                            name="check-circle"
                            size={22}
                            color={colors.success || "#4caf50"}
                          />
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text
                              style={[
                                styles.nonPayorText,
                                { color: colors.success || "#2e7d32" },
                              ]}
                            >
                              Billing cycle complete!
                            </Text>
                            <Text style={styles.nonPayorSubtext}>
                              All payors in your room have settled their bills.
                              Please wait for the host to start a new billing
                              period.
                            </Text>
                          </View>
                        </View>
                      );
                    }

                    return (
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
                            The payors in your room handle the bill payments.
                            You can view the billing summary above.
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                {/* ─── BILLING PERIOD CARD ─── */}
                <ViewShot
                  ref={viewShotRef}
                  style={styles.card}
                  options={{ format: "png", quality: 0.95 }}
                >
                  <View
                    style={[
                      styles.cardHeader,
                      { justifyContent: "space-between" },
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                        gap: 8,
                      }}
                    >
                      <View style={styles.cardIconBg}>
                        <Ionicons
                          name="calendar"
                          size={16}
                          color={colors.textOnAccent}
                        />
                      </View>
                      <Text style={styles.cardTitle}>Billing Period</Text>
                    </View>
                    <TouchableOpacity
                      onPress={downloadBillingImage}
                      disabled={downloadingPDF}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: downloadingPDF
                          ? "#ccc"
                          : colors.accent,
                        borderRadius: 6,
                      }}
                    >
                      <MaterialIcons
                        name={
                          downloadingPDF ? "hourglass-top" : "file-download"
                        }
                        size={16}
                        color="white"
                      />
                      <Text
                        style={{
                          color: "white",
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {downloadingPDF ? "Generating..." : "Download"}
                      </Text>
                    </TouchableOpacity>
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
                </ViewShot>

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
                        {/* Display each custom charge individually */}
                        {(() => {
                          let customCharges = [];
                          if (activeCycle?.customCharges) {
                            try {
                              customCharges = Array.isArray(
                                activeCycle.customCharges,
                              )
                                ? activeCycle.customCharges
                                : typeof activeCycle.customCharges === "string"
                                  ? JSON.parse(activeCycle.customCharges)
                                  : [];
                            } catch (_) {
                              customCharges = [];
                            }
                          }
                          return customCharges.map((charge, idx) => (
                            <View
                              key={`custom-${idx}`}
                              style={styles.billGridItem}
                            >
                              <View
                                style={[
                                  styles.billIconCircle,
                                  {
                                    backgroundColor:
                                      colors.accentSurface || colors.purpleBg,
                                  },
                                ]}
                              >
                                <MaterialIcons
                                  name={getCustomChargeIcon(charge.name)}
                                  size={18}
                                  color={colors.accent}
                                />
                              </View>
                              <Text
                                style={styles.billGridLabel}
                                numberOfLines={1}
                              >
                                {charge.name || "Charge"}
                              </Text>
                              <Text style={styles.billGridAmount}>
                                {fmt(parseFloat(charge.amount || 0))}
                              </Text>
                            </View>
                          ));
                        })()}
                      </View>

                      {/* Grand Total */}
                      <View style={styles.grandTotalStrip}>
                        <Text style={styles.grandTotalLabel}>Total</Text>
                        <Text style={styles.grandTotalAmount}>
                          {(() => {
                            let customTotal = 0;
                            if (activeCycle?.customCharges) {
                              try {
                                const customCharges = Array.isArray(
                                  activeCycle.customCharges,
                                )
                                  ? activeCycle.customCharges
                                  : typeof activeCycle.customCharges ===
                                      "string"
                                    ? JSON.parse(activeCycle.customCharges)
                                    : [];
                                customTotal = customCharges.reduce(
                                  (sum, c) => sum + parseFloat(c.amount || 0),
                                  0,
                                );
                              } catch (_) {
                                customTotal = 0;
                              }
                            }
                            return fmt(
                              (billing.rent || 0) +
                                (billing.electricity || 0) +
                                calculateTotalWaterBill() +
                                (billing.internet || 0) +
                                customTotal,
                            );
                          })()}
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
                    {selectedRoom.members.map((member, idx) => {
                      const memberId = String(
                        member.user?.id || member.user?._id || member.user,
                      );
                      const isCurrentUser = memberId === String(userId);
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.memberRow,
                            idx < selectedRoom.members.length - 1 &&
                              styles.memberRowBorder,
                            isCurrentUser && styles.memberRowHighlight,
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
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Text style={styles.memberName} numberOfLines={1}>
                                {member.user?.name || "Unknown"}
                              </Text>
                              {isCurrentUser && (
                                <View style={styles.youBadge}>
                                  <Text style={styles.youBadgeText}>You</Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.memberMeta}>
                              <Ionicons
                                name="calendar-outline"
                                size={11}
                                color={colors.textTertiary}
                              />
                              <Text style={styles.memberPresenceText}>
                                {
                                  (
                                    memberPresence[member.id || member._id] ||
                                    []
                                  ).length
                                }{" "}
                                days
                              </Text>
                              <Ionicons
                                name="information-circle-outline"
                                size={12}
                                color={colors.accent}
                              />
                            </View>
                          </View>
                          <View style={styles.memberWaterCol}>
                            <Text style={styles.memberWaterAmount}>
                              {fmt(
                                calculateMemberWaterBill(
                                  member.id || member._id,
                                ),
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
                      );
                    })}
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

                      {/* Display each custom charge individually */}
                      {(() => {
                        let customCharges = [];
                        const payorCount = billShare?.payorCount || 1;
                        if (activeCycle?.customCharges) {
                          try {
                            customCharges = Array.isArray(
                              activeCycle.customCharges,
                            )
                              ? activeCycle.customCharges
                              : typeof activeCycle.customCharges === "string"
                                ? JSON.parse(activeCycle.customCharges)
                                : [];
                          } catch (_) {
                            customCharges = [];
                          }
                        }
                        return customCharges.map((charge, idx) => (
                          <View
                            key={`share-custom-${idx}`}
                            style={styles.shareItem}
                          >
                            <View style={styles.shareItemLeft}>
                              <MaterialIcons
                                name={getCustomChargeIcon(charge.name)}
                                size={18}
                                color={colors.accent}
                              />
                              <Text
                                style={styles.shareItemLabel}
                                numberOfLines={1}
                              >
                                {charge.name || "Charge"}
                              </Text>
                            </View>
                            <View style={styles.shareItemRight}>
                              <Text style={styles.shareItemValue}>
                                {fmt(
                                  parseFloat(charge.amount || 0) / payorCount,
                                )}
                              </Text>
                              <Text
                                style={styles.shareItemNote}
                              >{`÷ ${payorCount}`}</Text>
                            </View>
                          </View>
                        ));
                      })()}
                    </View>

                    {/* Total Due */}
                    <View style={styles.totalDueStrip}>
                      <Text style={styles.totalDueLabel}>Total Due</Text>
                      <Text style={styles.totalDueAmount}>
                        {fmt(billShare.total)}
                      </Text>
                    </View>

                    {/* Pay Now / Locked / Pending Verification */}
                    {userPendingPayment?.status === "submitted" &&
                    userPendingPayment.billing_cycle_start ===
                      activeCycle?.start_date ? (
                      /* ── Awaiting Verification ── */
                      <View
                        style={[
                          styles.paymentLockedBox,
                          {
                            backgroundColor: colors.warningBg || "#fff8e1",
                            borderColor: "#f9a825",
                            borderWidth: 1,
                            borderRadius: 12,
                            padding: 14,
                            gap: 10,
                          },
                        ]}
                      >
                        <MaterialIcons
                          name="hourglass-top"
                          size={22}
                          color="#f9a825"
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.paymentLockedText,
                              { color: "#e65100", fontWeight: "700" },
                            ]}
                          >
                            Awaiting Host Verification
                          </Text>
                          <Text
                            style={[
                              styles.paymentLockedSubtext,
                              { color: "#795548" },
                            ]}
                          >
                            Your payment has been submitted. Your host will
                            verify it shortly.
                          </Text>
                          {!!userPendingPayment.reference && (
                            <Text
                              style={[
                                styles.paymentLockedSubtext,
                                { color: "#795548", marginTop: 4 },
                              ]}
                            >
                              Ref:{" "}
                              <Text style={{ fontWeight: "700" }}>
                                {userPendingPayment.reference}
                              </Text>
                            </Text>
                          )}
                        </View>
                      </View>
                    ) : userPendingPayment?.status === "rejected" &&
                      userPendingPayment.billing_cycle_start ===
                        activeCycle?.start_date ? (
                      /* ── Payment Rejected ── */
                      <View style={{ gap: 8 }}>
                        <View
                          style={[
                            styles.paymentLockedBox,
                            {
                              backgroundColor: "#fdecea",
                              borderColor: "#c62828",
                              borderWidth: 1,
                              borderRadius: 12,
                              padding: 14,
                              gap: 10,
                            },
                          ]}
                        >
                          <MaterialIcons
                            name="cancel"
                            size={22}
                            color="#c62828"
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.paymentLockedText,
                                { color: "#c62828", fontWeight: "700" },
                              ]}
                            >
                              Payment Rejected
                            </Text>
                            <Text
                              style={[
                                styles.paymentLockedSubtext,
                                { color: "#795548" },
                              ]}
                            >
                              {userPendingPayment.rejection_reason ||
                                "Your payment was rejected by your host. Please resubmit."}
                            </Text>
                          </View>
                        </View>
                        {/* Retry button */}
                        <TouchableOpacity
                          style={[
                            styles.payNowButton,
                            { backgroundColor: "#c62828" },
                          ]}
                          onPress={() => {
                            if (selectedRoom && billShare) {
                              navigation.navigate("PaymentMethod", {
                                roomId: selectedRoom.id || selectedRoom._id,
                                roomName: selectedRoom.name,
                                amount: billShare.total,
                                billType: "total",
                                billingCycleId:
                                  activeCycle?.id || activeCycle?._id,
                              });
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons
                            name="replay"
                            size={20}
                            color={colors.textOnAccent}
                          />
                          <Text style={styles.payNowButtonText}>
                            Resubmit Payment
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : activeCycle?.status === "closed" &&
                      !hasNewActiveCycle() ? (
                      /* ── Closed Cycle, No New Cycle ── */
                      <View style={styles.paymentLockedBox}>
                        <MaterialIcons
                          name="lock"
                          size={20}
                          color={colors.electricityColor}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.paymentLockedText}>
                            Billing Cycle Closed
                          </Text>
                          <Text style={styles.paymentLockedSubtext}>
                            Pay your unpaid bills in the Outstanding Balance
                            card above
                          </Text>
                        </View>
                      </View>
                    ) : isPaymentAllowed() ? (
                      /* ── Normal Pay Now ── */
                      <TouchableOpacity
                        style={[
                          styles.payNowButton,
                          activeCycle?.status === "completed" &&
                            styles.payNowButtonDisabled,
                        ]}
                        onPress={() => {
                          if (selectedRoom && billShare) {
                            navigation.navigate("PaymentMethod", {
                              roomId: selectedRoom.id || selectedRoom._id,
                              roomName: selectedRoom.name,
                              amount: billShare.total,
                              billType: "total",
                              billingCycleId:
                                activeCycle?.id || activeCycle?._id,
                            });
                          }
                        }}
                        activeOpacity={0.8}
                        disabled={activeCycle?.status === "completed"}
                      >
                        <MaterialIcons
                          name="payment"
                          size={20}
                          color={colors.textOnAccent}
                        />
                        <Text style={styles.payNowButtonText}>Pay Now</Text>
                      </TouchableOpacity>
                    ) : (
                      /* ── Payment Not Yet Open ── */
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
              </View>
            ) : hasUserPaidAllBills() ? (
              <View style={styles.contentPadding}>
                {/* All Paid Banner */}
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
                  <Text style={styles.statusTitle}>All Bills Paid!</Text>
                  <Text style={styles.statusSubtext}>
                    You have paid all bills for this billing period. Waiting for
                    the admin to start a new billing cycle.
                  </Text>
                </View>

                {/* Show billing summary even after paid */}
                {billing?.start && billing?.end && (
                  <View style={[styles.card, { marginTop: 12 }]}>
                    <View style={styles.cardHeader}>
                      <View
                        style={[
                          styles.cardIconBg,
                          { backgroundColor: colors.success },
                        ]}
                      >
                        <MaterialIcons
                          name="receipt-long"
                          size={16}
                          color={colors.textOnAccent}
                        />
                      </View>
                      <Text style={styles.cardTitle}>Billing Summary</Text>
                      <View
                        style={{
                          backgroundColor: colors.successBg,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.success,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          PAID
                        </Text>
                      </View>
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
                      </View>
                    </View>

                    {billShare && (
                      <View style={{ marginTop: 12 }}>
                        {[
                          {
                            label: "Rent",
                            value: billShare.rent,
                            color: "#e65100",
                          },
                          {
                            label: "Electricity",
                            value: billShare.electricity,
                            color: colors.electricityColor,
                          },
                          {
                            label: "Water",
                            value: billShare.water,
                            color: colors.info,
                          },
                          {
                            label: "Internet",
                            value: billShare.internet,
                            color: colors.internetColor,
                          },
                          ...(() => {
                            let customCharges = [];
                            if (activeCycle?.customCharges) {
                              try {
                                customCharges = Array.isArray(
                                  activeCycle.customCharges,
                                )
                                  ? activeCycle.customCharges
                                  : typeof activeCycle.customCharges ===
                                      "string"
                                    ? JSON.parse(activeCycle.customCharges)
                                    : [];
                              } catch (_) {
                                customCharges = [];
                              }
                            }
                            return customCharges.map((charge) => {
                              const totalCustomCharges = customCharges.reduce(
                                (sum, c) => sum + parseFloat(c.amount || 0),
                                0,
                              );
                              return {
                                label: charge.name || "Charge",
                                value:
                                  billShare.customCharges &&
                                  totalCustomCharges > 0
                                    ? (parseFloat(charge.amount || 0) /
                                        totalCustomCharges) *
                                      billShare.customCharges
                                    : 0,
                                color: colors.accent,
                              };
                            });
                          })(),
                        ].map((item, i) => (
                          <View key={i} style={styles.shareItemPaid}>
                            <View style={styles.shareItemLeft}>
                              <View
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 4,
                                  backgroundColor: item.color,
                                  marginRight: 8,
                                }}
                              />
                              <Text style={styles.shareItemLabel}>
                                {item.label}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.shareItemValue,
                                { color: colors.success },
                              ]}
                            >
                              {fmt(item.value)}
                            </Text>
                          </View>
                        ))}
                        <View
                          style={[
                            styles.totalDueStrip,
                            { backgroundColor: colors.successBg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.totalDueLabel,
                              { color: colors.success },
                            ]}
                          >
                            Total Paid
                          </Text>
                          <Text
                            style={[
                              styles.totalDueAmount,
                              { color: colors.success },
                            ]}
                          >
                            {fmt(billShare.total)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}
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
        <View
          style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 24) }]}
        >
          <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
            <MaterialIcons name="close" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Billing Receipt</Text>
          <View style={{ width: 28 }} />
        </View>
        {receiptData && (
          <ScrollView
            style={styles.receiptContainer}
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom, 16) + 16,
            }}
          >
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
              {receiptData.bills.customCharges &&
                receiptData.bills.customCharges.length > 0 &&
                receiptData.bills.customCharges.map((charge, idx) => (
                  <View key={idx} style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>{charge.name}</Text>
                    <Text style={styles.receiptAmount}>₱{charge.amount}</Text>
                  </View>
                ))}
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
                            {parseFloat(member.billShare.customCharges) > 0 && (
                              <Text style={styles.receiptBillPerMemberDetail}>
                                Custom: ₱{member.billShare.customCharges}
                              </Text>
                            )}
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
                  <View
                    style={[
                      styles.receiptRow,
                      { marginTop: 0, alignItems: "flex-start", gap: 4 },
                    ]}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={14}
                      color={colors.textSecondary}
                      style={{ marginTop: 1 }}
                    />
                    <Text
                      style={[
                        styles.receiptLabel,
                        {
                          fontSize: 11,
                          color: colors.textSecondary,
                          fontStyle: "italic",
                          flex: 1,
                        },
                      ]}
                    >
                      Your consumption: ₱
                      {receiptData.userShare.waterBreakdown.ownWater}
                      {parseFloat(
                        receiptData.userShare.waterBreakdown.nonPayorShare,
                      ) > 0
                        ? ` + Non-payors share: ₱${receiptData.userShare.waterBreakdown.nonPayorShare}`
                        : ""}
                    </Text>
                  </View>
                )}
                {parseFloat(receiptData.userShare.customCharges) > 0 && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Custom Charges:</Text>
                    <Text style={styles.receiptAmount}>
                      ₱{receiptData.userShare.customCharges}
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

      {/* Payment Receipt Modal */}
      <Modal
        visible={showPaymentReceipt && paymentReceiptData}
        animationType="slide"
        onRequestClose={() => setShowPaymentReceipt(false)}
      >
        <View
          style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 24) }]}
        >
          <TouchableOpacity onPress={() => setShowPaymentReceipt(false)}>
            <MaterialIcons name="close" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Payment Receipt</Text>
          <TouchableOpacity
            onPress={downloadPaymentReceipt}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: downloadingPDF
                ? "#ccc"
                : "rgba(255,255,255,0.3)",
              borderRadius: 6,
            }}
            disabled={downloadingPDF}
          >
            <MaterialIcons
              name={downloadingPDF ? "hourglass-top" : "file-download"}
              size={20}
              color="white"
            />
            <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>
              {downloadingPDF ? "Saving..." : "Download"}
            </Text>
          </TouchableOpacity>
        </View>
        {paymentReceiptData && (
          <ScrollView
            style={styles.receiptContainer}
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom, 16) + 16,
              paddingHorizontal: 16,
            }}
          >
            {/* Receipt Content - Professional Cash Receipt Style */}
            <View
              style={{
                backgroundColor: "#f5f5f5",
                marginTop: 14,
                paddingHorizontal: 16,
                paddingVertical: 20,
                fontFamily: "monospace",
              }}
            >
              {/* Title */}
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 16,
                  fontWeight: "bold",
                  marginBottom: 2,
                  letterSpacing: 1,
                  color: "#333",
                }}
              >
                {paymentReceiptData.paymentMethodText}
              </Text>

              {/* Dashed Line */}
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 10,
                  color: "#999",
                  marginBottom: 12,
                  letterSpacing: 1,
                }}
              >
                {Array(40).fill("·").join("")}
              </Text>

              {/* Receipt Number */}
              <View
                style={{
                  flexDirection: "row",
                  marginBottom: 4,
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 10, color: "#333" }}>Receipt #</Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: "#333",
                    fontWeight: "bold",
                  }}
                >
                  {paymentReceiptData.receiptNumber}
                </Text>
              </View>

              {/* Manager */}
              <View
                style={{
                  flexDirection: "row",
                  marginBottom: 4,
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 10, color: "#333" }}>Manager</Text>
                <Text style={{ fontSize: 10, color: "#333" }}>
                  {paymentReceiptData.managerInfo}
                </Text>
              </View>

              {/* Date and Time */}
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{ fontSize: 10, color: "#333", textAlign: "right" }}
                >
                  {paymentReceiptData.transactionDate}{" "}
                  {paymentReceiptData.transactionTime}
                </Text>
              </View>

              {/* Dashed Line */}
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 10,
                  color: "#999",
                  marginBottom: 12,
                  letterSpacing: 1,
                }}
              >
                {Array(40).fill("·").join("")}
              </Text>

              {/* Client/Tenant Section */}
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  marginBottom: 6,
                  color: "#333",
                }}
              >
                Client
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  marginBottom: 4,
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 10, color: "#333" }}>Name</Text>
                <Text style={{ fontSize: 10, color: "#333" }}>
                  {paymentReceiptData.tenantName}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  marginBottom: 4,
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 10, color: "#333" }}>Room</Text>
                <Text style={{ fontSize: 10, color: "#333" }}>
                  {paymentReceiptData.roomName}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  marginBottom: 12,
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 10, color: "#333" }}>Location</Text>
                <Text
                  style={{
                    fontSize: 9,
                    color: "#333",
                    textAlign: "right",
                    maxWidth: "50%",
                  }}
                  numberOfLines={2}
                >
                  {paymentReceiptData.roomAddress}
                </Text>
              </View>

              {/* Dashed Line */}
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 10,
                  color: "#999",
                  marginBottom: 12,
                  letterSpacing: 1,
                }}
              >
                {Array(40).fill("·").join("")}
              </Text>

              {/* Line Items Section */}
              <View style={{ marginBottom: 12 }}>
                {paymentReceiptData.lineItems &&
                  paymentReceiptData.lineItems.map((item, idx) => (
                    <View
                      key={idx}
                      style={{
                        flexDirection: "row",
                        marginBottom: 4,
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          color: "#333",
                          flex: 1,
                          maxWidth: "70%",
                        }}
                      >
                        {item.description}
                      </Text>
                      <Text
                        style={{
                          fontSize: 9,
                          color: "#333",
                          textAlign: "right",
                          fontWeight: "600",
                        }}
                      >
                        ₱
                        {typeof item.amount === "number"
                          ? item.amount.toFixed(2)
                          : item.amount}
                      </Text>
                    </View>
                  ))}
              </View>

              {/* Dashed Line */}
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 10,
                  color: "#999",
                  marginBottom: 8,
                  letterSpacing: 1,
                }}
              >
                {Array(40).fill("·").join("")}
              </Text>

              {/* Payment Details Items */}
              <View style={{ marginBottom: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    marginBottom: 4,
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ fontSize: 10, color: "#333", flex: 1 }}>
                    Status
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: "#333",
                      textAlign: "right",
                      flex: 1,
                    }}
                  >
                    {paymentReceiptData.paymentDetails}
                  </Text>
                </View>
              </View>

              {/* Dashed Line */}
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 10,
                  color: "#999",
                  marginBottom: 8,
                  letterSpacing: 1,
                }}
              >
                {Array(40).fill("·").join("")}
              </Text>

              {/* Total Amount */}
              <View
                style={{
                  flexDirection: "row",
                  marginBottom: 4,
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "bold",
                    color: "#333",
                  }}
                >
                  TOTAL
                </Text>
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                  <Text
                    style={{
                      fontSize: 9,
                      color: "#999",
                      letterSpacing: 1,
                    }}
                  >
                    {Array(25).fill(".").join("")}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "bold",
                    color: "#333",
                  }}
                >
                  ₱{fmt(paymentReceiptData.amountPaid)}
                </Text>
              </View>

              {/* Dashed Line */}
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 10,
                  color: "#999",
                  marginBottom: 12,
                  letterSpacing: 1,
                }}
              >
                {Array(40).fill("·").join("")}
              </Text>

              {/* Amount in Words */}
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    fontSize: 9,
                    color: "#333",
                    textAlign: "center",
                    fontStyle: "italic",
                  }}
                >
                  {paymentReceiptData.amountWords}
                </Text>
              </View>

              {/* Dashed Line */}
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 10,
                  color: "#999",
                  marginBottom: 16,
                  letterSpacing: 1,
                }}
              >
                {Array(40).fill("·").join("")}
              </Text>

              {/* Card Number Section */}
              <View style={{ marginBottom: 12, alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 9,
                    color: "#333",
                    letterSpacing: 2,
                    marginBottom: 8,
                  }}
                >
                  {paymentReceiptData.cardNumber}
                </Text>
              </View>

              {/* Barcode Representation */}
              <View style={{ marginBottom: 12, alignItems: "center" }}>
                <View
                  style={{
                    height: 40,
                    justifyContent: "space-around",
                    marginBottom: 4,
                  }}
                >
                  {Array(15)
                    .fill(0)
                    .map((_, i) => (
                      <View
                        key={i}
                        style={{
                          width: Math.random() > 0.5 ? 2 : 3,
                          height: 30,
                          backgroundColor: "#333",
                          display: "inline-block",
                          marginHorizontal: 0.5,
                        }}
                      />
                    ))}
                </View>
                <Text
                  style={{
                    fontSize: 8,
                    color: "#333",
                    letterSpacing: 1,
                    textAlign: "center",
                  }}
                >
                  {paymentReceiptData.barcodeNumber}
                </Text>
              </View>

              {/* Dashed Line */}
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 10,
                  color: "#999",
                  marginBottom: 12,
                  letterSpacing: 1,
                }}
              >
                {Array(40).fill("·").join("")}
              </Text>

              {/* Thank You Message */}
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: "bold",
                  marginBottom: 12,
                  letterSpacing: 1,
                  color: "#333",
                }}
              >
                THANK YOU FOR YOUR PAYMENT!
              </Text>

              {/* Footer Message */}
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 8,
                  color: "#666",
                  marginBottom: 2,
                }}
              >
                Please keep this receipt for your records
              </Text>

              <Text
                style={{
                  textAlign: "center",
                  fontSize: 8,
                  color: "#999",
                  marginTop: 12,
                }}
              >
                www.apartmentbilltracker.com
              </Text>
            </View>
          </ScrollView>
        )}
      </Modal>

      {/* Hidden billing statement for image capture */}
      {showBillingStmt &&
        selectedRoom?.billing &&
        (() => {
          // Determine if current user is a payor
          const currentMember = selectedRoom.members?.find(
            (m) =>
              String(m.user?.id || m.user?._id || m.user) === String(userId),
          );
          const isPayor = currentMember?.isPayer;

          if (!isPayor) {
            // NON-PAYOR STATEMENT
            return (
              <ViewShot
                ref={billingStmtRef}
                style={{
                  position: "absolute",
                  left: -9999,
                  top: 0,
                  width: SCREEN_WIDTH,
                  backgroundColor: "#ffffff",
                  paddingHorizontal: 12,
                  paddingVertical: 15,
                }}
                options={{ format: "png", quality: 0.95 }}
              >
                <View>
                  {/* HEADER */}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 20,
                      paddingBottom: 12,
                      borderBottomWidth: 2,
                      borderBottomColor: colors.accent,
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "bold",
                          color: colors.accent,
                        }}
                      >
                        Apartment Bill Tracker
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: colors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {selectedRoom?.name || "Room"}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: "bold",
                        color: colors.accent,
                      }}
                    >
                      STATEMENT
                    </Text>
                  </View>

                  {/* TENANT INFO */}
                  <View style={{ marginBottom: 20 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "bold",
                        marginBottom: 8,
                      }}
                    >
                      Tenant Information
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        marginBottom: 4,
                      }}
                    >
                      {state?.user?.name || "Tenant"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: colors.textSecondary,
                        marginBottom: 2,
                      }}
                    >
                      Status: Non-Payor
                    </Text>
                    <Text
                      style={{
                        fontSize: 9,
                        color: colors.textSecondary,
                      }}
                    >
                      Billing Period:{" "}
                      {new Date(
                        selectedRoom.billing.start,
                      ).toLocaleDateString()}{" "}
                      -{" "}
                      {new Date(selectedRoom.billing.end).toLocaleDateString()}
                    </Text>
                  </View>

                  {/* WATER ALLOCATION */}
                  <View
                    style={{
                      backgroundColor: "#fff8e1",
                      padding: 12,
                      borderRadius: 6,
                      marginBottom: 20,
                      borderLeftWidth: 3,
                      borderLeftColor: colors.accent,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "bold",
                        color: colors.accent,
                        marginBottom: 8,
                      }}
                    >
                      Water Allocation
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{ fontSize: 10, color: colors.textSecondary }}
                      >
                        Your water usage for this period:
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "bold",
                          color: colors.accent,
                        }}
                      >
                        {fmt(
                          calculateMemberWaterBill(
                            currentMember?.id || currentMember?._id,
                          ),
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* NOTICE */}
                  <View
                    style={{
                      backgroundColor: "#f0f0f0",
                      padding: 12,
                      borderRadius: 6,
                      marginBottom: 20,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        lineHeight: 14,
                        color: colors.text,
                      }}
                    >
                      As a non-payor member, you are not responsible for shared
                      utilities (Rent, Electricity, Internet). Your water usage
                      is recorded above. This statement is for your personal
                      reference.
                    </Text>
                  </View>

                  {/* FOOTER */}
                  <View
                    style={{
                      marginTop: 20,
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: "#eee",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        textAlign: "center",
                        color: colors.textSecondary,
                        marginBottom: 8,
                      }}
                    >
                      For any questions, please contact the property manager.
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "bold",
                        fontStyle: "italic",
                        color: colors.text,
                      }}
                    >
                      Thank You!
                    </Text>
                  </View>
                </View>
              </ViewShot>
            );
          }

          // PAYOR STATEMENT (original full statement)
          return (
            <ViewShot
              ref={billingStmtRef}
              style={{
                position: "absolute",
                left: -9999,
                top: 0,
                width: SCREEN_WIDTH,
                backgroundColor: "#ffffff",
                paddingHorizontal: 12,
                paddingVertical: 15,
              }}
              options={{ format: "png", quality: 0.95 }}
            >
              <View>
                {/* ===== HEADER ===== */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 20,
                    paddingBottom: 12,
                    borderBottomWidth: 2,
                    borderBottomColor: colors.accent,
                  }}
                >
                  {/* Logo & Company Name */}
                  <View>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "bold",
                        color: colors.accent,
                      }}
                    >
                      Apartment Bill Tracker
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: colors.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {selectedRoom?.name || "Room"}
                    </Text>
                  </View>

                  {/* STATEMENT Title */}
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "bold",
                      color: colors.accent,
                    }}
                  >
                    STATEMENT
                  </Text>
                </View>

                {/* ===== BILL TO & STATEMENT INFO ===== */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 15,
                  }}
                >
                  {/* Left: Bill To */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        marginBottom: 4,
                      }}
                    >
                      Bill To: {state?.user?.name || "Customer Name"}
                    </Text>
                    <Text style={{ fontSize: 9, color: colors.textSecondary }}>
                      General Maxilom, Carreta
                    </Text>
                    <Text style={{ fontSize: 9, color: colors.textSecondary }}>
                      Cebu City, Philippines, 6000
                    </Text>
                  </View>

                  {/* Right: Statement Details */}
                  <View style={{ alignItems: "flex-end", flex: 1 }}>
                    <View style={{ flexDirection: "row", marginBottom: 4 }}>
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "bold",
                          marginRight: 40,
                        }}
                      >
                        Statement Date
                      </Text>
                      <Text
                        style={{ fontSize: 9, width: 50, textAlign: "right" }}
                      >
                        {new Date().toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", marginBottom: 4 }}>
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "bold",
                          marginRight: 40,
                        }}
                      >
                        End Date
                      </Text>
                      <Text
                        style={{ fontSize: 9, width: 50, textAlign: "right" }}
                      >
                        {new Date(
                          selectedRoom.billing.end,
                        ).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", marginBottom: 4 }}>
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "bold",
                          marginRight: 40,
                        }}
                      >
                        Statement #
                      </Text>
                      <Text
                        style={{ fontSize: 9, width: 50, textAlign: "right" }}
                      >
                        1
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row" }}>
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "bold",
                          marginRight: 40,
                        }}
                      >
                        Customer ID
                      </Text>
                      <Text
                        style={{ fontSize: 9, width: 50, textAlign: "right" }}
                      >
                        {(state?.user?.id || state?.user?._id || "N/A").slice(
                          -8,
                        )}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ===== TWO COLUMN BOXES ===== */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    marginBottom: 15,
                  }}
                >
                  {/* LEFT: REMITTANCE BOX */}
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#fff8e1",
                      padding: 10,
                      borderRadius: 3,
                      borderLeftWidth: 3,
                      borderLeftColor: colors.accent,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: colors.accent,
                        marginBottom: 6,
                      }}
                    >
                      Remittance
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: colors.textSecondary,
                        lineHeight: 12,
                      }}
                    >
                      To ensure proper credit, please enclose a copy of this
                      statement with your check and remit to:
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: colors.text,
                        marginTop: 6,
                        fontWeight: "600",
                      }}
                    >
                      Studio Type Room
                    </Text>
                    <Text style={{ fontSize: 8, color: colors.text }}>
                      General Maxilom, Carreta
                    </Text>
                    <Text style={{ fontSize: 8, color: colors.text }}>
                      Cebu City, Philippines, 6000
                    </Text>
                    <Text
                      style={{
                        fontSize: 8,
                        color: colors.text,
                        marginTop: 6,
                      }}
                    >
                      Please write your Customer ID on your check.
                    </Text>
                  </View>

                  {/* RIGHT: ACCOUNT SUMMARY BOX */}
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#fff8e1",
                      padding: 10,
                      borderRadius: 3,
                      borderLeftWidth: 3,
                      borderLeftColor: colors.accent,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: colors.accent,
                        marginBottom: 8,
                      }}
                    >
                      Account Summary
                    </Text>
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 9, marginBottom: 2 }}>
                        Balance Due
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "bold",
                          color: colors.accent,
                        }}
                      >
                        {fmt(calculateBillShare()?.total || 0)}
                      </Text>
                    </View>
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 9, marginBottom: 2 }}>
                        Payment Due Date
                      </Text>
                      <Text style={{ fontSize: 9 }}>
                        {new Date(
                          selectedRoom.billing.end,
                        ).toLocaleDateString()}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 9, marginBottom: 2 }}>
                        Amount Enclosed $
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          paddingBottom: 4,
                        }}
                      >
                        ___________
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ===== ACCOUNT ACTIVITY TABLE ===== */}
                <View style={{ marginBottom: 12 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "bold",
                      // backgroundColor: colors.accent,
                      borderWidth: 1,
                      borderColor: colors.accent,
                      color: colors.accent,
                      padding: 5,
                      marginBottom: 0,
                    }}
                  >
                    Account Activity
                  </Text>
                  <View style={{ borderWidth: 1, borderColor: "#ccc" }}>
                    {/* Header */}
                    <View
                      style={{
                        flexDirection: "row",
                        backgroundColor: colors.accent,
                        borderBottomWidth: 1,
                        borderBottomColor: "#ccc",
                      }}
                    >
                      <Text
                        style={{
                          flex: 1.2,
                          padding: 5,
                          fontSize: 8,
                          fontWeight: "bold",
                          color: "white",
                        }}
                      >
                        TENANT'S NAME
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          fontWeight: "bold",
                          color: "white",
                          textAlign: "center",
                        }}
                      >
                        MEMBER STATUS
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          fontWeight: "bold",
                          color: "white",
                          textAlign: "right",
                        }}
                      >
                        WATER/MEMBER
                      </Text>
                      <Text
                        style={{
                          flex: 0.8,
                          padding: 5,
                          fontSize: 8,
                          fontWeight: "bold",
                          color: "white",
                          textAlign: "right",
                        }}
                      >
                        TOTAL
                      </Text>
                    </View>

                    {/* Data Rows - Show members if available */}
                    {selectedRoom.members && selectedRoom.members.length > 0 ? (
                      selectedRoom.members.map((member, idx) => {
                        // Use member.isPayer for correct status
                        const memberStatus = member.isPayer
                          ? "Payor"
                          : "Non-payor";

                        // Use calculateMemberWaterBill for correct water amount
                        const waterPerMember = calculateMemberWaterBill(
                          member.id || member._id,
                        );

                        // Get member's total from activeCycle or calculate
                        let memberTotal = 0;
                        if (activeCycle?.memberCharges?.length > 0) {
                          const memberCharge = activeCycle.memberCharges.find(
                            (c) =>
                              String(c.userId) ===
                              String(
                                member.user?.id ||
                                  member.user?._id ||
                                  member.user,
                              ),
                          );
                          memberTotal = memberCharge?.totalDue || 0;
                        }

                        return (
                          <View
                            key={idx}
                            style={{
                              flexDirection: "row",
                              backgroundColor:
                                idx % 2 === 0 ? "#fff9e6" : "white",
                              borderBottomWidth: 1,
                              borderBottomColor: "#eee",
                            }}
                          >
                            <Text
                              style={{
                                flex: 1.2,
                                padding: 5,
                                fontSize: 8,
                              }}
                            >
                              {member.user?.name || "Member"}
                            </Text>
                            <Text
                              style={{
                                flex: 1,
                                padding: 5,
                                fontSize: 8,
                                textAlign: "center",
                              }}
                            >
                              {memberStatus}
                            </Text>
                            <Text
                              style={{
                                flex: 1,
                                padding: 5,
                                fontSize: 8,
                                textAlign: "right",
                              }}
                            >
                              {fmt(waterPerMember)}
                            </Text>
                            <Text
                              style={{
                                flex: 0.8,
                                padding: 5,
                                fontSize: 8,
                                textAlign: "right",
                                fontWeight: "600",
                              }}
                            >
                              {fmt(waterPerMember)}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          backgroundColor: "#fafafa",
                        }}
                      >
                        <Text style={{ flex: 4, padding: 5, fontSize: 8 }}>
                          No members
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* ===== BILLING PERIOD SECTION ===== */}
                <View style={{ marginBottom: 12 }}>
                  <View style={{ borderWidth: 1, borderColor: "#ccc" }}>
                    {/* Header */}
                    <View
                      style={{
                        flexDirection: "row",
                        backgroundColor: colors.accent,
                      }}
                    >
                      <Text
                        style={{
                          flex: 1.5,
                          padding: 5,
                          fontSize: 8,
                          fontWeight: "bold",
                          color: "white",
                        }}
                      >
                        BILLING PERIOD
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          fontWeight: "bold",
                          color: "white",
                          textAlign: "right",
                        }}
                      >
                        TOTAL AMOUNT
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          fontWeight: "bold",
                          color: "white",
                          textAlign: "right",
                        }}
                      >
                        YOUR SHARE
                      </Text>
                    </View>

                    {/* Period Date Row */}
                    <View
                      style={{
                        flexDirection: "row",
                        backgroundColor: "#fff9e6",
                        borderBottomWidth: 1,
                        borderBottomColor: "#eee",
                      }}
                    >
                      <Text
                        style={{
                          flex: 1.5,
                          padding: 5,
                          fontSize: 8,
                          fontWeight: "bold",
                        }}
                      >
                        {new Date(
                          selectedRoom.billing.start,
                        ).toLocaleDateString()}{" "}
                        -{" "}
                        {new Date(
                          selectedRoom.billing.end,
                        ).toLocaleDateString()}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                        }}
                      />
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                        }}
                      />
                    </View>

                    {/* Rent Row */}
                    <View
                      style={{
                        flexDirection: "row",
                        backgroundColor: "white",
                        borderBottomWidth: 1,
                        borderBottomColor: "#eee",
                      }}
                    >
                      <Text style={{ flex: 1.5, padding: 5, fontSize: 8 }}>
                        Rent
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                        }}
                      >
                        {fmt(selectedRoom.billing.rent || 0)}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                        }}
                      >
                        {fmt(calculateBillShare()?.rent || 0)}
                      </Text>
                    </View>

                    {/* Electricity Row */}
                    <View
                      style={{
                        flexDirection: "row",
                        backgroundColor: "#fff9e6",
                        borderBottomWidth: 1,
                        borderBottomColor: "#eee",
                      }}
                    >
                      <Text style={{ flex: 1.5, padding: 5, fontSize: 8 }}>
                        Electricity
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                        }}
                      >
                        {fmt(selectedRoom.billing.electricity || 0)}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                        }}
                      >
                        {fmt(calculateBillShare()?.electricity || 0)}
                      </Text>
                    </View>

                    {/* Internet Row */}
                    <View
                      style={{
                        flexDirection: "row",
                        backgroundColor: "white",
                        borderBottomWidth: 1,
                        borderBottomColor: "#eee",
                      }}
                    >
                      <Text style={{ flex: 1.5, padding: 5, fontSize: 8 }}>
                        Internet
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                        }}
                      >
                        {fmt(selectedRoom.billing.internet || 0)}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                        }}
                      >
                        {fmt(calculateBillShare()?.internet || 0)}
                      </Text>
                    </View>

                    {/* Water Row */}
                    <View
                      style={{
                        flexDirection: "row",
                        backgroundColor: "#fff9e6",
                        borderBottomWidth: 1,
                        borderBottomColor: "#eee",
                      }}
                    >
                      <Text style={{ flex: 1.5, padding: 5, fontSize: 8 }}>
                        Water
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                        }}
                      >
                        {fmt(calculateTotalWaterBill())}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                        }}
                      >
                        {fmt(calculateBillShare()?.water || 0)}
                      </Text>
                    </View>

                    {/* Custom Charges Rows */}
                    {activeCycle?.customCharges &&
                      Array.isArray(activeCycle.customCharges) &&
                      activeCycle.customCharges.length > 0 &&
                      (() => {
                        const currentUserMember = selectedRoom.members?.find(
                          (m) =>
                            String(m.user?.id || m.user?._id || m.user) ===
                            String(userId),
                        );
                        const isPayer = currentUserMember?.isPayer !== false;
                        const payorCount = Math.max(
                          1,
                          (selectedRoom?.members || []).filter(
                            (m) => m.isPayer !== false,
                          ).length,
                        );
                        return activeCycle.customCharges.map(
                          (charge, chargeIdx) => {
                            const chargeAmount = parseFloat(charge.amount || 0);
                            const userShare =
                              isPayer && payorCount > 0
                                ? r2(chargeAmount / payorCount)
                                : 0;
                            return (
                              <View
                                key={`custom-charge-${chargeIdx}`}
                                style={{
                                  flexDirection: "row",
                                  backgroundColor:
                                    chargeIdx % 2 === 0 ? "white" : "#fff9e6",
                                  borderBottomWidth: 1,
                                  borderBottomColor: "#eee",
                                }}
                              >
                                <Text
                                  style={{
                                    flex: 1.5,
                                    padding: 5,
                                    fontSize: 8,
                                  }}
                                >
                                  {charge.name}
                                </Text>
                                <Text
                                  style={{
                                    flex: 1,
                                    padding: 5,
                                    fontSize: 8,
                                    textAlign: "right",
                                  }}
                                >
                                  {fmt(chargeAmount)}
                                </Text>
                                <Text
                                  style={{
                                    flex: 1,
                                    padding: 5,
                                    fontSize: 8,
                                    textAlign: "right",
                                  }}
                                >
                                  {fmt(userShare)}
                                </Text>
                              </View>
                            );
                          },
                        );
                      })()}

                    {/* Total Bills Row */}
                    <View
                      style={{
                        flexDirection: "row",
                        backgroundColor: "white",
                        borderBottomWidth: 1,
                        borderBottomColor: "#eee",
                      }}
                    >
                      <Text
                        style={{
                          flex: 1.5,
                          padding: 5,
                          fontSize: 8,
                          fontWeight: "bold",
                        }}
                      >
                        Total Bills:
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                          fontWeight: "bold",
                        }}
                      >
                        {fmt(
                          (selectedRoom.billing.rent || 0) +
                            (selectedRoom.billing.electricity || 0) +
                            calculateTotalWaterBill() +
                            (selectedRoom.billing.internet || 0) +
                            (Array.isArray(activeCycle?.customCharges)
                              ? activeCycle.customCharges.reduce(
                                  (sum, c) => sum + parseFloat(c.amount || 0),
                                  0,
                                )
                              : 0),
                        )}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                        }}
                      />
                    </View>

                    {/* Total Share Row */}
                    <View
                      style={{
                        flexDirection: "row",
                        backgroundColor: "#fff9e6",
                      }}
                    >
                      <Text
                        style={{
                          flex: 1.5,
                          padding: 5,
                          fontSize: 8,
                          fontWeight: "bold",
                        }}
                      >
                        Total Share:
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                          fontWeight: "bold",
                        }}
                      >
                        {fmt(calculateBillShare()?.total || 0)}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          padding: 5,
                          fontSize: 8,
                          textAlign: "right",
                        }}
                      />
                    </View>
                  </View>
                </View>

                {/* ===== CURRENT BALANCE ===== */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    backgroundColor: "#fff8e1",
                    padding: 8,
                    marginBottom: 12,
                    borderRadius: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "bold",
                      marginRight: 20,
                    }}
                  >
                    Current Balance:
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "bold",
                      color: colors.accent,
                    }}
                  >
                    {fmt(calculateBillShare()?.total || 0)}
                  </Text>
                </View>

                {/* ===== FOOTER ===== */}
                <View
                  style={{
                    marginTop: 10,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: "#eee",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      marginBottom: 4,
                      textAlign: "center",
                      color: colors.textSecondary,
                    }}
                  >
                    If you have any questions about this invoice, please contact
                  </Text>
                  <Text
                    style={{
                      fontSize: 8,
                      textAlign: "center",
                      color: colors.textSecondary,
                      marginBottom: 4,
                    }}
                  >
                    ABT, General Maxilom, Carreta, Cebu City, Philippines, 6000
                  </Text>
                  <Text
                    style={{
                      fontSize: 8,
                      textAlign: "center",
                      color: colors.textSecondary,
                      marginBottom: 6,
                    }}
                  >
                    Phone [09937896747], , [apartmentbilltrackers@gmail.com]
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "bold",
                      fontStyle: "italic",
                      color: colors.text,
                    }}
                  >
                    Thank You For Trusting Us!
                  </Text>
                </View>
              </View>
            </ViewShot>
          );
        })()}

      {/* Payment Receipt for Download */}
      {showPaymentReceipt && paymentReceiptData && (
        <ViewShot
          ref={paymentReceiptRef}
          style={{
            position: "absolute",
            left: -9999,
            top: 0,
            width: SCREEN_WIDTH,
            backgroundColor: "#f5f5f5",
            paddingHorizontal: 16,
            paddingVertical: 20,
          }}
          options={{ format: "png", quality: 0.95 }}
        >
          <View style={{ alignItems: "center" }}>
            {/* Title */}
            <Text
              style={{
                textAlign: "center",
                fontSize: 16,
                fontWeight: "bold",
                marginBottom: 2,
                letterSpacing: 1,
                color: "#333",
              }}
            >
              {paymentReceiptData.paymentMethodText}
            </Text>

            {/* Dashed Line */}
            <Text
              style={{
                textAlign: "center",
                fontSize: 10,
                color: "#999",
                marginBottom: 12,
                letterSpacing: 1,
              }}
            >
              {Array(40).fill("·").join("")}
            </Text>

            {/* Receipt Number */}
            <View
              style={{
                flexDirection: "row",
                marginBottom: 4,
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <Text style={{ fontSize: 10, color: "#333" }}>Receipt #</Text>
              <Text
                style={{
                  fontSize: 10,
                  color: "#333",
                  fontWeight: "bold",
                }}
              >
                {paymentReceiptData.receiptNumber}
              </Text>
            </View>

            {/* Manager */}
            <View
              style={{
                flexDirection: "row",
                marginBottom: 4,
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <Text style={{ fontSize: 10, color: "#333" }}>Manager</Text>
              <Text style={{ fontSize: 10, color: "#333" }}>
                {paymentReceiptData.managerInfo}
              </Text>
            </View>

            {/* Date and Time */}
            <View style={{ marginBottom: 12, width: "100%" }}>
              <Text style={{ fontSize: 10, color: "#333", textAlign: "right" }}>
                {paymentReceiptData.transactionDate}{" "}
                {paymentReceiptData.transactionTime}
              </Text>
            </View>

            {/* Dashed Line */}
            <Text
              style={{
                textAlign: "center",
                fontSize: 10,
                color: "#999",
                marginBottom: 12,
                letterSpacing: 1,
                width: "100%",
              }}
            >
              {Array(40).fill("·").join("")}
            </Text>

            {/* Client/Tenant Section */}
            <Text
              style={{
                fontSize: 10,
                fontWeight: "bold",
                marginBottom: 6,
                color: "#333",
                alignSelf: "flex-start",
              }}
            >
              Client
            </Text>
            <View
              style={{
                flexDirection: "row",
                marginBottom: 4,
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <Text style={{ fontSize: 10, color: "#333" }}>Name</Text>
              <Text style={{ fontSize: 10, color: "#333" }}>
                {paymentReceiptData.tenantName}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                marginBottom: 4,
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <Text style={{ fontSize: 10, color: "#333" }}>Room</Text>
              <Text style={{ fontSize: 10, color: "#333" }}>
                {paymentReceiptData.roomName}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                marginBottom: 12,
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <Text style={{ fontSize: 10, color: "#333" }}>Location</Text>
              <Text
                style={{
                  fontSize: 9,
                  color: "#333",
                  textAlign: "right",
                  flex: 1,
                  marginLeft: 8,
                }}
              >
                {paymentReceiptData.roomAddress}
              </Text>
            </View>

            {/* Dashed Line */}
            <Text
              style={{
                textAlign: "center",
                fontSize: 10,
                color: "#999",
                marginBottom: 12,
                letterSpacing: 1,
                width: "100%",
              }}
            >
              {Array(40).fill("·").join("")}
            </Text>

            {/* Payment Details Items */}
            <View style={{ marginBottom: 12, width: "100%" }}>
              <View
                style={{
                  flexDirection: "row",
                  marginBottom: 4,
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 10, color: "#333", flex: 1 }}>
                  Payment Method
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: "#333",
                    textAlign: "right",
                    flex: 1,
                  }}
                >
                  {paymentReceiptData.paymentMethodText}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  marginBottom: 4,
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 10, color: "#333", flex: 1 }}>
                  Status
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: "#333",
                    textAlign: "right",
                    flex: 1,
                  }}
                >
                  {paymentReceiptData.paymentDetails}
                </Text>
              </View>
            </View>

            {/* Dashed Line */}
            <Text
              style={{
                textAlign: "center",
                fontSize: 10,
                color: "#999",
                marginBottom: 8,
                letterSpacing: 1,
                width: "100%",
              }}
            >
              {Array(40).fill("·").join("")}
            </Text>

            {/* Total Amount */}
            <View
              style={{
                flexDirection: "row",
                marginBottom: 4,
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                TOTAL
              </Text>
              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <Text
                  style={{
                    fontSize: 9,
                    color: "#999",
                    letterSpacing: 1,
                  }}
                >
                  {Array(25).fill(".").join("")}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                ₱{fmt(paymentReceiptData.amountPaid)}
              </Text>
            </View>

            {/* Dashed Line */}
            <Text
              style={{
                textAlign: "center",
                fontSize: 10,
                color: "#999",
                marginBottom: 12,
                letterSpacing: 1,
                width: "100%",
              }}
            >
              {Array(40).fill("·").join("")}
            </Text>

            {/* Amount in Words */}
            <View style={{ marginBottom: 12, width: "100%" }}>
              <Text
                style={{
                  fontSize: 9,
                  color: "#333",
                  textAlign: "center",
                  fontStyle: "italic",
                }}
              >
                {paymentReceiptData.amountWords}
              </Text>
            </View>

            {/* Line Items Section */}
            {paymentReceiptData.lineItems &&
              paymentReceiptData.lineItems.length > 0 && (
                <View style={{ marginBottom: 12, width: "100%" }}>
                  {paymentReceiptData.lineItems.map((item, idx) => (
                    <View
                      key={idx}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          color: "#333",
                          flex: 0.7,
                        }}
                      >
                        {item.description}
                      </Text>
                      <Text
                        style={{
                          fontSize: 9,
                          color: "#333",
                          textAlign: "right",
                          flex: 0.3,
                        }}
                      >
                        ₱{fmt(item.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

            {/* Dashed Line */}
            <Text
              style={{
                textAlign: "center",
                fontSize: 10,
                color: "#999",
                marginBottom: 12,
                letterSpacing: 1,
                width: "100%",
              }}
            >
              {Array(40).fill("·").join("")}
            </Text>

            {/* Card Number Section */}
            <View
              style={{ marginBottom: 12, alignItems: "center", width: "100%" }}
            >
              <Text
                style={{
                  fontSize: 9,
                  color: "#333",
                  letterSpacing: 2,
                  marginBottom: 8,
                }}
              >
                {paymentReceiptData.cardNumber}
              </Text>
            </View>

            {/* Barcode Representation */}
            <View
              style={{ marginBottom: 12, alignItems: "center", width: "100%" }}
            >
              <View
                style={{
                  height: 40,
                  justifyContent: "space-around",
                  marginBottom: 4,
                  flexDirection: "row",
                }}
              >
                {Array(15)
                  .fill(0)
                  .map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: Math.random() > 0.5 ? 2 : 3,
                        height: 30,
                        backgroundColor: "#333",
                      }}
                    />
                  ))}
              </View>
              <Text
                style={{
                  fontSize: 8,
                  color: "#333",
                  letterSpacing: 1,
                  textAlign: "center",
                }}
              >
                {paymentReceiptData.barcodeNumber}
              </Text>
            </View>

            {/* Dashed Line */}
            <Text
              style={{
                textAlign: "center",
                fontSize: 10,
                color: "#999",
                marginBottom: 12,
                letterSpacing: 1,
                width: "100%",
              }}
            >
              {Array(40).fill("·").join("")}
            </Text>

            {/* Thank You Message */}
            <Text
              style={{
                textAlign: "center",
                fontSize: 12,
                fontWeight: "bold",
                marginBottom: 12,
                letterSpacing: 1,
                color: "#333",
              }}
            >
              THANK YOU FOR YOUR PAYMENT!
            </Text>

            {/* Footer Message */}
            <Text
              style={{
                textAlign: "center",
                fontSize: 8,
                color: "#666",
                marginBottom: 2,
              }}
            >
              Please keep this receipt for your records
            </Text>

            <Text
              style={{
                textAlign: "center",
                fontSize: 8,
                color: "#999",
                marginTop: 12,
              }}
            >
              www.apartmentbilltracker.com
            </Text>
          </View>
        </ViewShot>
      )}
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
      flexShrink: 1,
    },
    youBadge: {
      backgroundColor: colors.accent,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    youBadgeText: {
      fontSize: 9,
      fontWeight: "700",
      color: colors.textOnAccent,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    memberRowHighlight: {
      backgroundColor: colors.accentTransparent || `${colors.accent}10`,
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
    shareItemPaid: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
    payNowButtonDisabled: {
      backgroundColor: colors.textTertiary,
      opacity: 0.5,
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

    // ─── OUTSTANDING BALANCE ───
    outstandingCard: {
      backgroundColor: "#fdecea",
      borderRadius: 14,
      padding: 16,
      borderWidth: 1.5,
      borderColor: "#e57373",
      marginTop: 16,
    },
    outstandingCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    outstandingCardTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: "#c62828",
    },
    outstandingCardTotal: {
      fontSize: 16,
      fontWeight: "800",
      color: "#c62828",
    },
    outstandingCardSubtitle: {
      fontSize: 12,
      color: "#b71c1c",
      marginBottom: 10,
      lineHeight: 17,
    },
    outstandingCycleRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderTopWidth: 0.5,
      borderTopColor: "#e57373",
    },
    outstandingCycleLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: "#c62828",
    },
    outstandingCyclePeriod: {
      fontSize: 11,
      color: "#e53935",
      marginTop: 1,
    },
    outstandingCycleAmount: {
      fontSize: 14,
      fontWeight: "700",
      color: "#c62828",
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
