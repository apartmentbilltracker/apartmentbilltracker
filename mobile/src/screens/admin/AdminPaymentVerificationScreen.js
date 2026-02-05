import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { apiService } from "../../services/apiService";

const AdminPaymentVerificationScreen = ({ navigation }) => {
  const route = useRoute();
  const { room } = route.params || {};

  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [noteText, setNoteText] = useState("");

  const fetchPendingPayments = useCallback(async () => {
    try {
      const response = await apiService.get(
        `/api/v2/payments/admin/pending/${room?._id}`,
      );
      setPendingPayments(response.pendingPayments || []);
    } catch (error) {
      console.error("Error fetching pending payments:", error);
      Alert.alert("Error", "Failed to load pending payments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [room?._id]);

  useEffect(() => {
    fetchPendingPayments();
  }, [fetchPendingPayments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPendingPayments();
  }, [fetchPendingPayments]);

  const handleVerifyPayment = async () => {
    if (!selectedPayment) return;

    try {
      setLoading(true);
      const response = await apiService.post(
        `/api/v2/payments/admin/verify/${selectedPayment._id}`,
        {
          billType: selectedPayment.billType,
          memberId: selectedPayment.memberId,
          roomId: room._id,
        },
      );

      Alert.alert("Success", `${selectedPayment.billType} payment verified!`);
      setVerifyModalVisible(false);
      setSelectedPayment(null);
      fetchPendingPayments();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Verification failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedPayment || !rejectReason.trim()) {
      Alert.alert("Error", "Please provide a reason for rejection");
      return;
    }

    try {
      setLoading(true);
      await apiService.post(
        `/api/v2/payments/admin/reject/${selectedPayment._id}`,
        {
          billType: selectedPayment.billType,
          memberId: selectedPayment.memberId,
          roomId: room._id,
          reason: rejectReason,
        },
      );

      Alert.alert("Success", "Payment rejected and reset to pending");
      setModalVisible(false);
      setSelectedPayment(null);
      setRejectReason("");
      fetchPendingPayments();
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Rejection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedPayment || !noteText.trim()) {
      Alert.alert("Error", "Please enter a note");
      return;
    }

    try {
      setLoading(true);
      await apiService.post(`/api/v2/payments/admin/add-note/${room._id}`, {
        memberId: selectedPayment.memberId,
        billType: selectedPayment.billType,
        note: noteText,
      });

      Alert.alert("Success", "Note added successfully");
      setNoteText("");
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to add note",
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "#FF9500";
      case "verified":
        return "#4CAF50";
      case "rejected":
        return "#F44336";
      default:
        return "#999";
    }
  };

  const renderPaymentItem = ({ item }) => (
    <TouchableOpacity
      style={styles.paymentCard}
      onPress={() => {
        setSelectedPayment(item);
        setModalVisible(true);
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.memberName}>{item.memberName}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{item.billType.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <Text style={styles.detailText}>
          Amount:{" "}
          <Text style={styles.amountText}>₱{item.amount.toFixed(2)}</Text>
        </Text>
        <Text style={styles.detailText}>
          Status: <Text style={styles.statusValue}>{item.status}</Text>
        </Text>
        <Text style={styles.detailText}>
          Due Date: {new Date(item.dueDate).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.verifyBtn]}
          onPress={() => {
            setSelectedPayment(item);
            setVerifyModalVisible(true);
          }}
        >
          <Text style={styles.actionBtnText}>✓ Verify</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => {
            setSelectedPayment(item);
            setModalVisible(true);
          }}
        >
          <Text style={styles.actionBtnText}>✕ Reject</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading pending payments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payment Verification</Text>
        <Text style={styles.headerSubtitle}>
          {pendingPayments.length} pending payment(s)
        </Text>
      </View>

      {pendingPayments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pending payments</Text>
          <Text style={styles.emptySubtext}>All payments are verified!</Text>
        </View>
      ) : (
        <FlatList
          data={pendingPayments}
          renderItem={renderPaymentItem}
          keyExtractor={(item) => `${item._id}-${item.billType}`}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Rejection Modal */}
      <Modal visible={modalVisible && !verifyModalVisible} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Payment</Text>

            <Text style={styles.detailLabel}>
              Member: {selectedPayment?.memberName}
            </Text>
            <Text style={styles.detailLabel}>
              Bill Type: {selectedPayment?.billType.toUpperCase()}
            </Text>
            <Text style={styles.detailLabel}>
              Amount: ₱{selectedPayment?.amount.toFixed(2)}
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Enter rejection reason..."
              multiline
              numberOfLines={4}
              value={rejectReason}
              onChangeText={setRejectReason}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setModalVisible(false);
                  setSelectedPayment(null);
                  setRejectReason("");
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rejectModalBtn}
                onPress={handleRejectPayment}
              >
                <Text style={styles.confirmBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Verify Modal */}
      <Modal visible={verifyModalVisible} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify Payment</Text>

            <ScrollView style={styles.verifyDetails}>
              <Text style={styles.detailLabel}>
                Member: {selectedPayment?.memberName}
              </Text>
              <Text style={styles.detailLabel}>
                Bill Type: {selectedPayment?.billType.toUpperCase()}
              </Text>
              <Text style={styles.detailLabel}>
                Amount: ₱{selectedPayment?.amount.toFixed(2)}
              </Text>
              <Text style={styles.detailLabel}>
                Due Date:{" "}
                {new Date(selectedPayment?.dueDate).toLocaleDateString()}
              </Text>

              <Text style={styles.noteLabel}>Add Note (Optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Add any note about this payment..."
                multiline
                numberOfLines={3}
                value={noteText}
                onChangeText={setNoteText}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setVerifyModalVisible(false);
                  setSelectedPayment(null);
                  setNoteText("");
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.verifyModalBtn}
                onPress={handleVerifyPayment}
              >
                <Text style={styles.confirmBtnText}>Verify Payment</Text>
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
    backgroundColor: "#F5F5F5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  header: {
    backgroundColor: "#2E86AB",
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#E0E0E0",
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  paymentCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    marginVertical: 8,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  cardDetails: {
    backgroundColor: "#F9F9F9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 13,
    color: "#666",
    marginVertical: 4,
  },
  amountText: {
    fontWeight: "bold",
    color: "#2E86AB",
    fontSize: 14,
  },
  statusValue: {
    fontWeight: "600",
    color: "#FF9500",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  verifyBtn: {
    backgroundColor: "#4CAF50",
  },
  rejectBtn: {
    backgroundColor: "#F44336",
  },
  actionBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: "#666",
    marginVertical: 8,
    fontWeight: "500",
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    fontSize: 14,
    textAlignVertical: "top",
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginTop: 12,
    marginBottom: 8,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
  },
  verifyDetails: {
    maxHeight: 300,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#333",
    fontWeight: "600",
  },
  rejectModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#F44336",
    justifyContent: "center",
    alignItems: "center",
  },
  verifyModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#FFF",
    fontWeight: "600",
  },
});

export default AdminPaymentVerificationScreen;
