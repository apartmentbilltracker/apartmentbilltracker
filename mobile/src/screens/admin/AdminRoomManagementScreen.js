import React, { useState, useEffect } from "react";
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
} from "react-native";
import { roomService } from "../../services/apiService";

const AdminRoomManagementScreen = ({ navigation, route }) => {
  const [rooms, setRooms] = useState([]);

  // Open create form when navigated here with params.openCreate
  useEffect(() => {
    if (route?.params?.openCreate) {
      resetForm();
      setShowCreateForm(true);
      // Clear the param so it doesn't re-open on future navigations
      navigation.setParams({ openCreate: false });
    }
  }, [route?.params?.openCreate]);
  const [loading, setLoading] = useState(true);
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
      await roomService.updateRoom(editingRoom._id, {
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
    Alert.alert("Delete Room", "Are you sure you want to delete this room?", [
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
    ]);
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
    setMaxOccupancy(String(room.maxOccupancy || ""));
    setShowCreateForm(true);
  };

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header with Search */}
      <View style={styles.header}>
        <Text style={styles.title}>Room Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
          <Text style={styles.addButtonText}>+ Add Room</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search rooms..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {editingRoom ? "Edit Room" : "Create New Room"}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Room Name"
            value={roomName}
            onChangeText={setRoomName}
            editable={!saving}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            value={roomDescription}
            onChangeText={setRoomDescription}
            multiline
            editable={!saving}
          />
          <TextInput
            style={styles.input}
            placeholder="Max Occupancy (optional)"
            value={maxOccupancy}
            onChangeText={setMaxOccupancy}
            keyboardType="decimal-pad"
            editable={!saving}
          />
          <View style={styles.formButtons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                setShowCreateForm(false);
                resetForm();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.createButton,
                saving && styles.buttonDisabled,
              ]}
              onPress={editingRoom ? handleUpdateRoom : handleCreateRoom}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>
                  {editingRoom ? "Update" : "Create"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Rooms List */}
      <View style={styles.roomsSection}>
        {loading ? (
          <ActivityIndicator size="large" color="#b38604" />
        ) : filteredRooms.length === 0 ? (
          <Text style={styles.emptyText}>
            {rooms.length === 0
              ? "No rooms yet. Create one!"
              : "No rooms found matching your search"}
          </Text>
        ) : (
          filteredRooms.map((room) => (
            <View key={room._id} style={styles.roomCard}>
              <View style={styles.roomCardContent}>
                <View style={styles.roomInfo}>
                  <Text style={styles.roomName}>{room.name}</Text>
                  {room.description && (
                    <Text style={styles.roomDesc}>{room.description}</Text>
                  )}
                  <View style={styles.roomMeta}>
                    <Text style={styles.metaItem}>
                      👥 {room.members?.length || 0} members
                    </Text>
                    {room.maxOccupancy && (
                      <Text style={styles.metaItem}>
                        📍 Max: {room.maxOccupancy}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.roomActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => openEditModal(room)}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteRoom(room._id)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  addButton: {
    backgroundColor: "#b38604",
    paddingHorizontal: 12,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
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
  createButton: {
    backgroundColor: "#b38604",
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  roomsSection: {
    padding: 12,
  },
  roomCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
    borderLeftWidth: 4,
    borderLeftColor: "#b38604",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roomCardContent: {
    padding: 12,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  roomDesc: {
    fontSize: 13,
    color: "#666",
    marginBottom: 6,
  },
  roomMeta: {
    flexDirection: "row",
    gap: 12,
  },
  metaItem: {
    fontSize: 12,
    color: "#999",
  },
  roomActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  editButton: {
    flex: 1,
    backgroundColor: "#0066cc",
    paddingVertical: 10,
    alignItems: "center",
  },
  editButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#ff6b6b",
    paddingVertical: 10,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 30,
  },
});

export default AdminRoomManagementScreen;
