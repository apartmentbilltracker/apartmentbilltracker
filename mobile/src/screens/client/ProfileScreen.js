import React, { useContext, useState, useMemo } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { AuthContext } from "../../context/AuthContext";
import {
  roomService,
  supportService,
  hostRoleService,
} from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const THEME_OPTIONS = [
  { key: "light", label: "Light", icon: "sunny" },
  { key: "dark", label: "Dark", icon: "moon" },
  { key: "system", label: "System", icon: "phone-portrait-outline" },
];

const ProfileScreen = ({ navigation }) => {
  const { colors, preference, setTheme } = useTheme();
  const styles = createStyles(colors);

  const { state, refreshUser, signOut, switchView, updateUserProfile } =
    useContext(AuthContext);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [payorStatus, setPayorStatus] = useState(null);

  // Support Service States
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [faqModalVisible, setFAQModalVisible] = useState(false);
  const [bugModalVisible, setBugModalVisible] = useState(false);
  const [supportTicketForm, setSupportTicketForm] = useState({
    subject: "",
    message: "",
    category: "general",
  });
  const [bugReportForm, setBugReportForm] = useState({
    title: "",
    description: "",
    severity: "medium",
    module: "general",
  });
  const [faqs, setFAQs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unreadTickets, setUnreadTickets] = useState(0);
  const [unreadBugReports, setUnreadBugReports] = useState(0);
  const [hostRequestStatus, setHostRequestStatus] = useState(null);
  const [requestingHost, setRequestingHost] = useState(false);

  const user = state.user || {};
  const userId = user.id || user._id;

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

  const handleRequestHost = () => {
    Alert.alert(
      "Become a Host",
      "Request to become a room host? An admin will review your request. Once approved you'll get access to room management features.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request",
          onPress: async () => {
            try {
              setRequestingHost(true);
              await hostRoleService.requestHost();
              setHostRequestStatus("pending");
              Alert.alert(
                "Success",
                "Host request submitted! An admin will review it soon.",
              );
            } catch (error) {
              Alert.alert(
                "Error",
                error.response?.data?.message ||
                  error.message ||
                  "Failed to submit request",
              );
            } finally {
              setRequestingHost(false);
            }
          },
        },
      ],
    );
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

  const handleAdminButtonPress = () => {
    const userRole = user?.role?.toLowerCase();
    if (userRole === "admin") {
      console.log("Switching to admin view...");
      switchView("admin");
    } else if (userRole === "host") {
      console.log("Switching to host view...");
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

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Error", "Failed to logout");
      setIsLoggingOut(false);
    }
  };

  // Support Service Handlers
  const handleContactSupport = async () => {
    if (
      !supportTicketForm.subject.trim() ||
      !supportTicketForm.message.trim()
    ) {
      Alert.alert("Validation", "Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await supportService.createTicket(supportTicketForm);
      Alert.alert("Success", "Support ticket created successfully!");
      setSupportModalVisible(false);
      setSupportTicketForm({ subject: "", message: "", category: "general" });
    } catch (error) {
      console.error("Error creating ticket:", error);
      Alert.alert("Error", "Failed to create support ticket");
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
      Alert.alert("Error", "Failed to load FAQs");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportIssue = async () => {
    if (!bugReportForm.title.trim() || !bugReportForm.description.trim()) {
      Alert.alert("Validation", "Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await supportService.createBugReport(bugReportForm);
      Alert.alert("Success", "Bug report submitted successfully!");
      setBugModalVisible(false);
      setBugReportForm({
        title: "",
        description: "",
        severity: "medium",
        module: "general",
      });
    } catch (error) {
      console.error("Error creating bug report:", error);
      Alert.alert("Error", "Failed to submit bug report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvatarSource = () => {
    if (user.avatar?.url) {
      return { uri: user.avatar.url };
    }
    return null;
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ─── PROFILE HEADER ─── */}
      <View style={styles.headerBg}>
        <View style={styles.avatarWrap}>
          {user.avatar?.url ? (
            <Image
              source={getAvatarSource()}
              style={styles.avatarImg}
              defaultSource={require("../../assets/default-avatar.png")}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>
                {(user.name || "U").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.editAvatarBtn}
            onPress={handleEditPress}
          >
            <Ionicons name="pencil" size={14} color={colors.textOnAccent} />
          </TouchableOpacity>
        </View>
        <Text style={styles.userName}>{user.name || "User"}</Text>
        <Text style={styles.userEmail}>{user.email || "N/A"}</Text>
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
                payorStatus === "Payor" ? colors.success : colors.textSecondary
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
      </View>

      {/* ─── ACCOUNT INFO ─── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account Information</Text>
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
          <Text style={styles.infoValue}>{payorStatus || "No Room"}</Text>
        </View>
      </View>

      {/* ─── CUSTOMER SERVICE ─── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Customer Service</Text>
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
        <Text style={styles.cardTitle}>Track My Requests</Text>
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
        <Text style={styles.cardTitle}>Appearance</Text>
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
          <Text style={styles.cardTitle}>Room Host</Text>
          {hostRequestStatus === "pending" ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: "#fff8e1",
                padding: 14,
                borderRadius: 10,
              }}
            >
              <Ionicons name="time" size={22} color="#e67e22" />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#e67e22",
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: "#fce4ec",
                padding: 14,
                borderRadius: 10,
              }}
            >
              <Ionicons name="close-circle" size={22} color="#c62828" />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#c62828",
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
                  Your request was not approved. Contact admin for details.
                </Text>
              </View>
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
                  { backgroundColor: "#b38604" },
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
          <Text style={styles.cardTitle}>
            {isAdmin ? "Admin Panel" : "Host Panel"}
          </Text>
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
        <Text style={styles.cardTitle}>Legal</Text>
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
              ) : user.avatar?.url ? (
                <Image
                  source={getAvatarSource()}
                  style={styles.modalAvatarImg}
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
          </View>
        </View>
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
            <ScrollView
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
                value={supportTicketForm.subject}
                onChangeText={(text) =>
                  setSupportTicketForm({ ...supportTicketForm, subject: text })
                }
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.formLabel}>Message</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Describe your issue..."
                value={supportTicketForm.message}
                onChangeText={(text) =>
                  setSupportTicketForm({ ...supportTicketForm, message: text })
                }
                multiline
                numberOfLines={6}
                placeholderTextColor={colors.textTertiary}
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
              <View style={{ height: 20 }} />
            </ScrollView>
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
            <ScrollView
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
              <View style={{ height: 20 }} />
            </ScrollView>
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
            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.formLabel}>Module</Text>
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
                      setBugReportForm({ ...bugReportForm, module: mod })
                    }
                    style={[
                      styles.chip,
                      bugReportForm.module === mod && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        bugReportForm.module === mod && styles.chipTextActive,
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

              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleReportIssue}
                disabled={isSubmitting}
              >
                <Text style={styles.submitBtnText}>
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
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

    /* ─── Header ─── */
    headerBg: {
      alignItems: "center",
      paddingTop: 30,
      paddingBottom: 24,
      backgroundColor: colors.card,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    avatarWrap: {
      position: "relative",
      marginBottom: 14,
    },
    avatarImg: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.inputBg,
      borderWidth: 3,
      borderColor: "#fdf6e3",
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
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
    },
    userEmail: {
      fontSize: 13,
      color: colors.textTertiary,
      marginBottom: 10,
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusChipText: {
      fontSize: 12,
      fontWeight: "600",
    },

    /* ─── Cards ─── */
    card: {
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 14,
    },

    /* ─── Info Rows ─── */
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
    },
    infoLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    infoIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
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
    divider: {
      height: 1,
      backgroundColor: colors.inputBg,
    },

    /* ─── Menu Rows ─── */
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
    },
    menuIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    menuContent: {
      flex: 1,
      marginLeft: 12,
    },
    menuTitle: {
      fontSize: 14,
      fontWeight: "600",
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
      paddingVertical: 12,
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
      backgroundColor: colors.text,
      borderRadius: 12,
      paddingVertical: 14,
    },
    adminBtnText: {
      color: colors.background,
      fontSize: 15,
      fontWeight: "600",
    },

    /* ─── Legal ─── */
    legalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    legalRowText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
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
      borderRadius: 14,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: "#fce4ec",
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
      paddingBottom: 30,
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
  });

export default ProfileScreen;
