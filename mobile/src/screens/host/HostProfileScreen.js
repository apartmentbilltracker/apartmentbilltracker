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
  Switch,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { AuthContext } from "../../context/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
import { getAPIBaseURL } from "../../config/config";
import { biometricAuth } from "../../utils/biometricAuth";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";
const THEME_OPTIONS = [{ key: "light", label: "Light", icon: "sunny" }];

const HostProfileScreen = ({ navigation }) => {
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
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [disablingBiometric, setDisablingBiometric] = useState(false);
  const [biometricPasswordModalVisible, setBiometricPasswordModalVisible] =
    useState(false);
  const [biometricPassword, setBiometricPassword] = useState("");
  const [enablingBiometric, setEnablingBiometric] = useState(false);
  const [showBiometricPassword, setShowBiometricPassword] = useState(false);

  const user = state.user || {};

  // Reset avatar error when user or selected image changes
  useEffect(() => {
    setAvatarError(false);
  }, [user?.email, selectedImage]);

  // Load biometric status on mount
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
        "Are you sure you want to disable biometric login? You will need to enter your password on next login.",
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

  return (
    <ScrollViewWithDetection
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileTopRow}>
          <View style={styles.profilePill}>
            <Ionicons name="leaf-outline" size={13} color="#ffffff" />
            <Text style={styles.profilePillText}>Host Profile</Text>
          </View>
          <TouchableOpacity
            style={styles.headerEditBtn}
            onPress={handleEditPress}
            disabled={isUpdating}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={14} color="#ffffff" />
            <Text style={styles.headerEditBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
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
        <Text style={styles.userName}>{user.name || "Host"}</Text>
        <Text style={styles.userEmail}>{user.email || "N/A"}</Text>

        <View style={styles.roleBadge}>
          <Ionicons name="key" size={13} color="#ffffff" />
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
          <View style={styles.infoBadge}>
            <Text style={styles.infoBadgeText}>Host</Text>
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
              ) : getAvatarSource() ? (
                <Image
                  source={getAvatarSource()}
                  style={styles.modalAvatarImage}
                  defaultSource={require("../../assets/default-avatar.png")}
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

const createStyles = (colors) => {
  const isDarkMode = colors.statusBarStyle === "light-content";
  const forestHeader = isDarkMode ? colors.background : "#063f39";
  const softSurface = isDarkMode
    ? "rgba(255,255,255,0.06)"
    : "rgba(3,109,65,0.055)";
  const softBorder = isDarkMode
    ? "rgba(158,208,205,0.16)"
    : "rgba(3,109,65,0.12)";
  const cardShadow = isDarkMode ? "#000000" : "#0a4240";

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      paddingBottom: 28,
    },
    profileCard: {
      alignItems: "center",
      paddingTop: 18,
      paddingBottom: 28,
      paddingHorizontal: 18,
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: forestHeader,
      borderRadius: 28,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: cardShadow,
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 18,
        },
        android: { elevation: 5 },
      }),
    },
    profileTopRow: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    profilePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
    },
    profilePillText: {
      fontSize: 11,
      fontWeight: "800",
      color: "#ffffff",
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },
    headerEditBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
    },
    headerEditBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#ffffff",
    },
    avatarContainer: { marginBottom: 14, position: "relative" },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: "rgba(255,255,255,0.75)",
    },
    avatarImage: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.inputBg,
      borderWidth: 3,
      borderColor: "rgba(255,255,255,0.75)",
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
      borderColor: "#ffffff",
    },
    userName: {
      fontSize: 25,
      fontWeight: "900",
      color: "#ffffff",
      marginBottom: 4,
      textAlign: "center",
    },
    userEmail: {
      fontSize: 14,
      color: "rgba(255,255,255,0.78)",
      marginBottom: 12,
      textAlign: "center",
    },
    roleBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(255,255,255,0.14)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#ffffff",
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
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: softBorder,
      ...Platform.select({
        ios: {
          shadowColor: cardShadow,
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: 5 },
          shadowRadius: 12,
        },
        android: { elevation: 2 },
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
      borderRadius: 10,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
      flex: 1,
    },
    sectionAppearanceTitle: {
      fontSize: 15,
      marginBottom: 12,
      fontWeight: "800",
      color: colors.text,
      flex: 1,
    },
    /* ─── Biometric Settings ─── */
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
      borderRadius: 12,
      borderWidth: 1,
      borderColor: softBorder,
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
    infoBadge: {
      backgroundColor: softSurface,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: softBorder,
    },
    infoBadgeText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.accent,
    },
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
      borderRadius: 16,
      backgroundColor: softSurface,
      borderWidth: 1.5,
      borderColor: softBorder,
      gap: 4,
    },
    themeOptionActive: {
      borderColor: colors.accent,
      backgroundColor: softSurface,
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
      borderBottomColor: colors.borderLight,
    },
    legalRowText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
    },
    clientViewButton: {
      backgroundColor: colors.accent,
      borderRadius: 18,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: cardShadow,
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 4,
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
      marginHorizontal: 16,
      marginTop: 14,
      marginBottom: 32,
    },
    logoutButton: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.errorBg,
    },
    logoutButtonDisabled: { opacity: 0.7 },
    logoutLoading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    logoutButtonText: {
      color: colors.error,
      fontSize: 15,
      fontWeight: "700",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay || "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 8,
      maxHeight: "90%",
      borderWidth: 1,
      borderColor: softBorder,
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: softBorder,
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
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 24,
      paddingTop: 10,
      maxHeight: "90%",
      borderWidth: 1,
      borderColor: softBorder,
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
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
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
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
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
      borderColor: softBorder,
    },
    modalAvatarImage: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.inputBg,
      marginBottom: 12,
      borderWidth: 3,
      borderColor: softBorder,
    },
    modalAvatarText: { fontSize: 38, fontWeight: "700", color: "#fff" },
    changeAvatarButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 10,
      alignItems: "center",
      gap: 6,
      shadowColor: cardShadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 3,
    },
    changeAvatarText: { color: "#fff", fontSize: 13, fontWeight: "600" },
    modalBody: {
      maxHeight: 500,
    },
    formSection: { marginBottom: 18, paddingHorizontal: 20 },
    formLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 6,
    },
    nameInput: {
      borderWidth: 1,
      borderColor: softBorder,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: softSurface,
    },
    formInput: {
      borderWidth: 1,
      borderColor: softBorder,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: softSurface,
    },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 14,
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
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 20,
      gap: 8,
      shadowColor: cardShadow,
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 4,
    },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  });
};

export default HostProfileScreen;
