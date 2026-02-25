import React, { useState, useEffect, useMemo } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import apiService from "../../services/apiService";
import { settingsService } from "../../services/apiService";
import { screenCache } from "../../hooks/useScreenCache";
import { useTheme } from "../../theme/ThemeContext";

const BankTransferPaymentScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { roomId, roomName, amount, billType } = route.params;
  const [step, setStep] = useState("bankDetails"); // bankDetails, qr, success
  const [bankName, setBankName] = useState("");
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [hostBankAccounts, setHostBankAccounts] = useState(null); // null = loading
  const [qrData, setQrData] = useState(null);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [transactionId, setTransactionId] = useState("");

  // Use refs for cleanup to avoid stale closures
  const stepRef = React.useRef(step);
  const transactionIdRef = React.useRef(transactionId);
  const receiptRef = React.useRef(null);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    transactionIdRef.current = transactionId;
  }, [transactionId]);

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

  const handleCancelTransfer = () => {
    if (!transactionId) return navigation.goBack();

    Alert.alert(
      "Cancel Transfer",
      "Are you sure you want to cancel this transfer?",
      [
        { text: "No" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            try {
              setCancelLoading(true);
              await apiService.cancelTransaction(transactionId);
              Alert.alert("Cancelled", "Transfer has been cancelled");
              navigation.goBack();
            } catch (err) {
              Alert.alert("Error", err?.message || "Failed to cancel transfer");
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
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo gallery to save the QR code.",
        );
        return;
      }

      const bankQrUri = selectedBank?.qrUrl;
      if (!bankQrUri) {
        Alert.alert(
          "No QR Available",
          "No QR code has been configured for this bank account.",
        );
        return;
      }

      const destFile = new File(Paths.cache, "bank-qr-" + Date.now() + ".png");

      if (bankQrUri.startsWith("data:")) {
        // Base64 data URI — decode and write directly
        const base64 = bankQrUri.split(",")[1];
        destFile.create();
        destFile.write(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
      } else {
        const response = await fetch(bankQrUri);
        const arrayBuffer = await response.arrayBuffer();
        destFile.create();
        destFile.write(new Uint8Array(arrayBuffer));
      }

      await MediaLibrary.saveToLibraryAsync(destFile.uri);
      Alert.alert("Saved!", "QR code has been saved to your gallery.");
    } catch (error) {
      Alert.alert("Error", "Failed to save QR code. Please try again.");
    } finally {
      setDownloadLoading(false);
    }
  };

  // Use host-configured bank accounts only — no hardcoded fallback
  const availableBanks = (() => {
    if (!hostBankAccounts || hostBankAccounts.length === 0) return [];
    const enabled = hostBankAccounts.filter((a) => a.enabled !== false);
    if (enabled.length === 0) return [];
    return enabled.map((a) => ({
      name: a.bankName,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
      details: a.bankName,
      qrUrl: a.qrUrl || null,
    }));
  })();

  const selectedBank =
    availableBanks.find((b) => b.name === bankName) || availableBanks[0];

  useEffect(() => {
    if (step === "bankDetails") {
      setLoading(false);
    }
  }, [step]);

  // Fetch host-configured bank accounts for this room (cache-first, 10-min TTL)
  useEffect(() => {
    const pmtKey = "pmt_methods_" + roomId;
    screenCache.read(pmtKey).then((cached) => {
      if (cached?.bank_transfer?.accounts) {
        const accounts = cached.bank_transfer.accounts.filter(
          (a) => a.enabled !== false,
        );
        setHostBankAccounts(cached.bank_transfer.accounts);
        if (accounts.length > 0) setBankName(accounts[0].bankName);
        return;
      }
      settingsService
        .getPaymentMethods(roomId)
        .then((res) => {
          if (res?.paymentMethods)
            screenCache.write(pmtKey, res.paymentMethods);
          const accounts = res?.paymentMethods?.bank_transfer?.accounts;
          if (Array.isArray(accounts) && accounts.length > 0) {
            setHostBankAccounts(accounts);
            const first = accounts.find((a) => a.enabled !== false);
            if (first) setBankName(first.bankName);
          } else {
            setHostBankAccounts([]);
          }
        })
        .catch(() => {
          setHostBankAccounts([]);
        });
    });
  }, []);

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
        setTransactionId(response.transaction.id || response.transaction._id);
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

  const copyToClipboard = async (text) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copied", "Copied to clipboard");
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
          Preparing transfer…
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
          <Text style={styles.title}>Bank Transfer</Text>
          <Text style={styles.subtitle}>{roomName}</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === "bankDetails" && (
          <>
            {/* Amount Card */}
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Amount to Transfer</Text>
              <Text style={styles.amountValue}>₱{amount.toFixed(2)}</Text>
              <Text style={styles.billTypeText}>
                {billType.charAt(0).toUpperCase() + billType.slice(1)} Bill
              </Text>
            </View>

            {/* Bank Selection */}
            {hostBankAccounts !== null && availableBanks.length === 0 ? (
              <View
                style={[
                  styles.card,
                  { alignItems: "center", paddingVertical: 28 },
                ]}
              >
                <Ionicons
                  name="business-outline"
                  size={40}
                  color={colors.textMuted || "#999"}
                />
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "700",
                    fontSize: 15,
                    marginTop: 12,
                    marginBottom: 6,
                  }}
                >
                  No Bank Accounts Configured
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary || "#666",
                    fontSize: 13,
                    textAlign: "center",
                    lineHeight: 20,
                  }}
                >
                  Your host has not set up bank transfer accounts yet. Please
                  contact your host or use a different payment method.
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>Step 1</Text>
                </View>
                <Text style={styles.sectionTitle}>Select Bank</Text>
                <TouchableOpacity
                  style={styles.bankSelector}
                  onPress={() => setShowBankSelector(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.bankSelectorLeft}>
                    <View style={styles.bankIconContainer}>
                      <Ionicons
                        name="business-outline"
                        size={18}
                        color={colors.accent}
                      />
                    </View>
                    <View>
                      <Text style={styles.bankSelectorLabel}>Bank</Text>
                      <Text style={styles.bankSelectorValue}>
                        {selectedBank?.name || bankName || "Loading…"}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Bank Details */}
            {selectedBank && (
              <View style={styles.card}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>Step 2</Text>
                </View>
                <Text style={styles.sectionTitle}>Bank Details</Text>

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
                      <Ionicons
                        name="copy-outline"
                        size={16}
                        color={colors.accent}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

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
                <Text style={styles.instructionText}>
                  Log in to your {bankName} online banking
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.instructionDot}>
                  <Text style={styles.instructionNumber}>2</Text>
                </View>
                <Text style={styles.instructionText}>
                  Transfer ₱{amount.toFixed(2)} to the account above
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.instructionDot}>
                  <Text style={styles.instructionNumber}>3</Text>
                </View>
                <Text style={styles.instructionText}>
                  Use the reference number in the transaction description
                </Text>
              </View>
            </View>

            {/* Proceed Button — only show when banks are configured */}
            {availableBanks.length > 0 && (
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={initiateBankTransfer}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="arrow-forward-circle-outline"
                  size={18}
                  color={colors.textOnAccent}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.proceedButtonText}>Proceed to QR Code</Text>
              </TouchableOpacity>
            )}
          </>
        )}

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
                <Text style={styles.stepBadgeText}>Step 3</Text>
              </View>
              <Text style={styles.sectionTitle}>Transfer via QR Code</Text>
              <View style={styles.qrContainer}>
                {selectedBank?.qrUrl ? (
                  <Image
                    source={{ uri: selectedBank.qrUrl }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={[
                      styles.qrImage,
                      {
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.inputBg,
                        borderRadius: 8,
                      },
                    ]}
                  >
                    <Ionicons
                      name="qr-code-outline"
                      size={56}
                      color={colors.textMuted || "#999"}
                    />
                    <Text
                      style={{
                        color: colors.textMuted || "#999",
                        fontSize: 12,
                        marginTop: 8,
                        textAlign: "center",
                      }}
                    >
                      QR code not{"\n"}configured
                    </Text>
                  </View>
                )}
              </View>
              {selectedBank?.qrUrl && (
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
                Use your {bankName} mobile app to scan and transfer
              </Text>
            </View>

            {/* Reference Number Section */}
            <View style={styles.card}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Step 4</Text>
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
                      size={16}
                      color={colors.accent}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.referenceHint}>
                Include this in your bank transfer description
              </Text>
            </View>

            {/* Confirm Button */}
            <TouchableOpacity
              style={[styles.confirmButton, verifyLoading && styles.disabled]}
              onPress={handleConfirmTransfer}
              disabled={verifyLoading}
              activeOpacity={0.85}
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
                  <Text style={styles.confirmButtonText}>
                    Confirm Transfer Sent
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.confirmHint}>
              Click confirm once you've sent the transfer from your bank app
            </Text>

            {/* Cancel Button */}
            <TouchableOpacity
              style={[styles.cancelButton, cancelLoading && styles.disabled]}
              onPress={handleCancelTransfer}
              disabled={cancelLoading}
              activeOpacity={0.85}
            >
              {cancelLoading ? (
                <ActivityIndicator size="small" color="#c62828" />
              ) : (
                <>
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color="#c62828"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.cancelButtonText}>Cancel Transfer</Text>
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

              <Text style={styles.successTitle}>Transfer Confirmed!</Text>
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
                  <Text style={styles.successLabel}>Bank</Text>
                  <Text style={styles.successValue}>{bankName}</Text>
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
                  navigation.navigate("PaymentHistory", { refresh: true })
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

      {/* Bank Selector Modal */}
      <Modal
        visible={showBankSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalDragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Bank</Text>
              <TouchableOpacity
                onPress={() => setShowBankSelector(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.bankList}>
              {availableBanks.map((bank) => (
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
                  activeOpacity={0.7}
                >
                  <View style={styles.bankListLeft}>
                    <View
                      style={[
                        styles.bankListIcon,
                        bankName === bank.name && styles.bankListIconActive,
                      ]}
                    >
                      <Ionicons
                        name="business-outline"
                        size={20}
                        color={
                          bankName === bank.name
                            ? colors.accent
                            : colors.textTertiary
                        }
                      />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.bankListName,
                          bankName === bank.name && styles.bankListNameActive,
                        ]}
                      >
                        {bank.name}
                      </Text>
                      <Text style={styles.bankListDetails}>{bank.details}</Text>
                    </View>
                  </View>
                  {bankName === bank.name && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.accent}
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

    /* Bank Selector */
    bankSelector: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.cardAlt,
    },
    bankSelectorLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    bankIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.warningBg,
      justifyContent: "center",
      alignItems: "center",
    },
    bankSelectorLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    bankSelectorValue: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginTop: 2,
    },

    /* Bank Details */
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
    },
    detailLabel: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    detailValue: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      maxWidth: "60%",
      textAlign: "right",
    },
    accountNumberContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    accountNumber: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.accent,
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
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.skeleton,
      marginVertical: 4,
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

    /* Proceed Button */
    proceedButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    proceedButtonText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
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
    referenceHint: {
      fontSize: 11,
      color: colors.textTertiary,
    },

    /* Confirm & Cancel */
    confirmButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    confirmButtonText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
    confirmHint: {
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: "center",
      marginBottom: 12,
    },
    cancelButton: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    cancelButtonText: {
      color: "#c62828",
      fontSize: 14,
      fontWeight: "600",
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
      maxHeight: "80%",
      paddingBottom: 20,
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
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    modalCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    bankList: {
      padding: 16,
    },
    bankListItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 8,
      borderRadius: 14,
      backgroundColor: colors.cardAlt,
    },
    selectedBankItem: {
      backgroundColor: colors.warningBg,
      borderWidth: 1.5,
      borderColor: "#b38604",
    },
    bankListLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    bankListIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      justifyContent: "center",
      alignItems: "center",
    },
    bankListIconActive: {
      backgroundColor: colors.warningBg,
    },
    bankListName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    bankListNameActive: {
      color: colors.accent,
      fontWeight: "700",
    },
    bankListDetails: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
  });

export default BankTransferPaymentScreen;
