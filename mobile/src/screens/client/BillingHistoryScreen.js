import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiService } from "../../services/apiService";

const BillingHistoryScreen = ({ route }) => {
  const { roomId, roomName } = route.params;
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editableStartDate, setEditableStartDate] = useState("");
  const [editableEndDate, setEditableEndDate] = useState("");

  useEffect(() => {
    fetchBillingCycles();
  }, [roomId]);

  const fetchBillingCycles = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(
        `/api/v2/billing-cycles/room/${roomId}`,
      );
      if (response.success) {
        setCycles(response.data);
      }
    } catch (error) {
      console.error("Error fetching cycles:", error);
      Alert.alert("Error", "Failed to load billing history");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCycle = (cycle) => {
    setSelectedCycle(cycle);
    const startDate = new Date(cycle.startDate);
    const endDate = new Date(cycle.endDate);
    setEditableStartDate(
      `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(startDate.getDate()).padStart(2, "0")}`,
    );
    setEditableEndDate(
      `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(endDate.getDate()).padStart(2, "0")}`,
    );
    setShowDetailsModal(true);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return "₱" + (parseFloat(amount) || 0).toFixed(2);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "#4CAF50";
      case "completed":
        return "#FF9800";
      default:
        return "#999";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "active":
        return "radio-button-on";
      case "completed":
        return "checkmark-circle";
      default:
        return "archive";
    }
  };

  if (loading && cycles.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#bdb246" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Billing History</Text>
        <Text style={styles.headerSubtitle}>{roomName}</Text>
      </View>

      {/* Cycles List */}
      {cycles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No billing cycles found</Text>
        </View>
      ) : (
        <FlatList
          data={cycles}
          renderItem={({ item: cycle }) => (
            <TouchableOpacity
              style={styles.cycleItem}
              onPress={() => handleSelectCycle(cycle)}
              activeOpacity={0.7}
            >
              <View style={styles.cycleItemLeft}>
                <View
                  style={[
                    styles.cycleIcon,
                    {
                      backgroundColor: getStatusColor(cycle.status) + "20",
                    },
                  ]}
                >
                  <Ionicons
                    name={getStatusIcon(cycle.status)}
                    size={24}
                    color={getStatusColor(cycle.status)}
                  />
                </View>
                <View style={styles.cycleInfo}>
                  <Text style={styles.cycleTitle}>
                    {`ID: ${cycle._id.slice(-6).toUpperCase()}`}
                  </Text>
                  <Text style={styles.cycleDate}>
                    {formatDate(cycle.startDate)} to {formatDate(cycle.endDate)}
                  </Text>
                  <View
                    style={[
                      styles.statusLabel,
                      {
                        backgroundColor: getStatusColor(cycle.status) + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusLabelText,
                        { color: getStatusColor(cycle.status) },
                      ]}
                    >
                      {cycle.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.cycleItemRight}>
                <Text style={styles.totalAmount}>
                  {formatCurrency(
                    cycle.totalBilledAmount !== undefined
                      ? cycle.totalBilledAmount
                      : (cycle.rent || 0) +
                          (cycle.electricity || 0) +
                          (cycle.waterBillAmount || 0),
                  )}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#bdb246" />
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item._id}
          scrollEnabled={true}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Cycle Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Billing Details</Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedCycle && (
              <ScrollView style={styles.modalContent}>
                {/* Cycle Period */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Billing Period</Text>
                  <View style={styles.periodBox}>
                    <View style={styles.periodItem}>
                      <Text style={styles.periodLabel}>Start Date</Text>
                      <TextInput
                        style={styles.dateInput}
                        value={editableStartDate}
                        onChangeText={setEditableStartDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#999"
                      />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.periodItem}>
                      <Text style={styles.periodLabel}>End Date</Text>
                      <TextInput
                        style={styles.dateInput}
                        value={editableEndDate}
                        onChangeText={setEditableEndDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#999"
                      />
                    </View>
                  </View>
                </View>

                {/* Bills Breakdown */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Bills Breakdown</Text>
                  <View style={styles.billsContainer}>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Rent</Text>
                      <Text style={styles.billAmount}>
                        {formatCurrency(selectedCycle.rent)}
                      </Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Electricity</Text>
                      <Text style={styles.billAmount}>
                        {formatCurrency(selectedCycle.electricity)}
                      </Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Water</Text>
                      <Text style={styles.billAmount}>
                        {formatCurrency(selectedCycle.waterBillAmount)}
                      </Text>
                    </View>
                    <View style={[styles.billRow, styles.totalRow]}>
                      <Text style={styles.billLabel}>Total</Text>
                      <Text style={styles.totalBillAmount}>
                        {formatCurrency(
                          (selectedCycle.rent || 0) +
                            (selectedCycle.electricity || 0) +
                            (selectedCycle.waterBillAmount || 0),
                        )}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Member Charges */}
                {selectedCycle.memberCharges &&
                  selectedCycle.memberCharges.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Member Charges</Text>
                      <View style={styles.membersContainer}>
                        {selectedCycle.memberCharges.map((member, index) => (
                          <View
                            key={index}
                            style={[
                              styles.memberCard,
                              index !==
                                selectedCycle.memberCharges.length - 1 &&
                                styles.memberCardBorder,
                            ]}
                          >
                            <View style={styles.memberHeader}>
                              <View>
                                <Text style={styles.memberName}>
                                  {member.name}
                                </Text>
                                {member.isPayer && (
                                  <View style={styles.payerBadge}>
                                    <Ionicons
                                      name="person-circle"
                                      size={14}
                                      color="#4CAF50"
                                    />
                                    <Text style={styles.payerText}>Payor</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.memberTotal}>
                                {formatCurrency(member.totalDue || 0)}
                              </Text>
                            </View>

                            <View style={styles.memberDetails}>
                              {member.presenceDays > 0 && (
                                <Text style={styles.memberDetailText}>
                                  Presence: {member.presenceDays} days
                                </Text>
                              )}
                              {member.rentShare > 0 && (
                                <Text style={styles.memberDetailText}>
                                  Rent Share: {formatCurrency(member.rentShare)}
                                </Text>
                              )}
                              {member.electricityShare > 0 && (
                                <Text style={styles.memberDetailText}>
                                  Electricity Share:{" "}
                                  {formatCurrency(member.electricityShare)}
                                </Text>
                              )}
                              {member.waterBillShare > 0 && (
                                <Text style={styles.memberDetailText}>
                                  Water Share:{" "}
                                  {formatCurrency(member.waterBillShare)}
                                </Text>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                {/* Meter Readings */}
                {(selectedCycle.previousMeterReading ||
                  selectedCycle.currentMeterReading) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Meter Readings</Text>
                    <View style={styles.meterContainer}>
                      <View style={styles.meterItem}>
                        <Text style={styles.meterLabel}>Previous Reading</Text>
                        <Text style={styles.meterValue}>
                          {selectedCycle.previousMeterReading || "-"}
                        </Text>
                      </View>
                      <View style={styles.meterItem}>
                        <Text style={styles.meterLabel}>Current Reading</Text>
                        <Text style={styles.meterValue}>
                          {selectedCycle.currentMeterReading || "-"}
                        </Text>
                      </View>
                      {selectedCycle.previousMeterReading &&
                        selectedCycle.currentMeterReading && (
                          <View style={styles.meterItem}>
                            <Text style={styles.meterLabel}>Usage</Text>
                            <Text style={styles.meterValue}>
                              {selectedCycle.currentMeterReading -
                                selectedCycle.previousMeterReading}{" "}
                              units
                            </Text>
                          </View>
                        )}
                    </View>
                  </View>
                )}

                {/* Status Info */}
                <View style={styles.section}>
                  <View style={styles.statusInfo}>
                    <Ionicons
                      name={getStatusIcon(selectedCycle.status)}
                      size={24}
                      color={getStatusColor(selectedCycle.status)}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.statusInfoLabel}>Status</Text>
                      <Text
                        style={[
                          styles.statusInfoValue,
                          {
                            color: getStatusColor(selectedCycle.status),
                          },
                        ]}
                      >
                        {selectedCycle.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {selectedCycle.closedAt && (
                    <Text style={styles.closedDate}>
                      Closed on {formatDate(selectedCycle.closedAt)}
                    </Text>
                  )}
                </View>
              </ScrollView>
            )}
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
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#bdb246",
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#f5f5f5",
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cycleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cycleItemLeft: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
  },
  cycleIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cycleInfo: {
    flex: 1,
  },
  cycleTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  cycleDate: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  statusLabel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  statusLabelText: {
    fontSize: 10,
    fontWeight: "600",
  },
  cycleItemRight: {
    alignItems: "flex-end",
    marginLeft: 10,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  periodBox: {
    flexDirection: "row",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  periodItem: {
    flex: 1,
    padding: 12,
    alignItems: "center",
  },
  divider: {
    width: 1,
    backgroundColor: "#e0e0e0",
  },
  periodLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  periodValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  dateInput: {
    fontSize: 14,
    color: "#333",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#bdb246",
    borderRadius: 6,
    backgroundColor: "#fffbf0",
    fontWeight: "500",
  },
  billsContainer: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  totalRow: {
    borderBottomWidth: 0,
    backgroundColor: "#fffde7",
  },
  billLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  billAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  totalBillAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  membersContainer: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  memberCard: {
    padding: 12,
  },
  memberCardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  memberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  payerBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  payerText: {
    fontSize: 11,
    color: "#4CAF50",
    fontWeight: "600",
  },
  memberTotal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  memberDetails: {
    marginLeft: 4,
  },
  memberDetailText: {
    fontSize: 12,
    color: "#666",
    marginVertical: 2,
  },
  meterContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  meterItem: {
    alignItems: "center",
  },
  meterLabel: {
    fontSize: 11,
    color: "#666",
    marginBottom: 4,
  },
  meterValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  statusInfoLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  statusInfoValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  closedDate: {
    fontSize: 12,
    color: "#999",
    marginTop: 12,
    textAlign: "center",
  },
});

export default BillingHistoryScreen;
