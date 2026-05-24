import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";
import ModalBottomSpacer from "./ModalBottomSpacer";

const BILL_TYPES = ["rent", "electricity", "water", "internet", "custom_charges"];

const EMPTY_SELECTION = {
  rent: false,
  electricity: false,
  water: false,
  internet: false,
  custom_charges: false,
};

const SelectivePaymentModal = ({
  visible,
  onClose,
  onProceed,
  billShare,
  roomName,
  paymentStatus,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const billOptions = useMemo(
    () => [
      {
        id: "rent",
        label: "Rent",
        description: "Monthly room charge",
        icon: "home-outline",
        amount: billShare?.rent || 0,
        status: paymentStatus?.rentStatus,
      },
      {
        id: "electricity",
        label: "Electricity",
        description: "Shared electric bill",
        icon: "flash-outline",
        amount: billShare?.electricity || 0,
        status: paymentStatus?.electricityStatus,
      },
      {
        id: "water",
        label: "Water",
        description: "Shared water bill",
        icon: "water-outline",
        amount: billShare?.water || 0,
        status: paymentStatus?.waterStatus,
      },
      {
        id: "internet",
        label: "Internet",
        description: "Shared internet bill",
        icon: "wifi-outline",
        amount: billShare?.internet || 0,
        status: paymentStatus?.internetStatus,
      },
      {
        id: "custom_charges",
        label: "Additional Charges",
        description: "Other room charges",
        icon: "pricetag-outline",
        amount: billShare?.customCharges || 0,
        status: paymentStatus?.customChargesStatus,
      },
    ].map((bill) => ({
      ...bill,
      available: bill.amount > 0 && bill.status !== "paid",
      isPaid: bill.status === "paid",
    })),
    [billShare, paymentStatus],
  );

  const buildInitialSelection = () =>
    billOptions.reduce(
      (selection, bill) => ({
        ...selection,
        [bill.id]: bill.available,
      }),
      { ...EMPTY_SELECTION },
    );

  const [selectedBills, setSelectedBills] = useState(buildInitialSelection);

  useEffect(() => {
    if (visible) {
      setSelectedBills(buildInitialSelection());
    }
  }, [visible, billOptions]);

  const fmt = (num) =>
    `PHP ${Number(num || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const availableBills = useMemo(
    () => billOptions.filter((bill) => bill.available),
    [billOptions],
  );

  const paidCount = useMemo(
    () => billOptions.filter((bill) => bill.isPaid).length,
    [billOptions],
  );

  const selectedCount = useMemo(
    () => billOptions.filter((bill) => selectedBills[bill.id]).length,
    [billOptions, selectedBills],
  );

  const totalSelected = useMemo(
    () =>
      billOptions.reduce(
        (sum, bill) =>
          selectedBills[bill.id] && bill.available ? sum + bill.amount : sum,
        0,
      ),
    [selectedBills, billOptions],
  );

  const toggleBill = (billId) => {
    const bill = billOptions.find((item) => item.id === billId);
    if (!bill?.available) return;

    setSelectedBills((prev) => ({
      ...prev,
      [billId]: !prev[billId],
    }));
  };

  const selectAll = () => setSelectedBills(buildInitialSelection());
  const clearAll = () => setSelectedBills({ ...EMPTY_SELECTION });

  const handleProceed = () => {
    const selectedBillTypes = billOptions
      .filter((bill) => selectedBills[bill.id] && bill.available)
      .map((bill) => bill.id)
      .filter((type) => BILL_TYPES.includes(type));
    const billAmounts = billOptions.reduce((amounts, bill) => {
      if (selectedBills[bill.id] && bill.available) {
        amounts[bill.id] = Number(bill.amount) || 0;
      }
      return amounts;
    }, {});

    if (selectedBillTypes.length === 0) {
      Alert.alert("No Bills Selected", "Please select at least one bill to pay.");
      return;
    }

    onProceed({
      billTypes: selectedBillTypes,
      amount: totalSelected,
      breakdown: selectedBills,
      billAmounts,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="receipt-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Select Bills</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {roomName || "Your room"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.75}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>Amount selected</Text>
              <Text style={styles.summaryAmount}>{fmt(totalSelected)}</Text>
            </View>
            <View style={styles.summaryMeta}>
              <Text style={styles.summaryMetaValue}>
                {selectedCount}/{availableBills.length}
              </Text>
              <Text style={styles.summaryMetaLabel}>Selected</Text>
            </View>
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={selectAll}
              activeOpacity={0.75}
              disabled={availableBills.length === 0}
            >
              <Ionicons name="checkmark-done" size={16} color={colors.accent} />
              <Text style={styles.actionButtonText}>All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={clearAll}
              activeOpacity={0.75}
              disabled={selectedCount === 0}
            >
              <Ionicons name="remove-circle-outline" size={16} color={colors.accent} />
              <Text style={styles.actionButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Available Bills</Text>
            <Text style={styles.sectionHint}>
              {paidCount > 0 ? `${paidCount} paid` : "Tap to include"}
            </Text>
          </View>

          {availableBills.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="checkmark-done-circle-outline"
                size={36}
                color={colors.success || colors.accent}
              />
              <Text style={styles.emptyTitle}>No unpaid bills</Text>
              <Text style={styles.emptyText}>
                Everything listed here is already paid or has no amount due.
              </Text>
            </View>
          ) : null}

          <View style={styles.billsList}>
            {billOptions.map((bill) => {
              const selected = selectedBills[bill.id] && bill.available;

              return (
                <TouchableOpacity
                  key={bill.id}
                  style={[
                    styles.billItem,
                    selected && styles.billItemSelected,
                    !bill.available && styles.billItemDisabled,
                  ]}
                  onPress={() => toggleBill(bill.id)}
                  disabled={!bill.available}
                  activeOpacity={0.78}
                >
                  <View
                    style={[
                      styles.billIcon,
                      selected && styles.billIconSelected,
                      !bill.available && styles.billIconDisabled,
                    ]}
                  >
                    <Ionicons
                      name={bill.icon}
                      size={20}
                      color={
                        selected
                          ? colors.textOnAccent
                          : bill.available
                            ? colors.accent
                            : colors.textTertiary
                      }
                    />
                  </View>

                  <View style={styles.billInfo}>
                    <View style={styles.billTitleRow}>
                      <Text
                        style={[
                          styles.billLabel,
                          !bill.available && styles.billLabelDisabled,
                        ]}
                        numberOfLines={1}
                      >
                        {bill.label}
                      </Text>
                      {bill.isPaid ? (
                        <View style={styles.paidPill}>
                          <Ionicons name="checkmark" size={11} color="#fff" />
                          <Text style={styles.paidPillText}>Paid</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.billDescription,
                        !bill.available && styles.billDescriptionDisabled,
                      ]}
                      numberOfLines={1}
                    >
                      {bill.isPaid ? "Already settled" : bill.description}
                    </Text>
                  </View>

                  <View style={styles.billRight}>
                    <Text
                      style={[
                        styles.billAmount,
                        !bill.available && styles.billAmountDisabled,
                      ]}
                    >
                      {fmt(bill.amount)}
                    </Text>
                    <View
                      style={[
                        styles.checkbox,
                        selected && styles.checkboxSelected,
                        !bill.available && styles.checkboxDisabled,
                      ]}
                    >
                      {selected ? (
                        <Ionicons
                          name="checkmark"
                          size={15}
                          color={colors.textOnAccent}
                        />
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerSummary}>
            <Text style={styles.footerLabel}>Total to pay</Text>
            <Text style={styles.footerAmount}>{fmt(totalSelected)}</Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              activeOpacity={0.75}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.proceedButton,
                totalSelected === 0 && styles.proceedButtonDisabled,
              ]}
              onPress={handleProceed}
              disabled={totalSelected === 0}
              activeOpacity={0.85}
            >
              <Ionicons name="card-outline" size={18} color={colors.textOnAccent} />
              <Text style={styles.proceedButtonText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ModalBottomSpacer />
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (colors) => {
  const isDarkMode = colors.statusBarStyle === "light-content";
  const softSurface = isDarkMode
    ? "rgba(255,255,255,0.06)"
    : "rgba(3,109,65,0.055)";
  const selectedSurface = isDarkMode
    ? "rgba(129,216,163,0.12)"
    : "rgba(202,238,232,0.72)";
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
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTextWrap: {
      flex: 1,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    title: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 20,
    },
    summaryCard: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: softBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
    summaryLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.7,
      marginBottom: 4,
    },
    summaryAmount: {
      fontSize: 26,
      fontWeight: "900",
      color: colors.accent,
    },
    summaryMeta: {
      minWidth: 72,
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
    },
    summaryMetaValue: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.text,
    },
    summaryMetaLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
      marginTop: 1,
    },
    quickActions: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 18,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: softSurface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: softBorder,
      gap: 6,
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },
    sectionHint: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    billsList: {
      gap: 10,
    },
    billItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    billItemSelected: {
      backgroundColor: selectedSurface,
      borderColor: colors.accent,
    },
    billItemDisabled: {
      opacity: 0.58,
    },
    billIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: softSurface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: softBorder,
    },
    billIconSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    billIconDisabled: {
      backgroundColor: "transparent",
    },
    billInfo: {
      flex: 1,
      minWidth: 0,
    },
    billTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    billLabel: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
    },
    billLabelDisabled: {
      color: colors.textTertiary,
    },
    billDescription: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: "500",
      color: colors.textSecondary,
    },
    billDescriptionDisabled: {
      color: colors.textTertiary,
    },
    billRight: {
      alignItems: "flex-end",
      gap: 8,
    },
    billAmount: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.accent,
    },
    billAmountDisabled: {
      color: colors.textTertiary,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    checkboxSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accent,
    },
    checkboxDisabled: {
      backgroundColor: softSurface,
    },
    paidPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.success || "#22c55e",
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    paidPillText: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "800",
    },
    emptyState: {
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 26,
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: softBorder,
      marginBottom: 12,
    },
    emptyTitle: {
      marginTop: 10,
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    emptyText: {
      marginTop: 4,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      textAlign: "center",
    },
    footer: {
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    footerSummary: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    footerLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    footerAmount: {
      fontSize: 20,
      fontWeight: "900",
      color: colors.accent,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
    },
    button: {
      flex: 1,
      minHeight: 50,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    cancelButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
    },
    proceedButton: {
      backgroundColor: colors.accent,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
      elevation: 4,
    },
    proceedButtonDisabled: {
      opacity: 0.5,
    },
    proceedButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textOnAccent,
    },
  });
};

export default SelectivePaymentModal;
