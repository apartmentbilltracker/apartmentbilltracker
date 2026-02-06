import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { supportService } from "../../services/apiService";

const AdminBugReportsScreen = ({ navigation }) => {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBug, setSelectedBug] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchAllBugReports();

    // Refresh bug reports when screen comes into focus
    const unsubscribe = navigation.addListener("focus", () => {
      fetchAllBugReports();
    });

    return unsubscribe;
  }, [navigation]);

  const fetchAllBugReports = async () => {
    setLoading(true);
    try {
      const response = await supportService.getAllBugReports();
      setBugs(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error("Error fetching bug reports:", error);
      Alert.alert("Error", "Failed to load bug reports");
    } finally {
      setLoading(false);
    }
  };

  const handleBugPress = async (bugId) => {
    try {
      const details = await supportService.getBugReportDetails(bugId);
      setSelectedBug(details?.data || details);
      setNewStatus(details?.data?.status || details?.status);
      setModalVisible(true);

      // Mark bug report as read by admin
      try {
        await supportService.markBugReportAsRead(bugId);
        // Update the bug in the local list
        setBugs(
          bugs.map((b) =>
            b._id === bugId ? { ...b, isReadByAdmin: true } : b,
          ),
        );
      } catch (error) {
        console.error("Error marking bug report as read:", error);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load bug details");
    }
  };

  const handleAddResponse = async () => {
    if (!responseText.trim()) {
      Alert.alert("Validation", "Please enter a response message");
      return;
    }

    setSubmitting(true);
    try {
      await supportService.addBugReportResponse(selectedBug._id, responseText);

      const updatedBug = {
        ...selectedBug,
        responses: [
          ...(selectedBug.responses || []),
          {
            from: "admin",
            message: responseText,
            createdAt: new Date(),
          },
        ],
        isReadByAdmin: false, // Reset read flag so indicator appears for user
      };
      setSelectedBug(updatedBug);
      setResponseText("");
      Alert.alert("Success", "Response added successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to add response");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setSubmitting(true);
    try {
      await supportService.updateBugReportStatus(selectedBug._id, newStatus);
      const updatedBug = { ...selectedBug, status: newStatus };
      setSelectedBug(updatedBug);
      setNewStatus(newStatus);
      Alert.alert("Success", "Bug status updated");
    } catch (error) {
      Alert.alert("Error", "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "critical":
        return "#c0392b";
      case "high":
        return "#e74c3c";
      case "medium":
        return "#f39c12";
      case "low":
        return "#27ae60";
      default:
        return "#95a5a6";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "new":
        return "#3498db";
      case "in-review":
        return "#f39c12";
      case "acknowledged":
        return "#9b59b6";
      case "fixed":
        return "#27ae60";
      case "closed":
        return "#95a5a6";
      default:
        return "#95a5a6";
    }
  };

  const filteredBugs = bugs.filter((b) => {
    const severityMatch =
      severityFilter === "all" || b.severity === severityFilter;
    const statusMatch = statusFilter === "all" || b.status === statusFilter;
    return severityMatch && statusMatch;
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#e74c3c" />
        <Text style={styles.loadingText}>Loading bug reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bug Reports</Text>
          <Text style={styles.headerSubtitle}>Track and resolve issues</Text>
        </View>
        <View style={styles.countBadge}>
          <MaterialIcons name="bug-report" size={18} color="#fff" />
          <Text style={styles.countText}>{filteredBugs.length}</Text>
        </View>
      </View>

      {/* Severity Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        <TouchableOpacity
          style={[
            styles.filterTab,
            severityFilter === "all" && styles.filterTabActive,
          ]}
          onPress={() => setSeverityFilter("all")}
        >
          <MaterialIcons
            name="list"
            size={16}
            color={severityFilter === "all" ? "#fff" : "#666"}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.filterTabText,
              severityFilter === "all" && styles.filterTabTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {["critical", "high", "medium", "low"].map((severity) => (
          <TouchableOpacity
            key={severity}
            style={[
              styles.filterTab,
              severityFilter === severity && styles.filterTabActive,
            ]}
            onPress={() => setSeverityFilter(severity)}
          >
            <View
              style={[
                styles.severityDot,
                { backgroundColor: getSeverityColor(severity) },
              ]}
            />
            <Text
              style={[
                styles.filterTabText,
                severityFilter === severity && styles.filterTabTextActive,
              ]}
            >
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bug Reports List */}
      <FlatList
        data={filteredBugs}
        keyExtractor={(item) => item._id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.bugCard}
            onPress={() => handleBugPress(item._id)}
          >
            <View style={styles.bugHeader}>
              <View style={styles.bugTitleSection}>
                <Text style={styles.bugTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.bugReporter}>{item.userName}</Text>
              </View>
              <View style={styles.bugBadges}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: getSeverityColor(item.severity) + "20" },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: getSeverityColor(item.severity) },
                    ]}
                  >
                    {item.severity.charAt(0).toUpperCase() +
                      item.severity.slice(1)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: getStatusColor(item.status) + "20" },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: getStatusColor(item.status) },
                    ]}
                  >
                    {item.status
                      .split("-")
                      .map(
                        (word) => word.charAt(0).toUpperCase() + word.slice(1),
                      )
                      .join("-")}
                  </Text>
                </View>
                {!item.isReadByAdmin &&
                  item.responses &&
                  item.responses.length > 0 && (
                    <View style={styles.unreadDotIndicator} />
                  )}
              </View>
            </View>

            <View style={styles.bugMeta}>
              <Text style={styles.module}>{item.module}</Text>
              <Text style={styles.responseCount}>
                {(item.responses || []).length} responses
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No bug reports found</Text>
        }
      />

      {/* Bug Details Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bug Report Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedBug && (
              <ScrollView style={styles.modalBody}>
                {/* Bug Info */}
                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Title</Text>
                  <Text style={styles.infoValue}>{selectedBug.title}</Text>
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Reporter</Text>
                  <Text style={styles.infoValue}>{selectedBug.userName}</Text>
                  <Text style={styles.infoSubText}>
                    {selectedBug.userEmail}
                  </Text>
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Module</Text>
                  <Text style={styles.infoValue}>
                    {selectedBug.module.charAt(0).toUpperCase() +
                      selectedBug.module.slice(1)}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoHalf}>
                    <Text style={styles.infoLabel}>Severity</Text>
                    <View
                      style={[
                        styles.severityBadge,
                        {
                          backgroundColor:
                            getSeverityColor(selectedBug.severity) + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.severityText,
                          {
                            color: getSeverityColor(selectedBug.severity),
                          },
                        ]}
                      >
                        {selectedBug.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoHalf}>
                    <Text style={styles.infoLabel}>Status</Text>
                    <View style={styles.statusPicker}>
                      {[
                        "new",
                        "in-review",
                        "acknowledged",
                        "fixed",
                        "closed",
                      ].map((status) => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusButton,
                            newStatus === status && styles.statusButtonActive,
                          ]}
                          onPress={() => handleStatusChange(status)}
                        >
                          <Text
                            style={[
                              styles.statusButtonText,
                              newStatus === status &&
                                styles.statusButtonTextActive,
                            ]}
                          >
                            {status.split("-")[0].charAt(0).toUpperCase() +
                              status.split("-")[0].slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Description */}
                <View style={styles.descriptionSection}>
                  <Text style={styles.infoLabel}>Description</Text>
                  <View style={styles.descriptionBox}>
                    <Text style={styles.descriptionText}>
                      {selectedBug.description}
                    </Text>
                  </View>
                </View>

                {/* Responses Timeline */}
                <View style={styles.responsesSection}>
                  <Text style={styles.infoLabel}>
                    Timeline ({(selectedBug.responses || []).length})
                  </Text>

                  {/* Original Report */}
                  <View style={styles.responseItem}>
                    <View
                      style={[
                        styles.responseBadge,
                        {
                          backgroundColor: getSeverityColor(
                            selectedBug.severity,
                          ),
                        },
                      ]}
                    >
                      <MaterialIcons name="bug-report" size={16} color="#fff" />
                    </View>
                    <View style={styles.responseContent}>
                      <Text style={styles.responseFrom}>Bug Report</Text>
                      <Text style={styles.responseText}>
                        {selectedBug.description}
                      </Text>
                      <Text style={styles.responseTime}>
                        {new Date(selectedBug.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {/* Responses */}
                  {(selectedBug.responses || []).map((response, index) => (
                    <View
                      key={index}
                      style={[
                        styles.messageBubbleWrapper,
                        response.from === "admin"
                          ? styles.adminBubbleWrapper
                          : styles.userBubbleWrapper,
                      ]}
                    >
                      <View
                        style={[
                          styles.messageBubble,
                          response.from === "admin"
                            ? styles.adminBubble
                            : styles.userBubble,
                        ]}
                      >
                        <View style={styles.messageHeader}>
                          <Text
                            style={[
                              styles.messageSender,
                              response.from === "admin"
                                ? styles.adminSender
                                : styles.userSender,
                            ]}
                          >
                            {response.from === "admin"
                              ? "🔧 You (Admin)"
                              : "👤 " + selectedBug.userName}
                          </Text>
                          <Text
                            style={[
                              styles.messageTimestamp,
                              response.from === "admin"
                                ? { color: "#ccc" }
                                : { color: "#999" },
                            ]}
                          >
                            {new Date(response.createdAt).toLocaleString()}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.messageTextContent,
                            response.from === "admin"
                              ? styles.adminMessageText
                              : styles.userMessageText,
                          ]}
                        >
                          {response.message}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Response Input */}
                <View style={styles.responseInputSection}>
                  <TextInput
                    style={styles.responseInput}
                    placeholder="Type your response here..."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={4}
                    value={responseText}
                    onChangeText={setResponseText}
                    editable={!submitting}
                  />
                  <TouchableOpacity
                    style={[
                      styles.responseButton,
                      submitting && styles.responseButtonDisabled,
                    ]}
                    onPress={handleAddResponse}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <MaterialIcons name="send" size={18} color="#fff" />
                        <Text style={styles.responseButtonText}>
                          Send Response
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#e74c3c",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  bugCount: {
    fontSize: 14,
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f5f5f5",
  },
  filterTabActive: {
    backgroundColor: "#e74c3c",
    borderColor: "#e74c3c",
  },
  filterTabText: {
    fontSize: 12,
    color: "#555",
    fontWeight: "600",
  },
  filterTabTextActive: {
    color: "#fff",
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  bugCard: {
    margin: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#e74c3c",
  },
  bugHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bugTitleSection: {
    flex: 1,
    marginRight: 12,
  },
  bugTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a202c",
    marginBottom: 6,
  },
  bugReporter: {
    fontSize: 12,
    color: "#718096",
  },
  bugBadges: {
    flexDirection: "row",
    gap: 8,
    position: "relative",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  unreadDotIndicator: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e74c3c",
    borderWidth: 2,
    borderColor: "#fff",
  },
  bugMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  module: {
    fontSize: 11,
    color: "#999",
    textTransform: "uppercase",
  },
  responseCount: {
    fontSize: 11,
    color: "#e74c3c",
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
    fontSize: 14,
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoSection: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  infoSubText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  infoHalf: {
    flex: 1,
  },
  severityBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  statusButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
    minWidth: "30%",
  },
  statusButtonActive: {
    backgroundColor: "#e74c3c",
  },
  statusButtonText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#666",
  },
  statusButtonTextActive: {
    color: "#fff",
  },
  descriptionSection: {
    marginBottom: 16,
  },
  descriptionBox: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
  },
  descriptionText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 20,
  },
  responsesSection: {
    marginBottom: 20,
  },
  messagesContainer: {
    marginVertical: 12,
    paddingVertical: 8,
  },
  messageBubbleWrapper: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  adminBubbleWrapper: {
    alignItems: "flex-end",
  },
  userBubbleWrapper: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  adminBubble: {
    backgroundColor: "#0a66c2",
    borderBottomRightRadius: 4,
  },
  userBubble: {
    backgroundColor: "#e8e8e8",
    borderBottomLeftRadius: 4,
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: "700",
  },
  adminSender: {
    color: "#fff",
  },
  userSender: {
    color: "#333",
  },
  messageTimestamp: {
    fontSize: 11,
    color: "#999",
  },
  messageTextContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  adminMessageText: {
    color: "#fff",
  },
  userMessageText: {
    color: "#333",
  },
  responseItem: {
    flexDirection: "row",
    marginBottom: 16,
  },
  responseBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e74c3c",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  responseContent: {
    flex: 1,
  },
  responseFrom: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1a202c",
    marginBottom: 4,
  },
  responseText: {
    fontSize: 13,
    color: "#555",
    lineHeight: 20,
  },
  responseTime: {
    fontSize: 11,
    color: "#999",
    marginTop: 6,
  },
  responseInputSection: {
    marginBottom: 20,
  },
  responseInput: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#333",
    textAlignVertical: "top",
    marginBottom: 12,
  },
  responseButton: {
    flexDirection: "row",
    backgroundColor: "#e74c3c",
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  responseButtonDisabled: {
    opacity: 0.6,
  },
  responseButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default AdminBugReportsScreen;
