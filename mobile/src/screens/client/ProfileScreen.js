import React, { useContext, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { AuthContext } from "../../context/AuthContext";

const ProfileScreen = ({ navigation }) => {
  const { state, refreshUser, signOut, switchView, updateUserProfile } =
    useContext(AuthContext);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const user = state.user || {};
  // Handle role as either array or string
  const isAdmin = Array.isArray(user.role)
    ? user.role.includes("admin")
    : typeof user.role === "string" &&
      user.role.toLowerCase().includes("admin");

  const handleAdminButtonPress = () => {
    console.log("Switching to admin view...");
    switchView("admin");
  };

  const handleEditPress = () => {
    setEditName(user.name || "");
    setSelectedImage(null);
    setEditModalVisible(true);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        // Convert image to base64
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = () => {
          setSelectedImage({
            uri: asset.uri,
            base64: reader.result.split(",")[1], // Remove data:image/... prefix
          });
        };
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Validation", "Name cannot be empty");
      return;
    }

    setIsUpdating(true);
    try {
      const result = await updateUserProfile(
        editName,
        selectedImage?.base64 || null,
      );

      if (result.success) {
        Alert.alert("Success", "Profile updated successfully");
        setEditModalVisible(false);
        setSelectedImage(null);
      } else {
        Alert.alert("Error", result.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  const getAvatarSource = () => {
    if (user.avatar?.url) {
      return { uri: user.avatar.url };
    }
    return null;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          {user.avatar?.url ? (
            <Image
              source={getAvatarSource()}
              style={styles.avatarImage}
              defaultSource={require("../../assets/default-avatar.png")}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user.name || "U").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.userName}>{user.name || "User"}</Text>
        <Text style={styles.userEmail}>{user.email || "N/A"}</Text>

        <TouchableOpacity
          style={styles.editButton}
          onPress={handleEditPress}
          disabled={isUpdating}
        >
          <MaterialIcons name="edit" size={18} color="#fff" />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Name</Text>
          <Text style={styles.infoValue}>{user.name || "N/A"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user.email || "N/A"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role</Text>
          <View style={styles.roleContainer}>
            <Text style={styles.infoValue}>{user.role || "Client"}</Text>
            {isAdmin && (
              <View style={styles.adminBadge}>
                <MaterialIcons name="verified-user" size={12} color="#fff" />
              </View>
            )}
          </View>
        </View>
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin Panel</Text>
          <TouchableOpacity
            style={styles.adminButton}
            onPress={handleAdminButtonPress}
          >
            <MaterialIcons
              name="admin-panel-settings"
              size={20}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.adminButtonText}>Go to Admin Dashboard</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => !isUpdating && setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => !isUpdating && setEditModalVisible(false)}
                disabled={isUpdating}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Avatar Preview */}
            <View style={styles.modalAvatarSection}>
              {selectedImage?.uri ? (
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.modalAvatarImage}
                />
              ) : user.avatar?.url ? (
                <Image
                  source={getAvatarSource()}
                  style={styles.modalAvatarImage}
                />
              ) : (
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>
                    {editName.charAt(0).toUpperCase() || "U"}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.changAvatarButton}
                onPress={pickImage}
                disabled={isUpdating}
              >
                <MaterialIcons name="photo-camera" size={18} color="#fff" />
                <Text style={styles.changeAvatarText}>Change Avatar</Text>
              </TouchableOpacity>
            </View>

            {/* Name Input */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="Enter your name"
                value={editName}
                onChangeText={setEditName}
                editable={!isUpdating}
                placeholderTextColor="#999"
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                isUpdating && styles.saveButtonDisabled,
              ]}
              onPress={handleSaveProfile}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="save" size={18} color="#fff" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#bdb246",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f0f0f0",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#888",
    marginBottom: 16,
  },
  editButton: {
    flexDirection: "row",
    backgroundColor: "#ff6b35",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    gap: 8,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  roleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  adminBadge: {
    backgroundColor: "#ff6b35",
    borderRadius: 10,
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 14,
    color: "#888",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  logoutButton: {
    backgroundColor: "#ff6b6b",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  adminButton: {
    backgroundColor: "#ff6b35",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12,
  },
  adminButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  adminHelpText: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
    fontStyle: "italic",
    textAlign: "center",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 30,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  modalAvatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  modalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#bdb246",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  modalAvatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f0f0f0",
    marginBottom: 12,
  },
  modalAvatarText: {
    fontSize: 40,
    fontWeight: "700",
    color: "#fff",
  },
  changAvatarButton: {
    flexDirection: "row",
    backgroundColor: "#ff6b35",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    gap: 8,
  },
  changeAvatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#f9f9f9",
  },
  saveButton: {
    flexDirection: "row",
    backgroundColor: "#ff6b35",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ProfileScreen;
