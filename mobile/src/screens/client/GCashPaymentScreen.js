import React, { useState, useEffect, useMemo, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
import { Toast, ConfirmModal } from "../../components/CustomAlert";
import { AuthContext } from "../../context/AuthContext";
import {
  buildBillSharesFromCharge,
  findUserCharge,
  getExactBillAmount,
  getSelectedPaymentBillTypes,
} from "../../utils/paymentAmounts";
import HomeSpaceLoader from "../../components/SpaceLoader";

const GCashPaymentScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const authContext = useContext(AuthContext);
  const user = authContext?.state?.user;
  const userId = user?.id || user?._id;

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
  const [toast, setToast] = useState({
    visible: false,
    type: "success",
    message: "",
  });
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);

  const showToast = (message, type = "success") =>
    setToast({ visible: true, type, message });

  const getSelectedBillAmount = (type, index, selectedTypes) => {
    const exactAmount = getExactBillAmount(type, {
      billAmounts,
      billShares,
      totalAmount: amount,
    });

    if (exactAmount !== null) return exactAmount;
    if (selectedTypes?.length === 1 && type === "total") {
      const totalAmount = Number(amount);
      return Number.isFinite(totalAmount) && totalAmount > 0
        ? totalAmount
        : null;
    }

    return null;
  };

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

          // Calculate bill shares if target cycle exists and has member charges
          if (targetCycle?.memberCharges?.length > 0) {
            const userCharge = findUserCharge(
              targetCycle.memberCharges,
              userId,
            );
            if (userCharge) {
              setBillShares(buildBillSharesFromCharge(userCharge));
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
    setCancelConfirmVisible(true);
  };

  const executeCancelPayment = async () => {
    setCancelConfirmVisible(false);
    try {
      setCancelLoading(true);
      await apiService.cancelTransaction(transactionId);
      showToast("Payment has been cancelled", "info");
      navigation.goBack();
    } catch (err) {
      showToast(err?.message || "Failed to cancel payment", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleDownloadReceipt = async () => {
    try {
      setReceiptLoading(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        showToast(
          "Please allow gallery access to save the receipt.",
          "warning",
        );
        return;
      }
      const uri = await captureRef(receiptRef, { format: "png", quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      showToast("Receipt image saved to your gallery.", "success");
    } catch (error) {
      showToast("Failed to save receipt. Please try again.", "error");
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
        showToast(
          "Please allow access to your photo gallery to save the QR code.",
          "warning",
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
          showToast("No QR code has been configured for this host.", "warning");
          return;
        }
        const response = await fetch(hostQrUri);
        const arrayBuffer = await response.arrayBuffer();
        destFile.create();
        destFile.write(new Uint8Array(arrayBuffer));
      }

      await MediaLibrary.saveToLibraryAsync(destFile.uri);
      showToast("QR code has been saved to your gallery.", "success");
    } catch (error) {
      showToast("Failed to save QR code. Please try again.", "error");
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

      // Check if this is a batch payment (multiple bills selected)
      let selectedBillTypes = getSelectedPaymentBillTypes({
        breakdown,
        billTypes,
        billType,
        billAmounts,
        billShares,
        totalAmount: amount,
      });

      if (selectedBillTypes.length === 0) {
        showToast("Invalid bill types selected. Please try again.", "error");
        navigation.goBack();
        return;
      }

      const isBatch = selectedBillTypes.length > 1;
      const missingAmountType = selectedBillTypes.find(
        (type, index) =>
          getSelectedBillAmount(type, index, selectedBillTypes) === null,
      );

      if (missingAmountType) {
        throw new Error(
          "Exact bill amounts are still loading. Please try again in a moment.",
        );
      }

      if (isBatch) {
        // For batch payments, initiate separate transactions for each bill type
        const responses = [];
        const transactionIds = [];
        const paymentBatchId = `gcash-${Date.now()}`;

        for (let i = 0; i < selectedBillTypes.length; i++) {
          const billTypeItem = selectedBillTypes[i];
          const billAmount = getSelectedBillAmount(
            billTypeItem,
            i,
            selectedBillTypes,
          );

          const response = await apiService.initiateGCash({
            roomId,
            amount: billAmount,
            billType: billTypeItem,
            billingCycleId,
            paymentBatchId,
          });

          if (response.success) {
            responses.push(response);
            transactionIds.push(
              response.transaction.id || response.transaction._id,
            );
          }
        }

        if (
          responses.length === selectedBillTypes.length &&
          responses.every((r) => r.success)
        ) {
          setQrData(responses[0].qrData);
          setReferenceNumber(responses[0].transaction.referenceNumber);
          // Store all transaction IDs for batch verification
          setTransactionId(JSON.stringify(transactionIds));
          setStep("qr");
        } else {
          throw new Error("Failed to initiate one or more payments");
        }
      } else {
        const singleBillType = selectedBillTypes[0] || billType;
        const singleAmount =
          getSelectedBillAmount(singleBillType, 0, selectedBillTypes) ??
          Number(amount || 0);
        // Single bill payment
        const response = await apiService.initiateGCash({
          roomId,
          amount: singleAmount,
          billType: singleBillType,
          billingCycleId,
        });

        if (response.success) {
          setQrData(response.qrData);
          setReferenceNumber(response.transaction.referenceNumber);
          setTransactionId(response.transaction.id || response.transaction._id);
          setStep("qr");
        }
      }
    } catch (error) {
      showToast(error.message || "Failed to initiate GCash payment", "error");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!mobileNumber.trim()) {
      setMobileNumberError(true);
      showToast("Please enter your GCash mobile number", "warning");
      return;
    }
    setMobileNumberError(false);

    try {
      setVerifyLoading(true);

      // Check if this is a batch transaction (multiple IDs stored as JSON)
      let transactionIdsToVerify = [];
      try {
        transactionIdsToVerify = JSON.parse(transactionId);
      } catch (e) {
        transactionIdsToVerify = [transactionId];
      }

      if (transactionIdsToVerify.length > 1) {
        // Verify all transactions in the batch
        const responses = [];
        for (const txnId of transactionIdsToVerify) {
          const response = await apiService.verifyGCash({
            transactionId: txnId,
            mobileNumber,
          });
          responses.push(response);
        }

        if (responses.every((r) => r.success)) {
          setStep("success");
          setPaymentDate(new Date());
        } else {
          throw new Error("Failed to verify one or more payments");
        }
      } else {
        // Single transaction verification
        const response = await apiService.verifyGCash({
          transactionId,
          mobileNumber,
        });

        if (response.success) {
          setStep("success");
          setPaymentDate(new Date());
        }
      }
    } catch (error) {
      showToast(
        error.message || "Unable to verify payment. Please try again.",
        "error",
      );
    } finally {
      setVerifyLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await Clipboard.setStringAsync(text);
      showToast("Reference number copied to clipboard", "success");
    } catch (error) {
      showToast("Failed to copy", "error");
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
        <View style={styles.centerLoader}>
          <HomeSpaceLoader />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
      <ConfirmModal
        visible={cancelConfirmVisible}
        title="Cancel Payment"
        message="Are you sure you want to cancel this payment?"
        confirmText="Yes, Cancel"
        cancelText="No"
        confirmStyle="destructive"
        onConfirm={executeCancelPayment}
        onCancel={() => setCancelConfirmVisible(false)}
      />
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

      <ScrollViewWithDetection
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
                  <Text style={styles.titleSubtitle}>PropFlow</Text>
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
                <Text style={styles.receiptSectionTitle}>
                  Client Information
                </Text>
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
      </ScrollViewWithDetection>
    </View>
  );
};

const createStyles = (colors) => {
  const isDarkMode = colors.statusBarStyle === "light-content";
  const elevatedCard = isDarkMode ? colors.card : "#ffffff";
  const softSurface = isDarkMode
    ? "rgba(255,255,255,0.06)"
    : "rgba(3,109,65,0.055)";
  const accentSurface = isDarkMode
    ? "rgba(129,216,163,0.15)"
    : "rgba(202,238,232,0.78)";
  const softBorder = isDarkMode
    ? "rgba(158,208,205,0.16)"
    : "rgba(3,109,65,0.12)";

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: elevatedCard,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: softBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    headerContent: {
      flex: 1,
      alignItems: "center",
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    content: {
      flex: 1,
      padding: 16,
    },

    /* Amount Card */
    amountCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      paddingVertical: 24,
      paddingHorizontal: 20,
      marginBottom: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: softBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.13,
      shadowRadius: 22,
      elevation: 5,
    },
    amountLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    amountValue: {
      fontSize: 38,
      fontWeight: "900",
      color: colors.accent,
      marginTop: 6,
    },
    billTypeText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 6,
      fontWeight: "700",
    },

    /* Step Badge */
    stepBadge: {
      alignSelf: "flex-start",
      backgroundColor: accentSurface,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: softBorder,
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
      backgroundColor: elevatedCard,
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: softBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 14,
    },

    /* QR Section */
    qrCard: {
      backgroundColor: elevatedCard,
      borderRadius: 22,
      padding: 18,
      marginBottom: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: softBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
    qrContainer: {
      width: 200,
      height: 200,
      borderWidth: 1,
      borderColor: softBorder,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
      backgroundColor: "#ffffff",
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
      borderRadius: 14,
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
      backgroundColor: softSurface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: softBorder,
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
      borderRadius: 12,
      backgroundColor: accentSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    referenceHint: {
      fontSize: 11,
      color: colors.textTertiary,
    },

    /* Instructions */
    instructionsCard: {
      backgroundColor: elevatedCard,
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: softBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
    instructionsHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
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
      backgroundColor: accentSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    instructionNumber: {
      color: colors.accent,
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
      borderColor: softBorder,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: softSurface,
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
      borderRadius: 18,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
      elevation: 4,
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
      backgroundColor: accentSurface,
      borderWidth: 1,
      borderColor: softBorder,
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
      backgroundColor: elevatedCard,
      borderRadius: 20,
      padding: 18,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: softBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
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
      borderRadius: 18,
      paddingVertical: 14,
      gap: 6,
      backgroundColor: softSurface,
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
      borderColor: softBorder,
      borderRadius: 18,
      paddingVertical: 14,
      gap: 6,
      backgroundColor: elevatedCard,
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
      borderRadius: 18,
      paddingVertical: 14,
      gap: 6,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
      elevation: 4,
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
    receiptSectionTitle: {
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
};

export default GCashPaymentScreen;
