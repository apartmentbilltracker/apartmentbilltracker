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
import { AuthContext } from "../../context/AuthContext";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";

const CashPaymentScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.state?.user;
  const userId = currentUser?.id || currentUser?._id;

  const { roomId, roomName, amount, billType, billingCycleId } = route.params;
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
          const userCharge = targetCycle.memberCharges.find(
            (c) => String(c.userId) === String(userId),
          );
          if (userCharge) {
            setUserChargeData(userCharge);
            setBillShares({
              rent: userCharge.rentShare || 0,
              electricity: userCharge.electricityShare || 0,
              internet: userCharge.internetShare || 0,
              water:
                userCharge.isPayer !== false
                  ? userCharge.waterBillShare || 0
                  : userCharge.waterOwn || 0,
              customCharges: userCharge.custom_charges_share || 0,
              total: userCharge.totalDue || 0,
            });
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

      const response = await apiService.recordCash({
        roomId,
        amount,
        billType,
        receiptNumber,
        receivedBy,
        witnessName,
        notes,
        billingCycleId,
      });

      if (response.success) {
        setTransactionId(response.transaction.id || response.transaction._id);
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
      return userChargeData.isPayer !== false ? "Payor" : "Non-Payor";
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
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Cash Payment</Text>
          <Text style={styles.subtitle}>{roomName}</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === "form" && (
          <>
            {/* Amount Card */}
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Amount to Pay</Text>
              <Text style={styles.amountValue}>₱{amount.toFixed(2)}</Text>
              <Text style={styles.billTypeText}>
                {billType.charAt(0).toUpperCase() + billType.slice(1)} Bill
              </Text>
            </View>

            {/* Form */}
            <View style={styles.card}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Payment Details</Text>
              </View>
              <Text style={styles.sectionTitle}>Record Information</Text>

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
                  name="information-circle-outline"
                  size={18}
                  color={colors.accent}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Payment Receipt</Text>
                <Text style={styles.infoText}>
                  Make sure to keep a copy of the receipt for your records
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
                      return billingData.customCharges.map((charge, idx) => {
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
                      });
                    })()}
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
                      ₱{(billShares?.total || 0).toFixed(2)}
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
      </ScrollView>

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
              <Text style={styles.modalTitle}>Confirm Payment</Text>
              <TouchableOpacity
                onPress={() => setShowConfirm(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalAmountRow}>
              <Text style={styles.modalAmountLabel}>Total Amount</Text>
              <Text style={styles.modalAmountValue}>₱{amount.toFixed(2)}</Text>
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
                <Text style={styles.confirmValue}>
                  {billType.charAt(0).toUpperCase() + billType.slice(1)}
                </Text>
              </View>
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

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    headerContent: {
      flex: 1,
      alignItems: "center",
    },
    title: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    content: {
      flex: 1,
      padding: 14,
    },

    /* Amount Card */
    amountCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: 22,
      paddingHorizontal: 20,
      marginBottom: 14,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: "#b38604",
      shadowColor: "#b38604",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    amountLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    amountValue: {
      fontSize: 34,
      fontWeight: "800",
      color: colors.accent,
      marginTop: 6,
    },
    billTypeText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 6,
      fontWeight: "500",
    },

    /* Step Badge */
    stepBadge: {
      alignSelf: "flex-start",
      backgroundColor: colors.warningBg,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 8,
    },
    stepBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.accent,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    /* Cards */
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
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
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.cardAlt,
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
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.cardAlt,
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
      backgroundColor: colors.warningBg,
      borderRadius: 14,
      padding: 14,
      marginBottom: 14,
      gap: 12,
      alignItems: "flex-start",
    },
    infoIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.accentSurface,
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
      color: colors.accent,
      marginTop: 3,
      lineHeight: 17,
    },

    /* Submit Button */
    submitButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
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
      backgroundColor: "rgba(0, 0, 0, 0.4)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 8,
      maxHeight: "80%",
    },
    modalDragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.skeleton,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 6,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    modalCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
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
    confirmationDetails: {
      backgroundColor: colors.background,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
    },
    confirmRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
    },
    confirmLabel: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    confirmValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "700",
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
      paddingVertical: 13,
      borderRadius: 12,
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
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
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

export default CashPaymentScreen;
