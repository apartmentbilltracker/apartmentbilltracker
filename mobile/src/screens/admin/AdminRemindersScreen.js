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
  FlatList,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { apiService } from "../../services/apiService";

const AdminRemindersScreen = ({ navigation }) => {
  const route = useRoute();
  const { room } = route.params || {};

  const [overduePayments, setOverduePayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [reminderHistory, setReminderHistory] = useState(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [customMessageModalVisible, setCustomMessageModalVisible] =
    useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [customMessage, setCustomMessage] = useState("");

  const fetchOverduePayments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get(
        `/api/v2/admin/reminders/overdue/${room?._id}`,
      );
      setOverduePayments(response.overduePayments || []);
    } catch (error) {
      console.error("Error fetching overdue payments:", error);
      Alert.alert("Error", "Failed to load overdue payments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [room?._id]);

  useEffect(() => {
    fetchOverduePayments();
  }, [fetchOverduePayments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOverduePayments();
  }, [fetchOverduePayments]);

  const fetchReminderHistory = async (member) => {
    try {
      const response = await apiService.get(
        `/api/v2/admin/reminders/history/${room?._id}/${member.memberId}`,
      );
      setReminderHistory(response.history);
      setSelectedMember(member);
      setHistoryModalVisible(true);
    } catch (error) {
      Alert.alert("Error", "Failed to load reminder history");
    }
  };

  const handleSendReminder = async (member) => {
    try {
      setLoading(true);
      await apiService.post(
        `/api/v2/admin/reminders/send-reminder/${room?._id}/${member.memberId}`,
        {
          customMessage: customMessage || null,
        },
      );

      Alert.alert("Success", `Reminder sent to ${member.memberName}!`);
      setCustomMessage("");
      fetchOverduePayments();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to send reminder",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReminders = async () => {
    if (selectedMembers.size === 0) {
      Alert.alert("Error", "Please select at least one member");
      return;
    }

    try {
      setBulkSending(true);
      await apiService.post(
        `/api/v2/admin/reminders/send-bulk-reminders/${room?._id}`,
        {
          memberIds: Array.from(selectedMembers),
          customMessage: customMessage || null,
        },
      );

      Alert.alert(
        "Success",
        `Reminders sent to ${selectedMembers.size} member(s)!`,
      );
      setCustomMessage("");
      setSelectedMembers(new Set());
      setCustomMessageModalVisible(false);
      fetchOverduePayments();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to send bulk reminders",
      );
    } finally {
      setBulkSending(false);
    }
  };

  const toggleMemberSelection = (memberId) => {
    const newSelection = new Set(selectedMembers);
    if (newSelection.has(memberId)) {
      newSelection.delete(memberId);
    } else {
      newSelection.add(memberId);
    }
    setSelectedMembers(newSelection);
  };

  const renderMemberCard = (member) => (
    <View
      style={[
        styles.memberCard,
        selectedMembers.has(member.memberId) && styles.memberCardSelected,
      ]}
    >
      <TouchableOpacity
        style={styles.selectCheckbox}
        onPress={() => toggleMemberSelection(member.memberId)}
      >
        <View
          style={[
            styles.checkbox,
            selectedMembers.has(member.memberId) && styles.checkboxSelected,
          ]}
        >
          {selectedMembers.has(member.memberId) && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.memberName}</Text>
        <Text style={styles.memberEmail}>{member.email}</Text>

        <View style={styles.unpaidBillsContainer}>
          <Text style={styles.unpaidLabel}>Overdue:</Text>
          <View style={styles.unpaidBills}>
            {member.unpaidBills?.includes("rent") && (
              <View style={[styles.unpaidBill, { backgroundColor: "#FFE0E0" }]}>
                <Text style={styles.unpaidBillText}>Rent</Text>
              </View>
            )}
            {member.unpaidBills?.includes("electricity") && (
              <View style={[styles.unpaidBill, { backgroundColor: "#FFF3E0" }]}>
                <Text style={styles.unpaidBillText}>Elec</Text>
              </View>
            )}
            {member.unpaidBills?.includes("water") && (
              <View style={[styles.unpaidBill, { backgroundColor: "#E0F2F1" }]}>
                <Text style={styles.unpaidBillText}>Water</Text>
              </View>
            )}
            {member.unpaidBills?.includes("internet") && (
              <View style={[styles.unpaidBill, { backgroundColor: "#F3E5F5" }]}>
                <Text style={styles.unpaidBillText}>Net</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.daysOverdueContainer}>
          <Text style={styles.daysOverdue}>
            {member.daysOverdue} days overdue
          </Text>
          <Text style={styles.amount}>₱{member.totalDue?.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.historyBtn]}
          onPress={() => fetchReminderHistory(member)}
        >
          <Text style={styles.actionBtnText}>📋 History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.sendBtn]}
          onPress={() => {
            setSelectedMember(member);
            setCustomMessageModalVisible(true);
          }}
        >
          <Text style={styles.actionBtnText}>📧 Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const hasSelection = selectedMembers.size > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payment Reminders</Text>
          <Text style={styles.headerSubtitle}>
            {overduePayments.length} overdue payment
            {overduePayments.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {overduePayments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No overdue payments</Text>
            <Text style={styles.emptySubtext}>All members are up to date!</Text>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Overdue Members</Text>
              {hasSelection && (
                <Text style={styles.selectedCount}>
                  {selectedMembers.size} selected
                </Text>
              )}
            </View>
            {overduePayments.map((member) => (
              <View key={`${member.memberId}-${member.daysOverdue}`}>
                {renderMemberCard(member)}
              </View>
            ))}
          </View>
        )}

        <View style={styles.spacing} />
      </ScrollView>

      {hasSelection && (
        <View style={styles.bulkActionBar}>
          <TouchableOpacity
            style={styles.bulkCancelBtn}
            onPress={() => setSelectedMembers(new Set())}
          >
            <Text style={styles.bulkCancelBtnText}>Clear Selection</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkSendBtn}
            onPress={() => setCustomMessageModalVisible(true)}
          >
            <Text style={styles.bulkSendBtnText}>
              Send to {selectedMembers.size}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* History Modal */}
      <Modal visible={historyModalVisible} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reminder History</Text>
              <TouchableOpacity
                onPress={() => {
                  setHistoryModalVisible(false);
                  setSelectedMember(null);
                }}
              >
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.memberNameInModal}>
              {selectedMember?.memberName}
            </Text>

            {reminderHistory ? (
              <View style={styles.historyContent}>
                <View style={styles.historyItem}>
                  <Text style={styles.historyLabel}>Total Reminders Sent:</Text>
                  <Text style={styles.historyValue}>
                    {reminderHistory.reminderCount || 0}
                  </Text>
                </View>

                {reminderHistory.lastReminderDate ? (
                  <View style={styles.historyItem}>
                    <Text style={styles.historyLabel}>Last Reminder Sent:</Text>
                    <Text style={styles.historyValue}>
                      {reminderHistory.daysAgo} days ago
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(
                        reminderHistory.lastReminderDate,
                      ).toLocaleDateString()}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.historyItem}>
                    <Text style={styles.historyLabel}>Last Reminder:</Text>
                    <Text style={styles.historyValue}>Never sent</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.loadingText}>Loading history...</Text>
            )}

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => {
                setHistoryModalVisible(false);
                setSelectedMember(null);
              }}
            >
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Message Modal */}
      <Modal visible={customMessageModalVisible} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send Reminder</Text>
            {selectedMember ? (
              <Text style={styles.modalSubtitle}>
                To: {selectedMember.memberName}
              </Text>
            ) : (
              <Text style={styles.modalSubtitle}>
                To: {selectedMembers.size} selected members
              </Text>
            )}

            <View style={styles.form}>
              <Text style={styles.formLabel}>Custom Message (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add a custom message to the reminder..."
                multiline
                numberOfLines={4}
                value={customMessage}
                onChangeText={setCustomMessage}
              />

              <Text style={styles.formHint}>
                If empty, a default reminder will be sent.
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setCustomMessageModalVisible(false);
                    setCustomMessage("");
                    if (!selectedMember) {
                      setSelectedMembers(new Set());
                    }
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => {
                    if (selectedMember) {
                      handleSendReminder(selectedMember);
                      setCustomMessageModalVisible(false);
                      setSelectedMember(null);
                    } else {
                      handleBulkReminders();
                    }
                  }}
                  disabled={bulkSending}
                >
                  <Text style={styles.confirmBtnText}>
                    {bulkSending ? "Sending..." : "Send Reminder"}
                  </Text>
                </TouchableOpacity>
              </View>
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
  scrollContainer: {
    flex: 1,
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
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
  },
  section: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  selectedCount: {
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: "#2E86AB",
    color: "#FFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  memberCardSelected: {
    borderLeftWidth: 4,
    borderLeftColor: "#2E86AB",
    backgroundColor: "#F0F5FA",
  },
  selectCheckbox: {
    marginRight: 12,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#DDD",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#2E86AB",
    borderColor: "#2E86AB",
  },
  checkmark: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 12,
  },
  memberInfo: {
    flex: 1,
    marginRight: 10,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
  },
  memberEmail: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  unpaidBillsContainer: {
    marginTop: 8,
    width: "100%",
  },
  unpaidLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
    marginBottom: 6,
  },
  unpaidBills: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  unpaidBill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  unpaidBillText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#333",
  },
  daysOverdueContainer: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  daysOverdue: {
    fontSize: 12,
    color: "#F44336",
    fontWeight: "600",
  },
  amount: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#2E86AB",
  },
  actionButtons: {
    gap: 6,
    justifyContent: "flex-end",
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  historyBtn: {
    backgroundColor: "#9C27B0",
  },
  sendBtn: {
    backgroundColor: "#2E86AB",
  },
  actionBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 11,
  },
  bulkActionBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  bulkCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  bulkCancelBtnText: {
    color: "#333",
    fontWeight: "600",
  },
  bulkSendBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: "#2E86AB",
    justifyContent: "center",
    alignItems: "center",
  },
  bulkSendBtnText: {
    color: "#FFF",
    fontWeight: "600",
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
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeBtn: {
    fontSize: 20,
    color: "#999",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#999",
    marginBottom: 16,
  },
  memberNameInModal: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2E86AB",
    marginBottom: 16,
  },
  historyContent: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  historyItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  historyLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  historyValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E86AB",
    marginTop: 4,
  },
  historyDate: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
  },
  form: {
    maxHeight: 400,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    marginTop: 12,
    marginBottom: 8,
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
  formHint: {
    fontSize: 11,
    color: "#999",
    marginBottom: 16,
    fontStyle: "italic",
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
  closeModalBtn: {
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  closeModalBtnText: {
    color: "#333",
    fontWeight: "600",
  },
  spacing: {
    height: 20,
  },
});

export default AdminRemindersScreen;
