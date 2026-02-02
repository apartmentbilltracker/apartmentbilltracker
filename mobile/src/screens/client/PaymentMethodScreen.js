import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Image,
} from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";

const PaymentMethodScreen = ({ navigation, route }) => {
  const { roomId, roomName, amount, billType } = route.params;
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

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
      icon: "bank",
      color: "#1e88e5",
      details: "Direct bank-to-bank transfer",
    },
    {
      id: "cash",
      name: "Cash",
      description: "Pay in person",
      icon: "cash",
      color: "#43a047",
      details: "Hand-to-hand cash payment",
    },
  ];

  const handleSelectMethod = (method) => {
    setSelectedMethod(method);
    setShowConfirm(true);
  };

  const handleProceed = () => {
    if (selectedMethod.id === "gcash") {
      navigation.navigate("GCashPayment", {
        roomId,
        roomName,
        amount,
        billType,
      });
    } else if (selectedMethod.id === "bank_transfer") {
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
          <MaterialIcons name="arrow-back" size={24} color="#333" />
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

        {paymentMethods.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={styles.methodCard}
            onPress={() => handleSelectMethod(method)}
          >
            <View
              style={[
                styles.methodIconContainer,
                { backgroundColor: `${method.color}15` },
              ]}
            >
              {method.image ? (
                <Image source={method.image} style={styles.methodImage} />
              ) : (
                <MaterialCommunityIcons
                  name={method.icon}
                  size={28}
                  color={method.color}
                />
              )}
            </View>

            <View style={styles.methodContent}>
              <Text style={styles.methodName}>{method.name}</Text>
              <Text style={styles.methodDescription}>{method.description}</Text>
              <Text style={styles.methodDetails}>{method.details}</Text>
            </View>

            <MaterialIcons name="chevron-right" size={24} color="#b38604" />
          </TouchableOpacity>
        ))}

        <View style={styles.infoCard}>
          <MaterialIcons name="info" size={20} color="#0066FF" />
          <Text style={styles.infoText}>
            Choose your preferred payment method. Your payment will be recorded
            and settlements will be updated automatically.
          </Text>
        </View>

        <View style={{ height: 20 }} />
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Payment Method</Text>
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
                <Text style={styles.confirmButtonText}>Proceed</Text>
              </TouchableOpacity>
            </View>
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
  amountCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#b38604",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  amountLabel: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  amountValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#b38604",
    marginTop: 8,
  },
  billTypeText: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  methodIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  methodImage: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },
  methodContent: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  methodDescription: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
  },
  methodDetails: {
    fontSize: 12,
    color: "#bbb",
    marginTop: 4,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#0066FF",
    fontWeight: "500",
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
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  confirmationDetails: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
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
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  confirmValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 8,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#b38604",
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});

export default PaymentMethodScreen;
