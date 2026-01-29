import React, { useState, useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { roomService, memberService } from "../../services/apiService";

const AdminMembersScreen = ({ navigation, route }) => {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const isFocused = useIsFocused();

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [isPayer, setIsPayer] = useState(true);

  useEffect(() => {
    fetchRooms();
  }, []);

  // Re-fetch when screen gains focus so newly created rooms appear immediately
  useEffect(() => {
    if (isFocused) fetchRooms();
  }, [isFocused]);

  useEffect(() => {
    if (selectedRoom) {
      setMembers(selectedRoom.members || []);
    }
  }, [selectedRoom]);

  const fetchRooms = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await roomService.getRooms();
      const allRooms = response.rooms || response.data?.rooms || [];
      setRooms(allRooms);

      // If no room is selected or previously selected room was removed, pick the first
      if (!selectedRoom || !allRooms.some((r) => r._id === selectedRoom._id)) {
        if (allRooms.length > 0) setSelectedRoom(allRooms[0]);
        else setSelectedRoom(null);
      }
    } catch (error) {
      console.log("Error fetching rooms:", error);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberEmail.trim()) {
      Alert.alert("Error", "Please enter member email");
      return;
    }

    if (!selectedRoom) return;

    try {
      setAdding(true);
      await memberService.addMember(selectedRoom._id, {
        email: memberEmail.trim(),
      });
      await fetchRooms();
      setMemberName("");
      setMemberEmail("");
      setIsPayer(true);
      setSearchTerm("");
      setShowAddForm(false);
      Alert.alert("Success", "Member added successfully");
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to add member",
      );
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (!selectedRoom) return;

    Alert.alert(
      "Delete Member",
      "Are you sure you want to remove this member?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await memberService.deleteMember(selectedRoom._id, memberId);
              await fetchRooms();
              Alert.alert("Success", "Member deleted successfully");
            } catch (error) {
              Alert.alert("Error", "Failed to delete member");
            }
          },
        },
      ],
    );
  };

  const handleTogglePayer = async (memberId, isCurrentlyPayer) => {
    if (!selectedRoom) return;
    try {
      // Optimistic update: update UI immediately
      const updatedMembers = (selectedRoom.members || []).map((m) =>
        m._id === memberId ? { ...m, isPayer: !isCurrentlyPayer } : m,
      );
      setMembers(updatedMembers);
      await memberService.updateMember(selectedRoom._id, memberId, {
        isPayer: !isCurrentlyPayer,
      });
      await fetchRooms();
    } catch (error) {
      console.error("Error toggling payer:", error);
      Alert.alert("Error", "Failed to update payer status");
      // revert by re-fetching
      await fetchRooms();
    }
  };

  const filteredMembers = members.filter((member) =>
    (member.name || member.email || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#bdb246" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchRooms(true)}
        />
      }
    >
      {/* Room Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Room</Text>
        <FlatList
          data={rooms}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.roomOption,
                selectedRoom?._id === item._id && styles.roomOptionActive,
              ]}
              onPress={() => setSelectedRoom(item)}
            >
              <Text
                style={[
                  styles.roomOptionText,
                  selectedRoom?._id === item._id && styles.roomOptionTextActive,
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {selectedRoom && (
        <>
          {/* Header with title and add button */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Members</Text>
              <Text style={styles.subtitle}>
                {selectedRoom.name} • {members.length} members
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) {
                  setMemberEmail("");
                  setMemberName("");
                }
              }}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          {members.length > 0 && (
            <View style={styles.searchSection}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search members..."
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
            </View>
          )}

          {/* Add Member Form */}
          {showAddForm && (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Add New Member</Text>
              <TextInput
                style={styles.input}
                placeholder="Member Email"
                value={memberEmail}
                onChangeText={setMemberEmail}
                keyboardType="email-address"
                editable={!adding}
              />
              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowAddForm(false);
                    setMemberEmail("");
                    setMemberName("");
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.addMemberButton,
                    adding && styles.buttonDisabled,
                  ]}
                  onPress={handleAddMember}
                  disabled={adding}
                >
                  {adding ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.addMemberButtonText}>Add Member</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Members List */}
          <View style={styles.membersSection}>
            {members.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No members yet</Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => setShowAddForm(true)}
                >
                  <Text style={styles.emptyButtonText}>Add First Member</Text>
                </TouchableOpacity>
              </View>
            ) : filteredMembers.length === 0 ? (
              <Text style={styles.emptyText}>No members matching search</Text>
            ) : (
              <FlatList
                data={filteredMembers}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const presenceDays = item.presence ? item.presence.length : 0;
                  return (
                    <View style={styles.memberCard}>
                      <View style={styles.memberContent}>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>
                            {item.name || item.email || "—"}
                          </Text>
                          <Text style={styles.memberEmail}>{item.email}</Text>

                          {/* Payer indicator and joined date */}
                          <View style={styles.memberMetaRow}>
                            <View
                              style={[
                                styles.payerBadge,
                                item.isPayer
                                  ? styles.payerBadgeActive
                                  : styles.payerBadgeInactive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.payerBadgeText,
                                  item.isPayer
                                    ? styles.payerBadgeTextActive
                                    : styles.payerBadgeTextInactive,
                                ]}
                              >
                                {item.isPayer ? "Payer" : "Non-payer"}
                              </Text>
                            </View>

                            <View style={styles.joinedRow}>
                              <Ionicons
                                name="calendar-outline"
                                size={14}
                                color="#999"
                                style={{ marginRight: 6 }}
                              />
                              <Text style={styles.joinedTextSmall}>
                                {item.joinedAt
                                  ? new Date(item.joinedAt).toLocaleDateString()
                                  : "—"}
                              </Text>
                            </View>
                          </View>

                          {presenceDays > 0 && (
                            <Text style={styles.memberPresence}>
                              📅 {presenceDays} days presence
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.memberActions}>
                        <TouchableOpacity
                          style={[
                            styles.payerToggleButton,
                            item.isPayer
                              ? styles.payerToggleActive
                              : styles.payerToggleInactive,
                          ]}
                          onPress={() =>
                            handleTogglePayer(item._id, item.isPayer)
                          }
                        >
                          <Text style={styles.payerToggleText}>
                            {item.isPayer ? "Unset Payer" : "Set Payer"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteActionButton}
                          onPress={() => handleDeleteMember(item._id)}
                        >
                          <Text style={styles.deleteActionText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  section: {
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  roomOption: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  roomOptionActive: {
    borderColor: "#bdb246",
    backgroundColor: "#fffbf0",
  },
  roomOptionText: {
    fontSize: 14,
    color: "#666",
  },
  roomOptionTextActive: {
    color: "#bdb246",
    fontWeight: "600",
  },
  header: {
    backgroundColor: "#fff",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: "#999",
  },
  addButton: {
    backgroundColor: "#bdb246",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  searchSection: {
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#f9f9f9",
  },
  formContainer: {
    backgroundColor: "#fff",
    margin: 12,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    fontSize: 14,
    backgroundColor: "#f9f9f9",
  },
  formButtons: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 6,
    padding: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#e0e0e0",
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "600",
  },
  addMemberButton: {
    backgroundColor: "#bdb246",
  },
  addMemberButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  membersSection: {
    padding: 12,
  },
  memberCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 12,
    // subtle shadow / elevation
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
  },
  memberContent: {
    padding: 14,
  },
  memberInfo: {
    marginBottom: 8,
  },
  memberMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  payerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  payerBadgeActive: {
    backgroundColor: "#e8f5e9",
    borderColor: "#28a745",
  },
  payerBadgeInactive: {
    backgroundColor: "#f5f5f5",
    borderColor: "#ddd",
  },
  payerBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  payerBadgeTextActive: {
    color: "#28a745",
  },
  payerBadgeTextInactive: {
    color: "#666",
  },
  joinedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  joinedTextSmall: {
    fontSize: 12,
    color: "#666",
  },
  payerToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 10,
    flex: 1,
    alignItems: "center",
  },
  payerToggleActive: {
    backgroundColor: "#28a745",
  },
  payerToggleInactive: {
    backgroundColor: "#e8f5e9",
    borderWidth: 1,
    borderColor: "#28a745",
  },
  payerToggleText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  memberPresence: {
    fontSize: 12,
    color: "#0066cc",
    fontWeight: "500",
  },
  memberActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  deleteActionButton: {
    flex: 1,
    backgroundColor: "#ffebee",
    paddingVertical: 10,
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: "#f0f0f0",
  },
  deleteActionText: {
    color: "#c62828",
    fontWeight: "600",
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: "#bdb246",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  emptyButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default AdminMembersScreen;
