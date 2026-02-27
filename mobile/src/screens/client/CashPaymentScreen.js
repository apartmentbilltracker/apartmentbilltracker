import React, { useState, useMemo } from "react";
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
import apiService from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";

const CashPaymentScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { roomId, roomName, amount, billType } = route.params;
  const [step, setStep] = useState("form"); // form, success
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const receiptRef = React.useRef(null);

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
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark-circle" size={56} color="#43a047" />
              </View>

              <Text style={styles.successTitle}>Payment Recorded!</Text>
              <Text style={styles.successSubtitle}>
                Awaiting admin verification
              </Text>

              <View style={styles.successCard}>
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Amount</Text>
                  <Text style={styles.successValue}>₱{amount.toFixed(2)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Receipt No.</Text>
                  <Text style={styles.successValue}>{receiptNumber}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Received By</Text>
                  <Text style={styles.successValue}>{receivedBy}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Witness</Text>
                  <Text style={styles.successValue}>{witnessName}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Bill Type</Text>
                  <Text style={styles.successValue}>
                    {billType.charAt(0).toUpperCase() + billType.slice(1)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>Room</Text>
                  <Text style={styles.successValue}>{roomName}</Text>
                </View>
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
      alignItems: "center",
      backgroundColor: colors.background,
      paddingTop: 4,
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
  });

export default CashPaymentScreen;
