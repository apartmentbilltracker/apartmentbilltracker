import React, { useState, useEffect, useContext, useMemo} from "react";
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
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { roomService, memberService } from "../../services/apiService";
import { AuthContext } from "../../context/AuthContext";
import { useTheme } from "../../theme/ThemeContext";

const AdminMembersScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

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
  const [pendingMembers, setPendingMembers] = useState([]);

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
      const approvedMembers = (selectedRoom.members || []).filter(
        (m) => m.status !== "pending",
      );
      setMembers(approvedMembers);
      fetchPendingMembers();
    }
  }, [selectedRoom]);

  const fetchPendingMembers = async () => {
    if (!selectedRoom) return;
    try {
      const roomId = selectedRoom.id || selectedRoom._id;
      const response = await memberService.getPendingMembers(roomId);
      setPendingMembers(response.pendingMembers || []);
    } catch (error) {
      console.log("Error fetching pending members:", error);
      setPendingMembers([]);
    }
  };

  const fetchRooms = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await roomService.getRooms();
      const allRooms = response.rooms || response.data?.rooms || [];
      setRooms(allRooms);

      // Update selectedRoom with fresh data if it exists
      if (selectedRoom && allRooms.length > 0) {
        const selectedId = selectedRoom.id || selectedRoom._id;
        const updatedSelectedRoom = allRooms.find(
          (r) => (r.id || r._id) === selectedId,
        );
        if (updatedSelectedRoom) {
          setSelectedRoom(updatedSelectedRoom);
          console.log("Updated selectedRoom with fresh data");
        }
      } else if (
        !selectedRoom ||
        !allRooms.some(
          (r) => (r.id || r._id) === (selectedRoom?.id || selectedRoom?._id),
        )
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
      await memberService.addMember(selectedRoom.id || selectedRoom._id, {
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
              await memberService.deleteMember(
                selectedRoom.id || selectedRoom._id,
                memberId,
              );
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
        (m.id || m._id) === memberId ? { ...m, isPayer: !isCurrentlyPayer } : m,
      );
      setMembers(updatedMembers);
      await memberService.updateMember(
        selectedRoom.id || selectedRoom._id,
        memberId,
        {
          isPayer: !isCurrentlyPayer,
        },
      );
      await fetchRooms();
    } catch (error) {
      console.error("Error toggling payor:", error);
      Alert.alert("Error", "Failed to update payor status");
      // revert by re-fetching
      await fetchRooms();
    }
  };

  const handleApproveMember = async (memberId, memberName) => {
    if (!selectedRoom) return;
    Alert.alert(
      "Approve Member",
      `Approve ${memberName} to join ${selectedRoom.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            try {
              await memberService.approveMember(
                selectedRoom.id || selectedRoom._id,
                memberId,
              );
              Alert.alert("Success", `${memberName} has been approved!`);
              await fetchRooms();
              await fetchPendingMembers();
            } catch (error) {
              Alert.alert("Error", "Failed to approve member");
            }
          },
        },
      ],
    );
  };

  const handleRejectMember = async (memberId, memberName) => {
    if (!selectedRoom) return;
    Alert.alert(
      "Reject Request",
      `Reject ${memberName}'s request to join ${selectedRoom.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              await memberService.rejectMember(
                selectedRoom.id || selectedRoom._id,
                memberId,
              );
              Alert.alert("Done", `${memberName}'s request has been rejected.`);
              await fetchPendingMembers();
            } catch (error) {
              Alert.alert("Error", "Failed to reject request");
            }
          },
        },
      ],
    );
  };

  const filteredMembers = members.filter((member) =>
    (member.user?.name || member.name || member.email || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingLabel}>Loading members...</Text>
      </View>
    );
  }

  const payerCount = members.filter(
    (m) => m.isPayer || m.is_payer,
  ).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 30 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchRooms(true)}
          tintcolor={colors.accent}
          colors={["#b38604"]}
        />
      }
    >
      {/* Room Selector */}
      <View style={styles.roomSelector}>
        <Text style={styles.roomSelectorLabel}>Select Room</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {rooms.map((item) => {
            const active =
              (selectedRoom?.id || selectedRoom?._id) ===
              (item.id || item._id);
            return (
              <TouchableOpacity
                key={item.id || item._id}
                style={[styles.roomChip, active && styles.roomChipActive]}
                activeOpacity={0.7}
                onPress={() => setSelectedRoom(item)}
              >
                <Ionicons
                  name="home"
                  size={12}
                  color={active ? "#fff" : "#999"}
                />
                <Text
                  style={[
                    styles.roomChipText,
                    active && styles.roomChipTextActive,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {selectedRoom && (
        <>
          {/* Summary Strip */}
          <View style={styles.summaryStrip}>
            <View style={[styles.stripIconWrap, { backgroundColor: colors.accentSurface }]}>
              <Ionicons name="people" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stripTitle}>{selectedRoom.name}</Text>
              <Text style={styles.stripSubtitle}>
                {members.length} member{members.length !== 1 ? "s" : ""} · {payerCount} payer{payerCount !== 1 ? "s" : ""}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              activeOpacity={0.7}
              onPress={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) {
                  setMemberEmail("");
                  setMemberName("");
                }
              }}
            >
              <Ionicons
                name={showAddForm ? "close" : "person-add"}
                size={16}
                color={colors.textOnAccent}
              />
            </TouchableOpacity>
          </View>

          {/* Search */}
          {members.length > 0 && (
            <View style={styles.searchBar}>
              <Ionicons name="search" size={15} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search members..."
                placeholderTextColor={colors.textTertiary}
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm("")}>
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Add Member Form */}
          {showAddForm && (
            <View style={styles.addFormCard}>
              <View style={styles.addFormHeader}>
                <View style={styles.addFormHeaderLeft}>
                  <View
                    style={[
                      styles.addFormIconWrap,
                      { backgroundColor: colors.accentSurface },
                    ]}
                  >
                    <Ionicons name="person-add" size={16} color={colors.accent} />
                  </View>
                  <Text style={styles.addFormTitle}>Add New Member</Text>
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => setShowAddForm(false)}
                >
                  <Ionicons name="close" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.addFormInput}
                placeholder="Enter member email"
                placeholderTextColor={colors.textTertiary}
                value={memberEmail}
                onChangeText={setMemberEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!adding}
              />
              <TouchableOpacity
                style={[styles.addFormSubmitBtn, adding && { opacity: 0.6 }]}
                activeOpacity={0.7}
                onPress={handleAddMember}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator color={colors.textOnAccent} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color={colors.textOnAccent} />
                    <Text style={styles.addFormSubmitText}>Add Member</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Pending Join Requests */}
          {pendingMembers.length > 0 && (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View
                    style={[
                      styles.sectionIconWrap,
                      { backgroundColor: colors.accentSurface },
                    ]}
                  >
                    <Ionicons name="time" size={14} color="#e67e22" />
                  </View>
                  <Text style={[styles.sectionTitle, { color: "#e67e22" }]}>
                    Pending Requests
                  </Text>
                </View>
                <View style={styles.pendingCountBadge}>
                  <Text style={styles.pendingCountText}>
                    {pendingMembers.length}
                  </Text>
                </View>
              </View>
              {pendingMembers.map((item) => {
                const initial = (
                  item.user?.name ||
                  item.name ||
                  "U"
                )
                  .charAt(0)
                  .toUpperCase();
                return (
                  <View key={item.id || item._id} style={styles.pendingCard}>
                    <View style={styles.pendingLeft}>
                      {item.user?.avatar?.url ? (
                        <Image
                          source={{ uri: item.user.avatar.url }}
                          style={styles.pendingAvatar}
                        />
                      ) : (
                        <View style={styles.pendingAvatarFallback}>
                          <Text style={styles.pendingAvatarText}>
                            {initial}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pendingName} numberOfLines={1}>
                          {item.user?.name || item.name || "Unknown"}
                        </Text>
                        <Text style={styles.pendingEmail} numberOfLines={1}>
                          {item.user?.email || item.email || ""}
                        </Text>
                        <View style={styles.pendingChipRow}>
                          <View style={styles.pendingChip}>
                            <Ionicons
                              name="hourglass"
                              size={9}
                              color="#e67e22"
                            />
                            <Text style={styles.pendingChipText}>Pending</Text>
                          </View>
                          <View style={styles.payerInfoChip}>
                            <Text style={styles.payerInfoChipText}>
                              {item.isPayer ? "Payor" : "Non-payor"}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <View style={styles.pendingActions}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        activeOpacity={0.7}
                        onPress={() =>
                          handleApproveMember(
                            item.id || item._id,
                            item.user?.name || item.name || "Member",
                          )
                        }
                      >
                        <Ionicons name="checkmark" size={18} color={colors.textOnAccent} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        activeOpacity={0.7}
                        onPress={() =>
                          handleRejectMember(
                            item.id || item._id,
                            item.user?.name || item.name || "Member",
                          )
                        }
                      >
                        <Ionicons name="close" size={18} color={colors.textOnAccent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Members List */}
          {members.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="people-outline" size={36} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No Members Yet</Text>
              <Text style={styles.emptySubtitle}>
                Add the first member to get started.
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                activeOpacity={0.7}
                onPress={() => setShowAddForm(true)}
              >
                <Ionicons name="person-add" size={14} color={colors.textOnAccent} />
                <Text style={styles.emptyActionText}>Add Member</Text>
              </TouchableOpacity>
            </View>
          ) : filteredMembers.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="search" size={36} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>No Results</Text>
              <Text style={styles.emptySubtitle}>
                No members match "{searchTerm}"
              </Text>
            </View>
          ) : (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <View
                    style={[
                      styles.sectionIconWrap,
                      { backgroundColor: colors.successBg },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={colors.success}
                    />
                  </View>
                  <Text style={styles.sectionTitle}>Active Members</Text>
                </View>
              </View>

              <FlatList
                data={filteredMembers}
                keyExtractor={(item) => item.id || item._id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const presenceDays = item.presence
                    ? item.presence.length
                    : 0;
                  const isPayer = item.isPayer || item.is_payer;
                  const initial = (item.user?.name || item.name || "U")
                    .charAt(0)
                    .toUpperCase();

                  return (
                    <View style={styles.memberCard}>
                      {/* Top row: avatar + info + actions */}
                      <View style={styles.memberCardTop}>
                        <View style={styles.memberCardLeft}>
                          {item.user?.avatar?.url ? (
                            <Image
                              source={{ uri: item.user.avatar.url }}
                              style={styles.memberAvatar}
                            />
                          ) : (
                            <View style={styles.memberAvatarFallback}>
                              <Text style={styles.memberAvatarText}>
                                {initial}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.memberName} numberOfLines={1}>
                              {item.user?.name || item.name || "Unknown"}
                            </Text>
                            <Text style={styles.memberEmail} numberOfLines={1}>
                              {item.user?.email || item.email}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.memberCardActions}>
                          <TouchableOpacity
                            style={[
                              styles.payerToggle,
                              isPayer
                                ? styles.payerToggleOn
                                : styles.payerToggleOff,
                            ]}
                            activeOpacity={0.7}
                            onPress={() =>
                              handleTogglePayer(item.id || item._id, isPayer)
                            }
                          >
                            <Ionicons
                              name={
                                isPayer
                                  ? "checkmark-circle"
                                  : "ellipse-outline"
                              }
                              size={16}
                              color={isPayer ? "#fff" : colors.success}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            activeOpacity={0.7}
                            onPress={() =>
                              handleDeleteMember(item.id || item._id)
                            }
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color={colors.error}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Bottom chips */}
                      <View style={styles.memberChipRow}>
                        <View
                          style={[
                            styles.memberChip,
                            isPayer
                              ? { backgroundColor: colors.successBg }
                              : { backgroundColor: colors.inputBg },
                          ]}
                        >
                          <Ionicons
                            name={isPayer ? "wallet" : "wallet-outline"}
                            size={11}
                            color={isPayer ? colors.success : "#999"}
                          />
                          <Text
                            style={[
                              styles.memberChipText,
                              { color: isPayer ? colors.success : "#999" },
                            ]}
                          >
                            {isPayer ? "Payor" : "Non-payor"}
                          </Text>
                        </View>
                        {presenceDays > 0 && (
                          <View
                            style={[
                              styles.memberChip,
                              { backgroundColor: colors.infoBg },
                            ]}
                          >
                            <Ionicons
                              name="calendar"
                              size={11}
                              color={colors.info}
                            />
                            <Text
                              style={[
                                styles.memberChipText,
                                { color: colors.waterColor },
                              ]}
                            >
                              {presenceDays} day{presenceDays !== 1 ? "s" : ""}
                            </Text>
                          </View>
                        )}
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

const createStyles = (colors) => StyleSheet.create({
  /* ── Layout ── */
  container: { flex: 1, backgroundColor: colors.background },
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  loadingLabel: { fontSize: 13, color: colors.textTertiary, marginTop: 10 },

  /* ── Room Selector ── */
  roomSelector: {
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  roomSelectorLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  roomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roomChipActive: {
    backgroundColor: colors.accent,
    borderColor: "#b38604",
  },
  roomChipText: { fontSize: 13, fontWeight: "600", color: colors.textTertiary },
  roomChipTextActive: { color: "#fff" },

  /* ── Summary Strip ── */
  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  stripIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  stripTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  stripSubtitle: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── Search ── */
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 10,
  },

  /* ── Add Form ── */
  addFormCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    marginHorizontal: 14,
    marginTop: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#b38604",
    ...Platform.select({
      ios: {
        shadowColor: "#b38604",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  addFormHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  addFormHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addFormIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addFormTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  addFormInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.cardAlt,
    marginBottom: 12,
  },
  addFormSubmitBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  addFormSubmitText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  /* ── Section ── */
  sectionWrap: { marginHorizontal: 14, marginTop: 16 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  pendingCountBadge: {
    backgroundColor: "#e67e22",
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingCountText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  /* ── Pending Card ── */
  pendingCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 3,
    borderLeftColor: "#e67e22",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
    }),
  },
  pendingLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pendingAvatar: { width: 38, height: 38, borderRadius: 19 },
  pendingAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSurface,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingAvatarText: { fontSize: 15, fontWeight: "700", color: "#e67e22" },
  pendingName: { fontSize: 14, fontWeight: "600", color: colors.text },
  pendingEmail: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  pendingChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  pendingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.accentSurface,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pendingChipText: { fontSize: 10, fontWeight: "600", color: "#e67e22" },
  payerInfoChip: {
    backgroundColor: colors.background,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  payerInfoChipText: { fontSize: 10, fontWeight: "600", color: colors.textTertiary },
  pendingActions: {
    flexDirection: "row",
    gap: 6,
    marginLeft: 8,
  },
  approveBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.success,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#e53935",
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── Member Card ── */
  memberCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
    }),
  },
  memberCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.inputBg,
  },
  memberAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSurface,
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarText: { fontSize: 15, fontWeight: "700", color: colors.accent },
  memberName: { fontSize: 14, fontWeight: "600", color: colors.text },
  memberEmail: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  memberCardActions: {
    flexDirection: "row",
    gap: 6,
    marginLeft: 8,
  },
  payerToggle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  payerToggleOn: { backgroundColor: colors.success },
  payerToggleOff: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.success,
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.errorBg,
    justifyContent: "center",
    alignItems: "center",
  },
  memberChipRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  memberChipText: { fontSize: 11, fontWeight: "600" },

  /* ── Empty State ── */
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    marginHorizontal: 14,
    marginTop: 24,
    padding: 32,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 1 },
    }),
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accentSurface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyActionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});

export default AdminMembersScreen;
