import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { MaterialIcons, FontAwesome } from "@expo/vector-icons";
import { apiService } from "../../services/apiService";

const SettlementScreen = ({ navigation, route }) => {
  const { roomId, roomName } = route.params;
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("pending"); // pending, settled, partial

  const fetchSettlements = async () => {
    try {
      setError("");
      const response = await apiService.getSettlements(roomId, activeTab);
      if (response.success) {
        setSettlements(response.settlements || []);
      }
    } catch (err) {
      console.error("Error fetching settlements:", err);
      setError("Failed to load settlements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, [roomId, activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSettlements();
    setRefreshing(false);
  };

  const handleMarkAsSettled = async (settlement) => {
    Alert.alert(
      "Record Settlement",
      `Mark settlement between ${settlement.debtor.name} and ${settlement.creditor.name} as settled?`,
      [
        { text: "Cancel", onPress: () => {}, style: "cancel" },
        {
          text: "Settled",
          onPress: async () => {
            try {
              const response = await apiService.recordSettlement(
                roomId,
                settlement.debtor._id,
                settlement.creditor._id,
                settlement.amount,
                settlement.amount,
                "Settled",
              );

              if (response.success) {
                Alert.alert("Success", "Settlement recorded successfully");
                await fetchSettlements();
              }
            } catch (err) {
              Alert.alert("Error", "Failed to record settlement");
            }
          },
        },
      ],
    );
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "pending":
        return { bg: "#ffebee", text: "#d32f2f" };
      case "partial":
        return { bg: "#fff3e0", text: "#e65100" };
      case "settled":
        return { bg: "#e8f5e9", text: "#2e7d32" };
      default:
        return { bg: "#f5f5f5", text: "#666" };
    }
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
          <Text style={styles.title}>Settlements</Text>
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
          <Text style={styles.title}>Settlements</Text>
          <Text style={styles.subtitle}>{roomName}</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Tab Buttons */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "pending" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("pending")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "pending" && styles.tabTextActive,
            ]}
          >
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "partial" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("partial")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "partial" && styles.tabTextActive,
            ]}
          >
            Partial
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "settled" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("settled")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "settled" && styles.tabTextActive,
            ]}
          >
            Settled
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {settlements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="handshake-o" size={60} color="#ddd" />
          <Text style={styles.emptyText}>
            {activeTab === "settled"
              ? "No settled accounts"
              : "No open settlements"}
          </Text>
          <Text style={styles.emptySubtext}>
            {activeTab === "settled"
              ? "All settlement records will appear here"
              : "Settlements will appear once bills are tracked"}
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
            {settlements.map((settlement, index) => {
              const statusColors = getStatusBadgeColor(settlement.status);
              const outstandingAmount =
                settlement.amount - settlement.settlementAmount;

              return (
                <View
                  key={settlement._id || index}
                  style={styles.settlementCard}
                >
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleContainer}>
                      <View style={styles.avatarContainer}>
                        <Text style={styles.avatar}>
                          {settlement.debtor.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.cardTitle}>
                        <Text style={styles.debtorName}>
                          {settlement.debtor.name}
                        </Text>
                        <Text style={styles.owesText}>
                          owes {settlement.creditor.name}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.statusBadgeContainer}>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: statusColors.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: statusColors.text },
                          ]}
                        >
                          {settlement.status.charAt(0).toUpperCase() +
                            settlement.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Amount Details */}
                  <View style={styles.amountContainer}>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Amount:</Text>
                      <Text style={styles.amountValue}>
                        ₱{settlement.amount.toFixed(2)}
                      </Text>
                    </View>

                    {settlement.settlementAmount > 0 && (
                      <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>Paid:</Text>
                        <Text style={styles.paidAmount}>
                          ₱{settlement.settlementAmount.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {outstandingAmount > 0 && (
                      <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>Outstanding:</Text>
                        <Text style={styles.outstandingAmount}>
                          ₱{outstandingAmount.toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Card Footer */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.dateText}>
                      {new Date(settlement.createdAt).toLocaleDateString(
                        "en-PH",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </Text>

                    {settlement.status !== "settled" && (
                      <TouchableOpacity
                        style={styles.markSettledButton}
                        onPress={() => handleMarkAsSettled(settlement)}
                      >
                        <MaterialIcons
                          name="check-circle"
                          size={18}
                          color="#b38604"
                        />
                        <Text style={styles.markSettledText}>Mark Settled</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
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
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabButtonActive: {
    borderBottomColor: "#b38604",
  },
  tabText: {
    fontSize: 14,
    color: "#999",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#b38604",
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
  settlementCard: {
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  cardTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#b38604",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatar: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  cardTitle: {
    flex: 1,
  },
  debtorName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  owesText: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  statusBadgeContainer: {
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  amountContainer: {
    backgroundColor: "#f9f9f9",
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  amountValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  paidAmount: {
    fontSize: 14,
    color: "#2e7d32",
    fontWeight: "600",
  },
  outstandingAmount: {
    fontSize: 14,
    color: "#d32f2f",
    fontWeight: "600",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    fontSize: 12,
    color: "#999",
  },
  markSettledButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#b38604",
    gap: 4,
  },
  markSettledText: {
    fontSize: 12,
    color: "#b38604",
    fontWeight: "600",
  },
});

export default SettlementScreen;
