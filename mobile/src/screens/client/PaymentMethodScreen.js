import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { settingsService } from "../../services/apiService";
import { screenCache } from "../../hooks/useScreenCache";
import { useTheme } from "../../theme/ThemeContext";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";

const PaymentMethodScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { roomId, roomName, amount, billType } = route.params;
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [methodStatus, setMethodStatus] = useState(null); // null = loading
  const [settingsFailed, setSettingsFailed] = useState(false);
  const [methodLoading, setMethodLoading] = useState(true);

  useEffect(() => {
    fetchMethodStatus();
  }, []);

  const fetchMethodStatus = async () => {
    setMethodLoading(true);
    try {
      const response = await settingsService.getPaymentMethods(roomId);
      const methods = response?.paymentMethods || null;
      setMethodStatus(methods);
      setSettingsFailed(false);
      return { methods, failed: false };
    } catch {
      // On error, mark as failed — do NOT block payments
      setSettingsFailed(true);
      const fallback = {
        gcash: { enabled: true, maintenanceMessage: "" },
        bank_transfer: { enabled: true, maintenanceMessage: "" },
        cash: { enabled: true, maintenanceMessage: "" },
      };
      setMethodStatus(fallback);
      return { methods: fallback, failed: true };
    } finally {
      setMethodLoading(false);
    }
  };

  // Silently fetch the latest settings without touching loading state.
  // Used inside handleProceed to guard against stale initial-load data.
  const fetchFreshStatus = async () => {
    try {
      const response = await settingsService.getPaymentMethods(roomId);
      const methods = response?.paymentMethods || null;
      if (methods) {
        setMethodStatus(methods);
        setSettingsFailed(false);
      }
      return { methods, failed: false };
    } catch {
      return { methods: null, failed: true };
    }
  };

  const isMethodDisabled = (methodId) => {
    if (!methodStatus) return false; // still loading — allow
    const entry = methodStatus[methodId];
    return entry ? entry.enabled === false : false;
  };

  const getMaintenanceMessage = (methodId) => {
    if (!methodStatus) return "";
    const entry = methodStatus[methodId];
    return entry?.maintenanceMessage || "";
  };

  const paymentMethods = [
    {
      id: "gcash",
      name: "GCash",
      description: "Send via GCash App",
      image: require("../../assets/gcash-icon.png"),
      color: "#0066FF",
      details: "Quick and secure mobile payment",
    },
    {
      id: "bank_transfer",
      name: "Bank Transfer",
      description: "BDO, BPI, Metrobank, etc.",
      icon: "business-outline",
      color: "#1e88e5",
      details: "Direct bank-to-bank transfer",
    },
    {
      id: "cash",
      name: "Cash",
      description: "Pay in person",
      icon: "cash-outline",
      color: "#43a047",
      details: "Hand-to-hand cash payment",
    },
  ];

  const handleSelectMethod = (method) => {
    if (isMethodDisabled(method.id)) {
      const customMsg = getMaintenanceMessage(method.id);
      Alert.alert(
        "Temporarily Unavailable",
        customMsg ||
          `${method.name} is currently undergoing scheduled maintenance. Please try again later or use another payment method.`,
      );
      return;
    }
    setSelectedMethod(method);
    setShowConfirm(true);
  };

  const handleProceed = async () => {
    const pmtKey = "pmt_methods_" + roomId;
    if (selectedMethod.id === "gcash") {
      // Guard: only block when settings loaded successfully but host hasn't configured
      // Do NOT block on network/fetch errors (settingsFailed) — let the screen handle it
      if (
        !settingsFailed &&
        !methodLoading &&
        methodStatus &&
        !methodStatus?.gcash?.qrUrl
      ) {
        // Silently re-fetch in case the initial load was stale
        const { methods: fresh, failed } = await fetchFreshStatus();
        if (!failed && fresh && !fresh?.gcash?.qrUrl) {
          setShowConfirm(false);
          Alert.alert(
            "Not Configured",
            "Your host has not set up GCash payment yet. Please contact your host or use a different payment method.",
            [{ text: "OK" }, { text: "Retry", onPress: fetchMethodStatus }],
          );
          return;
        }
        // Fresh data has qrUrl — proceed
      }
      // Flush stale cache so GCashPaymentScreen fetches fresh host QR
      screenCache.clear(pmtKey);
      navigation.navigate("GCashPayment", {
        roomId,
        roomName,
        amount,
        billType,
      });
    } else if (selectedMethod.id === "bank_transfer") {
      // Guard: only block when settings loaded successfully but no accounts configured
      const accounts =
        methodStatus && !settingsFailed && !methodLoading
          ? methodStatus?.bank_transfer?.accounts || []
          : null;
      if (accounts !== null && accounts.length === 0) {
        // Silently re-fetch in case the initial load was stale
        const { methods: fresh, failed } = await fetchFreshStatus();
        const freshAccounts = fresh?.bank_transfer?.accounts;
        if (!failed && (!freshAccounts || freshAccounts.length === 0)) {
          setShowConfirm(false);
          Alert.alert(
            "Not Configured",
            "Your host has not set up bank transfer accounts yet. Please contact your host or use a different payment method.",
            [{ text: "OK" }, { text: "Retry", onPress: fetchMethodStatus }],
          );
          return;
        }
        // Fresh data has accounts — proceed
      }
      // Flush stale cache so BankTransferPaymentScreen fetches fresh account list
      screenCache.clear(pmtKey);
      navigation.navigate("BankTransferPayment", {
        roomId,
        roomName,
        amount,
        billType,
      });
    } else if (selectedMethod.id === "cash") {
      navigation.navigate("CashPayment", {
        roomId,
        roomName,
        amount,
        billType,
      });
    }
    setShowConfirm(false);
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
          <Text style={styles.title}>Payment Method</Text>
          <Text style={styles.subtitle}>{roomName}</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Amount Display */}
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Amount to Pay</Text>
        <Text style={styles.amountValue}>₱{amount.toFixed(2)}</Text>
        <Text style={styles.billTypeText}>
          {billType.charAt(0).toUpperCase() + billType.slice(1)} Bill
        </Text>
      </View>

      {/* Payment Methods */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Select Payment Method</Text>

        {methodLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>Checking payment settings…</Text>
          </View>
        )}

        {paymentMethods.map((method) => {
          const disabled = isMethodDisabled(method.id);
          return (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodCard,
                disabled && styles.methodCardDisabled,
                methodLoading && { opacity: 0.6 },
              ]}
              onPress={() => !methodLoading && handleSelectMethod(method)}
              activeOpacity={disabled || methodLoading ? 0.5 : 0.7}
            >
              <View
                style={[
                  styles.methodIconContainer,
                  { backgroundColor: `${method.color}15` },
                  disabled && { opacity: 0.4 },
                ]}
              >
                {method.image ? (
                  <Image source={method.image} style={styles.methodImage} />
                ) : (
                  <Ionicons name={method.icon} size={26} color={method.color} />
                )}
              </View>

              <View
                style={[styles.methodContent, disabled && { opacity: 0.5 }]}
              >
                <Text style={styles.methodName}>{method.name}</Text>
                <Text style={styles.methodDescription}>
                  {method.description}
                </Text>
                {disabled ? (
                  <View style={styles.maintenanceBadge}>
                    <Ionicons name="construct" size={11} color="#e65100" />
                    <Text style={styles.maintenanceBadgeText}>
                      Temporarily Unavailable
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.methodDetails}>{method.details}</Text>
                )}
              </View>

              {disabled ? (
                <Ionicons name="lock-closed" size={18} color="#bbb" />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.accent}
                />
              )}
            </TouchableOpacity>
          );
        })}

        <View style={styles.infoCard}>
          <View style={styles.infoIconCircle}>
            <Ionicons
              name="information-circle"
              size={18}
              color={colors.accent}
            />
          </View>
          <Text style={styles.infoText}>
            Choose your preferred payment method. Your payment will be recorded
            and settlements will be updated automatically.
          </Text>
        </View>

        <View style={{ height: 24 }} />
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
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Payment Method</Text>
              <TouchableOpacity
                onPress={() => setShowConfirm(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedMethod && (
              <View style={styles.confirmationDetails}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Method:</Text>
                  <Text style={styles.confirmValue}>{selectedMethod.name}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Amount:</Text>
                  <Text style={styles.confirmValue}>₱{amount.toFixed(2)}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Bill Type:</Text>
                  <Text style={styles.confirmValue}>
                    {billType.charAt(0).toUpperCase() + billType.slice(1)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Room:</Text>
                  <Text style={styles.confirmValue}>{roomName}</Text>
                </View>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleProceed}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={colors.textOnAccent}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.confirmButtonText}>Proceed</Text>
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
    amountCard: {
      backgroundColor: colors.card,
      marginHorizontal: 14,
      marginTop: 14,
      paddingVertical: 22,
      paddingHorizontal: 20,
      borderRadius: 14,
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
    content: {
      flex: 1,
      padding: 14,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 4,
    },
    methodCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    methodIconContainer: {
      width: 50,
      height: 50,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
    },
    methodImage: {
      width: 34,
      height: 34,
      resizeMode: "contain",
    },
    methodContent: {
      flex: 1,
    },
    methodName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    methodDescription: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 3,
    },
    methodDetails: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 3,
    },
    methodCardDisabled: {
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
    },
    maintenanceBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: colors.warningBg,
      borderRadius: 6,
      alignSelf: "flex-start",
    },
    maintenanceBadgeText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.warning,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    loadingText: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    infoCard: {
      flexDirection: "row",
      backgroundColor: colors.warningBg,
      borderRadius: 12,
      padding: 14,
      marginTop: 14,
      gap: 10,
      alignItems: "flex-start",
    },
    infoIconCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 1,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      color: colors.accent,
      lineHeight: 18,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 18,
      paddingBottom: 8,
      maxHeight: "80%",
    },
    dragHandle: {
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
      marginBottom: 18,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    confirmationDetails: {
      backgroundColor: colors.background,
      borderRadius: 12,
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
      fontWeight: "500",
    },
    confirmValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "700",
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.badgeBg,
      marginVertical: 4,
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    confirmButton: {
      flex: 1,
      flexDirection: "row",
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
    },
  });

export default PaymentMethodScreen;
