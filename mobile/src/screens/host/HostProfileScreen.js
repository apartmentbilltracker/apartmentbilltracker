import React, { useContext, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import { AuthContext } from "../../context/AuthContext";
import { useTheme } from "../../theme/ThemeContext";

const THEME_OPTIONS = [
  { key: "light", label: "Light", icon: "sunny" },
  { key: "dark", label: "Dark", icon: "moon" },
  { key: "system", label: "System", icon: "phone-portrait-outline" },
];

const HostProfileScreen = ({ navigation }) => {
  const { colors, preference, setTheme } = useTheme();
  const styles = createStyles(colors);

  const { state, signOut, updateUserProfile, switchView } =
    useContext(AuthContext);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const user = state.user || {};

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut();
    } catch (error) {
      Alert.alert("Error", "Failed to logout. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  const handleEditPress = () => {
    setEditName(user.name || "");
    setSelectedImage(null);
    setEditModalVisible(true);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = () => {
          setSelectedImage({
            uri: asset.uri,
            base64: reader.result.split(",")[1],
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
      {/* Profile Header Card */}
      <View style={styles.profileCard}>
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
                {(user.name || "H").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.editAvatarBtn}
            onPress={handleEditPress}
            disabled={isUpdating}
          >
            <Ionicons
              name="camera-outline"
              size={14}
              color={colors.textOnAccent}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.userName}>{user.name || "Host"}</Text>
        <Text style={styles.userEmail}>{user.email || "N/A"}</Text>

        <View style={styles.roleBadge}>
          <Ionicons name="key" size={13} color="#b38604" />
          <Text style={styles.roleBadgeText}>Room Host</Text>
        </View>
      </View>

      {/* Account Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="person-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.sectionTitle}>Account Information</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Name</Text>
          <Text style={styles.infoValue}>{user.name || "N/A"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user.email || "N/A"}</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>Role</Text>
          <View
            style={{
              backgroundColor: "rgba(179,134,4,0.12)",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: colors.accent,
              }}
            >
              Host
            </Text>
          </View>
        </View>
      </View>

      {/* App Version */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={colors.accent}
            />
          </View>
          <Text style={styles.sectionTitle}>App Version</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>
            {Constants.expoConfig?.version || "1.0.0"}
          </Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>Build</Text>
          <Text style={styles.infoValue}>1</Text>
        </View>
      </View>

      {/* ─── Appearance ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionAppearanceTitle}>Appearance</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((opt) => {
            const active = preference === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.themeOption, active && styles.themeOptionActive]}
                onPress={() => setTheme(opt.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={active ? colors.accent : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.themeOptionLabel,
                    active && styles.themeOptionLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ─── LEGAL ─── */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.legalRow}
          onPress={() => navigation.navigate("TermsOfService")}
          activeOpacity={0.7}
        >
          <Ionicons
            name="document-text-outline"
            size={18}
            color={colors.accent}
          />
          <Text style={styles.legalRowText}>Terms of Service</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.legalRow}
          onPress={() => navigation.navigate("PrivacyPolicy")}
          activeOpacity={0.7}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={colors.accent}
          />
          <Text style={styles.legalRowText}>Privacy Policy</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Switch to Client View */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.clientViewButton}
          onPress={() => switchView("client")}
          activeOpacity={0.8}
        >
          <View style={styles.clientViewIconWrap}>
            <Ionicons
              name="swap-horizontal-outline"
              size={22}
              color={colors.textOnAccent}
            />
          </View>
          <View style={styles.clientViewContent}>
            <Text style={styles.clientViewTitle}>Switch to Client View</Text>
            <Text style={styles.clientViewSubtitle}>
              Browse as a regular user
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color="rgba(255,255,255,0.6)"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.logoutSection}>
        <TouchableOpacity
          style={[
            styles.logoutButton,
            loggingOut && styles.logoutButtonDisabled,
          ]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <View style={styles.logoutLoading}>
              <ActivityIndicator size="small" color={colors.error} />
              <Text style={styles.logoutButtonText}>Logging out...</Text>
            </View>
          ) : (
            <View style={styles.logoutLoading}>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => !isUpdating && setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => !isUpdating && setEditModalVisible(false)}
                disabled={isUpdating}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

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
                    {editName.charAt(0).toUpperCase() || "H"}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.changeAvatarButton}
                onPress={pickImage}
                disabled={isUpdating}
              >
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={colors.textOnAccent}
                />
                <Text style={styles.changeAvatarText}>Change Avatar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="Enter your name"
                value={editName}
                onChangeText={setEditName}
                editable={!isUpdating}
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                isUpdating && styles.saveButtonDisabled,
              ]}
              onPress={handleSaveProfile}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color={colors.textOnAccent} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={colors.textOnAccent}
                  />
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

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    profileCard: {
      alignItems: "center",
      paddingVertical: 28,
      paddingHorizontal: 16,
      marginHorizontal: 12,
      marginTop: 12,
      backgroundColor: colors.card,
      borderRadius: 14,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.07,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
    },
    avatarContainer: { marginBottom: 14, position: "relative" },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: "#b38604",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: "rgba(179,134,4,0.18)",
    },
    avatarImage: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.inputBg,
      borderWidth: 3,
      borderColor: "rgba(179,134,4,0.18)",
    },
    avatarText: { fontSize: 34, fontWeight: "700", color: "#fff" },
    editAvatarBtn: {
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: "#fff",
    },
    userName: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: colors.textTertiary,
      marginBottom: 12,
    },
    roleBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(179,134,4,0.12)",
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 8,
      marginBottom: 16,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#b38604",
    },
    editButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 10,
      alignItems: "center",
      gap: 6,
    },
    editButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    section: {
      marginHorizontal: 12,
      marginTop: 12,
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
        },
        android: { elevation: 1 },
      }),
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      gap: 8,
    },
    sectionIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(179,134,4,0.12)",
      justifyContent: "center",
      alignItems: "center",
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    sectionAppearanceTitle: {
      fontSize: 15,
      marginBottom: 12,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    infoLabel: { fontSize: 14, color: colors.textTertiary },
    infoValue: { fontSize: 14, fontWeight: "600", color: colors.text },
    themeRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 12,
      paddingBottom: 14,
    },
    themeOption: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      borderWidth: 1.5,
      borderColor: "transparent",
      gap: 4,
    },
    themeOptionActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSurface,
    },
    themeOptionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    themeOptionLabelActive: { color: colors.accent },
    legalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    legalRowText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
    },
    clientViewButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
    },
    clientViewIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.2)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    clientViewContent: { flex: 1 },
    clientViewTitle: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
      marginBottom: 2,
    },
    clientViewSubtitle: {
      color: "rgba(255,255,255,0.7)",
      fontSize: 12,
    },
    logoutSection: {
      marginHorizontal: 12,
      marginTop: 12,
      marginBottom: 32,
    },
    logoutButton: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(231,76,60,0.2)",
    },
    logoutButtonDisabled: { opacity: 0.7 },
    logoutLoading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    logoutButtonText: {
      color: "#e74c3c",
      fontSize: 15,
      fontWeight: "700",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingBottom: 24,
      paddingTop: 10,
      maxHeight: "90%",
    },
    modalIconHeader: {
      alignItems: "center",
      marginTop: 20,
      marginBottom: 4,
    },
    modalIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(179,134,4,0.12)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      marginBottom: 16,
      marginTop: 8,
    },
    modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    modalAvatarSection: {
      alignItems: "center",
      marginBottom: 20,
      paddingHorizontal: 20,
    },
    modalAvatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: "#b38604",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
      borderWidth: 3,
      borderColor: "rgba(179,134,4,0.18)",
    },
    modalAvatarImage: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.inputBg,
      marginBottom: 12,
      borderWidth: 3,
      borderColor: "rgba(179,134,4,0.18)",
    },
    modalAvatarText: { fontSize: 38, fontWeight: "700", color: "#fff" },
    changeAvatarButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      alignItems: "center",
      gap: 6,
    },
    changeAvatarText: { color: "#fff", fontSize: 13, fontWeight: "600" },
    formSection: { marginBottom: 18, paddingHorizontal: 20 },
    formLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 6,
    },
    nameInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.cardAlt,
    },
    saveButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 20,
      gap: 8,
    },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  });

export default HostProfileScreen;
