import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { apiService } from "../../services/apiService";

const AdminAdjustmentsScreen = ({ navigation }) => {
  const route = useRoute();
  const { room, cycleId } = route.params || {};

  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [actualCycleId, setActualCycleId] = useState(cycleId);

  // Form states
  const [adjustmentType, setAdjustmentType] = useState("rent"); // rent, electricity, water, internet
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundBillType, setRefundBillType] = useState("rent"); // rent, electricity, water, internet
  const [refundReason, setRefundReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteBillType, setNoteBillType] = useState("general");

  const fetchBreakdown = useCallback(async () => {
    try {
      setLoading(true);

      // If cycleId not provided, try to get active cycle from the room
      let idToUse = actualCycleId;
      if (!idToUse && room) {
        try {
          const cycleResponse = await apiService.get(
            `/api/v2/billing-cycles/active/${room._id}`,
          );
          if (cycleResponse.data?._id) {
            idToUse = cycleResponse.data._id;
            setActualCycleId(idToUse);
          }
        } catch (error) {
          console.error("Error fetching active cycle:", error);
        }
      }

      if (!idToUse) {
        Alert.alert("Error", "No active billing cycle found");
        setLoading(false);
        return;
      }

      const response = await apiService.get(
        `/api/v2/admin/billing/breakdown/${idToUse}`,
      );
      setBreakdown(response.breakdown);
    } catch (error) {
      console.error("Error fetching breakdown:", error);
      Alert.alert("Error", "Failed to load billing details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actualCycleId, cycleId, room?._id]);

  useEffect(() => {
    fetchBreakdown();
  }, [fetchBreakdown]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBreakdown();
  }, [fetchBreakdown]);

  const handleAdjustCharge = async () => {
    if (!selectedMember || !adjustmentAmount || !adjustmentReason.trim()) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    try {
      setLoading(true);
      const adjustmentObj = {};
      adjustmentObj[`${adjustmentType}Adjustment`] =
        parseFloat(adjustmentAmount);

      await apiService.put(
        `/api/v2/admin/billing/adjust-charge/${actualCycleId}/${selectedMember._id}`,
        {
          ...adjustmentObj,
          reason: adjustmentReason,
        },
      );

      Alert.alert("Success", "Charge adjusted successfully!");
      setAdjustmentModalVisible(false);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      setSelectedMember(null);
      fetchBreakdown();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Adjustment failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedMember || !refundAmount || !refundReason.trim()) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    try {
      setLoading(true);
      await apiService.post(`/api/v2/admin/billing/refund/${actualCycleId}`, {
        memberId: selectedMember.userId,
        amount: parseFloat(refundAmount),
        billType: refundBillType,
        reason: refundReason,
      });

      Alert.alert("Success", "Refund processed successfully!");
      setRefundModalVisible(false);
      setRefundAmount("");
      setRefundReason("");
      setSelectedMember(null);
      fetchBreakdown();
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Refund failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedMember || !noteText.trim()) {
      Alert.alert("Error", "Please enter a note");
      return;
    }

    try {
      setLoading(true);
      await apiService.post(
        `/api/v2/admin/billing/add-note/${actualCycleId}/${selectedMember.userId}`,
        {
          note: noteText,
          billType: noteBillType,
        },
      );

      Alert.alert("Success", "Note added successfully!");
      setNoteModalVisible(false);
      setNoteText("");
      setSelectedMember(null);
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to add note",
      );
    } finally {
      setLoading(false);
    }
  };

  const renderMemberCard = (member) => {
    const isPaid = member.allPaid;

    return (
      <View style={styles.memberCard}>
        <View style={styles.memberHeader}>
          <View>
            <Text style={styles.memberName}>{member.memberName}</Text>
            <Text style={styles.memberPresence}>
              {member.presenceDays} days present
            </Text>
            {isPaid && (
              <Text
                style={[
                  styles.memberPresence,
                  { color: "#4CAF50", fontWeight: "bold" },
                ]}
              >
                ✓ Payment Complete
              </Text>
            )}
          </View>
          <Text style={styles.memberTotal}>₱{member.totalDue.toFixed(2)}</Text>
        </View>

        <View style={styles.chargesDetails}>
          <View style={styles.chargeRow}>
            <Text style={styles.chargeLabel}>Rent</Text>
            <Text style={styles.chargeValue}>
              ₱{member.rentShare.toFixed(2)}
            </Text>
          </View>
          <View style={styles.chargeRow}>
            <Text style={styles.chargeLabel}>Electricity</Text>
            <Text style={styles.chargeValue}>
              ₱{member.electricityShare.toFixed(2)}
            </Text>
          </View>
          <View style={styles.chargeRow}>
            <Text style={styles.chargeLabel}>Water</Text>
            <Text style={styles.chargeValue}>
              ₱{member.waterShare.toFixed(2)}
            </Text>
          </View>
          <View style={styles.chargeRow}>
            <Text style={styles.chargeLabel}>Internet</Text>
            <Text style={styles.chargeValue}>
              ₱{member.internetShare.toFixed(2)}
            </Text>
          </View>
          {member.waterShareNote && (
            <View style={styles.chargeNote}>
              <Text style={styles.chargeNoteText}>
                💧 {member.waterShareNote}
              </Text>
            </View>
          )}
        </View>

        {isPaid ? (
          <View style={styles.paidNotice}>
            <Text style={styles.paidNoticeText}>
              Adjustments are disabled for paid members
            </Text>
          </View>
        ) : (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.adjustBtn]}
              onPress={() => {
                setSelectedMember(member);
                setAdjustmentModalVisible(true);
              }}
            >
              <Text style={styles.actionBtnText}>⚙️ Adjust</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.refundBtn]}
              onPress={() => {
                setSelectedMember(member);
                setRefundModalVisible(true);
              }}
            >
              <Text style={styles.actionBtnText}>↩️ Refund</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.noteBtn]}
              onPress={() => {
                setSelectedMember(member);
                setNoteModalVisible(true);
              }}
            >
              <Text style={styles.actionBtnText}>📝 Note</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Charge Adjustments</Text>
        <Text style={styles.headerSubtitle}>
          Cycle #{breakdown?.cycleNumber}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Members</Text>
        {breakdown?.memberBreakdown.map((member) => (
          <View key={member.userId}>{renderMemberCard(member)}</View>
        ))}
      </View>

      <View style={styles.spacing} />

      {/* Adjustment Modal */}
      <Modal visible={adjustmentModalVisible} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adjust Charge</Text>
            <Text style={styles.modalSubtitle}>
              {selectedMember?.memberName}
            </Text>

            <View style={styles.form}>
              <Text style={styles.formLabel}>Bill Type</Text>
              <View style={styles.typeButtons}>
                {["rent", "electricity", "water", "internet"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeBtn,
                      adjustmentType === type && styles.typeActive,
                    ]}
                    onPress={() => setAdjustmentType(type)}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        adjustmentType === type && styles.typeBtnTextActive,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Adjustment Amount (₱)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter amount (positive/negative)"
                keyboardType="decimal-pad"
                value={adjustmentAmount}
                onChangeText={setAdjustmentAmount}
              />

              <Text style={styles.formLabel}>Reason</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Explain the adjustment..."
                multiline
                numberOfLines={3}
                value={adjustmentReason}
                onChangeText={setAdjustmentReason}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setAdjustmentModalVisible(false);
                    setSelectedMember(null);
                    setAdjustmentAmount("");
                    setAdjustmentReason("");
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleAdjustCharge}
                >
                  <Text style={styles.confirmBtnText}>Apply Adjustment</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Refund Modal */}
      <Modal visible={refundModalVisible} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Process Refund</Text>
            <Text style={styles.modalSubtitle}>
              {selectedMember?.memberName}
            </Text>

            <View style={styles.form}>
              <Text style={styles.formLabel}>Bill Type</Text>
              <View style={styles.typeButtons}>
                {["rent", "electricity", "water", "internet"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeBtn,
                      refundBillType === type && styles.typeActive,
                    ]}
                    onPress={() => setRefundBillType(type)}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        refundBillType === type && styles.typeBtnTextActive,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Refund Amount (₱)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter refund amount"
                keyboardType="decimal-pad"
                value={refundAmount}
                onChangeText={setRefundAmount}
              />

              <Text style={styles.formLabel}>Reason</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Reason for refund..."
                multiline
                numberOfLines={3}
                value={refundReason}
                onChangeText={setRefundReason}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setRefundModalVisible(false);
                    setSelectedMember(null);
                    setRefundAmount("");
                    setRefundReason("");
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: "#FF6B6B" }]}
                  onPress={handleRefund}
                >
                  <Text style={styles.confirmBtnText}>Process Refund</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Note Modal */}
      <Modal visible={noteModalVisible} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Note</Text>
            <Text style={styles.modalSubtitle}>
              {selectedMember?.memberName}
            </Text>

            <View style={styles.form}>
              <Text style={styles.formLabel}>Bill Type (Optional)</Text>
              <View style={styles.typeButtons}>
                {["general", "rent", "electricity", "water"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeBtn,
                      noteBillType === type && styles.typeActive,
                    ]}
                    onPress={() => setNoteBillType(type)}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        noteBillType === type && styles.typeBtnTextActive,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Note</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add any note..."
                multiline
                numberOfLines={4}
                value={noteText}
                onChangeText={setNoteText}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setNoteModalVisible(false);
                    setSelectedMember(null);
                    setNoteText("");
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: "#9C27B0" }]}
                  onPress={handleAddNote}
                >
                  <Text style={styles.confirmBtnText}>Add Note</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
  section: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  memberCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  memberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
  },
  memberPresence: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  memberTotal: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E86AB",
  },
  chargesDetails: {
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  chargeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  chargeLabel: {
    fontSize: 12,
    color: "#666",
  },
  chargeValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  chargeNote: {
    backgroundColor: "#E0F7FA",
    borderLeftColor: "#00BCD4",
    borderLeftWidth: 3,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginVertical: 8,
    borderRadius: 4,
  },
  chargeNoteText: {
    fontSize: 11,
    color: "#00838F",
    fontStyle: "italic",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  adjustBtn: {
    backgroundColor: "#4CAF50",
  },
  refundBtn: {
    backgroundColor: "#FF9800",
  },
  noteBtn: {
    backgroundColor: "#9C27B0",
  },
  paidNotice: {
    backgroundColor: "#E8F5E9",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
    marginTop: 12,
  },
  paidNoticeText: {
    color: "#2E7D32",
    fontSize: 13,
    fontWeight: "500",
  },
  actionBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 12,
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
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#999",
    marginBottom: 16,
  },
  form: {
    maxHeight: 500,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    marginTop: 12,
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    minWidth: "22%",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 6,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  typeActive: {
    backgroundColor: "#2E86AB",
    borderColor: "#2E86AB",
  },
  typeBtnText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  typeBtnTextActive: {
    color: "#FFF",
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 12,
  },
  textArea: {
    textAlignVertical: "top",
    paddingTop: 10,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#333",
    fontWeight: "600",
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: "#2E86AB",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#FFF",
    fontWeight: "600",
  },
  spacing: {
    height: 20,
  },
});

export default AdminAdjustmentsScreen;
