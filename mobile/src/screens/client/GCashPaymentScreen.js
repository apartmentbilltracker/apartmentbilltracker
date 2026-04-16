import React, { useState, useEffect, useMemo, useContext } from "react";
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
import { captureRef } from "react-native-view-shot";
import apiService, {
  roomService,
  billingCycleService,
} from "../../services/apiService";
import { settingsService } from "../../services/apiService";
import { screenCache } from "../../hooks/useScreenCache";
import { useTheme } from "../../theme/ThemeContext";
import { AuthContext } from "../../context/AuthContext";

const GCashPaymentScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const authContext = useContext(AuthContext);
  const user = authContext?.state?.user;
  const userId = user?.id || user?._id;

  const { roomId, roomName, amount, billType, billingCycleId } = route.params;
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState(null);
  const [hostQrUri, setHostQrUri] = useState(null); // host-uploaded QR image
  const [referenceNumber, setReferenceNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paymentDate, setPaymentDate] = useState(null);
  const [step, setStep] = useState("qr"); // qr, verify, success
  const [mobileNumber, setMobileNumber] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [billingData, setBillingData] = useState(null);
  const [billShares, setBillShares] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  const [barcodeNumber] = useState(
    Math.random().toString().slice(2, 14).padEnd(12, "0"),
  );
  const receiptRef = React.useRef(null);

  // Helper functions
  const getRoomAddress = () => {
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
    return memberInfo?.isPayer ? "Payor" : "Non-Payor";
  };
  const [mobileNumberFocused, setMobileNumberFocused] = useState(false);
  const [mobileNumberError, setMobileNumberError] = useState(false);

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
    // Always fetch fresh payment settings from server (room-specific)
    const pmtKey = "pmt_methods_" + roomId;
    settingsService
      .getPaymentMethods(roomId)
      .then((res) => {
        if (res?.paymentMethods) screenCache.write(pmtKey, res.paymentMethods);
        const url = res?.paymentMethods?.gcash?.qrUrl;
        if (url) setHostQrUri(url);
      })
      .catch(() => {
        // Fallback to cache if API fails
        screenCache.read(pmtKey).then((cached) => {
          const qrUrl = cached?.gcash?.qrUrl;
          if (qrUrl) setHostQrUri(qrUrl);
        });
      });

    // Fetch room and billing data
    const fetchData = async () => {
      try {
        // Use getRoomById to get complete room data including address
        const roomResponse = await roomService.getRoomById(roomId);
        const room =
          roomResponse?.data?.room ||
          roomResponse?.room ||
          roomResponse?.data ||
          roomResponse;
        setRoomData(room);

        const cycles = await billingCycleService.getBillingCycles(roomId);
        const cycles_arr = Array.isArray(cycles)
          ? cycles
          : cycles?.billingCycles || cycles?.data || [];
        const active = cycles_arr.find((c) => c.status === "active");
        setBillingData(active);

        // Get current user's member info
        if (room?.members && Array.isArray(room.members)) {
          const member = room.members.find(
            (m) =>
              String(m.user?.id || m.user?._id || m.user) === String(userId),
          );
          setMemberInfo(member);

          // Calculate bill shares if active cycle exists
          if (active?.memberCharges?.length > 0) {
            const userCharge = active.memberCharges.find(
              (c) => String(c.userId) === String(userId),
            );
            if (userCharge) {
              setBillShares({
                rent: userCharge.rentShare || 0,
                electricity: userCharge.electricityShare || 0,
                internet: userCharge.internetShare || 0,
                water:
                  userCharge.isPayer !== false
                    ? userCharge.waterBillShare || 0
                    : userCharge.waterOwn || 0,
                total: userCharge.totalDue || 0,
              });
            }
          }
        }
      } catch (error) {
        // Silently handle error - use defaults
      }
    };

    if (roomId && userId) {
      fetchData();
    }
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

      const destFile = new File(Paths.cache, "gcash-qr-" + Date.now() + ".png");

      if (hostQrUri && hostQrUri.startsWith("data:")) {
        // Base64 data URI — decode and write directly
        const base64 = hostQrUri.split(",")[1];
        destFile.create();
        destFile.write(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
      } else {
        if (!hostQrUri) {
          Alert.alert(
            "No QR Available",
            "No QR code has been configured for this host.",
          );
          return;
        }
        const response = await fetch(hostQrUri);
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
        billingCycleId,
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
      setMobileNumberError(true);
      Alert.alert("Required", "Please enter your GCash mobile number");
      return;
    }
    setMobileNumberError(false);

    try {
      setVerifyLoading(true);
      const response = await apiService.verifyGCash({
        transactionId,
        mobileNumber,
      });

      if (response.success) {
        setStep("success");
        setPaymentDate(new Date());
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
                  hostQrUri ? (
                    <Image source={{ uri: hostQrUri }} style={styles.qrImage} />
                  ) : (
                    <View
                      style={[
                        styles.qrPlaceholder,
                        { alignItems: "center", justifyContent: "center" },
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
                  )
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
                  style={[
                    styles.input,
                    mobileNumberFocused && styles.inputFocused,
                    mobileNumberError &&
                      !mobileNumber.trim() &&
                      styles.inputError,
                  ]}
                  placeholder="09XX XXX XXXX"
                  value={mobileNumber}
                  onChangeText={(v) => {
                    setMobileNumber(v);
                    if (mobileNumberError && v.trim())
                      setMobileNumberError(false);
                  }}
                  onFocus={() => setMobileNumberFocused(true)}
                  onBlur={() => setMobileNumberFocused(false)}
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
            <View
              ref={receiptRef}
              collapsable={false}
              style={styles.receiptCapture}
            >
              {/* Professional Receipt Format */}
              <View style={styles.receiptContent}>
                {/* Title */}
                <View style={styles.titleRow}>
                  <Text style={styles.receiptTitle}>GCASH RECEIPT</Text>
                  <Text style={styles.titleSubtitle}>
                    Apartment Bill Tracker
                  </Text>
                </View>

                {/* Dashed Line */}
                <Text style={styles.dashedLine}>
                  {Array(46).fill("-").join("")}
                </Text>

                {/* Receipt Header Info */}
                <View style={styles.headerInfo}>
                  <View style={styles.headerRow}>
                    <Text style={styles.headerLabelRight}>
                      Room: {roomName}
                    </Text>
                    <Text style={styles.headerLabel}>
                      Receipt No. {referenceNumber || transactionId}
                    </Text>
                  </View>
                  <View style={styles.headerRow}>
                    <Text style={styles.headerLabel}>
                      Ref. No. {referenceNumber}
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
                  {Array(46).fill("-").join("")}
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
                  {Array(46).fill("-").join("")}
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
                  {Array(46).fill("-").join("")}
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
                  {Array(46).fill("-").join("")}
                </Text>

                {/* Card Info Section */}
                <View style={styles.cardSection}>
                  <Text style={styles.cardNumber}>
                    **** **** {mobileNumber.slice(-4) || "XXXX"}
                  </Text>
                  <Text style={styles.cardType}>GCASH WALLET</Text>
                </View>

                {/* Dashed Line */}
                <Text style={styles.dashedLine}>
                  {Array(46).fill("-").join("")}
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
                  {Array(46).fill("-").join("")}
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
    inputFocused: {
      borderColor: colors.accent,
      borderWidth: 1.5,
    },
    inputError: {
      borderColor: colors.error,
      borderWidth: 1.5,
      backgroundColor: colors.errorBg,
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
    receiptCapture: {
      width: "100%",
      alignItems: "center",
      backgroundColor: colors.background,
      paddingVertical: 8,
    },
    receiptContent: {
      backgroundColor: "#f5f5f5",
      paddingHorizontal: 16,
      paddingVertical: 20,
      width: "100%",
      alignItems: "center",
    },
    receiptPaper: {
      width: "100%",
      backgroundColor: "#fff",
      borderRadius: 16,
      paddingVertical: 20,
      paddingHorizontal: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
      borderWidth: 1,
      borderColor: "#e8e8e8",
    },
    receiptHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    },
    receiptAppIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: "#1a73e8",
      justifyContent: "center",
      alignItems: "center",
    },
    receiptAppName: {
      fontSize: 13,
      fontWeight: "700",
      color: "#1a1a1a",
      letterSpacing: 0.2,
    },
    receiptAppTagline: {
      fontSize: 10,
      color: "#888",
      marginTop: 1,
    },
    receiptTitleBar: {
      backgroundColor: "#f0f7ff",
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: "center",
      marginBottom: 10,
      borderWidth: 1,
      borderColor: "#d0e4ff",
    },
    receiptTitleText: {
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 1.5,
      color: "#1a73e8",
    },
    receiptStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      backgroundColor: "#fff3e0",
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
      alignSelf: "center",
      marginBottom: 14,
      borderWidth: 1,
      borderColor: "#ffcc80",
    },
    receiptStatusText: {
      fontSize: 11,
      fontWeight: "600",
      color: "#e65100",
    },
    receiptDash: {
      borderStyle: "dashed",
      borderWidth: 1,
      borderColor: "#ddd",
      borderRadius: 1,
      marginVertical: 12,
    },
    receiptRows: {
      gap: 7,
    },
    receiptRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    receiptRowLabel: {
      fontSize: 12,
      color: "#888",
      flex: 1,
    },
    receiptRowValue: {
      fontSize: 12,
      fontWeight: "600",
      color: "#1a1a1a",
      flex: 2,
      textAlign: "right",
    },
    receiptAmountSection: {
      alignItems: "center",
      paddingVertical: 4,
    },
    receiptAmountLabel: {
      fontSize: 10,
      letterSpacing: 1.5,
      color: "#888",
      fontWeight: "600",
      marginBottom: 4,
    },
    receiptAmountValue: {
      fontSize: 28,
      fontWeight: "800",
      color: "#43a047",
      letterSpacing: 0.5,
    },
    receiptFooter: {
      fontSize: 11,
      fontWeight: "700",
      color: "#1a73e8",
      textAlign: "center",
      marginTop: 2,
    },
    receiptFooterSub: {
      fontSize: 10,
      color: "#aaa",
      textAlign: "center",
      marginTop: 2,
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
    cardSection: {
      marginBottom: 8,
      alignItems: "center",
    },
    cardNumber: {
      fontSize: 8,
      color: "#333",
      letterSpacing: 2,
      marginBottom: 4,
      fontWeight: "600",
    },
    cardType: {
      fontSize: 7,
      color: "#666",
      letterSpacing: 1,
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

export default GCashPaymentScreen;
