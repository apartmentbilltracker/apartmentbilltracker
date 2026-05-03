import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import ModalBottomSpacer from "./ModalBottomSpacer";

const SelectivePaymentModal = ({
  visible,
  onClose,
  onProceed,
  billShare,
  roomName,
  paymentStatus,
}) => {
  const { colors } = useTheme();
  // Initialize selectedBills based on available (unpaid) bills only
  const getInitialSelectedBills = () => ({
    rent: billShare?.rent > 0 && paymentStatus?.rentStatus !== "paid",
    electricity:
      billShare?.electricity > 0 && paymentStatus?.electricityStatus !== "paid",
    water: billShare?.water > 0 && paymentStatus?.waterStatus !== "paid",
    internet:
      billShare?.internet > 0 && paymentStatus?.internetStatus !== "paid",
    custom_charges:
      billShare?.customCharges > 0 &&
      paymentStatus?.customChargesStatus !== "paid",
  });

  const [selectedBills, setSelectedBills] = useState(getInitialSelectedBills());

  const billOptions = useMemo(
    () => [
      {
        id: "rent",
        label: "Rent",
        icon: "home",
        amount: billShare?.rent || 0,
        available:
          (billShare?.rent || 0) > 0 && paymentStatus?.rentStatus !== "paid",
        isPaid: paymentStatus?.rentStatus === "paid",
      },
      {
        id: "electricity",
        label: "Electricity",
        icon: "flash",
        amount: billShare?.electricity || 0,
        available:
          (billShare?.electricity || 0) > 0 &&
          paymentStatus?.electricityStatus !== "paid",
        isPaid: paymentStatus?.electricityStatus === "paid",
      },
      {
        id: "water",
        label: "Water",
        icon: "water",
        amount: billShare?.water || 0,
        available:
          (billShare?.water || 0) > 0 && paymentStatus?.waterStatus !== "paid",
        isPaid: paymentStatus?.waterStatus === "paid",
      },
      {
        id: "internet",
        label: "Internet",
        icon: "wifi",
        amount: billShare?.internet || 0,
        available:
          (billShare?.internet || 0) > 0 &&
          paymentStatus?.internetStatus !== "paid",
        isPaid: paymentStatus?.internetStatus === "paid",
      },
      {
        id: "custom_charges",
        label: "Additional Charges",
        icon: "pricetag",
        amount: billShare?.customCharges || 0,
        available:
          (billShare?.customCharges || 0) > 0 &&
          paymentStatus?.customChargesStatus !== "paid",
        isPaid: paymentStatus?.customChargesStatus === "paid",
      },
    ],
    [billShare, paymentStatus],
  );

  // Format currency
  const fmt = (num) => {
    if (!num) return "₱0.00";
    return (
      "₱" +
      Number(num).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  // Calculate total selected
  const totalSelected = useMemo(() => {
    return billOptions.reduce((sum, bill) => {
      return selectedBills[bill.id] ? sum + bill.amount : sum;
    }, 0);
  }, [selectedBills, billOptions]);

  // Toggle bill selection
  const toggleBill = (billId) => {
    setSelectedBills((prev) => ({
      ...prev,
      [billId]: !prev[billId],
    }));
  };

  // Select all available
  const selectAll = () => {
    const newSelection = {};
    billOptions.forEach((bill) => {
      if (bill.available) {
        newSelection[bill.id] = true;
      }
    });
    setSelectedBills(newSelection);
  };

  // Clear all
  const clearAll = () => {
    setSelectedBills({
      rent: false,
      electricity: false,
      water: false,
      internet: false,
      custom_charges: false,
    });
  };

  // Proceed with payment
  const handleProceed = () => {
    const selectedBillTypes = billOptions
      .filter((bill) => selectedBills[bill.id])
      .map((bill) => bill.id)
      // Double-check: ensure all bill types are valid snake_case
      .map((bt) => {
        const normalized = String(bt).trim().toLowerCase();
        if (
          [
            "rent",
            "electricity",
            "water",
            "internet",
            "custom_charges",
          ].includes(normalized)
        ) {
          return normalized;
        }
        // Fallback conversion for customcharges
        if (normalized === "customcharges") return "custom_charges";
        return null;
      })
      .filter((bt) => bt !== null);

    if (selectedBillTypes.length === 0) {
      Alert.alert(
        "No Bills Selected",
        "Please select at least one bill to pay",
      );
      return;
    }

    onProceed({
      billTypes: selectedBillTypes,
      amount: totalSelected,
      breakdown: selectedBills,
    });
  };

  const styles = createStyles(colors);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Select Bills to Pay</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
        >
          {/* Room Info */}
          <View style={styles.roomInfo}>
            <Ionicons name="home" size={20} color={colors.accent} />
            <Text style={styles.roomName}>{roomName}</Text>
          </View>

          {/* Bills List */}
          <View style={styles.billsList}>
            <Text style={styles.sectionLabel}>Available Bills</Text>

            {billOptions.map((bill) => (
              <View key={bill.id}>
                <TouchableOpacity
                  style={[
                    styles.billItem,
                    !bill.available && styles.billItemDisabled,
                  ]}
                  onPress={() => bill.available && toggleBill(bill.id)}
                  disabled={!bill.available}
                  activeOpacity={0.7}
                >
                  <View style={styles.billCheckbox}>
                    {selectedBills[bill.id] && bill.available ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.textOnAccent}
                      />
                    ) : (
                      <View style={styles.checkboxEmpty} />
                    )}
                  </View>

                  <View style={styles.billInfo}>
                    <View style={styles.billHeader}>
                      <Ionicons
                        name={bill.icon}
                        size={18}
                        color={
                          bill.available ? colors.accent : colors.textTertiary
                        }
                      />
                      <Text
                        style={[
                          styles.billLabel,
                          !bill.available && styles.billLabelDisabled,
                        ]}
                      >
                        {bill.label}
                      </Text>
                      {bill.isPaid && (
                        <View
                          style={{
                            marginLeft: 8,
                            backgroundColor: colors.success,
                            borderRadius: 12,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.textOnAccent,
                              fontSize: 11,
                              fontWeight: "600",
                            }}
                          >
                            ✓ Paid
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.billAmount,
                      !bill.available && styles.billAmountDisabled,
                    ]}
                  >
                    {fmt(bill.amount)}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.divider} />
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={selectAll}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-done" size={16} color={colors.accent} />
              <Text style={styles.actionButtonText}>Select All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={clearAll}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color={colors.accent} />
              <Text style={styles.actionButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {/* Total Summary */}
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Amount to Pay:</Text>
            <Text style={styles.totalAmount}>{fmt(totalSelected)}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              activeOpacity={0.7}
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
              activeOpacity={0.7}
            >
              <Ionicons
                name="card"
                size={18}
                color={colors.textOnAccent}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.proceedButtonText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ModalBottomSpacer />
      </View>
    </Modal>
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
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    roomInfo: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 24,
      paddingHorizontal: 12,
      paddingVertical: 14,
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    roomName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginLeft: 10,
      flex: 1,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
      textTransform: "uppercase",
      marginBottom: 12,
      letterSpacing: 0.5,
    },
    billsList: {
      marginBottom: 12,
    },
    billItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 10,
      backgroundColor: colors.card,
      borderRadius: 10,
      marginBottom: 8,
    },
    billItemDisabled: {
      opacity: 0.5,
    },
    billCheckbox: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    checkboxEmpty: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: colors.border,
    },
    billInfo: {
      flex: 1,
    },
    billHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    billLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    billLabelDisabled: {
      color: colors.textTertiary,
    },
    billAmount: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.accent,
    },
    billAmountDisabled: {
      color: colors.textTertiary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: 6,
    },
    quickActions: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 24,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.accent,
      gap: 6,
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.accent,
    },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    totalBox: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 14,
      backgroundColor: colors.card,
      borderRadius: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    totalLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    totalAmount: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.accent,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
    },
    cancelButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    proceedButton: {
      backgroundColor: colors.accent,
    },
    proceedButtonDisabled: {
      opacity: 0.5,
    },
    proceedButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textOnAccent,
    },
  });

export default SelectivePaymentModal;
