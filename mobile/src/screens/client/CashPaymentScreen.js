import React, { useState, useMemo, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import apiService, {
  roomService,
  billingCycleService,
} from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
import { AuthContext } from "../../context/AuthContext";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";
import {
  buildBillSharesFromCharge,
  findUserCharge,
  getExactBillAmount,
  getSelectedPaymentBillTypes,
  normalizePaymentBillType,
} from "../../utils/paymentAmounts";

const CashPaymentScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.state?.user;
  const userId = currentUser?.id || currentUser?._id;

  const {
    roomId,
    roomName,
    amount,
    billType,
    billTypes,
    billingCycleId,
    breakdown,
    billAmounts,
  } = route.params;
  const [step, setStep] = useState("form"); // form, success
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [billShares, setBillShares] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  const [userChargeData, setUserChargeData] = useState(null);
  const [barcodeNumber] = useState(
    Math.random().toString().slice(2, 14).padEnd(12, "0"),
  );
  const receiptRef = React.useRef(null);

  const billNameMap = {
    rent: "Rent",
    electricity: "Electricity",
    water: "Water",
    internet: "Internet",
    custom_charges: "Additional Charges",
    customCharges: "Additional Charges",
    total: "All Bills",
  };

  const selectedBillTypesForDisplay = useMemo(
    () =>
      getSelectedPaymentBillTypes({
        breakdown,
        billTypes,
        billType,
        billAmounts,
        billShares,
        totalAmount: amount,
      }),
    [breakdown, billTypes, billType, billAmounts, billShares, amount],
  );

  const billTitle = useMemo(() => {
    const labels = selectedBillTypesForDisplay
      .map((type) => billNameMap[type] || type)
      .filter(Boolean);

    if (labels.length >= 5 || labels.includes("All Bills")) return "All Bills";
    return labels.join(" / ") || "Selected Bills";
  }, [selectedBillTypesForDisplay]);

  const amountDisplay = `PHP ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const getSelectedBillAmount = (type, index, selectedTypes) => {
    const normalizedType = normalizePaymentBillType(type);
    const exactAmount = getExactBillAmount(normalizedType, {
      billAmounts,
      billShares,
      totalAmount: amount,
    });

    if (exactAmount !== null) return exactAmount;
    if (selectedTypes?.length === 1 && normalizedType === "total") {
      const totalAmount = Number(amount);
      return Number.isFinite(totalAmount) && totalAmount > 0
        ? totalAmount
        : null;
    }

    return null;
  };

  // Fetch room and billing data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use getRoomById to get complete room data including address (like RoomDetailsScreen does)
        const roomResponse = await roomService.getRoomById(roomId);
        const room =
          roomResponse?.data?.room ||
          roomResponse?.room ||
          roomResponse?.data ||
          roomResponse;

        setRoomData(room);

        // If billingCycleId is provided, fetch that specific cycle (handles closed cycles)
        // Otherwise, fetch all cycles and find the active one
        let targetCycle = null;
        if (billingCycleId) {
          const cycleResponse =
            await billingCycleService.getBillingCycleById(billingCycleId);
          targetCycle =
            cycleResponse?.data?.billingCycle ||
            cycleResponse?.billingCycle ||
            cycleResponse?.data ||
            cycleResponse;
        } else {
          const cycles = await billingCycleService.getBillingCycles(roomId);
          const cycles_arr = Array.isArray(cycles)
            ? cycles
            : cycles?.billingCycles || cycles?.data || [];
          targetCycle = cycles_arr.find((c) => c.status === "active");
        }

        setBillingData(targetCycle);

        // Get current user's member info
        if (room?.members && Array.isArray(room.members)) {
          const member = room.members.find(
            (m) =>
              String(m.user?.id || m.user?._id || m.user) === String(userId),
          );
          setMemberInfo(member);
        }

        // Calculate bill shares if target cycle exists and has member charges
        if (targetCycle?.memberCharges?.length > 0) {
          const userCharge = findUserCharge(targetCycle.memberCharges, userId);
          if (userCharge) {
            setUserChargeData(userCharge);
            setBillShares(buildBillSharesFromCharge(userCharge));
          }
        }
      } catch (error) {
        console.error("Error fetching room/billing data:", error);
      }
    };
    if (roomId && userId) {
      fetchData();
    }
  }, [roomId, userId, billingCycleId]);

  // Helper function to get bill labels to display in receipt
  // Returns only the bills that were selected for payment (based on breakdown)
  const getDisplayedBillLabels = () => {
    if (!breakdown) return [];

    const labels = [];
    const billLabelMap = {
      rent: "Rent",
      electricity: "Electricity",
      internet: "Internet",
      water: "Water",
      custom_charges: "Custom Charges",
      customCharges: "Custom Charges",
    };

    // Check which bills were selected
    Object.entries(breakdown).forEach(([key, isSelected]) => {
      if (isSelected) {
        labels.push(key);
      }
    });

    return labels;
  };

  // Helper function to get amount for a specific bill from breakdown
  const getDisplayedAmount = (billKey) => {
    return (
      getExactBillAmount(billKey, {
        billAmounts,
        billShares,
        totalAmount: amount,
      }) || 0
    );
  };

  const receiptLineItems = useMemo(
    () =>
      selectedBillTypesForDisplay
        .filter((type) => type !== "total")
        .map((type) => ({
          type,
          label: billNameMap[type] || type,
          amount: getSelectedBillAmount(type, 0, selectedBillTypesForDisplay),
        }))
        .filter((item) => Number(item.amount) > 0),
    [selectedBillTypesForDisplay, billAmounts, billShares, amount],
  );

  const receiptTotal = useMemo(() => {
    const lineTotal = receiptLineItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );
    return lineTotal > 0 ? lineTotal : Number(amount || 0);
  }, [receiptLineItems, amount]);

  const handleRecordCash = async () => {
    if (!receiptNumber.trim()) {
      Alert.alert("Required", "Please enter the receipt number");
      return;
    }

    if (!receivedBy.trim()) {
      Alert.alert("Required", "Please enter who received the payment");
      return;
    }

    if (!witnessName.trim()) {
      Alert.alert("Required", "Please enter a witness name");
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmPayment = async () => {
    try {
      setLoading(true);
      setShowConfirm(false);

      // Check if this is a batch payment (multiple bills selected)
      // Ensure billTypes is an array and normalize values
      let selectedBillTypes = selectedBillTypesForDisplay;

      selectedBillTypes = selectedBillTypes
        .map(normalizePaymentBillType)
        .filter((bt) => bt !== null);

      if (selectedBillTypes.length === 0) {
        Alert.alert("Error", "Invalid bill types selected. Please try again.");
        return;
      }

      const isBatch = selectedBillTypes.length > 1;
      const missingAmountType = selectedBillTypes.find(
        (type, index) =>
          getSelectedBillAmount(type, index, selectedBillTypes) === null,
      );

      if (missingAmountType) {
        Alert.alert(
          "Bill amounts not ready",
          "Please wait a moment for the exact bill amounts to load, then try again.",
        );
        return;
      }

      let response;
      if (isBatch) {
        // For batch payments, call recordCash for each bill type
        const responses = [];
        const paymentBatchId = `cash-${Date.now()}`;

        for (let i = 0; i < selectedBillTypes.length; i++) {
          const billTypeItem = selectedBillTypes[i];
          const billAmount = getSelectedBillAmount(
            billTypeItem,
            i,
            selectedBillTypes,
          );

          const res = await apiService.recordCash({
            roomId,
            amount: billAmount,
            billType: billTypeItem,
            receiptNumber,
            receivedBy,
            witnessName,
            notes: notes
              ? `${notes} (Part ${i + 1}/${selectedBillTypes.length})`
              : `(Part ${i + 1}/${selectedBillTypes.length})`,
            billingCycleId,
            paymentBatchId,
          });
          responses.push(res);
        }

        // Combine responses
        response = {
          success: responses.every((r) => r.success),
          transaction: responses[0]?.transaction,
          transactions: responses.map((r) => r.transaction),
        };
      } else {
        const singleBillAmount =
          getSelectedBillAmount(selectedBillTypes[0], 0, selectedBillTypes) ??
          Number(amount || 0);
        // Use single bill endpoint for single bill
        response = await apiService.recordCash({
          roomId,
          amount: singleBillAmount,
          billType: selectedBillTypes[0],
          receiptNumber,
          receivedBy,
          witnessName,
          notes,
          billingCycleId,
        });
      }

      if (response.success) {
        setTransactionId(
          response.transaction?.id ||
            response.transaction?._id ||
            response.transactions?.[0]?.id,
        );
        setStep("success");
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to record cash payment");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async () => {
    try {
      setReceiptLoading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow gallery access to save the receipt.",
        );
        return;
      }
      const uri = await captureRef(receiptRef, { format: "png", quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Saved!", "Receipt image saved to your gallery.");
    } catch (error) {
      Alert.alert("Error", "Failed to save receipt. Please try again.");
    } finally {
      setReceiptLoading(false);
    }
  };

  // Helper functions
  const getRoomAddress = () => {
    // Use room.address (same as RoomDetailsScreen)
    return roomData?.address || "Apartment Address";
  };

  const getMemberSinceDate = () => {
    const joinedDate = memberInfo?.joinedAt || memberInfo?.joined_at;
    if (!joinedDate) return "N/A";

    const date = new Date(joinedDate);
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getMemberStatus = () => {
    // Use userCharge.isPayer for accurate status from billing cycle data
    if (userChargeData) {
      return userChargeData.isPayer !== false &&
        userChargeData.is_payer !== false
        ? "Payor"
        : "Non-Payor";
    }
    return memberInfo?.isPayer ? "Payor" : "Non-Payor";
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Cash Payment</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {roomName}
          </Text>
        </View>
        <View style={styles.headerMethodBadge}>
          <Ionicons name="cash-outline" size={17} color={colors.accent} />
        </View>
      </View>

      <ScrollViewWithDetection
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {step === "form" && (
          <>
            {/* Amount Card */}
            <View style={styles.amountCard}>
              <View style={styles.amountTopRow}>
                <View style={styles.amountIcon}>
                  <Ionicons
                    name="receipt-outline"
                    size={20}
                    color={colors.accent}
                  />
                </View>
                <Text style={styles.amountLabel}>Cash amount to record</Text>
              </View>
              <Text style={styles.amountValue}>{amountDisplay}</Text>
              <View style={styles.billPill}>
                <Ionicons
                  name="document-text-outline"
                  size={13}
                  color={colors.accent}
                />
                <Text style={styles.billTypeText} numberOfLines={1}>
                  {billTitle}
                </Text>
              </View>
            </View>

            {/* Form */}
            <View style={styles.card}>
              <View style={styles.formHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>Payment Details</Text>
                </View>
                <Text style={styles.formSectionTitle}>Record Information</Text>
                <Text style={styles.formSectionSubtitle}>
                  Fill in the receipt details before confirming the cash
                  payment.
                </Text>
              </View>

              {/* Receipt Number */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Receipt Number <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="receipt-outline"
                    size={18}
                    color={colors.accent}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.inputWithIcon}
                    placeholder="e.g., RCP-2024-001"
                    value={receiptNumber}
                    onChangeText={setReceiptNumber}
                    editable={!loading}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <Text style={styles.inputHint}>
                  Use the receipt or acknowledgement number from your host
                </Text>
              </View>

              {/* Received By */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Received By <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={colors.accent}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.inputWithIcon}
                    placeholder="Name of person who received payment"
                    value={receivedBy}
                    onChangeText={setReceivedBy}
                    editable={!loading}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <Text style={styles.inputHint}>
                  Full name of the person accepting the cash
                </Text>
              </View>

              {/* Witness Name */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Witness Name <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="eye-outline"
                    size={18}
                    color={colors.accent}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.inputWithIcon}
                    placeholder="Name of witness to transaction"
                    value={witnessName}
                    onChangeText={setWitnessName}
                    editable={!loading}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <Text style={styles.inputHint}>
                  Someone who can verify the transaction
                </Text>
              </View>

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  placeholder="Any additional notes about the payment"
                  value={notes}
                  onChangeText={setNotes}
                  editable={!loading}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoIconCircle}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={colors.accent}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Before You Record</Text>
                <Text style={styles.infoText}>
                  Confirm the cash was received by your host or authorized
                  collector. A receipt image can be saved after recording.
                </Text>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabled]}
              onPress={handleRecordCash}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textOnAccent} />
              ) : (
                <>
                  <Ionicons
                    name="cash-outline"
                    size={18}
                    color={colors.textOnAccent}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.submitButtonText}>Record Payment</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === "success" && (
          <View style={styles.successContainer}>
            <View
              ref={receiptRef}
              collapsable={false}
              style={styles.receiptCapture}
            >
              {/* Professional Receipt Format */}
              <View style={styles.receiptContent}>
                {/* Title */}
                <View style={styles.titleRow}>
                  <Text style={styles.receiptTitle}>CASH RECEIPT</Text>
                  <Text style={styles.titleSubtitle}>PropFlow</Text>
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
                    <Text style={styles.headerLabel}>
                      Receipt No. {receiptNumber}
                    </Text>
                  </View>
                </View>

                {/* Date */}
                <View style={styles.dateSection}>
                  <Text style={styles.dateText}>
                    {new Date().toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}{" "}
                    {new Date().toLocaleTimeString("en-PH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
                      : {currentUser?.name || "Tenant"}
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
                  {/* Display only the bills that were selected for payment */}
                  {breakdown ? (
                    <>
                      {/* Rent */}
                      {(breakdown.rent ||
                        selectedBillTypesForDisplay.includes("rent")) && (
                        <View style={styles.costRow}>
                          <Text style={styles.costLabel}>Rent</Text>
                          <Text style={styles.costDots}>
                            {Array(26).fill(".").join("")}
                          </Text>
                          <Text style={styles.costAmount}>
                            ₱{(getDisplayedAmount("rent") || 0).toFixed(2)}
                          </Text>
                        </View>
                      )}
                      {/* Electricity */}
                      {(breakdown.electricity ||
                        selectedBillTypesForDisplay.includes(
                          "electricity",
                        )) && (
                        <View style={styles.costRow}>
                          <Text style={styles.costLabel}>Electricity</Text>
                          <Text style={styles.costDots}>
                            {Array(26).fill(".").join("")}
                          </Text>
                          <Text style={styles.costAmount}>
                            ₱
                            {(getDisplayedAmount("electricity") || 0).toFixed(
                              2,
                            )}
                          </Text>
                        </View>
                      )}
                      {/* Internet */}
                      {(breakdown.internet ||
                        selectedBillTypesForDisplay.includes("internet")) && (
                        <View style={styles.costRow}>
                          <Text style={styles.costLabel}>Internet</Text>
                          <Text style={styles.costDots}>
                            {Array(26).fill(".").join("")}
                          </Text>
                          <Text style={styles.costAmount}>
                            ₱{(getDisplayedAmount("internet") || 0).toFixed(2)}
                          </Text>
                        </View>
                      )}
                      {/* Water */}
                      {(breakdown.water ||
                        selectedBillTypesForDisplay.includes("water")) && (
                        <View style={styles.costRow}>
                          <Text style={styles.costLabel}>Water</Text>
                          <Text style={styles.costDots}>
                            {Array(26).fill(".").join("")}
                          </Text>
                          <Text style={styles.costAmount}>
                            ₱{(getDisplayedAmount("water") || 0).toFixed(2)}
                          </Text>
                        </View>
                      )}
                      {/* Custom Charges */}
                      {(breakdown.custom_charges || breakdown.customCharges) &&
                        billShares?.customCharges &&
                        billShares.customCharges > 0 &&
                        billingData?.customCharges &&
                        billingData.customCharges.length > 0 &&
                        (() => {
                          const totalCustomCharges =
                            billingData.customCharges.reduce(
                              (sum, c) => sum + parseFloat(c.amount || 0),
                              0,
                            );
                          return billingData.customCharges.map(
                            (charge, idx) => {
                              const userShareOfCharge =
                                totalCustomCharges > 0
                                  ? (parseFloat(charge.amount || 0) /
                                      totalCustomCharges) *
                                    billShares.customCharges
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
                            },
                          );
                        })()}
                      {/* Service Fee */}
                      <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Service Fee</Text>
                        <Text style={styles.costDots}>
                          {Array(26).fill(".").join("")}
                        </Text>
                        <Text style={styles.costAmount}>Free</Text>
                      </View>
                    </>
                  ) : (
                    // Fallback: show all bills if breakdown is not provided
                    <>
                      <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Rent</Text>
                        <Text style={styles.costDots}>
                          {Array(26).fill(".").join("")}
                        </Text>
                        <Text style={styles.costAmount}>
                          ₱{(billShares?.rent || 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Electricity</Text>
                        <Text style={styles.costDots}>
                          {Array(26).fill(".").join("")}
                        </Text>
                        <Text style={styles.costAmount}>
                          ₱{(billShares?.electricity || 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Internet</Text>
                        <Text style={styles.costDots}>
                          {Array(26).fill(".").join("")}
                        </Text>
                        <Text style={styles.costAmount}>
                          ₱{(billShares?.internet || 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Water</Text>
                        <Text style={styles.costDots}>
                          {Array(26).fill(".").join("")}
                        </Text>
                        <Text style={styles.costAmount}>
                          ₱{(billShares?.water || 0).toFixed(2)}
                        </Text>
                      </View>
                      {billShares?.customCharges &&
                        billShares.customCharges > 0 &&
                        billingData?.customCharges &&
                        billingData.customCharges.length > 0 &&
                        (() => {
                          const totalCustomCharges =
                            billingData.customCharges.reduce(
                              (sum, c) => sum + parseFloat(c.amount || 0),
                              0,
                            );
                          return billingData.customCharges.map(
                            (charge, idx) => {
                              const userShareOfCharge =
                                totalCustomCharges > 0
                                  ? (parseFloat(charge.amount || 0) /
                                      totalCustomCharges) *
                                    billShares.customCharges
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
                            },
                          );
                        })()}
                      <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Service Fee</Text>
                        <Text style={styles.costDots}>
                          {Array(26).fill(".").join("")}
                        </Text>
                        <Text style={styles.costAmount}>Free</Text>
                      </View>
                    </>
                  )}
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
                      ₱{Number(receiptTotal || 0).toFixed(2)}
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
            </View>

            <View style={styles.successButtons}>
              <TouchableOpacity
                style={styles.downloadReceiptBtn}
                onPress={handleDownloadReceipt}
                disabled={receiptLoading}
                activeOpacity={0.8}
              >
                {receiptLoading ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="download-outline"
                      size={18}
                      color={colors.accent}
                    />
                    <Text style={styles.downloadReceiptText}>Save Receipt</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.historyButton}
                onPress={() =>
                  navigation.navigate("PaymentHistory", {
                    roomId,
                    roomName,
                    refresh: true,
                  })
                }
              >
                <Ionicons name="time-outline" size={18} color={colors.accent} />
                <Text style={styles.historyButtonText}>View History</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.billsButton}
                onPress={() =>
                  navigation.navigate("BillsMain", { refresh: true })
                }
              >
                <Ionicons
                  name="receipt-outline"
                  size={18}
                  color={colors.textOnAccent}
                />
                <Text style={styles.billsButtonText}>Back to Bills</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollViewWithDetection>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Confirm Cash Payment</Text>
                <Text style={styles.modalSubtitle}>
                  Review the receipt details before recording.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowConfirm(false)}
                style={styles.modalCloseButton}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalAmountRow}>
              <Text style={styles.modalAmountLabel}>Total Amount</Text>
              <Text style={styles.modalAmountValue}>{amountDisplay}</Text>
              <Text style={styles.modalBillTitle} numberOfLines={1}>
                {billTitle}
              </Text>
            </View>

            <View style={styles.confirmationDetails}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Receipt No.</Text>
                <Text style={styles.confirmValue}>{receiptNumber}</Text>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Received By</Text>
                <Text style={styles.confirmValue}>{receivedBy}</Text>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Witness</Text>
                <Text style={styles.confirmValue}>{witnessName}</Text>
              </View>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Bill Type</Text>
                <Text style={styles.confirmValue} numberOfLines={2}>
                  {billTitle}
                </Text>
              </View>
              {notes.trim() ? (
                <>
                  <View style={styles.confirmDivider} />
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>Notes</Text>
                    <Text style={styles.confirmValue} numberOfLines={3}>
                      {notes.trim()}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleConfirmPayment}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={colors.textOnAccent}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.modalConfirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
            <ModalBottomSpacer />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors) => {
  const isDarkMode = colors.statusBarStyle === "light-content";
  const softSurface = isDarkMode
    ? "rgba(255,255,255,0.06)"
    : "rgba(3,109,65,0.055)";
  const softBorder = isDarkMode
    ? "rgba(158,208,205,0.16)"
    : "rgba(3,109,65,0.12)";
  const selectedSurface = isDarkMode
    ? "rgba(129,216,163,0.12)"
    : "rgba(202,238,232,0.72)";

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.background,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    headerContent: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: "600",
    },
    headerMethodBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: 18,
      paddingBottom: 54,
    },

    /* Amount Card */
    amountCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingVertical: 18,
      paddingHorizontal: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: softBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 18,
      elevation: 4,
    },
    amountTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginBottom: 10,
    },
    amountIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
    },
    amountLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },
    amountValue: {
      fontSize: 34,
      fontWeight: "900",
      color: colors.accent,
      marginBottom: 12,
    },
    billPill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      maxWidth: "100%",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
    },
    billTypeText: {
      flexShrink: 1,
      fontSize: 12,
      color: colors.accent,
      fontWeight: "800",
    },

    /* Step Badge */
    stepBadge: {
      alignSelf: "flex-start",
      backgroundColor: softSurface,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: softBorder,
    },
    stepBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.accent,
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },
    formHeader: {
      marginBottom: 16,
    },
    formSectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },
    formSectionSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: 4,
    },

    /* Cards */
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: softBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 16,
    },

    /* Form */
    formGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    required: {
      color: "#e53935",
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: softBorder,
      borderRadius: 16,
      backgroundColor: softSurface,
      paddingHorizontal: 12,
    },
    inputIcon: {
      marginRight: 10,
    },
    inputWithIcon: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: softBorder,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: softSurface,
    },
    multilineInput: {
      textAlignVertical: "top",
      paddingTop: 12,
      minHeight: 100,
    },
    inputHint: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 6,
    },

    /* Info Card */
    infoCard: {
      flexDirection: "row",
      backgroundColor: softSurface,
      borderRadius: 18,
      padding: 14,
      marginBottom: 14,
      gap: 12,
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: softBorder,
    },
    infoIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 12,
      backgroundColor: colors.accentSurface || selectedSurface,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 1,
    },
    infoContent: {
      flex: 1,
    },
    infoTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
    },
    infoText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 3,
      lineHeight: 17,
      fontWeight: "500",
    },

    /* Submit Button */
    submitButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 30,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
      elevation: 4,
    },
    submitButtonText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
    disabled: {
      opacity: 0.6,
    },

    /* Success */
    successContainer: {
      alignItems: "center",
      paddingVertical: 30,
    },
    successIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.successBg,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    successTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 4,
    },
    successSubtitle: {
      fontSize: 13,
      color: colors.textTertiary,
      marginBottom: 24,
    },
    successCard: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    successRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    successLabel: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    successValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.skeleton,
      marginVertical: 4,
    },
    successButtons: {
      width: "100%",
      gap: 10,
    },
    receiptCapture: {
      width: "100%",
      backgroundColor: colors.background,
      paddingTop: 4,
    },
    receiptContent: {
      backgroundColor: "#f5f5f5",
      paddingHorizontal: 16,
      paddingVertical: 20,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 16,
    },
    downloadReceiptBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 13,
      gap: 6,
    },
    downloadReceiptText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent,
    },
    historyButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 13,
      gap: 6,
    },
    historyButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent,
    },
    billsButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 13,
      gap: 6,
    },
    billsButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
    },

    /* Modal */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      paddingBottom: 8,
      maxHeight: "80%",
    },
    modalDragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.skeleton || colors.border,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 10,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.text,
    },
    modalSubtitle: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      marginTop: 3,
    },
    modalCloseButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    modalAmountRow: {
      alignItems: "center",
      marginBottom: 16,
    },
    modalAmountLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    modalAmountValue: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.accent,
      marginTop: 4,
    },
    modalBillTitle: {
      marginTop: 6,
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
      textAlign: "center",
    },
    confirmationDetails: {
      backgroundColor: colors.background,
      borderRadius: 18,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: softBorder,
    },
    confirmRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 16,
      paddingVertical: 8,
    },
    confirmLabel: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    confirmValue: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontWeight: "800",
      textAlign: "right",
    },
    confirmDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.skeleton,
      marginVertical: 4,
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
    },
    modalCancelButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    modalCancelButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    modalConfirmButton: {
      flex: 1,
      flexDirection: "row",
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    modalConfirmButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
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
};

export default CashPaymentScreen;
