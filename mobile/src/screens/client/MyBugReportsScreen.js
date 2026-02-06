import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { supportService } from "../../services/apiService";

const MyBugReportsScreen = ({ navigation }) => {
  const { state } = useContext(AuthContext);
  const [bugReports, setBugReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [newResponse, setNewResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBugReports();
    
    // Refresh bug reports when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchBugReports();
    });
    
    return unsubscribe;
  }, [navigation]);

  const fetchBugReports = async () => {
    try {
      setLoading(true);
      const response = await supportService.getUserBugReports();
      setBugReports(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error("Error fetching bug reports:", error);
      Alert.alert("Error", "Failed to load your bug reports");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchBugReports().then(() => setRefreshing(false));
  }, []);

  const handleViewDetails = async (report) => {
    try {
      const response = await supportService.getBugReportDetails(report._id);
      setSelectedReport(response?.data || response);
      setDetailsVisible(true);

      // Mark bug report as read
      try {
        await supportService.markBugReportAsRead(report._id);
        // Update the report in the local list
        setBugReports(
          bugReports.map((r) =>
            r._id === report._id ? { ...r, isReadByUser: true } : r,
          ),
        );
      } catch (error) {
        console.error("Error marking bug report as read:", error);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load bug report details");
    }
  };

  const handleAddResponse = async () => {
    if (!newResponse.trim()) {
      Alert.alert("Validation", "Please enter your message");
      return;
    }

    setSubmitting(true);
    try {
      await supportService.addBugReportResponse(
        selectedReport._id,
        newResponse,
      );
      Alert.alert("Success", "Response added successfully");
      setNewResponse("");
      // Refresh bug report details
      const response = await supportService.getBugReportDetails(
        selectedReport._id,
      );
      setSelectedReport(response?.data || response);
      // Reset read flag so indicator appears for admin
      setBugReports(
        bugReports.map((r) =>
          r._id === selectedReport._id ? { ...r, isReadByAdmin: false } : r,
        ),
      );
    } catch (error) {
      Alert.alert("Error", "Failed to add response");
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "critical":
        return "#8b0000";
      case "high":
        return "#e74c3c";
      case "medium":
        return "#f39c12";
      case "low":
        return "#27ae60";
      default:
        return "#3498db";
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
        return "#3498db";
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e74c3c" />
        <Text style={styles.loadingText}>Loading your bug reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bug Reports</Text>
        <Text style={styles.headerSubtitle}>
          {bugReports.length} {bugReports.length === 1 ? "report" : "reports"}
        </Text>
      </View>

      {bugReports.length === 0 ? (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.emptyContainer}>
            <MaterialIcons name="bug-report" size={64} color="#ddd" />
            <Text style={styles.emptyText}>No bug reports yet</Text>
            <Text style={styles.emptySubtext}>
              When you report a bug, it will appear here
            </Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={bugReports}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.reportCard}
              onPress={() => handleViewDetails(item)}
            >
              <View style={styles.reportHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportTitle}>{item.title}</Text>
                  <Text style={styles.reportId}>ID: {item._id.slice(-8)}</Text>
                </View>
                <View style={styles.badgeContainer}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(item.status) },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {item.status
                        .split("-")
                        .map(
                          (word) =>
                            word.charAt(0).toUpperCase() + word.slice(1),
                        )
                        .join(" ")}
                    </Text>
                  </View>
                  {!item.isReadByUser && item.responses && item.responses.length > 0 && (
                    <View style={styles.unreadDotIndicator} />
                  )}
                </View>
              </View>

              <View style={styles.reportContent}>
                <Text style={styles.reportDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>

              <View style={styles.reportFooter}>
                <View
                  style={[
                    styles.severityBadge,
                    { backgroundColor: getSeverityColor(item.severity) },
                  ]}
                >
                  <Text style={styles.severityText}>
                    {item.severity.charAt(0).toUpperCase() +
                      item.severity.slice(1)}
                  </Text>
                </View>

                <View style={styles.footerItem}>
                  <Text style={styles.label}>Module:</Text>
                  <Text style={styles.value}>{item.module}</Text>
                </View>

                <View style={styles.footerItem}>
                  <Text style={styles.label}>Responses:</Text>
                  <Text style={styles.value}>
                    {item.responses?.length || 0}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Bug Report Details Modal */}
      <Modal visible={detailsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bug Report Details</Text>
              <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedReport && (
              <ScrollView style={styles.detailsContainer}>
                {/* Report Info */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Report Information</Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Title:</Text>
                    <Text style={styles.value}>{selectedReport.title}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Module:</Text>
                    <Text style={styles.value}>{selectedReport.module}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Severity:</Text>
                    <View
                      style={[
                        styles.inlineBadge,
                        {
                          backgroundColor: getSeverityColor(
                            selectedReport.severity,
                          ),
                        },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {selectedReport.severity.charAt(0).toUpperCase() +
                          selectedReport.severity.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Status:</Text>
                    <View
                      style={[
                        styles.inlineBadge,
                        {
                          backgroundColor: getStatusColor(
                            selectedReport.status,
                          ),
                        },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {selectedReport.status
                          .split("-")
                          .map(
                            (word) =>
                              word.charAt(0).toUpperCase() + word.slice(1),
                          )
                          .join(" ")}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.descriptionBox}>
                    <Text style={styles.label}>Description:</Text>
                    <View style={styles.descriptionContent}>
                      <Text style={styles.descriptionText}>
                        {selectedReport.description}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Admin Responses */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Team Responses ({selectedReport.responses?.length || 0})
                  </Text>

                  {selectedReport.responses &&
                  selectedReport.responses.length > 0 ? (
                    <View style={styles.messagesContainer}>
                      {selectedReport.responses.map((response, index) => (
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
                                  ? "🔧 Development Team"
                                  : "👤 You"}
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
                  ) : (
                    <Text style={styles.noResponses}>
                      No responses yet. Team is working on it!
                    </Text>
                  )}
                </View>

                {/* Add Response Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Add Your Comment</Text>
                  <TextInput
                    style={styles.responseInput}
                    placeholder="Add additional information about the bug..."
                    multiline
                    numberOfLines={4}
                    value={newResponse}
                    onChangeText={setNewResponse}
                    editable={!submitting}
                  />
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      submitting && styles.buttonDisabled,
                    ]}
                    onPress={handleAddResponse}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator
                        size="small"
                        color="#fff"
                        style={{ marginRight: 8 }}
                      />
                    ) : (
                      <MaterialIcons name="comment" size={18} color="#fff" />
                    )}
                    <Text style={styles.submitButtonText}>
                      {submitting ? "Posting..." : "Post Comment"}
                    </Text>
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
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: "#e74c3c",
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#ffd4cc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#888",
    marginTop: 8,
    textAlign: "center",
  },
  reportCard: {
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderLeftWidth: 4,
    borderLeftColor: "#e74c3c",
    elevation: 2,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  reportId: {
    fontSize: 12,
    color: "#999",
  },
  badgeContainer: {
    position: "relative",
    alignItems: "center",
  },
  unreadDotIndicator: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e74c3c",
    borderWidth: 2,
    borderColor: "#fff",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  reportContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  reportDescription: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  reportFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  footerItem: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: "#999",
    marginBottom: 2,
  },
  value: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    flex: 1,
    marginTop: 40,
    backgroundColor: "#fff",
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
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  detailsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  section: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
  },
  inlineBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  descriptionBox: {
    marginTop: 12,
  },
  descriptionContent: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  descriptionText: {
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
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
    alignItems: "flex-start",
  },
  userBubbleWrapper: {
    alignItems: "flex-end",
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  adminBubble: {
    backgroundColor: "#f0f0f0",
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: "#0a66c2",
    borderBottomRightRadius: 4,
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
    color: "#333",
  },
  userSender: {
    color: "#fff",
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
    color: "#333",
  },
  userMessageText: {
    color: "#fff",
  },
  responseBox: {
    backgroundColor: "#f9f9f9",
    borderLeftWidth: 3,
    borderLeftColor: "#ff6b35",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  responseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  responseFrom: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ff6b35",
  },
  responseTime: {
    fontSize: 11,
    color: "#999",
  },
  responseText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 18,
  },
  noResponses: {
    fontSize: 13,
    color: "#999",
    fontStyle: "italic",
    paddingVertical: 12,
    textAlign: "center",
  },
  responseInput: {
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#333",
    textAlignVertical: "top",
    minHeight: 100,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: "#e74c3c",
    flexDirection: "row",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default MyBugReportsScreen;
