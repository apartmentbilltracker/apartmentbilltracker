import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
} from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import apiService from "../../services/apiService";

const BankTransferPaymentScreen = ({ navigation, route }) => {
  const { roomId, roomName, amount, billType } = route.params;
  const [step, setStep] = useState("bankDetails"); // bankDetails, qr, success
  const [bankName, setBankName] = useState("BPI");
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [transactionId, setTransactionId] = useState("");

  const banks = [
    {
      name: "BPI",
      accountName: "Apartment Management Account",
      accountNumber: "9079376194",
      details: "Bank of the Philippine Islands",
    },
  ];

  const selectedBank = banks.find((b) => b.name === bankName);

  useEffect(() => {
    if (step === "bankDetails") {
      setLoading(false);
    }
  }, [step]);

  const initiateBankTransfer = async () => {
    try {
      setLoading(true);
      const response = await apiService.initiateBankTransfer({
        roomId,
        amount,
        billType,
        bankName,
      });

      if (response.success) {
        setQrData(response.qrData);
        setReferenceNumber(response.transaction.referenceNumber);
        setTransactionId(response.transaction._id);
        setStep("qr");
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to initiate bank transfer");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTransfer = async () => {
    try {
      setVerifyLoading(true);
      const response = await apiService.confirmBankTransfer({
        transactionId,
        bankName,
      });

      if (response.success) {
        setStep("success");
        setTimeout(() => {
          Alert.alert("Success", "Bank transfer recorded successfully!", [
            {
              text: "View History",
              onPress: () =>
                navigation.navigate("PaymentHistory", { refresh: true }),
            },
            {
              text: "Back to Bills",
              onPress: () => navigation.navigate("Bills", { refresh: true }),
            },
          ]);
        }, 500);
      }
    } catch (error) {
      Alert.alert(
        "Confirmation Failed",
        error.message || "Unable to confirm transfer. Please try again.",
      );
    } finally {
      setVerifyLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copied", "Account number copied to clipboard");
    } catch (error) {
      Alert.alert("Error", "Failed to copy");
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
          <Text style={styles.title}>Bank Transfer</Text>
          <Text style={styles.subtitle}>{roomName}</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === "bankDetails" && (
          <>
            {/* Amount Card */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Amount to Transfer</Text>
              <Text style={styles.amountValue}>₱{amount.toFixed(2)}</Text>
            </View>

            {/* Bank Selection */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Step 1: Select Bank</Text>
              <TouchableOpacity
                style={styles.bankSelector}
                onPress={() => setShowBankSelector(true)}
              >
                <View>
                  <Text style={styles.bankSelectorLabel}>Bank</Text>
                  <Text style={styles.bankSelectorValue}>{bankName}</Text>
                </View>
                <MaterialIcons name="expand-more" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Bank Details */}
            {selectedBank && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Step 2: Bank Details</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bank</Text>
                  <Text style={styles.detailValue}>{selectedBank.details}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Name</Text>
                  <Text style={styles.detailValue}>
                    {selectedBank.accountName}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Number</Text>
                  <View style={styles.accountNumberContent}>
                    <Text style={styles.accountNumber}>
                      {selectedBank.accountNumber}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        copyToClipboard(selectedBank.accountNumber)
                      }
                      style={styles.copyButton}
                    >
                      <MaterialCommunityIcons
                        name="content-copy"
                        size={18}
                        color="#1e88e5"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Instructions */}
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>Instructions:</Text>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>1</Text>
                <Text style={styles.instructionText}>
                  Log in to your {bankName} online banking
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>2</Text>
                <Text style={styles.instructionText}>
                  Transfer ₱{amount.toFixed(2)} to the account above
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>3</Text>
                <Text style={styles.instructionText}>
                  Use the reference number in the transaction description
                </Text>
              </View>
            </View>

            {/* Next Button */}
            <TouchableOpacity
              style={styles.nextButton}
              onPress={initiateBankTransfer}
            >
              <Text style={styles.nextButtonText}>Proceed to QR Code</Text>
            </TouchableOpacity>
          </>
        )}

        {step === "qr" && (
          <>
            {/* Amount Card */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Amount to Send</Text>
              <Text style={styles.amountValue}>₱{amount.toFixed(2)}</Text>
            </View>

            {/* QR Code Section */}
            <View style={styles.qrCard}>
              <Text style={styles.sectionTitle}>
                Step 3: Transfer via QR Code
              </Text>
              <View style={styles.qrContainer}>
                <Image
                  source={require("../../assets/bpi-qr.png")}
                  style={styles.qrImage}
                />
              </View>
              <Text style={styles.qrHint}>
                Use your {bankName} mobile app to scan and transfer
              </Text>
            </View>

            {/* Reference Number Section */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Reference Number</Text>
              <View style={styles.referenceBox}>
                <Text style={styles.referenceLabel}>Reference Number</Text>
                <View style={styles.referenceContent}>
                  <Text style={styles.referenceNumber}>{referenceNumber}</Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(referenceNumber)}
                    style={styles.copyButton}
                  >
                    <MaterialCommunityIcons
                      name="content-copy"
                      size={18}
                      color="#1e88e5"
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.referenceHint}>
                Include this in your bank transfer description
              </Text>
            </View>

            {/* Confirmation Button */}
            <TouchableOpacity
              style={[styles.confirmButton, verifyLoading && styles.disabled]}
              onPress={handleConfirmTransfer}
              disabled={verifyLoading}
            >
              {verifyLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  Confirm Transfer Sent
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.confirmHint}>
              Click confirm once you've sent the transfer from your bank app
            </Text>
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

            <Text style={styles.successTitle}>Transfer Confirmed!</Text>

            <View style={styles.successCard}>
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Amount:</Text>
                <Text style={styles.successValue}>₱{amount.toFixed(2)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Bank:</Text>
                <Text style={styles.successValue}>{bankName}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Reference:</Text>
                <Text style={styles.successValue}>{referenceNumber}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Bill Type:</Text>
                <Text style={styles.successValue}>
                  {billType.charAt(0).toUpperCase() + billType.slice(1)}
                </Text>
              </View>
            </View>

            <View style={styles.successButtons}>
              <TouchableOpacity
                style={styles.historyButton}
                onPress={() =>
                  navigation.navigate("PaymentHistory", { refresh: true })
                }
              >
                <MaterialIcons name="history" size={20} color="#1e88e5" />
                <Text style={styles.historyButtonText}>View History</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.billsButton}
                onPress={() => navigation.navigate("Bills", { refresh: true })}
              >
                <MaterialIcons name="receipt" size={20} color="#fff" />
                <Text style={styles.billsButtonText}>Back to Bills</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bank Selector Modal */}
      <Modal
        visible={showBankSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowBankSelector(false)}
                style={styles.modalCloseButton}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Bank</Text>
              <View style={styles.modalCloseButton} />
            </View>

            <ScrollView style={styles.bankList}>
              {banks.map((bank) => (
                <TouchableOpacity
                  key={bank.name}
                  style={[
                    styles.bankListItem,
                    bankName === bank.name && styles.selectedBankItem,
                  ]}
                  onPress={() => {
                    setBankName(bank.name);
                    setShowBankSelector(false);
                  }}
                >
                  <View>
                    <Text style={styles.bankListName}>{bank.name}</Text>
                    <Text style={styles.bankListDetails}>{bank.details}</Text>
                  </View>
                  {bankName === bank.name && (
                    <MaterialIcons
                      name="check-circle"
                      size={24}
                      color="#1e88e5"
                    />
                  )}
                </TouchableOpacity>
              ))}
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
    backgroundColor: "#f5f5f5",
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
    marginTop: 10,
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
    fontSize: 32,
    fontWeight: "bold",
    color: "#1e88e5",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  bankSelector: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bankSelectorLabel: {
    fontSize: 12,
    color: "#999",
  },
  bankSelectorValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: "#999",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    maxWidth: "60%",
    textAlign: "right",
  },
  accountNumberContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accountNumber: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e88e5",
    letterSpacing: 1,
  },
  copyButton: {
    padding: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 8,
  },
  instructionsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-start",
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1e88e5",
    color: "#fff",
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "bold",
    marginRight: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    paddingTop: 3,
  },
  nextButton: {
    backgroundColor: "#1e88e5",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  qrCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
  },
  qrContainer: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  qrHint: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },
  referenceBox: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  referenceLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
  },
  referenceContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  referenceNumber: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e88e5",
    letterSpacing: 1,
  },
  referenceHint: {
    fontSize: 12,
    color: "#999",
  },
  confirmButton: {
    backgroundColor: "#1e88e5",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  confirmHint: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    marginBottom: 16,
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
  successButtons: {
    width: "100%",
    gap: 10,
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#1e88e5",
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e88e5",
  },
  billsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e88e5",
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
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  bankList: {
    padding: 16,
  },
  bankListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  selectedBankItem: {
    borderColor: "#1e88e5",
    backgroundColor: "#e3f2fd",
  },
  bankListName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  bankListDetails: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
});

export default BankTransferPaymentScreen;
