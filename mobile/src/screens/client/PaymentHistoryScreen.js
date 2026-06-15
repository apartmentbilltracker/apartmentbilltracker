import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  apiService,
  roomService,
  billingCycleService,
} from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
import { AuthContext } from "../../context/AuthContext";
import {
  PAYMENT_BILL_TYPE_ORDER,
  buildBillSharesFromCharge,
  findUserCharge,
  normalizePaymentBillType,
} from "../../utils/paymentAmounts";
import HomeSpaceLoader from "../../components/SpaceLoader";

const PAYMENT_GROUP_WINDOW_MS = 5 * 60 * 1000;

const PaymentHistoryScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const authContext = useContext(AuthContext);
  const user = authContext?.state?.user;
  const userId = user?.id || user?._id;

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
  const [expandedPayments, setExpandedPayments] = useState({});
  const [billingSharesByCycleKey, setBillingSharesByCycleKey] = useState({});

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
        const roomResponse = await roomService.getRoomById(roomId);
        const room =
          roomResponse?.data?.room ||
          roomResponse?.room ||
          roomResponse?.data ||
          roomResponse;
        setReceiptRoomData(room);

        if (room?.members && Array.isArray(room.members)) {
          const member = room.members.find(
            (m) =>
              String(m.user?.id || m.user?._id || m.user) === String(userId),
          );
          setReceiptMemberInfo(member || null);
        }

        let historicalCycle = null;
        const cycles = await billingCycleService.getBillingCycles(roomId);
        const cycleList = Array.isArray(cycles)
          ? cycles
          : cycles?.billingCycles || cycles?.data || [];

        const selectedCycleStart =
          selectedPayment.billing_cycle_start ||
          selectedPayment.billingCycleStart;
        const selectedCycleEnd =
          selectedPayment.billing_cycle_end || selectedPayment.billingCycleEnd;

        if (selectedCycleStart && selectedCycleEnd) {
          historicalCycle = cycleList.find((cycle) => {
            const cycleStart = cycle.start_date || cycle.startDate;
            const cycleEnd = cycle.end_date || cycle.endDate;
            return (
              String(cycleStart).slice(0, 10) ===
                String(selectedCycleStart).slice(0, 10) &&
              String(cycleEnd).slice(0, 10) ===
                String(selectedCycleEnd).slice(0, 10)
            );
          });
        }

        if (!historicalCycle && selectedPayment.payment_date) {
          const paymentDate = new Date(selectedPayment.payment_date);
          const closedCycles = cycleList.filter(
            (cycle) => cycle.status !== "active" && cycle.status !== "pending",
          );
          historicalCycle = closedCycles.find((cycle) => {
            const cycleStart = new Date(cycle.start_date || cycle.startDate);
            const cycleEnd = new Date(cycle.end_date || cycle.endDate);
            return paymentDate >= cycleStart && paymentDate <= cycleEnd;
          });
        }

        setReceiptBillingData(historicalCycle || null);

        if (historicalCycle?.memberCharges?.length > 0) {
          const userCharge = findUserCharge(
            historicalCycle.memberCharges,
            userId,
          );
          setReceiptUserCharge(userCharge || null);
        } else {
          setReceiptUserCharge(null);
        }
      } catch (err) {
        console.error("Error fetching receipt data:", err);
      }
    };

    fetchReceiptData();
  }, [selectedPayment, roomId, userId]);

  const fetchPaymentHistory = async () => {
    try {
      setError("");
      const [response, cycleResponse] = await Promise.all([
        apiService.getTransactions(roomId),
        billingCycleService.getBillingCycles(roomId).catch(() => null),
      ]);
      if (response.success) {
        const validTransactions = (response.transactions || []).filter(
          (transaction) =>
            transaction.status !== "cancelled" &&
            transaction.status !== "deleted",
        );
        setPayments(validTransactions);

        const cycleList = Array.isArray(cycleResponse)
          ? cycleResponse
          : cycleResponse?.billingCycles || cycleResponse?.data || [];
        const sharesByKey = {};

        cycleList.forEach((cycle) => {
          const memberCharges =
            typeof cycle.memberCharges === "string"
              ? parseCustomCharges(cycle.memberCharges)
              : typeof cycle.member_charges === "string"
                ? parseCustomCharges(cycle.member_charges)
                : cycle.memberCharges || cycle.member_charges || [];
          const charge = findUserCharge(memberCharges, userId);
          const shares = buildBillSharesFromCharge(charge);
          if (!shares) return;

          const cycleId = cycle.id || cycle._id;
          const cycleStart = cycle.start_date || cycle.startDate;
          const cycleEnd = cycle.end_date || cycle.endDate;
          const keys = [
            cycleId,
            [normalizeCycleDateKey(cycleStart), normalizeCycleDateKey(cycleEnd)]
              .filter(Boolean)
              .join(":"),
          ].filter(Boolean);

          keys.forEach((key) => {
            sharesByKey[String(key)] = shares;
          });
        });

        setBillingSharesByCycleKey(sharesByKey);
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
  }, [roomId, userId]);

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

  const formatCurrency = (value) =>
    "\u20B1" +
    (parseFloat(value) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const parseCustomCharges = (charges) => {
    if (!charges) return [];
    if (Array.isArray(charges)) return charges;
    if (typeof charges === "string") {
      try {
        return JSON.parse(charges);
      } catch (_) {
        return [];
      }
    }
    return [];
  };

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
      case "custom_charges":
      case "customCharges":
        return "pricetag-outline";
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
      custom_charges: "Additional Charges",
      customCharges: "Additional Charges",
    };
    return (
      labels[type] ||
      (type ? type.charAt(0).toUpperCase() + type.slice(1) : "Payment")
    );
  };

  const getBillTypeColors = (type) => {
    switch (type) {
      case "rent":
        return { bg: colors.accentSurface, color: colors.accent };
      case "electricity":
        return { bg: colors.warningBg, color: colors.electricityColor };
      case "water":
        return { bg: colors.infoBg, color: colors.waterColor };
      case "internet":
        return { bg: colors.accentLight, color: colors.internetColor };
      default:
        return { bg: colors.cardAlt, color: colors.textSecondary };
    }
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
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
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
          color: colors.warning,
          bg: colors.warningBg,
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

  const getPaymentAmount = (payment) => {
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

      if (key && key in payment.billBreakdown) {
        const breakdownValue = payment.billBreakdown[key];
        if (breakdownValue && typeof breakdownValue !== "boolean") {
          return parseFloat(breakdownValue) || 0;
        }
      }
    }
    return parseFloat(payment.amount) || 0;
  };

  const getReference = (payment) =>
    payment.referenceNumber ||
    payment.reference ||
    payment.transactionId ||
    payment.gcash?.referenceNumber ||
    payment.bankTransfer?.referenceNumber ||
    payment.cash?.receiptNumber ||
    payment._id ||
    null;

  const getPaymentDateValue = (payment) =>
    payment.transactionDate || payment.payment_date || payment.created_at;

  const getPaymentId = (payment, index = 0) =>
    String(payment.id || payment._id || payment.transactionId || index);

  const normalizeCycleDateKey = (date) =>
    date ? String(date).slice(0, 10) : "";

  const getBillingCycleKey = (payment) =>
    payment.billingCycleId ||
    payment.billing_cycle_id ||
    payment.billingCycle?._id ||
    payment.billingCycle?.id ||
    [
      normalizeCycleDateKey(
        payment.billingCycleStart || payment.billing_cycle_start,
      ),
      normalizeCycleDateKey(
        payment.billingCycleEnd || payment.billing_cycle_end,
      ),
    ]
      .filter(Boolean)
      .join(":") ||
    "active";

  const getBillBreakdownKey = (billType) =>
    billType === "custom_charges" ? "customCharges" : billType;

  const getBillShareKey = (billType) => {
    const normalized = normalizePaymentBillType(billType);
    if (normalized === "custom_charges") return "customCharges";
    return normalized;
  };

  const getCycleShareAmount = (payment, billType) => {
    const shares = billingSharesByCycleKey[String(getBillingCycleKey(payment))];
    const shareKey = getBillShareKey(billType);
    const value = Number(shares?.[shareKey]);
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  const getPaymentUserKey = (payment) =>
    payment.paidBy ||
    payment.paid_by ||
    payment.userId ||
    payment.user?._id ||
    payment.user?.id ||
    "current";

  const getCashReceiptKey = (payment) => {
    const receipt = payment.cash?.receiptNumber || payment.receiptNumber;
    if (receipt) return receipt;

    const reference = getReference(payment);
    if (payment.paymentMethod === "cash" && reference) {
      return String(reference).split("|")[0].trim();
    }

    return null;
  };

  const getPaymentBatchKey = (payment) => {
    const reference = getReference(payment);
    if (!reference) return null;

    const match = String(reference).match(/Batch:([^|]+)/i);
    return match?.[1]?.trim() || null;
  };

  const getBatchGroupKey = (payment, index) => {
    const explicitBatch = getPaymentBatchKey(payment);
    if (explicitBatch) {
      return `batch:${payment.paymentMethod || "payment"}:${getBillingCycleKey(
        payment,
      )}:${getPaymentUserKey(payment)}:${explicitBatch}`;
    }

    const receipt = getCashReceiptKey(payment);
    const cycleKey = getBillingCycleKey(payment);
    const method = payment.paymentMethod || "payment";

    if (receipt) {
      return `receipt:${method}:${cycleKey}:${receipt}`;
    }

    const rawDate = getPaymentDateValue(payment);
    const parsedDate = rawDate ? new Date(rawDate) : null;
    const windowKey =
      parsedDate && !Number.isNaN(parsedDate.getTime())
        ? Math.floor(parsedDate.getTime() / PAYMENT_GROUP_WINDOW_MS)
        : getPaymentId(payment, index);

    return [
      "batch",
      method,
      payment.status || "unknown",
      cycleKey,
      getPaymentUserKey(payment),
      windowKey,
    ].join(":");
  };

  const buildGroupedPayment = (items, key) => {
    const sortedItems = items.slice().sort((a, b) => {
      const aType = normalizePaymentBillType(a.billType) || a.billType;
      const bType = normalizePaymentBillType(b.billType) || b.billType;
      const aOrder = PAYMENT_BILL_TYPE_ORDER.indexOf(aType);
      const bOrder = PAYMENT_BILL_TYPE_ORDER.indexOf(bType);
      return (aOrder === -1 ? 99 : aOrder) - (bOrder === -1 ? 99 : bOrder);
    });
    const getDetailAmount = (item) =>
      sortedItems.length > 1
        ? (getCycleShareAmount(item, item.billType) ?? getPaymentAmount(item))
        : getPaymentAmount(item);
    const totalAmount = sortedItems.reduce(
      (sum, item) => sum + getDetailAmount(item),
      0,
    );
    const billDetails = sortedItems.map((item) => ({
      type: normalizePaymentBillType(item.billType) || item.billType,
      amount: getDetailAmount(item),
      payment: item,
    }));
    const billBreakdown = billDetails.reduce(
      (breakdown, detail) => ({
        ...breakdown,
        [getBillBreakdownKey(detail.type)]: detail.amount,
      }),
      { total: totalAmount },
    );

    return {
      ...sortedItems[0],
      key,
      items: sortedItems,
      isGrouped: sortedItems.length > 1,
      primaryPayment: {
        ...sortedItems[0],
        items: sortedItems,
        isGrouped: sortedItems.length > 1,
        billDetails,
        amount: totalAmount,
        billType: sortedItems.length > 1 ? "total" : sortedItems[0].billType,
        billBreakdown:
          sortedItems.length > 1 ? billBreakdown : sortedItems[0].billBreakdown,
        billing_cycle_start:
          sortedItems[0].billing_cycle_start ||
          sortedItems[0].billingCycleStart,
        billing_cycle_end:
          sortedItems[0].billing_cycle_end || sortedItems[0].billingCycleEnd,
        billingCycleStart:
          sortedItems[0].billingCycleStart ||
          sortedItems[0].billing_cycle_start,
        billingCycleEnd:
          sortedItems[0].billingCycleEnd || sortedItems[0].billing_cycle_end,
      },
      billType: sortedItems.length > 1 ? "total" : sortedItems[0].billType,
      amount: totalAmount,
      billDetails,
      transactionDate: getPaymentDateValue(sortedItems[0]),
    };
  };

  const getRoomAddress = () => receiptRoomData?.address || "Apartment Address";

  const getMemberSinceDate = () => {
    const joinedDate =
      receiptMemberInfo?.joinedAt || receiptMemberInfo?.joined_at;
    if (!joinedDate) return "N/A";
    return new Date(joinedDate).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getMemberStatus = () => {
    if (receiptUserCharge) {
      return receiptUserCharge.isPayer !== false &&
        receiptUserCharge.is_payer !== false
        ? "Payor"
        : "Non-Payor";
    }
    return receiptMemberInfo?.isPayer ? "Payor" : "Non-Payor";
  };

  const getReceiptTitle = () => {
    const method = selectedPayment?.paymentMethod || "";
    if (method.includes("bank")) return "Bank Transfer Receipt";
    if (method.includes("gcash")) return "GCash Receipt";
    if (method.includes("cash")) return "Cash Receipt";
    return "Payment Receipt";
  };

  const paymentGroups = useMemo(() => {
    const groups = new Map();

    payments.forEach((payment, index) => {
      const key = getBatchGroupKey(payment, index);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(payment);
    });

    return Array.from(groups.entries())
      .map(([key, items]) => buildGroupedPayment(items, key))
      .sort(
        (a, b) =>
          new Date(getPaymentDateValue(b) || 0) -
          new Date(getPaymentDateValue(a) || 0),
      );
  }, [payments, billingSharesByCycleKey]);

  const totalPaid = paymentGroups
    .filter(
      (payment) =>
        payment.status === "verified" || payment.status === "completed",
    )
    .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  const totalPending = paymentGroups
    .filter(
      (payment) =>
        payment.status === "pending" || payment.status === "submitted",
    )
    .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  const verifiedCount = paymentGroups.filter(
    (payment) =>
      payment.status === "verified" || payment.status === "completed",
  ).length;
  const pendingCount = paymentGroups.filter(
    (payment) => payment.status === "pending" || payment.status === "submitted",
  ).length;
  const rejectedCount = paymentGroups.filter(
    (payment) => payment.status === "rejected",
  ).length;
  const latestTransaction = paymentGroups
    .slice()
    .sort(
      (a, b) =>
        new Date(getPaymentDateValue(b) || 0) -
        new Date(getPaymentDateValue(a) || 0),
    )[0];

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerShell}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color={colors.headerText} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Payment History</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {roomName}
              </Text>
            </View>
            <View style={styles.headerRight} />
          </View>
        </View>
        <View style={styles.centerContent}>
          <View style={styles.centerLoader}>
            <HomeSpaceLoader />
          </View>
        </View>
      </View>
    );
  }

  const renderPayment = ({ item: payment }) => {
    const status = getStatusConfig(payment.status);
    const reference = getReference(payment);
    const billColors = getBillTypeColors(payment.billType);
    const displayAmount = payment.isGrouped
      ? parseFloat(payment.amount) || 0
      : getPaymentAmount(payment);
    const transactionDate = getPaymentDateValue(payment);
    const isExpanded = payment.isGrouped
      ? expandedPayments[payment.key] !== false
      : !!expandedPayments[payment.key];
    const billCount = payment.billDetails?.length || 1;
    const toggleExpanded = () => {
      setExpandedPayments((prev) => ({
        ...prev,
        [payment.key]: !isExpanded,
      }));
    };
    const openReceipt = () =>
      setSelectedPayment(payment.primaryPayment || payment);

    return (
      <View style={styles.card}>
        <View style={styles.cardAccent} />

        <View style={styles.cardTop}>
          <View
            style={[styles.billIconWrap, { backgroundColor: billColors.bg }]}
          >
            <Ionicons
              name={getBillIcon(payment.billType)}
              size={18}
              color={billColors.color}
            />
          </View>

          <View style={styles.cardCopy}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.billLabel}>
                {payment.isGrouped
                  ? `${billCount} bills paid`
                  : getBillLabel(payment.billType)}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                <Ionicons name={status.icon} size={11} color={status.color} />
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </View>

            <Text style={styles.cardSubtitle}>
              {payment.isGrouped
                ? "Full payment breakdown"
                : `${formatMethod(payment.paymentMethod)} payment`}
            </Text>
            <Text style={styles.amount}>{formatCurrency(displayAmount)}</Text>

            <View style={styles.metaRow}>
              <Ionicons
                name="calendar-outline"
                size={12}
                color={colors.textSecondary}
              />
              <Text style={styles.metaText}>{formatDate(transactionDate)}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{formatTime(transactionDate)}</Text>
            </View>
          </View>

          <View style={styles.amountWrap}>
            <View style={styles.methodPill}>
              <Ionicons
                name={getMethodIcon(payment.paymentMethod)}
                size={12}
                color={colors.accent}
              />
              <Text style={styles.methodPillText}>
                {formatMethod(payment.paymentMethod)}
              </Text>
            </View>
            {payment.isGrouped ? (
              <TouchableOpacity
                style={styles.iconActionButton}
                onPress={toggleExpanded}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.accent}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.refRow}>
            <Ionicons
              name={reference ? "document-text-outline" : "receipt-outline"}
              size={13}
              color={colors.textSecondary}
            />
            {reference ? <Text style={styles.refLabel}>Ref</Text> : null}
            <Text style={styles.refValue} numberOfLines={1}>
              {reference || "No reference number"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.inlineMetaPill}
            onPress={openReceipt}
            activeOpacity={0.75}
          >
            <Ionicons
              name={
                payment.bankTransfer?.bankName && !payment.isGrouped
                  ? "business-outline"
                  : "receipt-outline"
              }
              size={12}
              color={
                payment.bankTransfer?.bankName && !payment.isGrouped
                  ? colors.textSecondary
                  : colors.accent
              }
            />
            <Text style={styles.inlineMetaPillText}>View receipt</Text>
          </TouchableOpacity>
        </View>

        {payment.isGrouped && isExpanded ? (
          <View style={styles.billBreakdownPanel}>
            {payment.billDetails.map((detail, index) => {
              const detailColors = getBillTypeColors(detail.type);
              return (
                <View
                  key={`${detail.type}-${index}`}
                  style={[
                    styles.billBreakdownRow,
                    index < payment.billDetails.length - 1 &&
                      styles.billBreakdownBorder,
                  ]}
                >
                  <View style={styles.billBreakdownLeft}>
                    <View
                      style={[
                        styles.billBreakdownIcon,
                        { backgroundColor: detailColors.bg },
                      ]}
                    >
                      <Ionicons
                        name={getBillIcon(detail.type)}
                        size={14}
                        color={detailColors.color}
                      />
                    </View>
                    <Text style={styles.billBreakdownLabel}>
                      {getBillLabel(detail.type)}
                    </Text>
                  </View>
                  <Text style={styles.billBreakdownAmount}>
                    {formatCurrency(detail.amount)}
                  </Text>
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.receiptLinkButton}
              onPress={openReceipt}
              activeOpacity={0.75}
            >
              <Ionicons
                name="receipt-outline"
                size={14}
                color={colors.accent}
              />
              <Text style={styles.receiptLinkText}>View receipt</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {payment.bankTransfer?.bankName ? (
          <View style={styles.bankRow}>
            <Ionicons
              name="business-outline"
              size={13}
              color={colors.textSecondary}
            />
            <Text style={styles.refLabel}>Bank</Text>
            <Text style={styles.refValue}>{payment.bankTransfer.bankName}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderReceiptModal = () => {
    if (!selectedPayment) return null;

    const payment = selectedPayment;
    const reference = getReference(payment) || "N/A";
    const status = getStatusConfig(payment.status);
    const paymentDate =
      payment.transactionDate || payment.payment_date || payment.created_at;
    const breakdownCharges = parseCustomCharges(
      receiptBillingData?.customCharges,
    );

    const billAmounts = {
      rent:
        payment.billBreakdown?.rent ||
        receiptUserCharge?.rentShare ||
        receiptUserCharge?.rent_share ||
        0,
      electricity:
        payment.billBreakdown?.electricity ||
        receiptUserCharge?.electricityShare ||
        receiptUserCharge?.electricity_share ||
        0,
      internet:
        payment.billBreakdown?.internet ||
        receiptUserCharge?.internetShare ||
        receiptUserCharge?.internet_share ||
        0,
      water:
        payment.billBreakdown?.water ||
        (receiptUserCharge?.isPayer !== false &&
        receiptUserCharge?.is_payer !== false
          ? receiptUserCharge?.waterBillShare ||
            receiptUserCharge?.water_bill_share
          : receiptUserCharge?.waterOwn || receiptUserCharge?.water_own) ||
        0,
      customCharges:
        payment.billBreakdown?.customCharges ||
        receiptUserCharge?.customChargesShare ||
        receiptUserCharge?.custom_charges_share ||
        0,
      total:
        payment.billBreakdown?.total ||
        receiptUserCharge?.totalDue ||
        receiptUserCharge?.total_due ||
        parseFloat(payment.amount) ||
        0,
    };

    const shouldShowBill = (billKey) => {
      if (payment.billBreakdown) {
        const value = payment.billBreakdown[billKey];
        return value === true || (Number(value) || 0) > 0;
      }

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

      return true;
    };

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

    billAmounts.total = calculatePaidTotal() || parseFloat(payment.amount) || 0;

    const receiptBreakdown = [
      {
        key: "rent",
        label: "Rent",
        value: billAmounts.rent,
        visible: shouldShowBill("rent") && billAmounts.rent > 0,
      },
      {
        key: "electricity",
        label: "Electricity",
        value: billAmounts.electricity,
        visible: shouldShowBill("electricity") && billAmounts.electricity > 0,
      },
      {
        key: "internet",
        label: "Internet",
        value: billAmounts.internet,
        visible: shouldShowBill("internet") && billAmounts.internet > 0,
      },
      {
        key: "water",
        label: "Water",
        value: billAmounts.water,
        visible: shouldShowBill("water") && billAmounts.water > 0,
      },
      {
        key: "customCharges",
        label: "Additional Charges",
        value: billAmounts.customCharges,
        visible:
          shouldShowBill("customCharges") && billAmounts.customCharges > 0,
      },
    ].filter((item) => item.visible);

    return (
      <Modal
        visible={Boolean(selectedPayment)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPayment(null)}
      >
        <View style={styles.receiptModalOverlay}>
          <View style={styles.receiptModalContent}>
            <View style={styles.receiptHandleWrap}>
              <View style={styles.receiptHandle} />
            </View>

            <View style={styles.receiptHeader}>
              <View style={styles.receiptHeaderCopy}>
                <Text style={styles.receiptModalTitle}>
                  {getReceiptTitle()}
                </Text>
                <Text style={styles.receiptModalSubtitle}>
                  {formatDate(paymentDate)} at {formatTime(paymentDate)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.receiptCloseBtn}
                onPress={() => setSelectedPayment(null)}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollViewWithDetection
              style={styles.receiptScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.receiptScrollContent}
            >
              <View style={styles.receiptHero}>
                <View
                  style={[
                    styles.receiptStatusPill,
                    { backgroundColor: status.bg },
                  ]}
                >
                  <Ionicons name={status.icon} size={12} color={status.color} />
                  <Text
                    style={[
                      styles.receiptStatusPillText,
                      { color: status.color },
                    ]}
                  >
                    {status.label}
                  </Text>
                </View>
                <Text style={styles.receiptHeroAmount}>
                  {formatCurrency(billAmounts.total)}
                </Text>
                <Text style={styles.receiptHeroSubtext}>
                  {getBillLabel(payment.billType)} paid via{" "}
                  {formatMethod(payment.paymentMethod)}
                </Text>
              </View>

              <View style={styles.receiptCard}>
                <Text style={styles.receiptSectionTitle}>Payment Info</Text>
                <View style={styles.receiptInfoRow}>
                  <Text style={styles.receiptInfoLabel}>Reference</Text>
                  <Text style={styles.receiptInfoValue}>{reference}</Text>
                </View>
                <View style={styles.receiptInfoRow}>
                  <Text style={styles.receiptInfoLabel}>Room</Text>
                  <Text style={styles.receiptInfoValue}>{roomName}</Text>
                </View>
                <View style={styles.receiptInfoRow}>
                  <Text style={styles.receiptInfoLabel}>Address</Text>
                  <Text style={styles.receiptInfoValue}>
                    {getRoomAddress()}
                  </Text>
                </View>
                <View style={styles.receiptInfoRow}>
                  <Text style={styles.receiptInfoLabel}>Member Status</Text>
                  <Text style={styles.receiptInfoValue}>
                    {getMemberStatus()}
                  </Text>
                </View>
                <View style={styles.receiptInfoRow}>
                  <Text style={styles.receiptInfoLabel}>Joined</Text>
                  <Text style={styles.receiptInfoValue}>
                    {getMemberSinceDate()}
                  </Text>
                </View>
              </View>

              <View style={styles.receiptCard}>
                <Text style={styles.receiptSectionTitle}>Paid Breakdown</Text>
                {receiptBreakdown.length > 0 ? (
                  receiptBreakdown.map((item, index) => {
                    const billColors = getBillTypeColors(item.key);
                    return (
                      <View
                        key={item.key}
                        style={[
                          styles.receiptBreakdownRow,
                          index < receiptBreakdown.length - 1 &&
                            styles.receiptBreakdownRowBorder,
                        ]}
                      >
                        <View style={styles.receiptBreakdownLeft}>
                          <View
                            style={[
                              styles.receiptBreakdownIcon,
                              { backgroundColor: billColors.bg },
                            ]}
                          >
                            <Ionicons
                              name={getBillIcon(item.key)}
                              size={14}
                              color={billColors.color}
                            />
                          </View>
                          <Text style={styles.receiptBreakdownLabel}>
                            {item.label}
                          </Text>
                        </View>
                        <Text style={styles.receiptBreakdownValue}>
                          {formatCurrency(item.value)}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.receiptEmptyText}>
                    No bill-level breakdown was stored for this payment.
                  </Text>
                )}

                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>Total Paid</Text>
                  <Text style={styles.receiptTotalValue}>
                    {formatCurrency(billAmounts.total)}
                  </Text>
                </View>
              </View>

              {breakdownCharges.length > 0 &&
              shouldShowBill("customCharges") ? (
                <View style={styles.receiptCard}>
                  <Text style={styles.receiptSectionTitle}>
                    Additional Charges
                  </Text>
                  {breakdownCharges.map((charge, index) => (
                    <View
                      key={`${charge.name || "charge"}-${index}`}
                      style={[
                        styles.receiptInfoRow,
                        index < breakdownCharges.length - 1 &&
                          styles.receiptBreakdownRowBorder,
                      ]}
                    >
                      <Text style={styles.receiptInfoLabel}>
                        {charge.name || "Charge"}
                      </Text>
                      <Text style={styles.receiptInfoValue}>
                        {formatCurrency(charge.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.receiptCard}>
                <Text style={styles.receiptSectionTitle}>Billing Context</Text>
                <View style={styles.receiptInfoRow}>
                  <Text style={styles.receiptInfoLabel}>Billing Period</Text>
                  <Text style={styles.receiptInfoValue}>
                    {selectedPayment.billing_cycle_start ||
                    selectedPayment.billingCycleStart
                      ? `${formatDate(
                          selectedPayment.billing_cycle_start ||
                            selectedPayment.billingCycleStart,
                        )} to ${formatDate(
                          selectedPayment.billing_cycle_end ||
                            selectedPayment.billingCycleEnd,
                        )}`
                      : "Not available"}
                  </Text>
                </View>
                <View style={styles.receiptInfoRow}>
                  <Text style={styles.receiptInfoLabel}>Cycle Status</Text>
                  <Text style={styles.receiptInfoValue}>
                    {receiptBillingData?.status || "Historical record"}
                  </Text>
                </View>
                {receiptUserCharge ? (
                  <View style={styles.receiptInfoRow}>
                    <Text style={styles.receiptInfoLabel}>Your Share</Text>
                    <Text style={styles.receiptInfoValue}>
                      {formatCurrency(
                        receiptUserCharge.totalDue ||
                          receiptUserCharge.total_due ||
                          0,
                      )}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollViewWithDetection>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <ScrollViewWithDetection
        style={styles.container}
        contentContainerStyle={styles.screenScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.headerShell}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color={colors.headerText} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Payment History</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {roomName}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.countBadge}>
                {paymentGroups.length}{" "}
                {paymentGroups.length === 1 ? "record" : "records"}
              </Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>Payment overview</Text>
                <Text style={styles.heroTitle}>{roomName}</Text>
                <Text style={styles.heroSubtext}>
                  Review verified, pending, and rejected transactions for this
                  room in one place.
                </Text>
              </View>
              <View style={styles.heroHighlight}>
                <Text style={styles.heroHighlightLabel}>Latest payment</Text>
                <Text style={styles.heroHighlightValue}>
                  {latestTransaction
                    ? formatCurrency(parseFloat(latestTransaction.amount) || 0)
                    : formatCurrency(0)}
                </Text>
                <Text style={styles.heroHighlightSubtext}>
                  {latestTransaction
                    ? formatDate(getPaymentDateValue(latestTransaction))
                    : "No payments yet"}
                </Text>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.summaryCardValue}>
                  {formatCurrency(totalPaid)}
                </Text>
                <Text style={styles.summaryCardLabel}>
                  Verified ({verifiedCount})
                </Text>
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={colors.warning}
                  />
                </View>
                <Text style={styles.summaryCardValue}>
                  {formatCurrency(totalPending)}
                </Text>
                <Text style={styles.summaryCardLabel}>
                  Pending ({pendingCount})
                </Text>
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={colors.error}
                  />
                </View>
                <Text style={styles.summaryCardValue}>{rejectedCount}</Text>
                <Text style={styles.summaryCardLabel}>Rejected</Text>
              </View>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBar}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={colors.error}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {payments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="receipt-outline"
                size={42}
                color={colors.textSecondary}
              />
            </View>
            <Text style={styles.emptyTitle}>No Payments Yet</Text>
            <Text style={styles.emptyText}>
              Completed and submitted payments will appear here once you start
              transacting for this room.
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
          <View style={styles.listContent}>
            {paymentGroups.map((payment, index) => (
              <React.Fragment
                key={String(
                  payment.key ||
                    payment.id ||
                    payment._id ||
                    payment.transactionId ||
                    index,
                )}
              >
                {renderPayment({ item: payment, index })}
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollViewWithDetection>
      {renderReceiptModal()}
    </>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    screenScrollContent: {
      paddingBottom: 28,
    },
    centerContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 13,
      color: colors.textTertiary,
    },
    headerShell: {
      backgroundColor: colors.headerBg,
      paddingBottom: 26,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 18,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.12)",
      justifyContent: "center",
      alignItems: "center",
    },
    headerCenter: {
      flex: 1,
      paddingHorizontal: 14,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.headerText,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 12,
      color: "rgba(255,255,255,0.72)",
      marginTop: 2,
    },
    headerRight: {
      minWidth: 72,
      alignItems: "flex-end",
    },
    countBadge: {
      fontSize: 11,
      color: colors.textOnAccent,
      fontWeight: "700",
    },
    heroCard: {
      marginHorizontal: 16,
      marginTop: 2,
      padding: 18,
      borderRadius: 24,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
    },
    heroTopRow: {
      flexDirection: "row",
      gap: 14,
    },
    heroCopy: {
      flex: 1,
    },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: "rgba(255,255,255,0.72)",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    heroTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.headerText,
      letterSpacing: -0.3,
    },
    heroSubtext: {
      fontSize: 13,
      color: "rgba(255,255,255,0.8)",
      lineHeight: 19,
      marginTop: 8,
    },
    heroHighlight: {
      minWidth: 118,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 14,
      justifyContent: "center",
      alignItems: "flex-end",
    },
    heroHighlightLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: "rgba(255,255,255,0.72)",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    heroHighlightValue: {
      fontSize: 19,
      fontWeight: "900",
      color: colors.headerText,
      letterSpacing: -0.4,
      marginTop: 8,
    },
    heroHighlightSubtext: {
      fontSize: 11,
      color: "rgba(255,255,255,0.72)",
      marginTop: 6,
      textAlign: "right",
    },
    summaryGrid: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 10,
      alignItems: "center",
    },
    summaryIconWrap: {
      marginBottom: 8,
    },
    summaryCardValue: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.headerText,
      textAlign: "center",
    },
    summaryCardLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: "rgba(255,255,255,0.72)",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 4,
      textAlign: "center",
    },
    errorBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.errorBg,
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 14,
      padding: 12,
      gap: 8,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: "600",
      flex: 1,
    },
    emptyContainer: {
      minHeight: 360,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
    },
    emptyIconWrap: {
      width: 82,
      height: 82,
      borderRadius: 28,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "800",
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
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: colors.accentLight,
      gap: 6,
    },
    emptyRefreshText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
    },
    listContent: {
      padding: 16,
      paddingTop: 18,
      paddingBottom: 28,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 18,
      marginBottom: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
      overflow: "hidden",
    },
    cardAccent: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: colors.accent,
    },
    cardTop: {
      flexDirection: "row",
      gap: 12,
    },
    billIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    cardCopy: {
      flex: 1,
    },
    cardTitleRow: {
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
    },
    billLabel: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
      flexShrink: 1,
    },
    cardSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    amount: {
      fontSize: 21,
      fontWeight: "900",
      color: colors.accent,
      letterSpacing: -0.4,
      marginTop: 10,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      gap: 4,
      flexWrap: "wrap",
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
      justifyContent: "space-between",
      marginLeft: 6,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      gap: 4,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "800",
    },
    methodPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.accentLight,
      gap: 5,
    },
    methodPillText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.accent,
    },
    iconActionButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.accentLight,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 10,
    },
    cardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    refRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 1,
    },
    refLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "700",
    },
    refValue: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      flex: 1,
    },
    inlineMetaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.cardAlt,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    inlineMetaPillText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    bankRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    billBreakdownPanel: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    billBreakdownRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      paddingVertical: 9,
    },
    billBreakdownBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    billBreakdownLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      flex: 1,
    },
    billBreakdownIcon: {
      width: 28,
      height: 28,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    billBreakdownLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    billBreakdownAmount: {
      fontSize: 13,
      fontWeight: "900",
      color: colors.text,
    },
    receiptLinkButton: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 12,
      paddingVertical: 10,
      backgroundColor: colors.accentLight,
    },
    receiptLinkText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.accent,
    },
    receiptModalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "flex-end",
    },
    receiptModalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      height: "88%",
      maxHeight: "92%",
      overflow: "hidden",
    },
    receiptHandleWrap: {
      alignItems: "center",
      paddingTop: 10,
      paddingBottom: 4,
    },
    receiptHandle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.skeleton,
    },
    receiptHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    receiptHeaderCopy: {
      flex: 1,
    },
    receiptModalTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.3,
    },
    receiptModalSubtitle: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 3,
    },
    receiptCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 12,
    },
    receiptScroll: {
      flex: 1,
      minHeight: 0,
    },
    receiptScrollContent: {
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 44,
    },
    receiptHero: {
      backgroundColor: colors.cardAlt,
      borderRadius: 22,
      padding: 18,
      alignItems: "center",
      marginBottom: 14,
    },
    receiptStatusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    receiptStatusPillText: {
      fontSize: 11,
      fontWeight: "800",
    },
    receiptHeroAmount: {
      fontSize: 30,
      fontWeight: "900",
      color: colors.accent,
      letterSpacing: -0.7,
      marginTop: 12,
    },
    receiptHeroSubtext: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 19,
      marginTop: 8,
    },
    receiptCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    receiptSectionTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 12,
    },
    receiptInfoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 8,
    },
    receiptInfoLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "700",
      flex: 0.4,
    },
    receiptInfoValue: {
      fontSize: 12,
      color: colors.text,
      fontWeight: "600",
      flex: 0.6,
      textAlign: "right",
    },
    receiptBreakdownRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      gap: 10,
    },
    receiptBreakdownRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    receiptBreakdownLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    receiptBreakdownIcon: {
      width: 32,
      height: 32,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    receiptBreakdownLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    receiptBreakdownValue: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "800",
    },
    receiptTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    receiptTotalLabel: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
    },
    receiptTotalValue: {
      fontSize: 16,
      fontWeight: "900",
      color: colors.accent,
    },
    receiptEmptyText: {
      fontSize: 12,
      color: colors.textTertiary,
      lineHeight: 18,
    },
  });

export default PaymentHistoryScreen;
