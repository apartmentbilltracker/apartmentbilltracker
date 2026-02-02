import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { apiService } from "../../services/apiService";

const PaymentHistoryScreen = ({ navigation, route }) => {
  const { roomId, roomName } = route.params;
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchPaymentHistory = async () => {
    try {
      setError("");
      const response = await apiService.getTransactions(roomId);
      if (response.success) {
        setPayments(response.transactions || []);
      } else {
        setError("No transactions found");
      }
    } catch (err) {
      console.error("Error fetching payment history:", err);
      setError("Failed to load payment history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentHistory();
  }, [roomId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPaymentHistory();
    setRefreshing(false);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getBillTypeColor = (type) => {
    switch (type) {
      case "rent":
        return "#d32f2f";
      case "electricity":
        return "#fbc02d";
      case "water":
        return "#0288d1";
      case "total":
        return "#388e3c";
      default:
        return "#666";
    }
  };

  const getBillTypeLabel = (type) => {
    const labels = {
      rent: "Rent",
      electricity: "Electricity",
      water: "Water",
      total: "Total",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Payment History</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#b38604" />
        </View>
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
        <View>
          <Text style={styles.title}>Payment History</Text>
          <Text style={styles.subtitle}>{roomName}</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {payments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="payment" size={60} color="#ddd" />
          <Text style={styles.emptyText}>No payment history yet</Text>
          <Text style={styles.emptySubtext}>
            Payments will appear here when marked as paid
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.listContainer}>
            {payments.map((payment, index) => (
              <View key={payment._id || index} style={styles.paymentCard}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <View
                      style={[
                        styles.billTypeIcon,
                        {
                          backgroundColor: getBillTypeColor(payment.billType),
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={
                          payment.billType === "rent"
                            ? "home"
                            : payment.billType === "electricity"
                              ? "flash-on"
                              : payment.billType === "water"
                                ? "opacity"
                                : "receipt-long"
                        }
                        size={20}
                        color="#fff"
                      />
                    </View>
                    <View style={styles.cardTitle}>
                      <Text style={styles.billType}>
                        {getBillTypeLabel(payment.billType)}
                      </Text>
                      <Text style={styles.paidBy}>
                        Status:{" "}
                        {payment.status.charAt(0).toUpperCase() +
                          payment.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.amount}>
                    ₱{payment.amount.toFixed(2)}
                  </Text>
                </View>

                {/* Card Details */}
                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payment Method:</Text>
                    <Text style={styles.detailValue}>
                      {payment.paymentMethod
                        .split("_")
                        .map(
                          (word) =>
                            word.charAt(0).toUpperCase() + word.slice(1),
                        )
                        .join(" ")}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(payment.transactionDate)}
                    </Text>
                  </View>

                  {payment.gcash?.referenceNumber && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Reference:</Text>
                      <Text style={styles.detailValue}>
                        {payment.gcash.referenceNumber}
                      </Text>
                    </View>
                  )}

                  {payment.bankTransfer?.referenceNumber && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Reference:</Text>
                      <Text style={styles.detailValue}>
                        {payment.bankTransfer.referenceNumber}
                      </Text>
                    </View>
                  )}

                  {payment.bankTransfer?.bankName && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Bank:</Text>
                      <Text style={styles.detailValue}>
                        {payment.bankTransfer.bankName}
                      </Text>
                    </View>
                  )}

                  {payment.cash?.receiptNumber && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Receipt #:</Text>
                      <Text style={styles.detailValue}>
                        {payment.cash.receiptNumber}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
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
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    backgroundColor: "#ffebee",
    borderLeftWidth: 4,
    borderLeftColor: "#d32f2f",
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 4,
  },
  errorText: {
    color: "#d32f2f",
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  listContainer: {
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#999",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 8,
    textAlign: "center",
  },
  paymentCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 12,
  },
  cardTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  billTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardTitle: {
    flex: 1,
  },
  billType: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  paidBy: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  amount: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#b38604",
  },
  cardDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 13,
    color: "#333",
    textAlign: "right",
    flex: 1,
    marginLeft: 8,
  },
});

export default PaymentHistoryScreen;
