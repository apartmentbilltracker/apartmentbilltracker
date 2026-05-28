import React, { useContext, useState, useEffect, useMemo } from "react";
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
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  InlineAlert,
  Toast,
  ConfirmModal,
} from "../../components/CustomAlert";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { AuthContext } from "../../context/AuthContext";
import {
  roomService,
  roommateService,
  supportService,
  hostRoleService,
} from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
import { getAPIBaseURL } from "../../config/config";
import { biometricAuth } from "../../utils/biometricAuth";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";
import RoommateProfileModal from "../../components/RoommateProfileModal";

const THEME_OPTIONS = [
  { key: "light", label: "Light", icon: "sunny" },
];

const ProfileScreen = ({ navigation }) => {
  const { colors, preference, setTheme } = useTheme();
  const styles = createStyles(colors);

  const {
    state,
    refreshUser,
    signOut,
    switchView,
    updateUserProfile,
    disableBiometric,
    updateBiometricCredentials,
  } = useContext(AuthContext);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [payorStatus, setPayorStatus] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  const [biometricPasswordModalVisible, setBiometricPasswordModalVisible] =
    useState(false);
  const [biometricPassword, setBiometricPassword] = useState("");
  const [enablingBiometric, setEnablingBiometric] = useState(false);
  const [showBiometricPassword, setShowBiometricPassword] = useState(false);

  // Support Service States
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [faqModalVisible, setFAQModalVisible] = useState(false);
  const [bugModalVisible, setBugModalVisible] = useState(false);
  const [supportTicketForm, setSupportTicketForm] = useState({
    title: "",
    description: "",
    category: "general",
  });
  const [bugReportForm, setBugReportForm] = useState({
    title: "",
    description: "",
    severity: "medium",
    category: "general",
  });
  const [userRoomId, setUserRoomId] = useState(null);
  const [faqs, setFAQs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unreadTickets, setUnreadTickets] = useState(0);
  const [unreadBugReports, setUnreadBugReports] = useState(0);
  const [hostRequestStatus, setHostRequestStatus] = useState(null);
  const [requestingHost, setRequestingHost] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [disablingBiometric, setDisablingBiometric] = useState(false);
  const [roommateModalVisible, setRoommateModalVisible] = useState(false);
  const [roommateProfile, setRoommateProfile] = useState(null);
  const [roommateProfileLoading, setRoommateProfileLoading] = useState(false);

  // ── Custom alert system ────────────────────────────────────────────────────
  // Toast: transient screen-level notification
  const [toast, setToast] = useState({ visible: false, type: "success", message: "" });
  // ConfirmModal: replaces 2-button Alert.alert()
  const [confirmConfig, setConfirmConfig] = useState({ visible: false });
  // InlineAlerts: per-modal validation / error banners
  const [editModalAlert, setEditModalAlert] = useState({ visible: false, type: "error", message: "" });
  const [biometricModalAlert, setBiometricModalAlert] = useState({ visible: false, type: "error", message: "" });
  const [supportModalAlert, setSupportModalAlert] = useState({ visible: false, type: "error", message: "" });
  const [bugModalAlert, setBugModalAlert] = useState({ visible: false, type: "error", message: "" });

  const showToast = (type, message) => setToast({ visible: true, type, message });
  const hideToast = () => setToast((prev) => ({ ...prev, visible: false }));
  const showConfirm = (config) => setConfirmConfig({ visible: true, ...config });
  const hideConfirm = () => setConfirmConfig((prev) => ({ ...prev, visible: false }));

  const user = state.user || {};
  const userId = user.id || user._id;

  // Reset avatar error when user account or selected image changes
  useEffect(() => {
    setAvatarError(false);
  }, [user?.email, selectedImage]);

  // Handle role as either array or string
  const isAdmin = Array.isArray(user.role)
    ? user.role.includes("admin")
    : typeof user.role === "string" &&
      user.role.toLowerCase().includes("admin");

  const isHost = user.role === "host";

  // Fetch host request status
  React.useEffect(() => {
    const fetchHostStatus = async () => {
      try {
        const res = await hostRoleService.getHostStatus();
        setHostRequestStatus(res.hostRequestStatus || null);
      } catch (e) {
        console.log("Error fetching host status:", e);
      }
    };
    if (userId && !isAdmin && !isHost) fetchHostStatus();
  }, [userId]);

  React.useEffect(() => {
    const fetchRoommateProfile = async () => {
      try {
        setRoommateProfileLoading(true);
        const profile = await roommateService.getMyProfile();
        setRoommateProfile(profile);
      } catch (error) {
        console.error("Error fetching roommate profile:", error);
      } finally {
        setRoommateProfileLoading(false);
      }
    };

    if (userId) fetchRoommateProfile();
  }, [userId]);

  const handleRequestHost = () => {
    showConfirm({
      title: "Become a Host",
      message:
        "Request to become a room host? An admin will review your request. Once approved you'll get access to room management features.",
      confirmText: "Request",
      confirmStyle: "default",
      onCancel: hideConfirm,
      onConfirm: async () => {
        hideConfirm();
        try {
          setRequestingHost(true);
          await hostRoleService.requestHost();
          setHostRequestStatus("pending");
          showToast("success", "Host request submitted! An admin will review it soon.");
        } catch (error) {
          showToast(
            "error",
            error.response?.data?.message ||
              error.message ||
              "Failed to submit request",
          );
        } finally {
          setRequestingHost(false);
        }
      },
    });
  };

  const handleRoommateProfileSaved = (profile) => {
    setRoommateProfile(profile);
  };

  // Fetch room to determine payor status
  React.useEffect(() => {
    const fetchPayorStatus = async () => {
      try {
        const roomsResponse = await roomService.getClientRooms();
        let rooms = [];
        if (Array.isArray(roomsResponse)) {
          rooms = roomsResponse;
        } else if (roomsResponse?.data) {
          rooms = Array.isArray(roomsResponse.data)
            ? roomsResponse.data
            : [roomsResponse.data];
        } else if (roomsResponse?.rooms) {
          rooms = Array.isArray(roomsResponse.rooms)
            ? roomsResponse.rooms
            : [roomsResponse.rooms];
        }

        // Find user in room members and get isPayer status
        const joinedRoom = rooms.find((r) => {
          const isMember = r.members?.some(
            (m) =>
              String(m.user?.id || m.user?._id || m.user) === String(userId),
          );
          return isMember;
        });

        if (joinedRoom) {
          setUserRoomId(joinedRoom.id || joinedRoom._id);
          const userMember = joinedRoom.members.find(
            (m) =>
              String(m.user?.id || m.user?._id || m.user) === String(userId),
          );
          if (userMember) {
            setPayorStatus(userMember.isPayer ? "Payor" : "Non-Payor");
          }
        }
      } catch (error) {
        console.error("Error fetching payor status:", error);
      }
    };

    if (userId) {
      fetchPayorStatus();
    }
  }, [userId]);

  React.useEffect(() => {
    const fetchUnreadCounts = async () => {
      try {
        const ticketsResponse = await supportService.getUserTickets();
        const tickets = Array.isArray(ticketsResponse)
          ? ticketsResponse
          : ticketsResponse?.data || [];
        const unreadTicketCount = tickets.filter(
          (t) => !t.isReadByUser && t.replies && t.replies.length > 0,
        ).length;
        setUnreadTickets(unreadTicketCount);

        const bugsResponse = await supportService.getUserBugReports();
        const bugs = Array.isArray(bugsResponse)
          ? bugsResponse
          : bugsResponse?.data || [];
        const unreadBugCount = bugs.filter(
          (b) => !b.isReadByUser && b.responses && b.responses.length > 0,
        ).length;
        setUnreadBugReports(unreadBugCount);
      } catch (error) {
        console.error("Error fetching unread counts:", error);
      }
    };

    if (userId) {
      fetchUnreadCounts();
    }
  }, [userId]);

  // Load biometric status on mount and when screen focuses
  React.useEffect(() => {
    const loadBiometricStatus = async () => {
      const available = await biometricAuth.isAvailable();
      setBiometricAvailable(available);
      // Use per-account check instead of global check
      const enabled = await biometricAuth.isBiometricEnabledFor(user.email);
      setBiometricEnabled(enabled);
    };

    // Load on mount
    loadBiometricStatus();

    // Refresh when screen comes into focus (user enables during login, then comes back to profile)
    const unsubscribe = navigation.addListener("focus", () => {
      loadBiometricStatus();
    });

    return unsubscribe;
  }, [user.email, navigation]);

  const handleToggleBiometric = (newValue) => {
    if (newValue === biometricEnabled) return;

    if (newValue === false) {
      // Disabling biometric
      showConfirm({
        title: "Disable Biometric Login",
        message:
          "Are you sure you want to disable biometric login? You will need to enter your password on next login.",
        confirmText: "Disable",
        confirmStyle: "destructive",
        onCancel: hideConfirm,
        onConfirm: async () => {
          hideConfirm();
          setDisablingBiometric(true);
          try {
            const result = await disableBiometric(user.email);
            if (result.success) {
              setBiometricEnabled(false);
            } else {
              showToast("error", result.error || "Failed to disable biometric");
              setBiometricEnabled(true);
            }
          } catch (error) {
            showToast("error", error.message || "Failed to disable biometric");
            setBiometricEnabled(true);
          } finally {
            setDisablingBiometric(false);
          }
        },
      });
    } else {
      // Enabling biometric - show password modal for validation
      setBiometricPassword("");
      setBiometricPasswordModalVisible(true);
    }
  };

  const handleEnableBiometric = async () => {
    setBiometricModalAlert({ visible: false });
    if (!biometricPassword.trim()) {
      setBiometricModalAlert({ visible: true, type: "error", message: "Please enter your password." });
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
        setBiometricModalAlert({
          visible: true,
          type: "error",
          message: `Server returned an invalid response (${validationResponse.status}). Please try again later.`,
        });
        setBiometricEnabled(false);
        setEnablingBiometric(false);
        return;
      }

      if (!validationResponse.ok) {
        setBiometricModalAlert({
          visible: true,
          type: "error",
          message:
            validationData?.message ||
            "The password you entered is incorrect. Please try again.",
        });
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
        setBiometricPasswordModalVisible(false);
        setBiometricPassword("");
        showToast("success", "Biometric login has been enabled.");
      } else {
        setBiometricModalAlert({
          visible: true,
          type: "error",
          message: result.error || "Failed to enable biometric.",
        });
        setBiometricEnabled(false);
      }
    } catch (error) {
      setBiometricModalAlert({
        visible: true,
        type: "error",
        message: error.message || "Failed to enable biometric.",
      });
      setBiometricEnabled(false);
    } finally {
      setEnablingBiometric(false);
    }
  };

  const handleAdminButtonPress = () => {
    const userRole = user?.role?.toLowerCase();
    if (userRole === "admin") {
      switchView("admin");
    } else if (userRole === "host") {
      switchView("host");
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
      showToast("error", "Failed to pick image. Please try again.");
    }
  };

  const handleSaveProfile = async () => {
    setEditModalAlert({ visible: false });
    if (!editName.trim()) {
      setEditModalAlert({ visible: true, type: "warning", message: "Name cannot be empty." });
      return;
    }

    setIsUpdating(true);
    try {
      const result = await updateUserProfile(
        editName,
        selectedImage?.base64 || null,
      );

      if (result.success) {
        showToast("success", "Profile updated successfully.");
        setEditModalVisible(false);
        setSelectedImage(null);
      } else {
        setEditModalAlert({
          visible: true,
          type: "error",
          message: result.error || "Failed to update profile.",
        });
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      setEditModalAlert({ visible: true, type: "error", message: "Failed to update profile." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
      showToast("error", "Failed to logout. Please try again.");
      setIsLoggingOut(false);
    }
  };

  // Support Service Handlers
  const handleContactSupport = async () => {
    setSupportModalAlert({ visible: false });
    if (
      !supportTicketForm.title.trim() ||
      !supportTicketForm.description.trim()
    ) {
      setSupportModalAlert({ visible: true, type: "warning", message: "Please fill in all fields." });
      return;
    }

    setIsSubmitting(true);
    try {
      await supportService.createTicket({
        ...supportTicketForm,
        roomId: userRoomId || undefined,
      });
      showToast("success", "Support ticket created successfully!");
      setSupportModalVisible(false);
      setSupportTicketForm({ title: "", description: "", category: "general" });
    } catch (error) {
      console.error("Error creating ticket:", error);
      setSupportModalAlert({ visible: true, type: "error", message: "Failed to create support ticket." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFAQPress = async () => {
    setIsSubmitting(true);
    try {
      const faqsData = await supportService.getAllFAQs();
      setFAQs(Array.isArray(faqsData) ? faqsData : faqsData?.data || []);
      setFAQModalVisible(true);
    } catch (error) {
      console.error("Error fetching FAQs:", error);
      showToast("error", "Failed to load FAQs. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportIssue = async () => {
    setBugModalAlert({ visible: false });
    if (!bugReportForm.title.trim() || !bugReportForm.description.trim()) {
      setBugModalAlert({ visible: true, type: "warning", message: "Please fill in all fields." });
      return;
    }

    setIsSubmitting(true);
    try {
      await supportService.createBugReport(bugReportForm);
      showToast("success", "Bug report submitted successfully!");
      setBugModalVisible(false);
      setBugReportForm({
        title: "",
        description: "",
        severity: "medium",
        category: "general",
      });
    } catch (error) {
      console.error("Error creating bug report:", error);
      setBugModalAlert({ visible: true, type: "error", message: "Failed to submit bug report." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeThemeLabel = useMemo(
    () =>
      THEME_OPTIONS.find((option) => option.key === preference)?.label ||
      "System",
    [preference],
  );

  const accountRoleLabel = useMemo(() => {
    if (isAdmin) return "Administrator";
    if (isHost) return "Room Host";
    if (payorStatus === "Payor") return "Payor";
    if (payorStatus === "Non-Payor") return "Member";
    return "Client";
  }, [isAdmin, isHost, payorStatus]);

  const totalUnreadRequests = unreadTickets + unreadBugReports;

  const profileHighlights = useMemo(
    () => [
      {
        key: "role",
        label: "Access",
        value: accountRoleLabel,
        icon: "shield-checkmark-outline",
        tint: colors.accentLight,
        color: colors.accent,
      },
      {
        key: "requests",
        label: "Updates",
        value: totalUnreadRequests > 0 ? `${totalUnreadRequests} new` : "All read",
        icon: "mail-unread-outline",
        tint: colors.infoBg,
        color: colors.info,
      },
      {
        key: "theme",
        label: "Theme",
        value: activeThemeLabel,
        icon: "color-palette-outline",
        tint: colors.purpleBg,
        color: colors.textSecondary,
      },
    ],
    [
      accountRoleLabel,
      activeThemeLabel,
      colors.accent,
      colors.accentLight,
      colors.info,
      colors.infoBg,
      colors.purpleBg,
      colors.textSecondary,
      totalUnreadRequests,
    ],
  );

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
    <View style={{ flex: 1 }}>
    <ScrollViewWithDetection
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── PROFILE HEADER ─── */}
      <View style={styles.headerBg}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerBadge}>
            <Ionicons
              name="sparkles-outline"
              size={14}
              color={colors.textOnAccent}
            />
            <Text style={styles.headerBadgeText}>Account Center</Text>
          </View>
          <TouchableOpacity
            style={styles.headerEditBtn}
            onPress={handleEditPress}
            activeOpacity={0.8}
          >
            <Ionicons
              name="create-outline"
              size={14}
              color={colors.textOnAccent}
            />
            <Text style={styles.headerEditBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.avatarWrap}>
          <Image
            source={getAvatarSource()}
            style={styles.avatarImg}
            defaultSource={require("../../assets/default-avatar.png")}
            onError={() => setAvatarError(true)}
          />
          <TouchableOpacity
            style={styles.editAvatarBtn}
            onPress={handleEditPress}
          >
            <Ionicons name="pencil" size={14} color={colors.textOnAccent} />
          </TouchableOpacity>
        </View>
        <Text style={styles.userName}>{user.name || "User"}</Text>
        <Text style={styles.userEmail}>{user.email || "N/A"}</Text>
        <Text style={styles.headerSubcopy}>
          Manage your profile, requests, theme, and security settings in one
          place.
        </Text>
        <View style={styles.headerChipRow}>
          <View style={styles.roleChip}>
            <Ionicons
              name={
                isAdmin
                  ? "shield-outline"
                  : isHost
                    ? "home-outline"
                    : "person-outline"
              }
              size={14}
              color={colors.textOnAccent}
            />
            <Text style={styles.roleChipText}>{accountRoleLabel}</Text>
          </View>
          {payorStatus && (
            <View
              style={[
                styles.statusChip,
                payorStatus === "Payor"
                  ? { backgroundColor: colors.successBg }
                  : { backgroundColor: colors.inputBg },
              ]}
            >
              <Ionicons
                name={payorStatus === "Payor" ? "checkmark-circle" : "person"}
                size={14}
                color={
                  payorStatus === "Payor"
                    ? colors.success
                    : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.statusChipText,
                  payorStatus === "Payor"
                    ? { color: colors.success }
                    : { color: colors.textSecondary },
                ]}
              >
                {payorStatus}
              </Text>
            </View>
          )}
          {hostRequestStatus === "pending" && (
            <View style={[styles.statusChip, styles.pendingStatusChip]}>
              <Ionicons name="time-outline" size={14} color={colors.info} />
              <Text style={[styles.statusChipText, { color: colors.info }]}>
                Host Review
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.summaryRow}>
        {profileHighlights.map((item) => (
          <View key={item.key} style={styles.summaryCard}>
            <View
              style={[styles.summaryIconWrap, { backgroundColor: item.tint }]}
            >
              <Ionicons name={item.icon} size={18} color={item.color} />
            </View>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {item.value}
            </Text>
            <Text style={styles.summaryLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* ─── ACCOUNT INFO ─── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Account Information</Text>
          <Text style={styles.cardSubtitle}>
            Your personal and membership details.
          </Text>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <View
              style={[styles.infoIcon, { backgroundColor: colors.accentLight }]}
            >
              <Ionicons name="person" size={16} color={colors.accent} />
            </View>
            <Text style={styles.infoLabel}>Name</Text>
          </View>
          <Text style={styles.infoValue}>{user.name || "N/A"}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <View style={[styles.infoIcon, { backgroundColor: colors.infoBg }]}>
              <Ionicons name="mail" size={16} color={colors.info} />
            </View>
            <Text style={styles.infoLabel}>Email</Text>
          </View>
          <Text style={styles.infoValue} numberOfLines={1}>
            {user.email || "N/A"}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <View
              style={[styles.infoIcon, { backgroundColor: colors.successBg }]}
            >
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={colors.success}
              />
            </View>
            <Text style={styles.infoLabel}>Status</Text>
          </View>
          <View style={styles.infoRightGroup}>
            <Text style={styles.infoValue}>{payorStatus || "No Room"}</Text>
            <TouchableOpacity
              style={styles.roommateInlineButton}
              onPress={() => setRoommateModalVisible(true)}
              disabled={roommateProfileLoading}
              activeOpacity={0.7}
            >
              {roommateProfileLoading ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <>
                  <Ionicons
                    name={roommateProfile ? "people" : "people-outline"}
                    size={14}
                    color={colors.accent}
                  />
                  <Text style={styles.roommateInlineText}>
                    {roommateProfile ? "Edit roomies" : "Create roomies"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─── CUSTOMER SERVICE ─── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Customer Service</Text>
          <Text style={styles.cardSubtitle}>
            Reach support, browse help, or report issues.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => setSupportModalVisible(true)}
          activeOpacity={0.6}
        >
          <View style={[styles.menuIcon, { backgroundColor: colors.infoBg }]}>
            <Ionicons name="headset" size={18} color={colors.info} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Contact Support</Text>
            <Text style={styles.menuSub}>Get help from our team</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.menuRow}
          onPress={handleFAQPress}
          activeOpacity={0.6}
        >
          <View
            style={[styles.menuIcon, { backgroundColor: colors.successBg }]}
          >
            <Ionicons name="help-circle" size={18} color={colors.success} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>FAQs</Text>
            <Text style={styles.menuSub}>Answers to common questions</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => setBugModalVisible(true)}
          activeOpacity={0.6}
        >
          <View style={[styles.menuIcon, { backgroundColor: colors.errorBg }]}>
            <Ionicons name="bug" size={18} color={colors.error} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Report Issue</Text>
            <Text style={styles.menuSub}>Report a problem or bug</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* ─── TRACK REQUESTS ─── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Track My Requests</Text>
          <Text style={styles.cardSubtitle}>
            Follow up on tickets and bug reports.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.trackRow}
          onPress={() => navigation.navigate("MyTickets")}
          activeOpacity={0.6}
        >
          <View
            style={[styles.trackStrip, { backgroundColor: colors.waterColor }]}
          />
          <View style={[styles.menuIcon, { backgroundColor: colors.infoBg }]}>
            <Ionicons name="ticket" size={18} color={colors.info} />
          </View>
          <View style={styles.menuContent}>
            <View style={styles.menuTitleRow}>
              <Text style={styles.menuTitle}>My Support Tickets</Text>
              {unreadTickets > 0 && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.menuSub}>View and track your requests</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.trackRow}
          onPress={() => navigation.navigate("MyBugReports")}
          activeOpacity={0.6}
        >
          <View style={[styles.trackStrip, { backgroundColor: "#e53935" }]} />
          <View style={[styles.menuIcon, { backgroundColor: colors.errorBg }]}>
            <Ionicons name="bug" size={18} color={colors.error} />
          </View>
          <View style={styles.menuContent}>
            <View style={styles.menuTitleRow}>
              <Text style={styles.menuTitle}>My Bug Reports</Text>
              {unreadBugReports > 0 && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.menuSub}>Track issues you've reported</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* ─── APPEARANCE ─── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Appearance</Text>
          <Text style={styles.cardSubtitle}>
            Choose how the app looks for you.
          </Text>
        </View>
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

      {/* ─── BECOME A HOST ─── */}
      {!isAdmin && !isHost && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Room Host</Text>
            <Text style={styles.cardSubtitle}>
              Unlock room management and billing tools.
            </Text>
          </View>
          {hostRequestStatus === "pending" ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: colors.infoBg,
                padding: 14,
                borderRadius: 10,
              }}
            >
              <Ionicons name="time" size={22} color={colors.info} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: colors.info,
                  }}
                >
                  Host Request Pending
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  Your request is being reviewed by an admin.
                </Text>
              </View>
            </View>
          ) : hostRequestStatus === "rejected" ? (
            <View style={{ gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: colors.errorBg,
                  padding: 14,
                  borderRadius: 10,
                }}
              >
                <Ionicons name="close-circle" size={22} color={colors.error} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: colors.error,
                    }}
                  >
                    Host Request Rejected
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    Your request was declined. You may submit a new request.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.adminBtn,
                  { backgroundColor: colors.accent },
                  requestingHost && { opacity: 0.6 },
                ]}
                onPress={handleRequestHost}
                disabled={requestingHost}
                activeOpacity={0.7}
              >
                {requestingHost ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={18} color="#fff" />
                    <Text style={styles.adminBtnText}>Request Again</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginBottom: 10,
                  lineHeight: 18,
                }}
              >
                Become a host to create and manage rooms, billing cycles,
                members, and payments.
              </Text>
              <TouchableOpacity
                style={[
                  styles.adminBtn,
                  { backgroundColor: colors.accent },
                  requestingHost && { opacity: 0.6 },
                ]}
                onPress={handleRequestHost}
                disabled={requestingHost}
                activeOpacity={0.7}
              >
                {requestingHost ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="key" size={18} color="#fff" />
                    <Text style={styles.adminBtnText}>Become a Host</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* ─── ADMIN / HOST PANEL ─── */}
      {(isAdmin || isHost) && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {isAdmin ? "Admin Panel" : "Host Panel"}
            </Text>
            <Text style={styles.cardSubtitle}>
              Open your management workspace.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={handleAdminButtonPress}
          >
            <Ionicons name="settings" size={18} color={colors.textOnAccent} />
            <Text style={styles.adminBtnText}>
              {isAdmin ? "Go to Admin Dashboard" : "Go to Host Dashboard"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── LEGAL ─── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Legal</Text>
          <Text style={styles.cardSubtitle}>
            Review the terms and privacy details.
          </Text>
        </View>
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

      {/* ─── SECURITY ─── */}
      {biometricAvailable && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Security</Text>
            <Text style={styles.cardSubtitle}>
              Control how you sign in to your account.
            </Text>
          </View>
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

      {/* ─── LOGOUT ─── */}
      <View style={styles.logoutWrap}>
        <TouchableOpacity
          style={[styles.logoutBtn, isLoggingOut && { opacity: 0.6 }]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={colors.error} />
              <Text style={styles.logoutBtnText}>Logout</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: 30 }} />

      {/* ─── EDIT PROFILE MODAL ─── */}
      <Modal
        animationType="slide"
        transparent
        visible={editModalVisible}
        onRequestClose={() => !isUpdating && setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => !isUpdating && setEditModalVisible(false)}
                disabled={isUpdating}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalAvatarSection}>
              {selectedImage?.uri ? (
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.modalAvatarImg}
                />
              ) : getAvatarSource() ? (
                <Image
                  source={getAvatarSource()}
                  style={styles.modalAvatarImg}
                  defaultSource={require("../../assets/default-avatar.png")}
                />
              ) : (
                <View style={styles.modalAvatarFallback}>
                  <Text style={styles.modalAvatarLetter}>
                    {editName.charAt(0).toUpperCase() || "U"}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.changeAvatarBtn}
                onPress={pickImage}
                disabled={isUpdating}
              >
                <Ionicons name="camera" size={16} color={colors.accent} />
                <Text style={styles.changeAvatarText}>Change Photo</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Enter your name"
                value={editName}
                onChangeText={setEditName}
                editable={!isUpdating}
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <InlineAlert
              visible={editModalAlert.visible}
              type={editModalAlert.type}
              message={editModalAlert.message}
              onDismiss={() => setEditModalAlert({ visible: false })}
            />

            <TouchableOpacity
              style={[styles.saveBtn, isUpdating && { opacity: 0.6 }]}
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
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
            <ModalBottomSpacer />
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

              <InlineAlert
                visible={biometricModalAlert.visible}
                type={biometricModalAlert.type}
                message={biometricModalAlert.message}
                onDismiss={() => setBiometricModalAlert({ visible: false })}
              />

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

      {/* ─── SUPPORT TICKET MODAL ─── */}
      <Modal
        visible={supportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !isSubmitting && setSupportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact Support</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => !isSubmitting && setSupportModalVisible(false)}
                disabled={isSubmitting}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollViewWithDetection
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.chipRow}>
                {["general", "billing", "payment", "technical", "other"].map(
                  (cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() =>
                        setSupportTicketForm({
                          ...supportTicketForm,
                          category: cat,
                        })
                      }
                      style={[
                        styles.chip,
                        supportTicketForm.category === cat && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          supportTicketForm.category === cat &&
                            styles.chipTextActive,
                        ]}
                      >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>

              <Text style={styles.formLabel}>Subject</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Enter subject"
                value={supportTicketForm.title}
                onChangeText={(text) =>
                  setSupportTicketForm({ ...supportTicketForm, title: text })
                }
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.formLabel}>Message</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Describe your issue..."
                value={supportTicketForm.description}
                onChangeText={(text) =>
                  setSupportTicketForm({
                    ...supportTicketForm,
                    description: text,
                  })
                }
                multiline
                numberOfLines={6}
                placeholderTextColor={colors.textTertiary}
              />

              <InlineAlert
                visible={supportModalAlert.visible}
                type={supportModalAlert.type}
                message={supportModalAlert.message}
                onDismiss={() => setSupportModalAlert({ visible: false })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleContactSupport}
                disabled={isSubmitting}
              >
                <Text style={styles.submitBtnText}>
                  {isSubmitting ? "Submitting..." : "Submit Ticket"}
                </Text>
              </TouchableOpacity>
              <ModalBottomSpacer />
            </ScrollViewWithDetection>
          </View>
        </View>
      </Modal>

      {/* ─── FAQ MODAL ─── */}
      <Modal
        visible={faqModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFAQModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>FAQs</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setFAQModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollViewWithDetection
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {faqs.length > 0 ? (
                faqs.map((faq, idx) => (
                  <View
                    key={faq.id || faq._id}
                    style={[
                      styles.faqItem,
                      idx === faqs.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={styles.faqQRow}>
                      <Ionicons
                        name="help-circle"
                        size={16}
                        color={colors.accent}
                      />
                      <Text style={styles.faqQuestion}>{faq.question}</Text>
                    </View>
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyFaq}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={40}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.emptyFaqText}>No FAQs available</Text>
                </View>
              )}
              <ModalBottomSpacer />
            </ScrollViewWithDetection>
          </View>
        </View>
      </Modal>

      {/* ─── BUG REPORT MODAL ─── */}
      <Modal
        visible={bugModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !isSubmitting && setBugModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Issue</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => !isSubmitting && setBugModalVisible(false)}
                disabled={isSubmitting}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollViewWithDetection
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.chipRow}>
                {[
                  "general",
                  "billing",
                  "payment",
                  "announcements",
                  "profile",
                ].map((mod) => (
                  <TouchableOpacity
                    key={mod}
                    onPress={() =>
                      setBugReportForm({ ...bugReportForm, category: mod })
                    }
                    style={[
                      styles.chip,
                      bugReportForm.category === mod && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        bugReportForm.category === mod && styles.chipTextActive,
                      ]}
                    >
                      {mod.charAt(0).toUpperCase() + mod.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Severity</Text>
              <View style={styles.chipRow}>
                {["low", "medium", "high", "critical"].map((sev) => {
                  const sevColors = {
                    low: colors.success,
                    medium: "#ffc107",
                    high: "#ff9800",
                    critical: "#e53935",
                  };
                  return (
                    <TouchableOpacity
                      key={sev}
                      onPress={() =>
                        setBugReportForm({ ...bugReportForm, severity: sev })
                      }
                      style={[
                        styles.chip,
                        bugReportForm.severity === sev && {
                          backgroundColor: sevColors[sev],
                          borderColor: sevColors[sev],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          bugReportForm.severity === sev && {
                            color: colors.textOnAccent,
                          },
                        ]}
                      >
                        {sev.charAt(0).toUpperCase() + sev.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.formLabel}>Title</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Brief description of the bug"
                value={bugReportForm.title}
                onChangeText={(text) =>
                  setBugReportForm({ ...bugReportForm, title: text })
                }
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Detailed explanation of the issue..."
                value={bugReportForm.description}
                onChangeText={(text) =>
                  setBugReportForm({ ...bugReportForm, description: text })
                }
                multiline
                numberOfLines={6}
                placeholderTextColor={colors.textTertiary}
              />

              <InlineAlert
                visible={bugModalAlert.visible}
                type={bugModalAlert.type}
                message={bugModalAlert.message}
                onDismiss={() => setBugModalAlert({ visible: false })}
              />

              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleReportIssue}
                disabled={isSubmitting}
              >
                <Text style={styles.submitBtnText}>
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </Text>
              </TouchableOpacity>
              <ModalBottomSpacer />
            </ScrollViewWithDetection>
          </View>
        </View>
      </Modal>

      <RoommateProfileModal
        visible={roommateModalVisible}
        initialProfile={roommateProfile}
        user={user}
        onClose={() => setRoommateModalVisible(false)}
        onSaved={handleRoommateProfileSaved}
      />
    </ScrollViewWithDetection>

    {/* ── Screen-level Toast (floats above everything) ── */}
    <Toast
      visible={toast.visible}
      type={toast.type}
      message={toast.message}
      onHide={hideToast}
    />

    {/* ── Confirmation dialog (replaces 2-button Alert) ── */}
    <ConfirmModal
      {...confirmConfig}
      accentColor={colors.accent}
    />
    </View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      paddingBottom: 26,
    },

    /* ─── Header ─── */
    headerBg: {
      alignItems: "center",
      paddingTop: 24,
      paddingBottom: 28,
      paddingHorizontal: 18,
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.headerBg,
      borderRadius: 28,
      overflow: "hidden",
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      elevation: 5,
    },
    headerTopRow: {
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },
    headerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.14)",
    },
    headerBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textOnAccent,
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
    },
    headerEditBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textOnAccent,
    },
    avatarWrap: {
      position: "relative",
      marginBottom: 16,
    },
    avatarImg: {
      width: 94,
      height: 94,
      borderRadius: 47,
      backgroundColor: colors.inputBg,
      borderWidth: 3,
      borderColor: "rgba(255,255,255,0.75)",
    },
    avatarFallback: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: "#fdf6e3",
    },
    avatarLetter: {
      fontSize: 34,
      fontWeight: "700",
      color: "#fff",
    },
    editAvatarBtn: {
      position: "absolute",
      bottom: 0,
      right: -2,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: "#fff",
    },
    userName: {
      fontSize: 25,
      fontWeight: "800",
      color: colors.textOnAccent,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 13,
      color: "rgba(255,255,255,0.78)",
      marginBottom: 10,
    },
    headerSubcopy: {
      fontSize: 13,
      lineHeight: 19,
      color: "rgba(255,255,255,0.82)",
      textAlign: "center",
      maxWidth: 280,
      marginBottom: 14,
    },
    headerChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
    },
    roleChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    roleChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textOnAccent,
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    statusChipText: {
      fontSize: 12,
      fontWeight: "700",
    },
    pendingStatusChip: {
      backgroundColor: colors.infoBg,
    },
    summaryRow: {
      flexDirection: "row",
      gap: 12,
      marginHorizontal: 16,
      marginTop: 14,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    summaryIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    summaryValue: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
      textAlign: "center",
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
      marginTop: 5,
    },

    /* ─── Cards ─── */
    card: {
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    cardHeader: {
      marginBottom: 14,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.text,
    },
    cardSubtitle: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 4,
      lineHeight: 18,
    },

    /* ─── Info Rows ─── */
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
    },
    infoLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    infoIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    infoLabel: {
      fontSize: 14,
      color: colors.textTertiary,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      maxWidth: 180,
    },
    infoRightGroup: {
      flex: 1,
      alignItems: "flex-end",
      gap: 8,
      marginLeft: 10,
    },
    roommateInlineButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    roommateInlineText: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.accent,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
    },

    /* ─── Menu Rows ─── */
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
    },
    menuIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    menuContent: {
      flex: 1,
      marginLeft: 12,
    },
    menuTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    menuTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    menuSub: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 1,
    },

    /* ─── Track Rows ─── */
    trackRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      position: "relative",
    },
    trackStrip: {
      position: "absolute",
      left: -16,
      top: 10,
      bottom: 10,
      width: 3,
      borderRadius: 2,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#e53935",
    },

    /* ─── Admin ─── */
    adminBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 15,
    },
    adminBtnText: {
      color: colors.textOnAccent,
      fontSize: 15,
      fontWeight: "700",
    },

    /* ─── Legal ─── */
    legalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    legalRowText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
    },

    /* ─── Biometric Settings ─── */
    biometricRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 6,
    },
    biometricInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    /* ─── Logout ─── */
    logoutWrap: {
      marginHorizontal: 16,
      marginTop: 14,
    },
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: colors.errorBg,
    },
    logoutBtnText: {
      color: "#e53935",
      fontSize: 15,
      fontWeight: "600",
    },

    /* ─── Modals ─── */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
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
    modalBody: {
      maxHeight: 500,
    },
    modalAvatarSection: {
      alignItems: "center",
      marginBottom: 20,
    },
    modalAvatarImg: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.inputBg,
      marginBottom: 12,
      borderWidth: 3,
      borderColor: "#fdf6e3",
    },
    modalAvatarFallback: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
      borderWidth: 3,
      borderColor: "#fdf6e3",
    },
    modalAvatarLetter: {
      fontSize: 38,
      fontWeight: "700",
      color: "#fff",
    },
    changeAvatarBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.accentSurface,
    },
    changeAvatarText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },

    /* ─── Form ─── */
    formGroup: {
      marginBottom: 18,
    },
    formLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
      marginTop: 4,
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
    textArea: {
      textAlignVertical: "top",
      height: 120,
      marginBottom: 12,
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
      fontWeight: "600",
    },

    /* ─── Chips ─── */
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardAlt,
    },
    chipActive: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    chipText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.background,
    },

    /* ─── Submit ─── */
    submitBtn: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
    },
    submitBtnText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "600",
    },

    /* ─── FAQ ─── */
    faqItem: {
      paddingBottom: 14,
      marginBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    faqQRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 6,
    },
    faqQuestion: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    faqAnswer: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
      paddingLeft: 24,
    },
    emptyFaq: {
      alignItems: "center",
      paddingVertical: 40,
    },
    emptyFaqText: {
      fontSize: 14,
      color: colors.textTertiary,
      marginTop: 10,
    },

    /* ─── Theme Toggle ─── */
    themeRow: {
      flexDirection: "row",
      gap: 10,
      paddingBottom: 4,
    },
    themeOption: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: colors.inputBg,
      borderWidth: 1.5,
      borderColor: "transparent",
      gap: 6,
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
  });

export default ProfileScreen;
