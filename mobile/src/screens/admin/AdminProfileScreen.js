import React, { useContext, useState, useEffect, useMemo } from "react";
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
  Switch,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { AuthContext } from "../../context/AuthContext";
import { supportService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
import { getAPIBaseURL } from "../../config/config";
import { biometricAuth } from "../../utils/biometricAuth";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";

const THEME_OPTIONS = [{ key: "light", label: "Light", icon: "sunny" }];

const AdminProfileScreen = ({ navigation }) => {
  const { colors, preference, setTheme } = useTheme();
  const styles = createStyles(colors);

  const {
    state,
    signOut,
    updateUserProfile,
    switchView,
    disableBiometric,
    isBiometricEnabledFor,
    updateBiometricCredentials,
  } = useContext(AuthContext);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [unreadTickets, setUnreadTickets] = useState(0);
  const [unreadBugReports, setUnreadBugReports] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [disablingBiometric, setDisablingBiometric] = useState(false);
  const [biometricPasswordModalVisible, setBiometricPasswordModalVisible] =
    useState(false);
  const [biometricPassword, setBiometricPassword] = useState("");
  const [enablingBiometric, setEnablingBiometric] = useState(false);
  const [showBiometricPassword, setShowBiometricPassword] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const user = state.user || {};

  // Reset avatar error when user or selected image changes
  useEffect(() => {
    setAvatarError(false);
  }, [user?.email, selectedImage]);

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
    if (avatarError) return require("../../assets/default-avatar.png");
    if (selectedImage?.uri) return { uri: selectedImage.uri };
    // External URL (Google/Facebook): kept in /getuser response (tiny string, no egress cost)
    if (user?.avatar?.url?.startsWith("http")) {
      return { uri: user.avatar.url };
    }
    // Base64 avatars are stripped from /getuser to save Supabase egress.
    // Use the server's cached avatar-image endpoint instead (1-hour TTL).
    if (user?.email) {
      return {
        uri: `${getAPIBaseURL()}/api/v2/user/avatar-image/${encodeURIComponent(user.email)}`,
      };
    }
    return require("../../assets/default-avatar.png");
  };

  useEffect(() => {
    const fetchUnreadCounts = async () => {
      try {
        const ticketsResponse = await supportService.getAllTickets();
        const tickets = Array.isArray(ticketsResponse)
          ? ticketsResponse
          : ticketsResponse?.data || [];
        const unreadTicketCount = tickets.filter(
          (t) => !t.isReadByAdmin && t.replies && t.replies.length > 0,
        ).length;
        setUnreadTickets(unreadTicketCount);

        const bugsResponse = await supportService.getAllBugReports();
        const bugs = Array.isArray(bugsResponse)
          ? bugsResponse
          : bugsResponse?.data || [];
        const unreadBugCount = bugs.filter(
          (b) => !b.isReadByAdmin && b.responses && b.responses.length > 0,
        ).length;
        setUnreadBugReports(unreadBugCount);
      } catch (error) {
        console.error("Error fetching unread counts:", error);
      }
    };

    const unsubscribe = navigation.addListener("focus", () => {
      fetchUnreadCounts();
    });

    fetchUnreadCounts();
    return unsubscribe;
  }, [navigation]);

  React.useEffect(() => {
    const loadBiometricStatus = async () => {
      const available = await biometricAuth.isAvailable();
      setBiometricAvailable(available);
      if (user.email) {
        const enabled = await biometricAuth.isBiometricEnabledFor(user.email);
        setBiometricEnabled(enabled);
      }
    };
    loadBiometricStatus();
  }, [user?.email]);

  const handleToggleBiometric = (newValue) => {
    if (newValue === biometricEnabled) return;

    if (newValue === false) {
      // Disabling biometric
      Alert.alert(
        "Disable Biometric Login",
        "Are you sure you want to disable biometric login? You'll need to enter your password on next login.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              setDisablingBiometric(true);
              try {
                const result = await disableBiometric(user.email);
                if (result.success) {
                  setBiometricEnabled(false);
                } else {
                  Alert.alert(
                    "Error",
                    result.error || "Failed to disable biometric",
                  );
                  setBiometricEnabled(true);
                }
              } catch (error) {
                Alert.alert(
                  "Error",
                  error.message || "Failed to disable biometric",
                );
                setBiometricEnabled(true);
              } finally {
                setDisablingBiometric(false);
              }
            },
          },
        ],
      );
    } else {
      // Enabling biometric - show password modal for validation
      setBiometricPassword("");
      setBiometricPasswordModalVisible(true);
    }
  };

  const handleEnableBiometric = async () => {
    if (!biometricPassword.trim()) {
      Alert.alert("Error", "Please enter your password");
      return;
    }

    setEnablingBiometric(true);
    try {
      // Validate password with backend before enabling biometric
      const validationResponse = await fetch(
        `${getAPIBaseURL()}/api/v2/user/validate-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            password: biometricPassword,
          }),
        },
      );

      let validationData;
      try {
        validationData = await validationResponse.json();
      } catch (parseError) {
        console.error(
          "[Biometric] Failed to parse response:",
          validationResponse.status,
          parseError,
        );
        Alert.alert(
          "Server Error",
          `Server returned invalid response (${validationResponse.status}). Please try again later.`,
        );
        setBiometricEnabled(false);
        setEnablingBiometric(false);
        return;
      }

      if (!validationResponse.ok) {
        Alert.alert(
          "Invalid Password",
          validationData?.message ||
            "The password you entered is incorrect. Please try again.",
        );
        setBiometricEnabled(false);
        setEnablingBiometric(false);
        return;
      }

      // Password is valid, now enable biometric
      const result = await updateBiometricCredentials(
        user.email,
        biometricPassword,
        true,
      );
      if (result.success) {
        setBiometricEnabled(true);
        Alert.alert("Success", "Biometric login has been enabled");
        setBiometricPasswordModalVisible(false);
        setBiometricPassword("");
      } else {
        Alert.alert("Error", result.error || "Failed to enable biometric");
        setBiometricEnabled(false);
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to enable biometric");
      setBiometricEnabled(false);
    } finally {
      setEnablingBiometric(false);
    }
  };

  return (
    <ScrollViewWithDetection style={styles.container}>
      {/* Profile Header — Deep Forest Green */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Image
            source={getAvatarSource()}
            style={styles.avatarImage}
            defaultSource={require("../../assets/default-avatar.png")}
            onError={() => setAvatarError(true)}
          />
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
        <Text style={styles.userName}>{user.name || "Admin"}</Text>
        <Text style={styles.userEmail}>{user.email || "N/A"}</Text>
        <View style={styles.superAdminBadge}>
          <Ionicons name="shield-checkmark" size={13} color={colors.accent} />
          <Text style={styles.superAdminBadgeText}>Super Admin</Text>
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
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{user.role || "Admin"}</Text>
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
            {Constants.expoConfig?.version || "1.0.0"} (
            {Application.nativeBuildVersion || "42"})
          </Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoLabel}>Build</Text>
          <Text style={styles.infoValue}>
            {Application.nativeBuildVersion || "42"}
          </Text>
        </View>
      </View>

      {/* Support Management */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="headset-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.sectionTitle}>Support Management</Text>
          {(unreadTickets > 0 || unreadBugReports > 0) && (
            <View style={styles.unreadDot} />
          )}
        </View>

        <TouchableOpacity
          style={styles.managementButton}
          onPress={() => navigation.navigate("ProfileSupportTickets")}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.mgmtIconWrap,
              { backgroundColor: "rgba(10,102,194,0.10)" },
            ]}
          >
            <Ionicons name="ticket-outline" size={20} color={colors.info} />
          </View>
          <View style={styles.managementButtonContent}>
            <View style={styles.titleRow}>
              <Text style={styles.managementButtonTitle}>Support Tickets</Text>
              {unreadTickets > 0 && <View style={styles.unreadDotSmall} />}
            </View>
            <Text style={styles.managementButtonDesc}>
              Manage client support requests
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.managementButton}
          onPress={() => navigation.navigate("ProfileBugReports")}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.mgmtIconWrap,
              { backgroundColor: "rgba(231,76,60,0.10)" },
            ]}
          >
            <Ionicons name="bug-outline" size={20} color={colors.error} />
          </View>
          <View style={styles.managementButtonContent}>
            <View style={styles.titleRow}>
              <Text style={styles.managementButtonTitle}>Bug Reports</Text>
              {unreadBugReports > 0 && <View style={styles.unreadDotSmall} />}
            </View>
            <Text style={styles.managementButtonDesc}>
              Review and fix reported issues
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.managementButton, { borderBottomWidth: 0 }]}
          onPress={() => navigation.navigate("ProfileManageFAQs")}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.mgmtIconWrap,
              { backgroundColor: "rgba(39,174,96,0.10)" },
            ]}
          >
            <Ionicons name="help-circle-outline" size={20} color="#27ae60" />
          </View>
          <View style={styles.managementButtonContent}>
            <Text style={styles.managementButtonTitle}>Manage FAQs</Text>
            <Text style={styles.managementButtonDesc}>
              Create and edit frequently asked questions
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
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

      {/* ─── MANAGEMENT SHORTCUTS ─── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons
              name="construct-outline"
              size={16}
              color={colors.accent}
            />
          </View>
          <Text style={styles.sectionTitle}>Management</Text>
        </View>
        <TouchableOpacity
          style={styles.legalRow}
          onPress={() =>
            navigation
              .getParent()
              ?.navigate("ManageStack", { screen: "UserManagement" })
          }
          activeOpacity={0.7}
        >
          <Ionicons name="people-outline" size={18} color="#2980B9" />
          <Text style={styles.legalRowText}>User Management</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.legalRow}
          onPress={() =>
            navigation
              .getParent()
              ?.navigate("ManageStack", { screen: "AllRooms" })
          }
          activeOpacity={0.7}
        >
          <Ionicons name="home-outline" size={18} color="#27AE60" />
          <Text style={styles.legalRowText}>All Rooms</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* ─── APP MANAGEMENT ─── */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.legalRow}
          onPress={() => navigation.navigate("Broadcast")}
          activeOpacity={0.7}
        >
          <Ionicons name="megaphone-outline" size={18} color={colors.accent} />
          <Text style={styles.legalRowText}>Send Notification</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.legalRow}
          onPress={() => navigation.navigate("VersionControl")}
          activeOpacity={0.7}
        >
          <Ionicons
            name="cloud-download-outline"
            size={18}
            color={colors.accent}
          />
          <Text style={styles.legalRowText}>Version Control</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* ─── BIOMETRIC ─── */}
      {biometricAvailable && (
        <View style={styles.section}>
          <Text style={styles.sectionAppearanceTitle}>Security</Text>
          <View style={styles.biometricRow}>
            <View style={styles.biometricInfo}>
              <View
                style={[
                  styles.menuIcon,
                  { backgroundColor: colors.accentLight },
                ]}
              >
                <Ionicons name="finger-print" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Biometric Login</Text>
                <Text style={styles.menuSub}>
                  {biometricEnabled
                    ? "Enabled - Use fingerprint or Face ID to login"
                    : "Disabled - Enable during login to use biometric"}
                </Text>
              </View>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              disabled={disablingBiometric}
              trackColor={{ false: colors.border, true: colors.accentLight }}
              thumbColor={
                biometricEnabled ? colors.accent : colors.textTertiary
              }
            />
          </View>
        </View>
      )}

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

      {/* Switch View & Logout */}
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

            {/* Avatar Preview */}
            <View style={styles.modalAvatarSection}>
              {selectedImage?.uri ? (
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.modalAvatarImage}
                />
              ) : getAvatarSource() ? (
                <Image
                  source={getAvatarSource()}
                  style={styles.modalAvatarImage}
                  defaultSource={require("../../assets/default-avatar.png")}
                />
              ) : (
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>
                    {editName.charAt(0).toUpperCase() || "A"}
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

            {/* Name Input */}
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

      {/* ─── BIOMETRIC PASSWORD MODAL ─── */}
      <Modal
        animationType="fade"
        transparent
        visible={biometricPasswordModalVisible}
        onRequestClose={() =>
          !enablingBiometric && setBiometricPasswordModalVisible(false)
        }
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { maxHeight: "60%" }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enable Biometric Login</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() =>
                  !enablingBiometric && setBiometricPasswordModalVisible(false)
                }
                disabled={enablingBiometric}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.formLabel, { marginBottom: 8 }]}>
                Enter your account password to enable biometric login
              </Text>
              <View style={{ position: "relative", marginBottom: 16 }}>
                <TextInput
                  style={[styles.formInput]}
                  placeholder="Password"
                  secureTextEntry={!showBiometricPassword}
                  value={biometricPassword}
                  onChangeText={setBiometricPassword}
                  editable={!enablingBiometric}
                  placeholderTextColor={colors.textTertiary}
                />
                <TouchableOpacity
                  style={{
                    position: "absolute",
                    right: 12,
                    top: 0,
                    bottom: 0,
                    justifyContent: "center",
                  }}
                  onPress={() =>
                    setShowBiometricPassword(!showBiometricPassword)
                  }
                  disabled={enablingBiometric}
                >
                  <Ionicons
                    name={showBiometricPassword ? "eye" : "eye-off"}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (enablingBiometric || !biometricPassword.trim()) && {
                    opacity: 0.6,
                  },
                ]}
                onPress={handleEnableBiometric}
                disabled={enablingBiometric || !biometricPassword.trim()}
              >
                {enablingBiometric ? (
                  <ActivityIndicator color={colors.textOnAccent} />
                ) : (
                  <>
                    <Ionicons
                      name="finger-print"
                      size={18}
                      color={colors.textOnAccent}
                    />
                    <Text style={styles.saveBtnText}>Enable Biometric</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <ModalBottomSpacer />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollViewWithDetection>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    /* Profile Header */
    profileHeader: {
      alignItems: "center",
      paddingTop: 32,
      paddingBottom: 32,
      paddingHorizontal: 16,
      backgroundColor: colors.headerBg,
    },
    superAdminBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(255,255,255,0.15)",
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 8,
    },
    superAdminBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.headerText,
    },
    avatarContainer: {
      marginBottom: 14,
      position: "relative",
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: "rgba(255,255,255,0.30)",
    },
    avatarImage: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.inputBg,
      borderWidth: 3,
      borderColor: "rgba(255,255,255,0.30)",
    },
    avatarText: {
      fontSize: 34,
      fontWeight: "700",
      color: "#fff",
    },
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
      color: colors.headerText,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: "rgba(255,255,255,0.65)",
      marginBottom: 16,
    },
    editButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 10,
      alignItems: "center",
      gap: 6,
      ...Platform.select({
        ios: {
          shadowColor: colors.accent,
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
        },
        android: { elevation: 3 },
      }),
    },
    editButtonText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
    },

    /* Sections */
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
      backgroundColor: colors.accentLight,
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
      paddingBottom: 12,
      fontSize: 15,
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
    infoLabel: {
      fontSize: 14,
      color: colors.textTertiary,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    roleBadge: {
      backgroundColor: colors.accentLight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.accent,
      textTransform: "capitalize",
    },

    /* Support Management */
    managementButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    mgmtIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    managementButtonContent: {
      flex: 1,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    managementButtonTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
    },
    managementButtonDesc: {
      fontSize: 12,
      color: colors.textTertiary,
      lineHeight: 16,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#e74c3c",
    },
    unreadDotSmall: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: "#e74c3c",
    },

    /* Client View Switch */
    clientViewButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: colors.accent,
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
        },
        android: { elevation: 3 },
      }),
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
    clientViewContent: {
      flex: 1,
    },
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

    /* Legal */
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

    /* Logout */
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
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 3,
        },
        android: { elevation: 1 },
      }),
    },
    logoutButtonDisabled: {
      opacity: 0.7,
    },
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

    /* Modal */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 8,
      maxHeight: "90%",
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.skeleton,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 12,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    modalClose: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingBottom: 24,
      paddingTop: 10,
      maxHeight: "90%",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 20,
        },
        android: { elevation: 12 },
      }),
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
      backgroundColor: colors.accentLight,
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
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
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
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
      borderWidth: 3,
      borderColor: colors.accentSurface,
    },
    modalAvatarImage: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.inputBg,
      marginBottom: 12,
      borderWidth: 3,
      borderColor: colors.accentSurface,
    },
    modalAvatarText: {
      fontSize: 38,
      fontWeight: "700",
      color: "#fff",
    },
    changeAvatarButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      alignItems: "center",
      gap: 6,
      ...Platform.select({
        ios: {
          shadowColor: colors.accent,
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
        },
        android: { elevation: 2 },
      }),
    },
    changeAvatarText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "600",
    },
    formSection: {
      marginBottom: 18,
      paddingHorizontal: 20,
    },
    modalBody: {
      maxHeight: 500,
    },
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
    formInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.cardAlt,
    },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
    },
    saveBtnText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
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
      ...Platform.select({
        ios: {
          shadowColor: colors.accent,
          shadowOpacity: 0.3,
          shadowOffset: { width: 0, height: 3 },
          shadowRadius: 6,
        },
        android: { elevation: 3 },
      }),
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },

    /* ─── Theme Toggle ─── */
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
    themeOptionLabelActive: {
      color: colors.accent,
    },
    rememberCheckbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    /* --- Biometric Settings --- */
    biometricRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    biometricInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    menuIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    menuTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    menuSub: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    sectionAppearanceTitle: {
      fontSize: 15,
      marginBottom: 12,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
  });

export default AdminProfileScreen;
