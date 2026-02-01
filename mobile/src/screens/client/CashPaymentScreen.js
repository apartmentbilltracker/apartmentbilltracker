import React, { useState } from "react";
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
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import apiService from "../../services/apiService";

const CashPaymentScreen = ({ navigation, route }) => {
  const { roomId, roomName, amount, billType } = route.params;
  const [step, setStep] = useState("form"); // form, confirm, success
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

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
        setTransactionId(response.transaction._id);
        setStep("success");
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to record cash payment");
    } finally {
      setLoading(false);
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
          <MaterialIcons name="arrow-back" size={24} color="#333" />
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
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Amount Received</Text>
              <Text style={styles.amountValue}>₱{amount.toFixed(2)}</Text>
              <Text style={styles.billTypeText}>
                {billType.charAt(0).toUpperCase() + billType.slice(1)} Bill
              </Text>
            </View>

            {/* Form */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Payment Details</Text>

              {/* Receipt Number */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Receipt Number <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., RCP-2024-001"
                  value={receiptNumber}
                  onChangeText={setReceiptNumber}
                  editable={!loading}
                  placeholderTextColor="#999"
                />
              </View>

              {/* Received By */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Received By <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Name of person who received payment"
                  value={receivedBy}
                  onChangeText={setReceivedBy}
                  editable={!loading}
                  placeholderTextColor="#999"
                />
                <Text style={styles.inputHint}>
                  Full name of the person accepting the cash
                </Text>
              </View>

              {/* Witness Name */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Witness Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Name of witness to transaction"
                  value={witnessName}
                  onChangeText={setWitnessName}
                  editable={!loading}
                  placeholderTextColor="#999"
                />
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
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <MaterialIcons name="info" size={20} color="#43a047" />
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
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Record Payment</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === "success" && (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <MaterialCommunityIcons
                name="check-circle"
                size={80}
                color="#43a047"
              />
            </View>

            <Text style={styles.successTitle}>Payment Recorded!</Text>

            <View style={styles.successCard}>
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Amount:</Text>
                <Text style={styles.successValue}>₱{amount.toFixed(2)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Receipt No.:</Text>
                <Text style={styles.successValue}>{receiptNumber}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Received By:</Text>
                <Text style={styles.successValue}>{receivedBy}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Witness:</Text>
                <Text style={styles.successValue}>{witnessName}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Bill Type:</Text>
                <Text style={styles.successValue}>
                  {billType.charAt(0).toUpperCase() + billType.slice(1)}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Room:</Text>
                <Text style={styles.successValue}>{roomName}</Text>
              </View>
            </View>

            <View style={styles.successButtons}>
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
                <MaterialIcons name="history" size={20} color="#43a047" />
                <Text style={styles.historyButtonText}>View History</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.billsButton}
                onPress={() =>
                  navigation.navigate("BillsMain", { refresh: true })
                }
              >
                <MaterialIcons name="receipt" size={20} color="#fff" />
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Payment</Text>
            </View>

            <View style={styles.confirmationDetails}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Amount:</Text>
                <Text style={styles.confirmValue}>₱{amount.toFixed(2)}</Text>
              </View>

              <View style={styles.confirmDivider} />

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Receipt No.:</Text>
                <Text style={styles.confirmValue}>{receiptNumber}</Text>
              </View>

              <View style={styles.confirmDivider} />

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Received By:</Text>
                <Text style={styles.confirmValue}>{receivedBy}</Text>
              </View>

              <View style={styles.confirmDivider} />

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Witness:</Text>
                <Text style={styles.confirmValue}>{witnessName}</Text>
              </View>

              <View style={styles.confirmDivider} />

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Bill Type:</Text>
                <Text style={styles.confirmValue}>
                  {billType.charAt(0).toUpperCase() + billType.slice(1)}
                </Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmPayment}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    marginTop: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    marginTop: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  cardLabel: {
    fontSize: 13,
    color: "#999",
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#43a047",
    marginTop: 8,
  },
  billTypeText: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  required: {
    color: "#e53935",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
  },
  multilineInput: {
    textAlignVertical: "top",
    paddingTop: 10,
  },
  inputHint: {
    fontSize: 12,
    color: "#999",
    marginTop: 6,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#43a047",
  },
  infoText: {
    fontSize: 12,
    color: "#2e7d32",
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: "#43a047",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#43a047",
    marginBottom: 20,
  },
  successCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  successRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  successLabel: {
    fontSize: 13,
    color: "#999",
  },
  successValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 8,
  },
  successButtons: {
    width: "100%",
    gap: 10,
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#43a047",
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#43a047",
  },
  billsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#43a047",
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  billsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  confirmationDetails: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
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
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  confirmValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  confirmDivider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 8,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#43a047",
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});

export default CashPaymentScreen;
