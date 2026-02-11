import React, { useState, useEffect, useMemo} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const AdminRoomManagementScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [rooms, setRooms] = useState([]);

  // Open create form when navigated here with params.openCreate
  useEffect(() => {
    if (route?.params?.openCreate) {
      resetForm();
      setShowCreateForm(true);
      navigation.setParams({ openCreate: false });
    }
  }, [route?.params?.openCreate]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [maxOccupancy, setMaxOccupancy] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await roomService.getRooms();
      setRooms(response.rooms || response.data?.rooms || []);
    } catch (error) {
      console.log("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      Alert.alert("Error", "Please enter room name");
      return;
    }

    try {
      setSaving(true);
      await roomService.createRoom({
        name: roomName.trim(),
        description: roomDescription.trim(),
        maxOccupancy: maxOccupancy ? Number(maxOccupancy) : undefined,
      });
      await fetchRooms();
      resetForm();
      setShowCreateForm(false);
      Alert.alert("Success", "Room created successfully");
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to create room",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRoom = async () => {
    if (!roomName.trim()) {
      Alert.alert("Error", "Please enter room name");
      return;
    }

    try {
      setSaving(true);
      await roomService.updateRoom(editingRoom.id || editingRoom._id, {
        name: roomName.trim(),
        description: roomDescription.trim(),
        maxOccupancy: maxOccupancy ? Number(maxOccupancy) : undefined,
      });
      await fetchRooms();
      resetForm();
      setEditingRoom(null);
      setShowCreateForm(false);
      Alert.alert("Success", "Room updated successfully");
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to update room",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    Alert.alert(
      "Delete Room",
      "Are you sure you want to delete this room? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await roomService.deleteRoom(roomId);
              await fetchRooms();
              Alert.alert("Success", "Room deleted successfully");
            } catch (error) {
              Alert.alert(
                "Error",
                error.response?.data?.message || "Failed to delete room",
              );
            }
          },
        },
      ],
    );
  };

  const resetForm = () => {
    setRoomName("");
    setRoomDescription("");
    setMaxOccupancy("");
    setEditingRoom(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateForm(true);
  };

  const openEditModal = (room) => {
    setEditingRoom(room);
    setRoomName(room.name || "");
    setRoomDescription(room.description || "");
    setMaxOccupancy(String(room.maxOccupancy || room.max_occupancy || ""));
    setShowCreateForm(true);
  };

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalMembers = rooms.reduce(
    (sum, r) => sum + (r.members?.length || 0),
    0,
  );

  const renderRoomCard = (room) => {
    const memberCount = room.members?.length || 0;
    const maxOcc = room.maxOccupancy || room.max_occupancy;
    const occupancyPercent = maxOcc
      ? Math.round((memberCount / maxOcc) * 100)
      : null;
    const roomCode = room.code || room.room_code;

    return (
      <TouchableOpacity
        key={room.id || room._id}
        style={styles.roomCard}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate("BillingStack", {
            screen: "AdminBilling",
            params: { roomId: room.id || room._id, roomName: room.name },
          })
        }
      >
        <View style={styles.roomCardTop}>
          <View style={styles.roomIconWrap}>
            <Ionicons name="home" size={20} color={colors.textOnAccent} />
          </View>
          <View style={styles.roomCardInfo}>
            <Text style={styles.roomName} numberOfLines={1}>
              {room.name}
            </Text>
            {roomCode ? (
              <View style={styles.codeBadge}>
                <Ionicons name="key-outline" size={10} color={colors.accent} />
                <Text style={styles.codeText}>{roomCode}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.roomCardActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => openEditModal(room)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={18} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleDeleteRoom(room.id || room._id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color="#c62828" />
            </TouchableOpacity>
          </View>
        </View>

        {room.description ? (
          <Text style={styles.roomDesc} numberOfLines={2}>
            {room.description}
          </Text>
        ) : null}

        <View style={styles.roomCardBottom}>
          <View style={styles.metaChip}>
            <Ionicons name="people" size={13} color={colors.info} />
            <Text style={styles.metaChipText}>
              {memberCount} member{memberCount !== 1 ? "s" : ""}
            </Text>
          </View>

          {maxOcc ? (
            <View style={styles.metaChip}>
              <Ionicons name="resize" size={13} color={colors.internetColor} />
              <Text style={styles.metaChipText}>Max {maxOcc}</Text>
            </View>
          ) : null}

          {occupancyPercent !== null ? (
            <View
              style={[
                styles.metaChip,
                {
                  backgroundColor:
                    occupancyPercent >= 90
                      ? "#fce4ec"
                      : occupancyPercent >= 70
                        ? "#fff8e1"
                        : colors.successBg,
                },
              ]}
            >
              <Ionicons
                name={occupancyPercent >= 90 ? "warning" : "pulse"}
                size={13}
                color={
                  occupancyPercent >= 90
                    ? "#c62828"
                    : occupancyPercent >= 70
                      ? colors.electricityColor
                      : colors.success
                }
              />
              <Text
                style={[
                  styles.metaChipText,
                  {
                    color:
                      occupancyPercent >= 90
                        ? "#c62828"
                        : occupancyPercent >= 70
                          ? colors.electricityColor
                          : colors.success,
                  },
                ]}
              >
                {occupancyPercent}% full
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.roomCardFooter}>
          <Text style={styles.viewDetailsText}>View billing & details</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Summary Strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <View
            style={[styles.summaryIconWrap, { backgroundColor: colors.accentSurface }]}
          >
            <Ionicons name="home" size={16} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.summaryValue}>{rooms.length}</Text>
            <Text style={styles.summaryLabel}>Rooms</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <View
            style={[styles.summaryIconWrap, { backgroundColor: colors.infoBg }]}
          >
            <Ionicons name="people" size={16} color={colors.info} />
          </View>
          <View>
            <Text style={styles.summaryValue}>{totalMembers}</Text>
            <Text style={styles.summaryLabel}>Members</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <TouchableOpacity style={styles.addRoomBtn} onPress={openCreateModal}>
          <Ionicons name="add-circle" size={20} color={colors.textOnAccent} />
          <Text style={styles.addRoomBtnText}>Add Room</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search rooms..."
            placeholderTextColor={colors.textTertiary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm("")}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Rooms List */}
      <ScrollView
        style={styles.listWrap}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintcolor={colors.accent}
            colors={["#b38604"]}
          />
        }
      >
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading rooms...</Text>
          </View>
        ) : filteredRooms.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="home-outline" size={44} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>
              {rooms.length === 0 ? "No rooms yet" : "No matches found"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {rooms.length === 0
                ? 'Tap "Add Room" to create your first room'
                : "Try a different search term"}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.listHeader}>
              {filteredRooms.length} room{filteredRooms.length !== 1 ? "s" : ""}
              {searchTerm ? ` matching "${searchTerm}"` : ""}
            </Text>
            {filteredRooms.map(renderRoomCard)}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateForm}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowCreateForm(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
            </View>
            <View style={styles.modalTitleRow}>
              <View style={styles.modalTitleIconWrap}>
                <Ionicons
                  name={editingRoom ? "create" : "add-circle"}
                  size={22}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.modalTitle}>
                {editingRoom ? "Edit Room" : "Create New Room"}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.formFields}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Room Name *</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="home-outline" size={18} color={colors.accent} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Room 101"
                    placeholderTextColor={colors.textTertiary}
                    value={roomName}
                    onChangeText={setRoomName}
                    editable={!saving}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Description</Text>
                <View style={[styles.inputWrap, styles.textAreaWrap]}>
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={colors.accent}
                    style={{ marginTop: 2 }}
                  />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Room description (optional)"
                    placeholderTextColor={colors.textTertiary}
                    value={roomDescription}
                    onChangeText={setRoomDescription}
                    multiline
                    editable={!saving}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Max Occupancy</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="people-outline" size={18} color={colors.accent} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 4"
                    placeholderTextColor={colors.textTertiary}
                    value={maxOccupancy}
                    onChangeText={setMaxOccupancy}
                    keyboardType="number-pad"
                    editable={!saving}
                  />
                </View>
              </View>
            </View>

            {/* Form Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.btnDisabled]}
                onPress={editingRoom ? handleUpdateRoom : handleCreateRoom}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textOnAccent} size="small" />
                ) : (
                  <>
                    <Ionicons
                      name={editingRoom ? "checkmark-circle" : "add-circle"}
                      size={18}
                      color={colors.textOnAccent}
                    />
                    <Text style={styles.submitBtnText}>
                      {editingRoom ? "Update Room" : "Create Room"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Summary Strip
  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e8e8e8",
    gap: 12,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.textTertiary,
    marginTop: -1,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.skeleton,
  },
  addRoomBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    marginLeft: "auto",
  },
  addRoomBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  // Search
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },

  // List
  listWrap: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textTertiary,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Room Card
  roomCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  roomCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  roomIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  roomCardInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  codeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.accentSurface,
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  codeText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.accent,
    letterSpacing: 0.5,
  },
  roomCardActions: {
    flexDirection: "row",
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  roomDesc: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 10,
    lineHeight: 17,
    paddingLeft: 54,
  },
  roomCardBottom: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    paddingLeft: 54,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  roomCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accent,
  },

  // Loading & Empty
  centerWrap: {
    alignItems: "center",
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 12,
  },
  emptyWrap: {
    alignItems: "center",
    paddingTop: 48,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSurface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: "center",
    lineHeight: 18,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "85%",
  },
  modalHeader: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.skeleton,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  modalTitleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accentSurface,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },

  // Form
  formFields: {
    paddingHorizontal: 20,
    gap: 16,
  },
  fieldGroup: {},
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  textAreaWrap: {
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
    paddingVertical: 0,
  },

  // Modal Buttons
  modalButtons: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  submitBtn: {
    flex: 2,
    flexDirection: "row",
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

export default AdminRoomManagementScreen;
