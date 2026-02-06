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
import { roomService, supportService } from "../../services/apiService";

const ProfileScreen = ({ navigation }) => {
  const { state, refreshUser, signOut, switchView, updateUserProfile } =
    useContext(AuthContext);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [payorStatus, setPayorStatus] = useState("Non-Payor");
  
  // Support Service States
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [faqModalVisible, setFAQModalVisible] = useState(false);
  const [bugModalVisible, setBugModalVisible] = useState(false);
  const [supportTicketForm, setSupportTicketForm] = useState({ subject: "", message: "", category: "general" });
  const [bugReportForm, setBugReportForm] = useState({ title: "", description: "", severity: "medium", module: "general" });
  const [faqs, setFAQs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unreadTickets, setUnreadTickets] = useState(0);
  const [unreadBugReports, setUnreadBugReports] = useState(0);

  const user = state.user || {};
  const userId = user._id;

  // Handle role as either array or string
  const isAdmin = Array.isArray(user.role)
    ? user.role.includes("admin")
    : typeof user.role === "string" &&
      user.role.toLowerCase().includes("admin");

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
            (m) => String(m.user?._id || m.user) === String(userId),
          );
          return isMember;
        });

        if (joinedRoom) {
          const userMember = joinedRoom.members.find(
            (m) => String(m.user?._id || m.user) === String(userId),
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
        const tickets = Array.isArray(ticketsResponse) ? ticketsResponse : ticketsResponse?.data || [];
        const unreadTicketCount = tickets.filter(t => !t.isReadByUser && t.replies && t.replies.length > 0).length;
        setUnreadTickets(unreadTicketCount);

        const bugsResponse = await supportService.getUserBugReports();
        const bugs = Array.isArray(bugsResponse) ? bugsResponse : bugsResponse?.data || [];
        const unreadBugCount = bugs.filter(b => !b.isReadByUser && b.responses && b.responses.length > 0).length;
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
    if (!supportTicketForm.subject.trim() || !supportTicketForm.message.trim()) {
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
      setBugReportForm({ title: "", description: "", severity: "medium", module: "general" });
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
        <Text style={styles.sectionTitle}>Customer Service</Text>
        <View style={styles.serviceContainer}>
          <TouchableOpacity 
            style={[styles.serviceButton, { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }]}
            onPress={() => setSupportModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.serviceIconContainer}>
              <MaterialIcons name="headset-mic" size={26} color="#0a66c2" />
            </View>
            <View style={styles.serviceButtonContent}>
              <Text style={styles.serviceButtonTitle}>Contact Support</Text>
              <Text style={styles.serviceButtonDesc}>
                Get help from our support team
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#cbd5e0" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.serviceButton, { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }]}
            onPress={handleFAQPress}
            activeOpacity={0.7}
          >
            <View style={styles.serviceIconContainer}>
              <MaterialIcons name="help" size={26} color="#27ae60" />
            </View>
            <View style={styles.serviceButtonContent}>
              <Text style={styles.serviceButtonTitle}>FAQs</Text>
              <Text style={styles.serviceButtonDesc}>
                Find answers to common questions
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#cbd5e0" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.serviceButton, { borderBottomWidth: 0 }]}
            onPress={() => setBugModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.serviceIconContainer}>
              <MaterialIcons name="bug-report" size={26} color="#e74c3c" />
            </View>
            <View style={styles.serviceButtonContent}>
              <Text style={styles.serviceButtonTitle}>Report Issue</Text>
              <Text style={styles.serviceButtonDesc}>
                Report a problem or bug
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#cbd5e0" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Track My Requests</Text>
        <View style={styles.trackingContainer}>
          <TouchableOpacity
            style={[styles.trackingButton, { borderLeftColor: "#0a66c2" }]}
            onPress={() => navigation.navigate("MyTickets")}
            activeOpacity={0.7}
          >
            <View style={styles.trackingIconContainer}>
              <MaterialIcons name="confirmation-number" size={26} color="#0a66c2" />
            </View>
            <View style={styles.trackingButtonContent}>
              <View style={styles.titleWithDot}>
                <Text style={styles.trackingButtonTitle}>My Support Tickets</Text>
                {unreadTickets > 0 && <View style={styles.unreadDotSmall} />}
              </View>
              <Text style={styles.trackingButtonDesc}>
                View and track your support requests
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#cbd5e0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.trackingButton, { borderLeftColor: "#e74c3c" }]}
            onPress={() => navigation.navigate("MyBugReports")}
            activeOpacity={0.7}
          >
            <View style={styles.trackingIconContainer}>
              <MaterialIcons name="bug-report" size={26} color="#e74c3c" />
            </View>
            <View style={styles.trackingButtonContent}>
              <View style={styles.titleWithDot}>
                <Text style={styles.trackingButtonTitle}>My Bug Reports</Text>
                {unreadBugReports > 0 && <View style={styles.unreadDotSmall} />}
              </View>
              <Text style={styles.trackingButtonDesc}>
                Track issues you've reported
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#cbd5e0" />
          </TouchableOpacity>
        </View>
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
          <Text style={styles.infoLabel}>Status</Text>
          <View style={styles.roleContainer}>
            <Text style={styles.infoValue}>{payorStatus}</Text>
            {payorStatus === "Payor" && (
              <View style={styles.payorBadge}>
                <MaterialIcons name="check-circle" size={12} color="#fff" />
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
        <TouchableOpacity
          style={[styles.logoutButton, isLoggingOut && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.logoutButtonText}>Logout</Text>
          )}
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

      {/* Support Ticket Modal */}
      <Modal
        visible={supportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !isSubmitting && setSupportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact Support</Text>
              <TouchableOpacity
                onPress={() => !isSubmitting && setSupportModalVisible(false)}
                disabled={isSubmitting}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.pickerContainer}>
                {["general", "billing", "payment", "technical", "other"].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSupportTicketForm({ ...supportTicketForm, category: cat })}
                    style={[
                      styles.categoryOption,
                      supportTicketForm.category === cat && styles.categoryOptionActive
                    ]}
                  >
                    <Text style={supportTicketForm.category === cat ? styles.categoryTextActive : styles.categoryText}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Subject</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter subject"
                value={supportTicketForm.subject}
                onChangeText={(text) => setSupportTicketForm({ ...supportTicketForm, subject: text })}
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Message</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your issue..."
                value={supportTicketForm.message}
                onChangeText={(text) => setSupportTicketForm({ ...supportTicketForm, message: text })}
                multiline
                numberOfLines={6}
                placeholderTextColor="#999"
              />

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleContactSupport}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? "Submitting..." : "Submit Ticket"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* FAQ Modal */}
      <Modal
        visible={faqModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFAQModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Frequently Asked Questions</Text>
              <TouchableOpacity onPress={() => setFAQModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {faqs.length > 0 ? (
                faqs.map((faq) => (
                  <View key={faq._id} style={styles.faqItem}>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>No FAQs available</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bug Report Modal */}
      <Modal
        visible={bugModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !isSubmitting && setBugModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Issue</Text>
              <TouchableOpacity
                onPress={() => !isSubmitting && setBugModalVisible(false)}
                disabled={isSubmitting}
              >
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Module</Text>
              <View style={styles.pickerContainer}>
                {["general", "billing", "payment", "announcements", "profile"].map(mod => (
                  <TouchableOpacity
                    key={mod}
                    onPress={() => setBugReportForm({ ...bugReportForm, module: mod })}
                    style={[
                      styles.categoryOption,
                      bugReportForm.module === mod && styles.categoryOptionActive
                    ]}
                  >
                    <Text style={bugReportForm.module === mod ? styles.categoryTextActive : styles.categoryText}>
                      {mod.charAt(0).toUpperCase() + mod.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Severity</Text>
              <View style={styles.pickerContainer}>
                {["low", "medium", "high", "critical"].map(sev => (
                  <TouchableOpacity
                    key={sev}
                    onPress={() => setBugReportForm({ ...bugReportForm, severity: sev })}
                    style={[
                      styles.categoryOption,
                      bugReportForm.severity === sev && styles.categoryOptionActive
                    ]}
                  >
                    <Text style={bugReportForm.severity === sev ? styles.categoryTextActive : styles.categoryText}>
                      {sev.charAt(0).toUpperCase() + sev.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Brief description of the bug"
                value={bugReportForm.title}
                onChangeText={(text) => setBugReportForm({ ...bugReportForm, title: text })}
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Detailed explanation of the issue..."
                value={bugReportForm.description}
                onChangeText={(text) => setBugReportForm({ ...bugReportForm, description: text })}
                multiline
                numberOfLines={6}
                placeholderTextColor="#999"
              />

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleReportIssue}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
    backgroundColor: "#b38604",
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
  payorBadge: {
    backgroundColor: "#27ae60",
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
    backgroundColor: "#b38604",
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
  serviceContainer: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e6eb",
  },
  serviceButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fafbfc",
    transition: "all 0.2s",
  },
  serviceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f3f7fc",
    justifyContent: "center",
    alignItems: "center",
  },
  serviceButtonContent: {
    flex: 1,
    marginLeft: 14,
  },
  serviceButtonTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a202c",
    marginBottom: 4,
  },
  serviceButtonDesc: {
    fontSize: 12,
    color: "#718096",
    marginTop: 2,
    lineHeight: 16,
  },
  trackingContainer: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e6eb",
  },
  trackingButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fafbfc",
    borderLeftWidth: 4,
  },
  trackingIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f3f7fc",
    justifyContent: "center",
    alignItems: "center",
  },
  trackingButtonContent: {
    flex: 1,
    marginLeft: 14,
  },
  trackingButtonTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a202c",
    marginBottom: 4,
  },
  titleWithDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unreadDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e74c3c",
  },
  trackingButtonDesc: {
    fontSize: 12,
    color: "#718096",
    marginTop: 2,
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginTop: 12,
  },
  pickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f0f0f0",
  },
  categoryOptionActive: {
    backgroundColor: "#0a66c2",
    borderColor: "#0a66c2",
  },
  categoryText: {
    fontSize: 12,
    fontWeight:"600",
    color: "#666",
  },
  categoryTextActive: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
    backgroundColor: "#f8f9fa",
  },
  textArea: {
    textAlignVertical: "top",
    height: 120,
  },
  faqItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0a66c2",
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
  },
  noDataText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ProfileScreen;
