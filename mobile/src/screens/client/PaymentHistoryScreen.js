import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  apiService,
  roomService,
  billingCycleService,
} from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import {
  ScrollViewWithDetection,
  FlatListWithDetection,
} from "../../navigation/ClientNavigator";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";

const PaymentHistoryScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const authContext = useContext(AuthContext);
  const user = authContext?.state?.user;

  const { roomId, roomName } = route.params;
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [receiptRoomData, setReceiptRoomData] = useState(null);
  const [receiptBillingData, setReceiptBillingData] = useState(null);
  const [receiptMemberInfo, setReceiptMemberInfo] = useState(null);
  const [receiptUserCharge, setReceiptUserCharge] = useState(null);

  // Fetch room and billing data for receipt display
  useEffect(() => {
    const fetchReceiptData = async () => {
      if (!selectedPayment) {
        setReceiptRoomData(null);
        setReceiptBillingData(null);
        setReceiptMemberInfo(null);
        setReceiptUserCharge(null);
        return;
      }

      try {
        const userId = user?.id || user?._id;
        const roomResponse = await roomService.getRoomById(roomId);
        const room =
          roomResponse?.data?.room ||
          roomResponse?.room ||
          roomResponse?.data ||
          roomResponse;
        setReceiptRoomData(room);

        // Get member info
        if (room?.members && Array.isArray(room.members)) {
          const member = room.members.find(
            (m) =>
              String(m.user?.id || m.user?._id || m.user) === String(userId),
          );
          setReceiptMemberInfo(member);
        }

        // IMPORTANT: Fetch the HISTORICAL billing cycle (from when payment was made)
        let historicalCycle = null;

        const cycles = await billingCycleService.getBillingCycles(roomId);
        const cycles_arr = Array.isArray(cycles)
          ? cycles
          : cycles?.billingCycles || cycles?.data || [];

        // Strategy 1: Match by billing_cycle_start and billing_cycle_end dates
        // (Backend stores these dates with payments, not billingCycleId)
        if (
          selectedPayment.billing_cycle_start &&
          selectedPayment.billing_cycle_end
        ) {
          const paymentCycleStart = selectedPayment.billing_cycle_start;
          const paymentCycleEnd = selectedPayment.billing_cycle_end;
          historicalCycle = cycles_arr.find((c) => {
            const cycleStart = c.start_date || c.startDate;
            const cycleEnd = c.end_date || c.endDate;
            // Match cycles with same date range (compare YYYY-MM-DD only)
            return (
              String(cycleStart).slice(0, 10) ===
                String(paymentCycleStart).slice(0, 10) &&
              String(cycleEnd).slice(0, 10) ===
                String(paymentCycleEnd).slice(0, 10)
            );
          });
        }

        // Strategy 2: Fallback to payment_date matching in CLOSED cycles
        if (!historicalCycle && selectedPayment.payment_date) {
          const paymentDate = new Date(selectedPayment.payment_date);
          const closedCycles = cycles_arr.filter(
            (c) => c.status !== "active" && c.status !== "pending",
          );
          historicalCycle = closedCycles.find((c) => {
            const cycleStart = c.start_date
              ? new Date(c.start_date)
              : new Date(c.startDate);
            const cycleEnd = c.end_date
              ? new Date(c.end_date)
              : new Date(c.endDate);
            return paymentDate >= cycleStart && paymentDate <= cycleEnd;
          });
        }

        setReceiptBillingData(historicalCycle);

        // Get user charge data from the historical cycle
        if (historicalCycle?.memberCharges?.length > 0) {
          const userCharge = historicalCycle.memberCharges.find(
            (c) => String(c.userId) === String(userId),
          );
          setReceiptUserCharge(userCharge);
        } else {
          setReceiptUserCharge(null);
        }
      } catch (err) {
        console.error("Error fetching receipt data:", err);
      }
    };

    fetchReceiptData();
  }, [selectedPayment, roomId, user]);

  const fetchPaymentHistory = async () => {
    try {
      setError("");
      const response = await apiService.getTransactions(roomId);
      if (response.success) {
        // Filter out cancelled/deleted transactions on the client side too
        const valid = (response.transactions || []).filter(
          (t) => t.status !== "cancelled" && t.status !== "deleted",
        );
        setPayments(valid);
      } else {
        setError("No transactions found");
      }
    } catch (err) {
      console.error("Error fetching payment history:", err);
      setError("Failed to load payment history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentHistory();
  }, [roomId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPaymentHistory();
    setRefreshing(false);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  /* ─── Bill helpers ─── */
  const getBillIcon = (type) => {
    switch (type) {
      case "rent":
        return "home-outline";
      case "electricity":
        return "flash-outline";
      case "water":
        return "water-outline";
      case "internet":
        return "wifi-outline";
      default:
        return "receipt-outline";
    }
  };

  const getBillLabel = (type) => {
    const labels = {
      rent: "Rent",
      electricity: "Electricity",
      water: "Water",
      internet: "Internet",
      total: "Total Bill",
    };
    return (
      labels[type] ||
      (type ? type.charAt(0).toUpperCase() + type.slice(1) : "Payment")
    );
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case "gcash":
        return "phone-portrait-outline";
      case "bank_transfer":
        return "business-outline";
      case "cash":
        return "cash-outline";
      default:
        return "card-outline";
    }
  };

  const formatMethod = (method) => {
    if (!method) return "Cash";
    return method
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "verified":
      case "completed":
        return {
          color: colors.success,
          bg: colors.successBg,
          label: "Verified",
          icon: "checkmark-circle",
        };
      case "submitted":
        return {
          color: "#e65100",
          bg: "#fff3e0",
          label: "Awaiting Verification",
          icon: "time-outline",
        };
      case "pending":
        return {
          color: colors.warning,
          bg: colors.warningBg,
          label: "Pending",
          icon: "time-outline",
        };
      case "rejected":
        return {
          color: colors.error,
          bg: colors.errorBg,
          label: "Rejected",
          icon: "close-circle",
        };
      default:
        return {
          color: colors.textTertiary,
          bg: colors.cardAlt,
          label: status
            ? status.charAt(0).toUpperCase() + status.slice(1)
            : "Unknown",
          icon: "help-circle-outline",
        };
    }
  };

  /* ─── Summary ─── */
  const totalPaid = payments
    .filter((p) => p.status === "verified" || p.status === "completed")
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const totalPending = payments
    .filter((p) => p.status === "pending" || p.status === "submitted")
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  /* ─── Helper to get correct payment amount ─── */
  const getPaymentAmount = (payment) => {
    // If there's a breakdown with the fair split amount, use that
    if (
      payment.billBreakdown &&
      payment.billType &&
      payment.billType !== "total"
    ) {
      const billTypeMap = {
        rent: "rent",
        electricity: "electricity",
        internet: "internet",
        water: "water",
        custom_charges: "customCharges",
      };
      const key = billTypeMap[payment.billType];

      // Check if this key exists in breakdown (even if 0 or false, as long as key exists)
      if (key && key in payment.billBreakdown) {
        const breakdownValue = payment.billBreakdown[key];
        // If it's a number or truthy value, parse it
        if (breakdownValue && typeof breakdownValue !== "boolean") {
          return parseFloat(breakdownValue) || 0;
        }
        // If it's true (boolean), return the total split fairly
        if (breakdownValue === true) {
          // Count how many bills are being paid
          const billsBeingPaid = Object.values(payment.billBreakdown).filter(
            (v) => v === true || (typeof v === "number" && v > 0),
          ).length;
          if (billsBeingPaid > 0) {
            return parseFloat(payment.amount) / billsBeingPaid || 0;
          }
        }
      }
    }
    // Fallback to total amount
    return parseFloat(payment.amount) || 0;
  };

  /* ─── Reference helper ─── */
  const getReference = (payment) => {
    return (
      payment.referenceNumber ||
      payment.reference ||
      payment.transactionId ||
      payment.gcash?.referenceNumber ||
      payment.bankTransfer?.referenceNumber ||
      payment.cash?.receiptNumber ||
      payment._id ||
      null
    );
  };

  /* ─── Helper functions for receipt ─── */
  const getRoomAddress = () => {
    return receiptRoomData?.address || "Apartment Address";
  };

  const getMemberSinceDate = () => {
    const joinedDate =
      receiptMemberInfo?.joinedAt || receiptMemberInfo?.joined_at;
    if (!joinedDate) return "N/A";

    const date = new Date(joinedDate);
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getMemberStatus = () => {
    if (receiptUserCharge) {
      return receiptUserCharge.isPayer !== false ? "Payor" : "Non-Payor";
    }
    return receiptMemberInfo?.isPayer ? "Payor" : "Non-Payor";
  };

  const getReceiptTitle = () => {
    const method = selectedPayment?.paymentMethod || "";
    if (method.includes("bank")) return "BANK TRANSFER RECEIPT";
    if (method.includes("gcash")) return "GCASH RECEIPT";
    if (method.includes("cash")) return "CASH RECEIPT";
    return "PAYMENT RECEIPT";
  };

  /* ─── Loading State ─── */
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Payment History</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading transactions…</Text>
        </View>
      </View>
    );
  }

  /* ─── Render Payment Card ─── */
  const renderPayment = ({ item: payment }) => {
    const sc = getStatusConfig(payment.status);
    const ref = getReference(payment);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelectedPayment(payment)}
        activeOpacity={0.7}
      >
        {/* Top Row */}
        <View style={styles.cardTop}>
          <View style={styles.billIconWrap}>
            <Ionicons
              name={getBillIcon(payment.billType)}
              size={18}
              color={colors.accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.billLabel}>
              {getBillLabel(payment.billType)}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons
                name={getMethodIcon(payment.paymentMethod)}
                size={12}
                color={colors.textSecondary}
              />
              <Text style={styles.metaText}>
                {formatMethod(payment.paymentMethod)}
              </Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>
                {formatDate(payment.transactionDate)}
              </Text>
            </View>
          </View>
          <View style={styles.amountWrap}>
            <Text style={styles.amount}>
              ₱{getPaymentAmount(payment).toFixed(2)}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
              <Ionicons name={sc.icon} size={11} color={sc.color} />
              <Text style={[styles.statusText, { color: sc.color }]}>
                {sc.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Reference / Details */}
        {ref && (
          <View style={styles.refRow}>
            <Ionicons
              name="document-text-outline"
              size={13}
              color={colors.textSecondary}
            />
            <Text style={styles.refLabel}>Ref:</Text>
            <Text style={styles.refValue} numberOfLines={1}>
              {ref}
            </Text>
          </View>
        )}

        {payment.bankTransfer?.bankName && (
          <View style={styles.refRow}>
            <Ionicons
              name="business-outline"
              size={13}
              color={colors.textSecondary}
            />
            <Text style={styles.refLabel}>Bank:</Text>
            <Text style={styles.refValue}>{payment.bankTransfer.bankName}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  /* ─── Receipt Modal ─── */
  const renderReceiptModal = () => {
    if (!selectedPayment) return null;

    const payment = selectedPayment;
    const ref = getReference(payment) || "N/A";
    // Ensure we have a valid date - use transactionDate from API response
    // The backend stores payment_date in ISO format (UTC)
    const paymentDate =
      payment.transactionDate || payment.payment_date || payment.created_at;
    if (!paymentDate) {
      console.warn("Warning: Payment has no date field", payment);
    }
    // Ensure the ISO string has the 'Z' suffix for proper UTC parsing
    let isoDateString = paymentDate;
    if (
      isoDateString &&
      !isoDateString.endsWith("Z") &&
      isoDateString.includes("T")
    ) {
      // Add 'Z' if missing so JavaScript treats it as UTC
      isoDateString = isoDateString + "Z";
    }
    // Parse the ISO date string - JavaScript automatically converts UTC to local timezone
    const transactionDateTime = new Date(isoDateString || new Date());

    const dateStr = transactionDateTime.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // Manually format time in local timezone to ensure correct display across platforms
    const hours = String(transactionDateTime.getHours()).padStart(2, "0");
    const minutes = String(transactionDateTime.getMinutes()).padStart(2, "0");
    const timeStr = `${hours}:${minutes}`;

    // Calculate bill amounts - use HISTORICAL data from payment first
    const billAmounts = {
      rent: payment.billBreakdown?.rent || receiptUserCharge?.rentShare || 0,
      electricity:
        payment.billBreakdown?.electricity ||
        receiptUserCharge?.electricityShare ||
        0,
      internet:
        payment.billBreakdown?.internet ||
        receiptUserCharge?.internetShare ||
        0,
      water:
        payment.billBreakdown?.water ||
        (receiptUserCharge?.isPayer !== false
          ? receiptUserCharge?.waterBillShare
          : receiptUserCharge?.waterOwn) ||
        0,
      customCharges: receiptUserCharge?.custom_charges_share || 0,
      total:
        payment.billBreakdown?.total ||
        receiptUserCharge?.totalDue ||
        parseFloat(payment.amount) ||
        0,
    };

    // Determine which bills were paid in this transaction
    const shouldShowBill = (billKey) => {
      // If breakdown exists, use it to determine which bills to show
      if (payment.billBreakdown) {
        return payment.billBreakdown[billKey] === true;
      }

      // If no breakdown but billType specified, only show that bill type
      if (payment.billType && payment.billType !== "total") {
        const billTypeMap = {
          rent: "rent",
          electricity: "electricity",
          internet: "internet",
          water: "water",
          custom_charges: "customCharges",
          customCharges: "customCharges",
        };
        return billTypeMap[payment.billType] === billKey;
      }

      // Default: show all bills (for backward compatibility)
      return true;
    };

    // Calculate total based only on bills that were paid
    const calculatePaidTotal = () => {
      let total = 0;
      if (shouldShowBill("rent")) total += billAmounts.rent || 0;
      if (shouldShowBill("electricity")) total += billAmounts.electricity || 0;
      if (shouldShowBill("internet")) total += billAmounts.internet || 0;
      if (shouldShowBill("water")) total += billAmounts.water || 0;
      if (shouldShowBill("customCharges"))
        total += billAmounts.customCharges || 0;
      return total;
    };

    // Update billAmounts.total to reflect only paid bills
    billAmounts.total = calculatePaidTotal() || parseFloat(payment.amount) || 0;

    // Generate a deterministic numeric-only barcode from payment ID
    // Match the numeric-only format used in BillsScreen for consistency
    let barcodeNumber = "000000000000";
    if (payment.id) {
      // Extract only numeric characters from ID and pad to 12 digits
      const numericOnly = String(payment.id).replace(/\D/g, "");
      barcodeNumber = numericOnly.slice(0, 12).padEnd(12, "0");
    }

    return (
      <Modal
        visible={true}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPayment(null)}
      >
        <View style={styles.receiptModalOverlay}>
          <View style={styles.receiptModalContent}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.receiptCloseBtn}
              onPress={() => setSelectedPayment(null)}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>

            <ScrollViewWithDetection
              style={styles.receiptScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Receipt Content */}
              <View style={styles.receiptContent}>
                {/* Title */}
                <View style={styles.titleRow}>
                  <Text style={styles.receiptTitle}>{getReceiptTitle()}</Text>
                  <Text style={styles.titleSubtitle}>
                    Apartment Bill Tracker
                  </Text>
                </View>

                {/* Dashed Line */}
                <Text style={styles.dashedLine}>
                  {Array(42).fill("-").join("")}
                </Text>

                {/* Receipt Header Info */}
                <View style={styles.headerInfo}>
                  <View style={styles.headerRow}>
                    <Text style={styles.headerLabelRight}>
                      Room: {roomName}
                    </Text>
                    <Text style={styles.headerLabel}>Receipt No. {ref}</Text>
                  </View>
                </View>

                {/* Date */}
                <View style={styles.dateSection}>
                  <Text style={styles.dateText}>
                    {dateStr} {timeStr}
                  </Text>
                </View>

                {/* Dashed Line */}
                <Text style={styles.dashedLine}>
                  {Array(42).fill("-").join("")}
                </Text>

                {/* Client Section */}
                <Text style={styles.sectionTitle}>Client Information</Text>
                <View style={styles.clientInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Name</Text>
                    <Text style={styles.infoValue}>
                      : {user?.name || "Tenant"}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Status</Text>
                    <Text style={styles.infoValue}>: {getMemberStatus()}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Member Since</Text>
                    <Text style={styles.infoValue}>
                      : {getMemberSinceDate()}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Location</Text>
                    <Text style={styles.infoValue}>: {getRoomAddress()}</Text>
                  </View>
                </View>

                {/* Dashed Line */}
                <Text style={styles.dashedLine}>
                  {Array(42).fill("-").join("")}
                </Text>

                {/* Cost Breakdown */}
                <View style={styles.costBreakdown}>
                  {shouldShowBill("rent") && (
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Rent</Text>
                      <Text style={styles.costDots}>
                        {Array(26).fill(".").join("")}
                      </Text>
                      <Text style={styles.costAmount}>
                        ₱{(billAmounts.rent || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {shouldShowBill("electricity") && (
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Electricity</Text>
                      <Text style={styles.costDots}>
                        {Array(26).fill(".").join("")}
                      </Text>
                      <Text style={styles.costAmount}>
                        ₱{(billAmounts.electricity || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {shouldShowBill("internet") && (
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Internet</Text>
                      <Text style={styles.costDots}>
                        {Array(26).fill(".").join("")}
                      </Text>
                      <Text style={styles.costAmount}>
                        ₱{(billAmounts.internet || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {shouldShowBill("water") && (
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Water</Text>
                      <Text style={styles.costDots}>
                        {Array(26).fill(".").join("")}
                      </Text>
                      <Text style={styles.costAmount}>
                        ₱{(billAmounts.water || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {shouldShowBill("customCharges") &&
                    receiptBillingData?.customCharges &&
                    receiptBillingData.customCharges.length > 0 &&
                    receiptBillingData.customCharges.map((charge, idx) => {
                      const totalCustomCharges =
                        receiptBillingData.customCharges.reduce(
                          (sum, c) => sum + parseFloat(c.amount || 0),
                          0,
                        );
                      const userShareOfCharge =
                        totalCustomCharges > 0
                          ? (parseFloat(charge.amount || 0) /
                              totalCustomCharges) *
                            billAmounts.customCharges
                          : 0;
                      return (
                        <View key={idx} style={styles.costRow}>
                          <Text style={styles.costLabel}>
                            {charge.name || "Charge"}
                          </Text>
                          <Text style={styles.costDots}>
                            {Array(26).fill(".").join("")}
                          </Text>
                          <Text style={styles.costAmount}>
                            ₱{userShareOfCharge.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })}
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Service Fee</Text>
                    <Text style={styles.costDots}>
                      {Array(26).fill(".").join("")}
                    </Text>
                    <Text style={styles.costAmount}>Free</Text>
                  </View>
                </View>

                {/* Dashed Line */}
                <Text style={styles.dashedLine}>
                  {Array(42).fill("-").join("")}
                </Text>

                {/* Total */}
                <View style={styles.totalSection}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>TOTAL</Text>
                    <Text style={styles.totalDots}>
                      {Array(26).fill(".").join("")}
                    </Text>
                    <Text style={styles.totalAmount}>
                      ₱{(billAmounts.total || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Dashed Line */}
                <Text style={styles.dashedLine}>
                  {Array(42).fill("-").join("")}
                </Text>

                {/* Barcode */}
                <View style={styles.barcodeSection}>
                  <View style={styles.barcode}>
                    {Array(30)
                      .fill(0)
                      .map((_, i) => (
                        <View
                          key={i}
                          style={{
                            width: Math.random() > 0.4 ? 1.5 : 4,
                            height: Math.random() > 0.1 ? 30 : 30,
                            backgroundColor: "#333",
                            marginHorizontal: 0.3,
                          }}
                        />
                      ))}
                  </View>
                  <Text style={styles.barcodeNumber}>{barcodeNumber}</Text>
                </View>

                {/* Dashed Line */}
                <Text style={styles.dashedLine}>
                  {Array(42).fill("-").join("")}
                </Text>

                {/* Thank You */}
                <Text style={styles.thankYouText}>THANK YOU FOR TRUSTING!</Text>

                {/* Footer */}
                <Text style={styles.footerText}>
                  Host your apartment with us and experience hassle-free
                  management and seamless payments. Visit our website to learn
                  more about our services and how we can help you manage your
                  property efficiently.
                </Text>
                <Text style={styles.websiteText}>
                  www.apartmentbilltracker-ph.onrender.com
                </Text>
              </View>
            </ScrollViewWithDetection>
          </View>
        </View>
      </Modal>
    );
  };

  /* ─── Main Render ─── */
  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Payment History</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {roomName}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.countBadge}>
              {payments.length} {payments.length === 1 ? "record" : "records"}
            </Text>
          </View>
        </View>

        {/* Summary Strip */}
        {payments.length > 0 && (
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <View
                style={[styles.summaryDot, { backgroundColor: "#22c55e" }]}
              />
              <Text style={styles.summaryLabel}>Verified</Text>
              <Text style={[styles.summaryValue, { color: "#22c55e" }]}>
                ₱{totalPaid.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <View
                style={[styles.summaryDot, { backgroundColor: "#f59e0b" }]}
              />
              <Text style={styles.summaryLabel}>Pending</Text>
              <Text style={[styles.summaryValue, { color: "#f59e0b" }]}>
                ₱{totalPending.toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View style={styles.errorBar}>
            <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* List / Empty */}
        {payments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="receipt-outline"
                size={48}
                color={colors.textSecondary}
              />
            </View>
            <Text style={styles.emptyTitle}>No Payments Yet</Text>
            <Text style={styles.emptyText}>
              Completed payments will appear here.
            </Text>
            <TouchableOpacity
              style={styles.emptyRefresh}
              onPress={fetchPaymentHistory}
            >
              <Ionicons
                name="refresh-outline"
                size={16}
                color={colors.accent}
              />
              <Text style={styles.emptyRefreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatListWithDetection
            data={payments}
            renderItem={renderPayment}
            keyExtractor={(item, i) => item.id || item._id || String(i)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#b38604"]}
                tintcolor={colors.accent}
              />
            }
          />
        )}
      </View>
      {renderReceiptModal()}
    </>
  );
};

/* ═══════════════════════ STYLES ═══════════════════════ */
const createStyles = (colors) =>
  StyleSheet.create({
    /* Layout */
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 12,
      fontSize: 13,
      color: colors.textTertiary,
    },

    /* Header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    headerRight: {
      width: 60,
      alignItems: "flex-end",
    },
    countBadge: {
      fontSize: 11,
      color: colors.accent,
      fontWeight: "600",
    },

    /* Summary */
    summaryStrip: {
      flexDirection: "row",
      backgroundColor: colors.card,
      marginHorizontal: 14,
      marginTop: 14,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    summaryItem: {
      flex: 1,
      alignItems: "center",
    },
    summaryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginBottom: 6,
    },
    summaryLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
      marginBottom: 2,
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: "800",
    },
    summaryDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.skeleton,
      marginHorizontal: 12,
    },

    /* Error */
    errorBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.errorBg,
      borderRadius: 10,
      marginHorizontal: 14,
      marginTop: 10,
      padding: 10,
      gap: 8,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: "500",
    },

    /* Empty */
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
    },
    emptyIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.inputBg,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: "center",
      lineHeight: 19,
    },
    emptyRefresh: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 20,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "#b38604",
      gap: 6,
    },
    emptyRefreshText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },

    /* List */
    listContent: {
      padding: 14,
      paddingBottom: 24,
    },

    /* Card */
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    billIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.warningBg,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    billLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 3,
      gap: 4,
    },
    metaText: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    metaDot: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    amountWrap: {
      alignItems: "flex-end",
    },
    amount: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.accent,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      marginTop: 4,
      gap: 3,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "700",
    },

    /* Reference row */
    refRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
      gap: 6,
    },
    refLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    refValue: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      flex: 1,
    },

    /* Receipt Modal */
    receiptModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    receiptModalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "90%",
      paddingBottom: 40,
    },
    receiptCloseBtn: {
      alignSelf: "flex-end",
      padding: 16,
      zIndex: 10,
    },
    receiptScroll: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    receiptContent: {
      backgroundColor: "#f5f5f5",
      borderRadius: 8,
      padding: 16,
      alignItems: "center",
    },

    /* Receipt Styles */
    titleRow: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    titleSubtitle: {
      fontSize: 9,
      color: "#666",
      letterSpacing: 1,
    },
    receiptTitle: {
      textAlign: "center",
      fontSize: 16,
      fontWeight: "bold",
      marginBottom: 2,
      letterSpacing: 2,
      color: "#333",
    },
    dashedLine: {
      textAlign: "center",
      fontSize: 10,
      color: "#999",
      marginBottom: 10,
      letterSpacing: 1,
      width: "100%",
    },
    headerInfo: {
      marginBottom: 2,
      width: "100%",
    },
    headerRow: {
      flexDirection: "column",
      marginBottom: 2,
      justifyContent: "space-between",
      width: "100%",
    },
    headerLabel: {
      fontSize: 9,
      color: "#333",
      flex: 0.5,
    },
    headerLabelRight: {
      fontSize: 9,
      color: "#333",
      flex: 0.5,
    },
    dateSection: {
      marginBottom: 10,
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "flex-end",
      width: "100%",
    },
    dateText: {
      fontSize: 9,
      color: "#333",
      textAlign: "right",
    },
    sectionTitle: {
      fontSize: 9,
      fontWeight: "600",
      marginBottom: 4,
      color: "#333",
      width: "100%",
    },
    clientInfo: {
      marginBottom: 10,
      width: "100%",
    },
    infoRow: {
      flexDirection: "row",
      marginBottom: 1,
      width: "100%",
    },
    infoLabel: {
      fontSize: 8,
      color: "#333",
      width: "40%",
    },
    infoValue: {
      fontSize: 8,
      color: "#333",
    },
    costBreakdown: {
      marginBottom: 8,
      paddingBottom: 8,
      width: "100%",
    },
    costRow: {
      flexDirection: "row",
      marginBottom: 3,
      alignItems: "center",
      width: "100%",
    },
    costLabel: {
      fontSize: 8,
      color: "#333",
      fontWeight: "600",
      flex: 0.3,
    },
    costDots: {
      fontSize: 8,
      color: "#999",
      flex: 1,
      letterSpacing: 1,
    },
    costAmount: {
      fontSize: 8,
      color: "#333",
      textAlign: "right",
      width: "25%",
    },
    totalSection: {
      marginBottom: 8,
      width: "100%",
    },
    totalRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
      width: "100%",
    },
    totalLabel: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#333",
      flex: 0.3,
    },
    totalDots: {
      fontSize: 8,
      color: "#999",
      flex: 1,
      letterSpacing: 1,
    },
    totalAmount: {
      fontSize: 11,
      fontWeight: "bold",
      color: "#333",
      textAlign: "right",
      width: "28%",
    },
    barcodeSection: {
      marginBottom: 8,
      alignItems: "center",
      justifyContent: "center",
      height: 45,
    },
    barcode: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "center",
      marginBottom: 2,
    },
    barcodeNumber: {
      fontSize: 7,
      color: "#333",
      letterSpacing: 1.5,
      marginTop: 2,
    },
    thankYouText: {
      textAlign: "center",
      fontSize: 11,
      fontWeight: "bold",
      marginBottom: 6,
      letterSpacing: 1,
      color: "#333",
    },
    footerText: {
      textAlign: "center",
      fontSize: 7,
      color: "#666",
      marginBottom: 1,
    },
    websiteText: {
      textAlign: "center",
      fontSize: 7,
      color: "#999",
      marginTop: 2,
    },
  });

export default PaymentHistoryScreen;
