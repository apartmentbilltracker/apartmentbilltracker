import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { settingsService } from "../../services/apiService";
import { screenCache } from "../../hooks/useScreenCache";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";

const PaymentMethodScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const {
    roomId,
    roomName,
    amount = 0,
    billType,
    billTypes,
    billingCycleId,
    breakdown,
    billAmounts,
  } = route.params;

  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [methodStatus, setMethodStatus] = useState(null);
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
      const fallback = {
        gcash: { enabled: true, maintenanceMessage: "" },
        bank_transfer: { enabled: true, maintenanceMessage: "" },
        cash: { enabled: true, maintenanceMessage: "" },
      };
      setSettingsFailed(true);
      setMethodStatus(fallback);
      return { methods: fallback, failed: true };
    } finally {
      setMethodLoading(false);
    }
  };

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

  const paymentMethods = useMemo(
    () => [
      {
        id: "gcash",
        name: "GCash",
        description: "Mobile wallet payment",
        image: require("../../assets/gcash-icon.png"),
        color: "#0066FF",
        details: "Upload a receipt after sending payment.",
      },
      {
        id: "bank_transfer",
        name: "Bank Transfer",
        description: "BDO, BPI, Metrobank, and more",
        icon: "business-outline",
        color: "#1e88e5",
        details: "Use one of your host's bank accounts.",
      },
      {
        id: "cash",
        name: "Cash",
        description: "Pay your host in person",
        icon: "cash-outline",
        color: "#43a047",
        details: "Record the cash payment for tracking.",
      },
    ],
    [],
  );

  const getBillTitle = () => {
    const billNames = {
      rent: "Rent",
      electricity: "Electricity",
      water: "Water",
      internet: "Internet",
      custom_charges: "Additional Charges",
      total: "All Bills",
    };

    if (breakdown) {
      const selectedBills = Object.entries(breakdown)
        .filter(([, isSelected]) => isSelected)
        .map(([type]) => billNames[type] || type);
      return selectedBills.length >= 5
        ? "All Bills"
        : selectedBills.join(" / ") || "Selected Bills";
    }

    if (Array.isArray(billTypes) && billTypes.length > 0) {
      return billTypes.map((type) => billNames[type] || type).join(" / ");
    }

    return billNames[billType] || "Selected Bills";
  };

  const billTitle = getBillTitle();
  const amountDisplay = `PHP ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const isMethodDisabled = (methodId) => {
    if (!methodStatus) return false;
    const entry = methodStatus[methodId];
    return entry ? entry.enabled === false : false;
  };

  const getMaintenanceMessage = (methodId) => {
    if (!methodStatus) return "";
    return methodStatus[methodId]?.maintenanceMessage || "";
  };

  const configuredMethodCount = paymentMethods.filter(
    (method) => !isMethodDisabled(method.id),
  ).length;

  const handleSelectMethod = (method) => {
    if (methodLoading) return;

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

  const navigateToPaymentScreen = (screenName) => {
    navigation.navigate(screenName, {
      roomId,
      roomName,
      amount,
      billType: billType || "total",
      billTypes: billTypes || [billType || "total"],
      billingCycleId,
      breakdown,
      billAmounts,
    });
  };

  const handleProceed = async () => {
    const pmtKey = "pmt_methods_" + roomId;

    if (selectedMethod.id === "gcash") {
      if (
        !settingsFailed &&
        !methodLoading &&
        methodStatus &&
        !methodStatus?.gcash?.qrUrl
      ) {
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
      }
      screenCache.clear(pmtKey);
      navigateToPaymentScreen("GCashPayment");
    } else if (selectedMethod.id === "bank_transfer") {
      const accounts =
        methodStatus && !settingsFailed && !methodLoading
          ? methodStatus?.bank_transfer?.accounts || []
          : null;
      if (accounts !== null && accounts.length === 0) {
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
      }
      screenCache.clear(pmtKey);
      navigateToPaymentScreen("BankTransferPayment");
    } else if (selectedMethod.id === "cash") {
      navigateToPaymentScreen("CashPayment");
    }

    setShowConfirm(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.title}>Payment Method</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {roomName || "Your room"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={fetchMethodStatus}
          style={styles.iconButton}
          activeOpacity={0.75}
          disabled={methodLoading}
        >
          {methodLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="refresh" size={20} color={colors.text} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollViewWithDetection
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.amountCard}>
          <View style={styles.amountTopRow}>
            <View style={styles.amountIcon}>
              <Ionicons
                name="receipt-outline"
                size={20}
                color={colors.accent}
              />
            </View>
            <Text style={styles.amountLabel}>Amount to pay</Text>
          </View>
          <Text style={styles.amountValue}>{amountDisplay}</Text>
          <View style={styles.billPill}>
            <Ionicons
              name="document-text-outline"
              size={13}
              color={colors.accent}
            />
            <Text style={styles.billTypeText} numberOfLines={1}>
              {billTitle}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Choose a method</Text>
            <Text style={styles.sectionSubtitle}>
              {methodLoading
                ? "Checking host settings"
                : `${configuredMethodCount} method${configuredMethodCount === 1 ? "" : "s"} available`}
            </Text>
          </View>
          {settingsFailed ? (
            <View style={styles.offlinePill}>
              <Ionicons name="cloud-offline-outline" size={13} color="#92400e" />
              <Text style={styles.offlinePillText}>Using fallback</Text>
            </View>
          ) : null}
        </View>

        {paymentMethods.map((method) => {
          const disabled = isMethodDisabled(method.id);
          const selected = selectedMethod?.id === method.id && showConfirm;
          const maintenanceMessage = getMaintenanceMessage(method.id);

          return (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodCard,
                selected && styles.methodCardSelected,
                disabled && styles.methodCardDisabled,
                methodLoading && styles.methodCardLoading,
              ]}
              onPress={() => handleSelectMethod(method)}
              activeOpacity={disabled || methodLoading ? 0.55 : 0.8}
              disabled={methodLoading}
            >
              <View
                style={[
                  styles.methodIconContainer,
                  { backgroundColor: `${method.color}18` },
                  disabled && styles.methodIconDisabled,
                ]}
              >
                {method.image ? (
                  <Image source={method.image} style={styles.methodImage} />
                ) : (
                  <Ionicons name={method.icon} size={25} color={method.color} />
                )}
              </View>

              <View style={styles.methodContent}>
                <View style={styles.methodTitleRow}>
                  <Text
                    style={[
                      styles.methodName,
                      disabled && styles.methodTextDisabled,
                    ]}
                    numberOfLines={1}
                  >
                    {method.name}
                  </Text>
                  {disabled ? (
                    <View style={styles.maintenanceBadge}>
                      <Ionicons name="construct" size={11} color="#e65100" />
                      <Text style={styles.maintenanceBadgeText}>Paused</Text>
                    </View>
                  ) : (
                    <View style={styles.availableBadge}>
                      <Ionicons name="checkmark" size={11} color="#fff" />
                      <Text style={styles.availableBadgeText}>Available</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.methodDescription,
                    disabled && styles.methodTextDisabled,
                  ]}
                  numberOfLines={1}
                >
                  {method.description}
                </Text>
                <Text
                  style={[
                    styles.methodDetails,
                    disabled && styles.methodTextDisabled,
                  ]}
                  numberOfLines={2}
                >
                  {disabled
                    ? maintenanceMessage || "Temporarily unavailable"
                    : method.details}
                </Text>
              </View>

              <Ionicons
                name={disabled ? "lock-closed" : "chevron-forward"}
                size={20}
                color={disabled ? colors.textTertiary : colors.accent}
              />
            </TouchableOpacity>
          );
        })}

        <View style={styles.infoCard}>
          <View style={styles.infoIconCircle}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={colors.accent}
            />
          </View>
          <Text style={styles.infoText}>
            Payment details are checked against your host's current settings
            before you continue.
          </Text>
        </View>
      </ScrollViewWithDetection>

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
              <View>
                <Text style={styles.modalTitle}>Confirm Method</Text>
                <Text style={styles.modalSubtitle}>
                  Review where this payment will continue.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowConfirm(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedMethod ? (
              <View style={styles.confirmationCard}>
                <View style={styles.selectedMethodRow}>
                  <View
                    style={[
                      styles.confirmIcon,
                      { backgroundColor: `${selectedMethod.color}18` },
                    ]}
                  >
                    {selectedMethod.image ? (
                      <Image
                        source={selectedMethod.image}
                        style={styles.confirmMethodImage}
                      />
                    ) : (
                      <Ionicons
                        name={selectedMethod.icon}
                        size={24}
                        color={selectedMethod.color}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedMethodName}>
                      {selectedMethod.name}
                    </Text>
                    <Text style={styles.selectedMethodDesc}>
                      {selectedMethod.description}
                    </Text>
                  </View>
                </View>

                <View style={styles.confirmDivider} />

                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Amount</Text>
                  <Text style={styles.confirmValue}>{amountDisplay}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Bills</Text>
                  <Text style={styles.confirmValue} numberOfLines={2}>
                    {billTitle}
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Room</Text>
                  <Text style={styles.confirmValue} numberOfLines={1}>
                    {roomName || "Your room"}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowConfirm(false)}
                activeOpacity={0.75}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleProceed}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="arrow-forward-circle-outline"
                  size={18}
                  color={colors.textOnAccent}
                />
                <Text style={styles.confirmButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
            <ModalBottomSpacer />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors) => {
  const isDarkMode = colors.statusBarStyle === "light-content";
  const softSurface = isDarkMode
    ? "rgba(255,255,255,0.06)"
    : "rgba(3,109,65,0.055)";
  const softBorder = isDarkMode
    ? "rgba(158,208,205,0.16)"
    : "rgba(3,109,65,0.12)";
  const selectedSurface = isDarkMode
    ? "rgba(129,216,163,0.12)"
    : "rgba(202,238,232,0.72)";

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.background,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    headerContent: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: "600",
    },
    content: {
      flex: 1,
    },
    contentInner: {
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 28,
    },
    amountCard: {
      backgroundColor: colors.card,
      paddingVertical: 18,
      paddingHorizontal: 18,
      borderRadius: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: softBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 18,
      elevation: 4,
    },
    amountTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginBottom: 10,
    },
    amountIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
    },
    amountLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },
    amountValue: {
      fontSize: 34,
      fontWeight: "900",
      color: colors.accent,
      marginBottom: 12,
    },
    billPill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      maxWidth: "100%",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
    },
    billTypeText: {
      flexShrink: 1,
      fontSize: 12,
      color: colors.accent,
      fontWeight: "800",
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: 12,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: "600",
    },
    offlinePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "#fef3c7",
      borderWidth: 1,
      borderColor: "#f59e0b",
    },
    offlinePillText: {
      fontSize: 11,
      fontWeight: "800",
      color: "#92400e",
    },
    methodCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 15,
      marginBottom: 11,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    methodCardSelected: {
      backgroundColor: selectedSurface,
      borderColor: colors.accent,
    },
    methodCardDisabled: {
      borderStyle: "dashed",
      opacity: 0.62,
    },
    methodCardLoading: {
      opacity: 0.62,
    },
    methodIconContainer: {
      width: 54,
      height: 54,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    methodIconDisabled: {
      opacity: 0.55,
    },
    methodImage: {
      width: 36,
      height: 36,
      resizeMode: "contain",
    },
    methodContent: {
      flex: 1,
      minWidth: 0,
    },
    methodTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 2,
    },
    methodName: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    methodDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
      marginTop: 2,
    },
    methodDetails: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 4,
      lineHeight: 16,
    },
    methodTextDisabled: {
      color: colors.textTertiary,
    },
    availableBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.success || "#22c55e",
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    availableBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#fff",
    },
    maintenanceBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      backgroundColor: colors.warningBg || "#fef3c7",
      borderRadius: 999,
    },
    maintenanceBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.warning || "#e65100",
    },
    infoCard: {
      flexDirection: "row",
      backgroundColor: softSurface,
      borderRadius: 16,
      padding: 14,
      marginTop: 10,
      gap: 10,
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: softBorder,
    },
    infoIconCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.accentSurface || softSurface,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 1,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
      fontWeight: "500",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      paddingBottom: 8,
      maxHeight: "82%",
    },
    dragHandle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.skeleton || colors.border,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 10,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 16,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.text,
    },
    modalSubtitle: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      marginTop: 3,
    },
    modalCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    confirmationCard: {
      backgroundColor: colors.background,
      borderRadius: 18,
      padding: 16,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: softBorder,
    },
    selectedMethodRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    confirmIcon: {
      width: 50,
      height: 50,
      borderRadius: 17,
      justifyContent: "center",
      alignItems: "center",
    },
    confirmMethodImage: {
      width: 34,
      height: 34,
      resizeMode: "contain",
    },
    selectedMethodName: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    selectedMethodDesc: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      marginTop: 2,
    },
    confirmDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 14,
    },
    confirmRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 16,
      paddingVertical: 7,
    },
    confirmLabel: {
      fontSize: 13,
      color: colors.textTertiary,
      fontWeight: "700",
    },
    confirmValue: {
      flex: 1,
      textAlign: "right",
      fontSize: 14,
      color: colors.text,
      fontWeight: "800",
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
    },
    modalButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 7,
    },
    cancelButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textSecondary,
    },
    confirmButton: {
      backgroundColor: colors.accent,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
      elevation: 4,
    },
    confirmButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textOnAccent,
    },
  });
};

export default PaymentMethodScreen;
