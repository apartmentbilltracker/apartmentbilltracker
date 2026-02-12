import React, { useState, useEffect, useMemo } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import apiService from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const GCashPaymentScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { roomId, roomName, amount, billType } = route.params;
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [step, setStep] = useState("qr"); // qr, verify, success
  const [mobileNumber, setMobileNumber] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);

  // Use refs for cleanup to avoid stale closures
  const stepRef = React.useRef(step);
  const transactionIdRef = React.useRef(transactionId);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    transactionIdRef.current = transactionId;
  }, [transactionId]);

  useEffect(() => {
    initiateGCashPayment();
  }, []);

  const handleBack = async () => {
    if (transactionIdRef.current && stepRef.current === "qr") {
      try {
        await apiService.cancelTransaction(transactionIdRef.current);
      } catch (err) {
        // ignore
      }
    }
    navigation.goBack();
  };

  const handleCancelPayment = async () => {
    if (!transactionId) return navigation.goBack();

    Alert.alert(
      "Cancel Payment",
      "Are you sure you want to cancel this payment?",
      [
        { text: "No" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            try {
              setCancelLoading(true);
              await apiService.cancelTransaction(transactionId);
              Alert.alert("Cancelled", "Payment has been cancelled");
              navigation.goBack();
            } catch (err) {
              Alert.alert("Error", err?.message || "Failed to cancel payment");
            } finally {
              setCancelLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleDownloadQR = async () => {
    try {
      setDownloadLoading(true);

      // Request gallery permission
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo gallery to save the QR code.",
        );
        return;
      }

      const asset = Image.resolveAssetSource(
        require("../../assets/gcash-qr.png"),
      );

      const destFile = new File(Paths.cache, "gcash-qr-" + Date.now() + ".png");

      // Fetch the asset and write to cache
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      destFile.create();
      destFile.write(new Uint8Array(arrayBuffer));

      // Save to gallery
      await MediaLibrary.saveToLibraryAsync(destFile.uri);
      Alert.alert("Saved!", "QR code has been saved to your gallery.");
    } catch (error) {
      Alert.alert("Error", "Failed to save QR code. Please try again.");
    } finally {
      setDownloadLoading(false);
    }
  };

  // Cancel pending transaction if user leaves before completing payment
  useEffect(() => {
    return () => {
      const cancelOnUnmount = async () => {
        if (transactionIdRef.current && stepRef.current === "qr") {
          try {
            await apiService.cancelTransaction(transactionIdRef.current);
          } catch (err) {
            // Ignore errors on cancel
          }
        }
      };
      cancelOnUnmount();
    };
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
        setTransactionId(response.transaction.id || response.transaction._id);
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
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={colors.accent} />
        <Text
          style={{ marginTop: 12, fontSize: 14, color: colors.textTertiary }}
        >
          Preparing payment…
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
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
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Amount to Send</Text>
              <Text style={styles.amountValue}>₱{amount.toFixed(2)}</Text>
              <Text style={styles.billTypeText}>
                {billType.charAt(0).toUpperCase() + billType.slice(1)} Bill
              </Text>
            </View>

            {/* QR Code Section */}
            <View style={styles.qrCard}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Step 1</Text>
              </View>
              <Text style={styles.sectionTitle}>Scan QR Code</Text>
              <View style={styles.qrContainer}>
                {qrData ? (
                  <Image
                    source={require("../../assets/gcash-qr.png")}
                    style={styles.qrImage}
                  />
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <Ionicons
                      name="qr-code-outline"
                      size={72}
                      color={colors.skeleton}
                    />
                  </View>
                )}
              </View>
              {qrData && (
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={handleDownloadQR}
                  disabled={downloadLoading}
                  activeOpacity={0.7}
                >
                  {downloadLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.textOnAccent}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="download-outline"
                        size={18}
                        color={colors.textOnAccent}
                      />
                      <Text style={styles.downloadButtonText}>
                        Save QR Code
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              <Text style={styles.qrHint}>
                Open your GCash app and scan this code
              </Text>
            </View>

            {/* Reference Number Section */}
            <View style={styles.card}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Step 2</Text>
              </View>
              <Text style={styles.sectionTitle}>Reference Number</Text>
              <View style={styles.referenceBox}>
                <Text style={styles.referenceLabel}>Reference Number</Text>
                <View style={styles.referenceContent}>
                  <Text style={styles.referenceNumber}>{referenceNumber}</Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(referenceNumber)}
                    style={styles.copyButton}
                  >
                    <Ionicons
                      name="copy-outline"
                      size={18}
                      color={colors.accent}
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
              <View style={styles.instructionsHeader}>
                <Ionicons name="list-outline" size={16} color={colors.accent} />
                <Text style={styles.instructionsTitle}>Instructions</Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.instructionDot}>
                  <Text style={styles.instructionNumber}>1</Text>
                </View>
                <Text style={styles.instructionText}>Open your GCash App</Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.instructionDot}>
                  <Text style={styles.instructionNumber}>2</Text>
                </View>
                <Text style={styles.instructionText}>
                  Scan the QR code above or manually send ₱{amount.toFixed(2)}
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.instructionDot}>
                  <Text style={styles.instructionNumber}>3</Text>
                </View>
                <Text style={styles.instructionText}>
                  Use reference number: {referenceNumber}
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.instructionDot}>
                  <Text style={styles.instructionNumber}>4</Text>
                </View>
                <Text style={styles.instructionText}>Complete the payment</Text>
              </View>
            </View>

            {/* Verification Section */}
            <View style={styles.card}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Step 3</Text>
              </View>
              <Text style={styles.sectionTitle}>Verify Payment</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Your GCash Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="09XX XXX XXXX"
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  keyboardType="phone-pad"
                  editable={!verifyLoading}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              <TouchableOpacity
                style={[styles.verifyButton, verifyLoading && styles.disabled]}
                onPress={handleVerifyPayment}
                disabled={verifyLoading}
              >
                {verifyLoading ? (
                  <ActivityIndicator size="small" color={colors.textOnAccent} />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color={colors.textOnAccent}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.verifyButtonText}>
                      Verify Payment Sent
                    </Text>
                  </>
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
                <Text style={styles.successLabel}>Reference</Text>
                <Text style={styles.successValue}>{referenceNumber}</Text>
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

            <View style={styles.successButtons}>
              <TouchableOpacity
                style={styles.historyButton}
                onPress={() =>
                  navigation.navigate("PaymentHistory", { refresh: true })
                }
              >
                <Ionicons name="time-outline" size={18} color={colors.accent} />
                <Text style={styles.historyButtonText}>View History</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.billsButton}
                onPress={() => navigation.navigate("Bills", { refresh: true })}
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
      marginBottom: 12,
    },

    /* QR Section */
    qrCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 14,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    qrContainer: {
      width: 200,
      height: 200,
      borderWidth: 1.5,
      borderColor: colors.divider,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
      backgroundColor: colors.cardAlt,
      overflow: "hidden",
    },
    qrImage: {
      width: 200,
      height: 200,
    },
    qrPlaceholder: {
      width: 200,
      height: 200,
      justifyContent: "center",
      alignItems: "center",
    },
    downloadButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 10,
      marginBottom: 12,
      gap: 8,
    },
    downloadButtonText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
    },
    qrHint: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: "center",
    },

    /* Reference */
    referenceBox: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
    },
    referenceLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.3,
      marginBottom: 6,
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
      fontWeight: "700",
      color: colors.text,
      letterSpacing: 1,
    },
    copyButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.warningBg,
      justifyContent: "center",
      alignItems: "center",
    },
    referenceHint: {
      fontSize: 11,
      color: colors.textTertiary,
    },

    /* Instructions */
    instructionsCard: {
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
    instructionsHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 14,
    },
    instructionsTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    instructionItem: {
      flexDirection: "row",
      marginBottom: 12,
      alignItems: "flex-start",
    },
    instructionDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    instructionNumber: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "700",
    },
    instructionText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 19,
      paddingTop: 3,
    },

    /* Form */
    formGroup: {
      marginBottom: 14,
    },
    label: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 6,
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
    verifyButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    verifyButtonText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
    verifyHint: {
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: "center",
      marginTop: 4,
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
  });

export default GCashPaymentScreen;
