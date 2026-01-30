import React, { useState, useEffect, useContext } from "react";
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
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { roomService, memberService } from "../../services/apiService";
import { AuthContext } from "../../context/AuthContext";

const AdminMembersScreen = ({ navigation, route }) => {
  const { state } = useContext(AuthContext);
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

  // Re-fetch when screen gains focus or user profile changes
  useEffect(() => {
    if (isFocused) fetchRooms();
  }, [isFocused]);

  // Refetch whenever user profile changes (name or avatar)
  useEffect(() => {
    console.log("Admin profile changed, refetching members");
    fetchRooms();
  }, [state.user?.name, state.user?.avatar?.url]);

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

      // Update selectedRoom with fresh data if it exists
      if (selectedRoom && allRooms.length > 0) {
        const updatedSelectedRoom = allRooms.find(
          (r) => r._id === selectedRoom._id,
        );
        if (updatedSelectedRoom) {
          setSelectedRoom(updatedSelectedRoom);
          console.log("Updated selectedRoom with fresh data");
        }
      } else if (
        !selectedRoom ||
        !allRooms.some((r) => r._id === selectedRoom?._id)
      ) {
        // If no room is selected or previously selected room was removed, pick the first
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
    (member.user?.name || member.name || member.email || "")
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
      <View style={styles.roomSelectorContainer}>
        <Text style={styles.roomSelectorTitle}>Select a Room</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.roomSelectorScroll}
        >
          {rooms.map((item) => (
            <TouchableOpacity
              key={item._id}
              style={[
                styles.roomTab,
                selectedRoom?._id === item._id && styles.roomTabActive,
              ]}
              onPress={() => setSelectedRoom(item)}
            >
              <Text
                style={[
                  styles.roomTabText,
                  selectedRoom?._id === item._id && styles.roomTabTextActive,
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {selectedRoom && (
        <>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View>
              <Text style={styles.memberCountTitle}>
                {members.length} Members
              </Text>
              <Text style={styles.roomNameSubtitle}>{selectedRoom.name}</Text>
            </View>
            <TouchableOpacity
              style={styles.addMemberQuickButton}
              onPress={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) {
                  setMemberEmail("");
                  setMemberName("");
                }
              }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          {members.length > 0 && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#999" />
              <TextInput
                style={styles.searchInputField}
                placeholder="Search members..."
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
            </View>
          )}

          {/* Add Member Form Modal-like */}
          {showAddForm && (
            <View style={styles.addFormCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Add New Member</Text>
                <TouchableOpacity onPress={() => setShowAddForm(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.formInput}
                placeholder="Enter member email"
                value={memberEmail}
                onChangeText={setMemberEmail}
                keyboardType="email-address"
                editable={!adding}
              />
              <TouchableOpacity
                style={[
                  styles.formSubmitButton,
                  adding && styles.buttonDisabled,
                ]}
                onPress={handleAddMember}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.formSubmitText}>Add Member</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Members List */}
          {members.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#bdb246" />
              <Text style={styles.emptyText}>No members yet</Text>
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => setShowAddForm(true)}
              >
                <Text style={styles.emptyActionText}>Add First Member</Text>
              </TouchableOpacity>
            </View>
          ) : filteredMembers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No members matching search</Text>
            </View>
          ) : (
            <View style={styles.membersListContainer}>
              <FlatList
                data={filteredMembers}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const presenceDays = item.presence ? item.presence.length : 0;
                  return (
                    <View style={styles.memberCard}>
                      <View style={styles.memberLeft}>
                        {item.user?.avatar?.url ? (
                          <Image
                            source={{ uri: item.user.avatar.url }}
                            style={styles.memberAvatar}
                          />
                        ) : (
                          <View style={styles.memberAvatarPlaceholder}>
                            <Text style={styles.memberAvatarText}>
                              {(item.user?.name || "U").charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.memberDetails}>
                          <Text style={styles.memberName}>
                            {item.user?.name || item.name || "Unknown"}
                          </Text>
                          <Text style={styles.memberEmail}>
                            {item.user?.email || item.email}
                          </Text>
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
                            {presenceDays > 0 && (
                              <Text style={styles.presenceTag}>
                                📅 {presenceDays} days
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                      <View style={styles.memberActions}>
                        <TouchableOpacity
                          style={[
                            styles.actionButton,
                            item.isPayer
                              ? styles.actionButtonActive
                              : styles.actionButtonInactive,
                          ]}
                          onPress={() =>
                            handleTogglePayer(item._id, item.isPayer)
                          }
                        >
                          <Ionicons
                            name={
                              item.isPayer
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            size={20}
                            color={item.isPayer ? "#fff" : "#28a745"}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteMember(item._id)}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={20}
                            color="#c62828"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },

  // Room Selector
  roomSelectorContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  roomSelectorTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  roomSelectorScroll: {
    flexGrow: 0,
  },
  roomTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  roomTabActive: {
    backgroundColor: "#bdb246",
    borderColor: "#bdb246",
  },
  roomTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
  },
  roomTabTextActive: {
    color: "#fff",
    fontWeight: "600",
  },

  // Header Section
  headerSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  memberCountTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  roomNameSubtitle: {
    fontSize: 12,
    color: "#999",
  },
  addMemberQuickButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#bdb246",
    justifyContent: "center",
    alignItems: "center",
  },

  // Search
  searchContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  searchInputField: {
    flex: 1,
    padding: 10,
    fontSize: 14,
    marginLeft: 8,
  },

  // Add Form
  addFormCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bdb246",
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  formInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    fontSize: 14,
    backgroundColor: "#f9f9f9",
  },
  formSubmitButton: {
    backgroundColor: "#bdb246",
    paddingVertical: 11,
    borderRadius: 6,
    alignItems: "center",
  },
  formSubmitText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Members List
  membersListContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  memberCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  memberLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: "#bdb246",
  },
  memberAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#bdb246",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberAvatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  memberMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  payerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    fontSize: 11,
    fontWeight: "600",
  },
  payerBadgeTextActive: {
    color: "#28a745",
  },
  payerBadgeTextInactive: {
    color: "#666",
  },
  presenceTag: {
    fontSize: 11,
    color: "#0066cc",
    fontWeight: "500",
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  memberActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonActive: {
    backgroundColor: "#28a745",
  },
  actionButtonInactive: {
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#28a745",
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffebee",
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyActionButton: {
    backgroundColor: "#bdb246",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  emptyActionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});

export default AdminMembersScreen;
