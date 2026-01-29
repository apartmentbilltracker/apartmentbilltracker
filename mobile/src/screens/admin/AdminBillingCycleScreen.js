import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiService } from "../../services/apiService";

const AdminBillingCycleScreen = ({ route }) => {
  const { roomId, roomName } = route.params;
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedDateField, setSelectedDateField] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    rent: "",
    electricity: "",
    waterBillAmount: "",
    previousMeterReading: "",
    currentMeterReading: "",
  });

  // Date input strings for editable TextInput
  const [startDateStr, setStartDateStr] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDateStr, setEndDateStr] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  );

  // Fetch billing cycles
  useEffect(() => {
    fetchCycles();
  }, [roomId]);

  const fetchCycles = async () => {
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
      Alert.alert("Error", "Failed to fetch billing cycles");
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (text, field) => {
    // Store the text as-is for display
    if (field === "startDate") {
      setStartDateStr(text);
      // Only parse if it matches YYYY-MM-DD format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(text)) {
        const date = new Date(text);
        setFormData((prev) => ({
          ...prev,
          startDate: date,
        }));
      }
    } else if (field === "endDate") {
      setEndDateStr(text);
      // Only parse if it matches YYYY-MM-DD format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(text)) {
        const date = new Date(text);
        setFormData((prev) => ({
          ...prev,
          endDate: date,
        }));
      }
    }
  };

  const handleCreateCycle = async () => {
    try {
      // Validation
      if (
        !formData.rent ||
        !formData.electricity ||
        !formData.waterBillAmount
      ) {
        Alert.alert("Error", "Please fill in all required fields");
        return;
      }

      if (formData.startDate >= formData.endDate) {
        Alert.alert("Error", "Start date must be before end date");
        return;
      }

      setLoading(true);

      const payload = {
        roomId,
        startDate: formData.startDate.toISOString(),
        endDate: formData.endDate.toISOString(),
        rent: parseFloat(formData.rent),
        electricity: parseFloat(formData.electricity),
        waterBillAmount: parseFloat(formData.waterBillAmount),
        previousMeterReading: formData.previousMeterReading
          ? parseFloat(formData.previousMeterReading)
          : null,
        currentMeterReading: formData.currentMeterReading
          ? parseFloat(formData.currentMeterReading)
          : null,
      };

      const response = await apiService.post(
        "/api/v2/billing-cycles/create",
        payload,
      );

      if (response.success) {
        Alert.alert("Success", "Billing cycle created successfully");
        setShowCreateModal(false);
        resetForm();
        fetchCycles();
      }
    } catch (error) {
      console.error("Error creating cycle:", error);
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to create billing cycle",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCloseCycle = async (cycleId) => {
    Alert.alert(
      "Close Cycle",
      "Are you sure you want to close this billing cycle? It cannot be modified after closing.",
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Close",
          onPress: async () => {
            try {
              setLoading(true);
              const response = await apiService.put(
                `/api/v2/billing-cycles/${cycleId}/close`,
                {},
              );
              if (response.success) {
                Alert.alert("Success", "Billing cycle closed successfully");
                fetchCycles();
              }
            } catch (error) {
              console.error("Error closing cycle:", error);
              Alert.alert("Error", "Failed to close billing cycle");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const resetForm = () => {
    const newStart = new Date();
    const newEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setFormData({
      startDate: newStart,
      endDate: newEnd,
      rent: "",
      electricity: "",
      waterBillAmount: "",
      previousMeterReading: "",
      currentMeterReading: "",
    });
    setStartDateStr(newStart.toISOString().split("T")[0]);
    setEndDateStr(newEnd.toISOString().split("T")[0]);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "#4CAF50";
      case "completed":
        return "#FF9800";
      case "archived":
        return "#999";
      default:
        return "#666";
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
        <Text style={styles.headerTitle}>Billing Cycles</Text>
        <Text style={styles.headerSubtitle}>{roomName}</Text>
      </View>

      {/* Create Button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.createButtonText}>New Billing Cycle</Text>
      </TouchableOpacity>

      {/* Cycles List */}
      <ScrollView
        style={styles.cyclesList}
        showsVerticalScrollIndicator={false}
      >
        {cycles.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No billing cycles yet</Text>
          </View>
        ) : (
          cycles.map((cycle) => (
            <View key={cycle._id} style={styles.cycleCard}>
              {/* Cycle Header */}
              <View style={styles.cycleHeader}>
                <View>
                  <Text style={styles.cycleTitle}>
                    {`ID: ${cycle._id.slice(-6).toUpperCase()}`}
                  </Text>
                  <Text style={styles.cycleDate}>
                    {formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(cycle.status) },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {cycle.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Cycle Details */}
              <View style={styles.cycleDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Rent:</Text>
                  <Text style={styles.detailValue}>₱{cycle.rent}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Electricity:</Text>
                  <Text style={styles.detailValue}>₱{cycle.electricity}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Water Bill:</Text>
                  <Text style={styles.detailValue}>
                    ₱{cycle.waterBillAmount}
                  </Text>
                </View>
                {cycle.membersCount > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Members:</Text>
                    <Text style={styles.detailValue}>{cycle.membersCount}</Text>
                  </View>
                )}
                {cycle.totalBilledAmount > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Billed:</Text>
                    <Text style={[styles.detailValue, styles.totalAmount]}>
                      ₱{cycle.totalBilledAmount}
                    </Text>
                  </View>
                )}
              </View>

              {/* Actions */}
              {cycle.status === "active" && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => handleCloseCycle(cycle._id)}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.closeButtonText}>Close Cycle</Text>
                </TouchableOpacity>
              )}

              {cycle.status === "completed" && (
                <View style={styles.completedInfo}>
                  <Ionicons name="checkmark-done" size={20} color="#FF9800" />
                  <Text style={styles.completedText}>
                    Closed on {formatDate(cycle.closedAt)}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Create Modal */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Billing Cycle</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Start Date */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Start Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={startDateStr}
                  onChangeText={(text) => handleDateChange(text, "startDate")}
                  placeholderTextColor="#999"
                />
                <Text style={styles.helperText}>Enter date as YYYY-MM-DD</Text>
              </View>

              {/* End Date */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>End Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={endDateStr}
                  onChangeText={(text) => handleDateChange(text, "endDate")}
                  placeholderTextColor="#999"
                />
                <Text style={styles.helperText}>Enter date as YYYY-MM-DD</Text>
              </View>

              {/* Rent */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Rent Amount *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={formData.rent}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, rent: text }))
                  }
                  placeholderTextColor="#999"
                />
              </View>

              {/* Electricity */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Electricity Amount *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={formData.electricity}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, electricity: text }))
                  }
                  placeholderTextColor="#999"
                />
              </View>

              {/* Water Bill */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Water Bill Amount *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={formData.waterBillAmount}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, waterBillAmount: text }))
                  }
                  placeholderTextColor="#999"
                />
              </View>

              {/* Meter Readings */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Previous Meter Reading (Optional)
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  value={formData.previousMeterReading}
                  onChangeText={(text) =>
                    setFormData((prev) => ({
                      ...prev,
                      previousMeterReading: text,
                    }))
                  }
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Current Meter Reading (Optional)
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  value={formData.currentMeterReading}
                  onChangeText={(text) =>
                    setFormData((prev) => ({
                      ...prev,
                      currentMeterReading: text,
                    }))
                  }
                  placeholderTextColor="#999"
                />
              </View>

              {/* Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.submitButton]}
                  onPress={handleCreateCycle}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Create Cycle</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cyclesList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },
  cycleCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#bdb246",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cycleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cycleTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  cycleDate: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  cycleDetails: {
    marginVertical: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 13,
    color: "#333",
    fontWeight: "600",
  },
  totalAmount: {
    color: "#4CAF50",
    fontSize: 14,
  },
  closeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF9800",
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 12,
    gap: 8,
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  completedInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginTop: 12,
    backgroundColor: "#FFF3E0",
    borderRadius: 6,
    gap: 8,
  },
  completedText: {
    color: "#FF9800",
    fontSize: 13,
    fontWeight: "500",
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
    paddingTop: 16,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#333",
    backgroundColor: "#f9f9f9",
  },
  helperText: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
    fontStyle: "italic",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f9f9f9",
    gap: 10,
  },
  dateText: {
    fontSize: 15,
    color: "#333",
    flex: 1,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    marginBottom: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#e0e0e0",
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "600",
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: "#bdb246",
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});

export default AdminBillingCycleScreen;
