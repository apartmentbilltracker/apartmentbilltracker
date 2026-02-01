import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
} from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import apiService from "../../services/apiService";

const GCashPaymentScreen = ({ navigation, route }) => {
  const { roomId, roomName, amount, billType } = route.params;
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [step, setStep] = useState("qr"); // qr, verify, success
  const [mobileNumber, setMobileNumber] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    initiateGCashPayment();
  }, []);

  const initiateGCashPayment = async () => {
    try {
      setLoading(true);
      const response = await apiService.initiateGCash({
        roomId,
        amount,
        billType,
      });

      if (response.success) {
        setQrData(response.qrData);
        setReferenceNumber(response.transaction.referenceNumber);
        setTransactionId(response.transaction._id);
        setStep("qr");
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to initiate GCash payment");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!mobileNumber.trim()) {
      Alert.alert("Required", "Please enter your GCash mobile number");
      return;
    }

    try {
      setVerifyLoading(true);
      const response = await apiService.verifyGCash({
        transactionId,
        mobileNumber,
      });

      if (response.success) {
        setStep("success");
        setTimeout(() => {
          Alert.alert("Success", "Payment recorded successfully!", [
            {
              text: "View History",
              onPress: () =>
                navigation.navigate("PaymentHistory", {
                  roomId,
                  roomName,
                  refresh: true,
                }),
            },
            {
              text: "Back to Bills",
              onPress: () =>
                navigation.navigate("BillsMain", { refresh: true }),
            },
          ]);
        }, 500);
      }
    } catch (error) {
      Alert.alert(
        "Verification Failed",
        error.message || "Unable to verify payment. Please try again.",
      );
    } finally {
      setVerifyLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copied", "Reference number copied to clipboard");
    } catch (error) {
      Alert.alert("Error", "Failed to copy");
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0066FF" />
      </View>
    );
  }

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
          <Text style={styles.title}>GCash Payment</Text>
          <Text style={styles.subtitle}>{roomName}</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === "qr" && (
          <>
            {/* Amount Card */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Amount to Send</Text>
              <Text style={styles.amountValue}>₱{amount.toFixed(2)}</Text>
            </View>

            {/* QR Code Section */}
            <View style={styles.qrCard}>
              <Text style={styles.sectionTitle}>Step 1: Scan QR Code</Text>
              <View style={styles.qrContainer}>
                {qrData ? (
                  <Image
                    source={require("../../assets/gcash-qr.png")}
                    style={styles.qrImage}
                  />
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <MaterialCommunityIcons
                      name="qrcode"
                      size={80}
                      color="#ddd"
                    />
                  </View>
                )}
              </View>
              <Text style={styles.qrHint}>
                Open your GCash app and scan this code
              </Text>
            </View>

            {/* Reference Number Section */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Step 2: Reference Number</Text>
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
                      color="#0066FF"
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.referenceHint}>
                Include this in your GCash transaction note
              </Text>
            </View>

            {/* Instructions */}
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>Instructions:</Text>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>1</Text>
                <Text style={styles.instructionText}>Open your GCash App</Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>2</Text>
                <Text style={styles.instructionText}>
                  Scan the QR code above or manually send ₱{amount.toFixed(2)}
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>3</Text>
                <Text style={styles.instructionText}>
                  Use reference number: {referenceNumber}
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>4</Text>
                <Text style={styles.instructionText}>Complete the payment</Text>
              </View>
            </View>

            {/* Verification Section */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Step 3: Verify Payment</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Your GCash Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your mobile number"
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  keyboardType="phone-pad"
                  editable={!verifyLoading}
                  placeholderTextColor="#999"
                />
              </View>

              <TouchableOpacity
                style={[styles.verifyButton, verifyLoading && styles.disabled]}
                onPress={handleVerifyPayment}
                disabled={verifyLoading}
              >
                {verifyLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.verifyButtonText}>
                    Verify Payment Sent
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={styles.verifyHint}>
                After you've sent the GCash payment, click verify to confirm
              </Text>
            </View>
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
                  navigation.navigate("PaymentHistory", { refresh: true })
                }
              >
                <MaterialIcons name="history" size={20} color="#0066FF" />
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
    fontSize: 32,
    fontWeight: "bold",
    color: "#0066FF",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
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
    color: "#0066FF",
    letterSpacing: 1,
  },
  copyButton: {
    padding: 8,
  },
  referenceHint: {
    fontSize: 12,
    color: "#999",
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
    backgroundColor: "#0066FF",
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
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
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
  verifyButton: {
    backgroundColor: "#0066FF",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  verifyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  verifyHint: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
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
    borderColor: "#0066FF",
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0066FF",
  },
  billsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0066FF",
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  billsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});

export default GCashPaymentScreen;
