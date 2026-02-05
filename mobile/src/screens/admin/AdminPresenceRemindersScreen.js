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
  ActivityIndicator,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { apiService } from "../../services/apiService";

const AdminPresenceRemindersScreen = ({ navigation }) => {
  const route = useRoute();
  const { room } = route.params || {};

  const [membersWithoutPresence, setMembersWithoutPresence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customMessageModalVisible, setCustomMessageModalVisible] =
    useState(false);
  const [sending, setSending] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [customMessage, setCustomMessage] = useState("");
  const [bulkMode, setBulkMode] = useState(false);

  const fetchMembersWithoutPresence = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get(
        `/api/v2/admin/reminders/presence/${room?._id}`,
      );
      setMembersWithoutPresence(response.membersWithoutPresence || []);
    } catch (error) {
      console.error("Error fetching members:", error);
      Alert.alert("Error", "Failed to load members without presence");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [room?._id]);

  useEffect(() => {
    fetchMembersWithoutPresence();
  }, [fetchMembersWithoutPresence]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMembersWithoutPresence();
  }, [fetchMembersWithoutPresence]);

  const handleSendReminder = async (member) => {
    try {
      setSending(true);
      await apiService.post(
        `/api/v2/admin/reminders/send-presence/${room?._id}/${member.memberId}`,
        {
          customMessage: customMessage || null,
        },
      );

      Alert.alert("Success", `Presence reminder sent to ${member.memberName}!`);
      setCustomMessage("");
      setCustomMessageModalVisible(false);
      fetchMembersWithoutPresence();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to send reminder",
      );
    } finally {
      setSending(false);
    }
  };

  const handleBulkReminders = async () => {
    if (selectedMembers.size === 0) {
      Alert.alert("Error", "Please select at least one member");
      return;
    }

    try {
      setSending(true);
      await apiService.post(
        `/api/v2/admin/reminders/send-presence-bulk/${room?._id}`,
        {
          customMessage: customMessage || null,
        },
      );

      Alert.alert(
        "Success",
        `Presence reminders sent to ${selectedMembers.size} members!`,
      );
      setCustomMessage("");
      setSelectedMembers(new Set());
      setCustomMessageModalVisible(false);
      setBulkMode(false);
      fetchMembersWithoutPresence();
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to send reminders",
      );
    } finally {
      setSending(false);
    }
  };

  const toggleMemberSelection = (memberId) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const renderMember = ({ item }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.memberName}</Text>
        <Text style={styles.memberEmail}>{item.memberEmail}</Text>
      </View>

      {bulkMode ? (
        <TouchableOpacity
          style={[
            styles.checkbox,
            selectedMembers.has(item.memberId) && styles.checkboxSelected,
          ]}
          onPress={() => toggleMemberSelection(item.memberId)}
        >
          {selectedMembers.has(item.memberId) && (
            <Ionicons name="checkmark" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => {
            setSelectedMembers(new Set([item.memberId]));
            setCustomMessageModalVisible(true);
          }}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading && membersWithoutPresence.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#b38604" />
        <Text style={styles.loadingText}>Loading members...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Presence Reminders</Text>
        <Text style={styles.subheader}>
          {membersWithoutPresence.length} members without presence today
        </Text>
      </View>

      {membersWithoutPresence.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle" size={48} color="#28a745" />
          <Text style={styles.emptyText}>All members marked presence!</Text>
        </View>
      ) : (
        <>
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={[styles.modeButton, !bulkMode && styles.modeButtonActive]}
              onPress={() => {
                setBulkMode(false);
                setSelectedMembers(new Set());
              }}
            >
              <Text style={styles.modeButtonText}>Individual</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, bulkMode && styles.modeButtonActive]}
              onPress={() => {
                setBulkMode(true);
                setSelectedMembers(new Set());
              }}
            >
              <Text style={styles.modeButtonText}>Bulk</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={membersWithoutPresence}
            renderItem={renderMember}
            keyExtractor={(item) => item.memberId}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={styles.listContent}
          />

          {bulkMode && selectedMembers.size > 0 && (
            <View style={styles.bulkActionBar}>
              <Text style={styles.selectedCount}>
                {selectedMembers.size} selected
              </Text>
              <TouchableOpacity
                style={styles.bulkSendButton}
                onPress={() => setCustomMessageModalVisible(true)}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.bulkSendText}>Send Reminders</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Custom Message Modal */}
      <Modal
        visible={customMessageModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {bulkMode
                  ? `Send Reminders to ${selectedMembers.size} Members`
                  : "Send Presence Reminder"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCustomMessageModalVisible(false);
                  setCustomMessage("");
                  setSelectedMembers(new Set());
                }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Custom Message (Optional)</Text>
              <Text style={styles.hint}>
                Leave empty to send default message
              </Text>

              <TextInput
                style={styles.textInput}
                placeholder="Enter custom reminder message..."
                value={customMessage}
                onChangeText={setCustomMessage}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <View style={styles.defaultMessageBox}>
                <Text style={styles.defaultMessageLabel}>Default Message:</Text>
                <Text style={styles.defaultMessage}>
                  Hi [Member Name],{"\n\n"}Please mark your presence for today
                  in the Apartment Bill Tracker app.{"\n\n"}This helps us track
                  your occupancy for billing purposes.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setCustomMessageModalVisible(false);
                  setCustomMessage("");
                  setSelectedMembers(new Set());
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sendRemainderButton,
                  sending && styles.sendRemainderButtonDisabled,
                ]}
                onPress={() => {
                  if (bulkMode) {
                    handleBulkReminders();
                  } else {
                    const member = membersWithoutPresence.find(
                      (m) => m.memberId === Array.from(selectedMembers)[0],
                    );
                    if (member) {
                      handleSendReminder(member);
                    }
                  }
                }}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
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
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
    fontSize: 14,
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  subheader: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  actionBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 10,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  modeButtonActive: {
    backgroundColor: "#b38604",
    borderColor: "#b38604",
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  modeButtonActive: {
    backgroundColor: "#b38604",
    borderColor: "#b38604",
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  listContent: {
    padding: 12,
  },
  memberCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 12,
    color: "#999",
  },
  checkbox: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#b38604",
    borderColor: "#b38604",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: "#28a745",
    justifyContent: "center",
    alignItems: "center",
  },
  bulkActionBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  bulkSendButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#28a745",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 8,
  },
  bulkSendText: {
    color: "#fff",
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginTop: 12,
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
    maxHeight: "90%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: "#999",
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    marginBottom: 16,
  },
  defaultMessageBox: {
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 12,
  },
  defaultMessageLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  defaultMessage: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  sendRemainderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#b38604",
    alignItems: "center",
  },
  sendRemainderButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});

export default AdminPresenceRemindersScreen;
