import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
} from "react-native";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import { apiService } from "../../services/apiService";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

const AdminBillingDetailsScreen = ({ navigation }) => {
  const route = useRoute();
  const { room, cycleId } = route.params || {};

  const [breakdown, setBreakdown] = useState(null);
  const [collectionStatus, setCollectionStatus] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMember, setExpandedMember] = useState(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [actualCycleId, setActualCycleId] = useState(cycleId);

  const fetchBillingDetails = useCallback(async () => {
    try {
      setLoading(true);

      // If cycleId not provided, try to get active cycle from the room
      let idToUse = actualCycleId;
      if (!idToUse && room) {
        try {
          const cycleResponse = await apiService.get(
            `/api/v2/billing-cycles/active/${room._id}`,
          );
          if (cycleResponse.data?._id) {
            idToUse = cycleResponse.data._id;
            setActualCycleId(idToUse);
          }
        } catch (error) {
          console.error("Error fetching active cycle:", error);
        }
      }

      if (!idToUse) {
        Alert.alert("Error", "No active billing cycle found");
        setLoading(false);
        return;
      }

      // Fetch breakdown
      const response = await apiService.get(
        `/api/v2/admin/billing/breakdown/${idToUse}`,
      );

      setBreakdown(response.breakdown);

      // Fetch collection status
      const statusResponse = await apiService.get(
        `/api/v2/admin/billing/collection-status/${idToUse}`,
      );

      setCollectionStatus(statusResponse);

      // Fetch export data
      const exportResponse = await apiService.get(
        `/api/v2/admin/billing/export/${idToUse}`,
      );

      setExportData(exportResponse.exportData || {});
    } catch (error) {
      console.error("Error fetching billing details:", error);
      Alert.alert("Error", "Failed to load billing details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actualCycleId, cycleId, room?._id]);

  useEffect(() => {
    fetchBillingDetails();
  }, [fetchBillingDetails]);

  // Refetch data when screen comes into focus (handles new cycle creation)
  useFocusEffect(
    useCallback(() => {
      // Reset actualCycleId so it fetches the active cycle fresh
      setActualCycleId(null);
      // Small delay to ensure backend is updated
      const timer = setTimeout(() => {
        fetchBillingDetails();
      }, 500);
      return () => clearTimeout(timer);
    }, [room?._id]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBillingDetails();
  }, [fetchBillingDetails]);

  const handleExportData = async () => {
    try {
      const date = new Date().toLocaleDateString();
      const roomName = breakdown?.roomName || "Room";
      const cycleNumber = breakdown?.cycleNumber || "N/A";
      const timestamp = new Date().getTime();
      const fileName = `Billing_Cycle_${cycleNumber}_${timestamp}.html`;

      // Generate HTML content
      const htmlContent = `
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 20px;
                color: #333;
                background-color: #f5f5f5;
              }
              .container {
                background-color: white;
                padding: 30px;
                max-width: 900px;
                margin: 0 auto;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 3px solid #2E86AB;
                padding-bottom: 15px;
              }
              .header h1 {
                margin: 0 0 10px 0;
                color: #2E86AB;
                font-size: 28px;
              }
              .header p {
                margin: 5px 0;
                color: #666;
                font-size: 14px;
              }
              .section {
                margin-bottom: 30px;
              }
              .section-title {
                background-color: #2E86AB;
                color: white;
                padding: 12px 15px;
                margin-bottom: 15px;
                font-weight: bold;
                font-size: 14px;
              }
              .summary-row {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid #eee;
              }
              .summary-row.total {
                background-color: #f0f0f0;
                font-weight: bold;
                padding: 10px;
                margin-top: 10px;
                border-left: 4px solid #2E86AB;
              }
              .member-item {
                border: 1px solid #ddd;
                padding: 12px;
                margin-bottom: 10px;
                border-radius: 4px;
                background-color: #f9f9f9;
              }
              .member-name {
                font-weight: bold;
                font-size: 14px;
                margin-bottom: 8px;
                color: #2E86AB;
              }
              .member-detail {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                font-size: 13px;
              }
              .amount {
                text-align: right;
                font-weight: 500;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
              }
              th {
                background-color: #f0f0f0;
                padding: 10px;
                text-align: left;
                border: 1px solid #ddd;
                font-weight: bold;
                font-size: 13px;
              }
              td {
                padding: 10px;
                border: 1px solid #ddd;
                font-size: 13px;
              }
              .status-paid {
                color: #4CAF50;
                font-weight: bold;
              }
              .status-pending {
                color: #FF9800;
                font-weight: bold;
              }
              .total-section {
                background-color: #f9f9f9;
                padding: 15px;
                margin-top: 20px;
                border-left: 4px solid #2E86AB;
              }
              .total-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                font-size: 14px;
              }
              .total-row.highlight {
                font-weight: bold;
                font-size: 16px;
                padding: 12px 0;
              }
              .footer {
                margin-top: 30px;
                padding-top: 15px;
                border-top: 1px solid #ddd;
                text-align: center;
                font-size: 12px;
                color: #999;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📋 Billing Statement</h1>
                <p><strong>${roomName}</strong></p>
                <p>Billing Cycle #${cycleNumber}</p>
                <p>Generated: ${date}</p>
              </div>

              <div class="section">
                <div class="section-title">Billing Period & Summary</div>
                <div class="summary-row">
                  <span>Period:</span>
                  <span>${new Date(breakdown?.startDate).toLocaleDateString()} - ${new Date(breakdown?.endDate).toLocaleDateString()}</span>
                </div>
                <div class="summary-row">
                  <span>Rent:</span>
                  <span class="amount">₱${breakdown?.billBreakdown.rent.total.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                  <span>Electricity:</span>
                  <span class="amount">₱${breakdown?.billBreakdown.electricity.total.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                  <span>Water:</span>
                  <span class="amount">₱${breakdown?.billBreakdown.water.total.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                  <span>Internet:</span>
                  <span class="amount" style="color: #9c27b0; font-weight: bold;">₱${breakdown?.billBreakdown.internet.total.toFixed(2)}</span>
                </div>
                <div class="summary-row total">
                  <span>Total Billed:</span>
                  <span class="amount">₱${breakdown?.totalBilled.toFixed(2)}</span>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Member Charges</div>
                ${breakdown?.memberBreakdown
                  .map(
                    (member) => `
                  <div class="member-item">
                    <div class="member-name">${member.memberName}</div>
                    <div class="member-detail">
                      <span>Presence Days:</span>
                      <span>${member.presenceDays}</span>
                    </div>
                    <div class="member-detail">
                      <span>Rent Share:</span>
                      <span>₱${member.rentShare.toFixed(2)}</span>
                    </div>
                    <div class="member-detail">
                      <span>Electricity Share:</span>
                      <span>₱${member.electricityShare.toFixed(2)}</span>
                    </div>
                    <div class="member-detail">
                      <span>Water Share:</span>
                      <span>₱${member.waterShare.toFixed(2)}</span>
                    </div>
                    <div class="member-detail">
                      <span>Internet Share:</span>
                      <span>₱${member.internetShare.toFixed(2)}</span>
                    </div>
                    <div class="member-detail" style="font-weight: bold; margin-top: 8px; border-top: 1px solid #ddd; padding-top: 8px;">
                      <span>Total Due:</span>
                      <span>₱${member.totalDue.toFixed(2)}</span>
                    </div>
                  </div>
                `,
                  )
                  .join("")}
              </div>

              <div class="section">
                <div class="section-title">Payment Status</div>
                <table>
                  <tr>
                    <th>Member</th>
                    <th>Rent</th>
                    <th>Electricity</th>
                    <th>Water</th>
                    <th>Total Due</th>
                  </tr>
                  ${collectionStatus?.memberStatus
                    .map(
                      (member) => `
                    <tr>
                      <td>${member.memberName}</td>
                      <td class="status-${member.rentStatus}">${member.rentStatus.toUpperCase()}</td>
                      <td class="status-${member.electricityStatus}">${member.electricityStatus.toUpperCase()}</td>
                      <td class="status-${member.waterStatus}">${member.waterStatus.toUpperCase()}</td>
                      <td>₱${member.totalDue.toFixed(2)}</td>
                    </tr>
                  `,
                    )
                    .join("")}
                </table>
              </div>

              <div class="total-section">
                <div class="total-row">
                  <span>Total Due:</span>
                  <span>₱${collectionStatus?.summary?.totalDue.toFixed(2)}</span>
                </div>
                <div class="total-row">
                  <span>Total Collected:</span>
                  <span style="color: #4CAF50;">₱${collectionStatus?.summary?.totalPaid.toFixed(2)}</span>
                </div>
                <div class="total-row">
                  <span>Pending:</span>
                  <span style="color: #FF9800;">₱${collectionStatus?.summary?.totalPending.toFixed(2)}</span>
                </div>
              </div>

              <div class="footer">
                <p>This is an automatically generated billing statement.</p>
                <p>For inquiries, please contact the room admin.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      // Write HTML to file
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, htmlContent);

      // Share the file
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/html",
        dialogTitle: `Billing Statement - Cycle ${cycleNumber}`,
      });

      Alert.alert("Success", "Billing statement exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("Error", "Failed to export billing statement");
    }
  };

  const renderMemberBreakdown = ({ item }) => {
    const isExpanded = expandedMember === item.userId;

    return (
      <TouchableOpacity
        style={styles.memberCard}
        onPress={() => setExpandedMember(isExpanded ? null : item.userId)}
      >
        <View style={styles.memberHeader}>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{item.memberName}</Text>
            <Text style={styles.memberStatus}>
              {item.isPayer ? "Payer" : "Non-Payer"}
            </Text>
          </View>
          <Text style={styles.memberTotal}>₱{item.totalDue.toFixed(2)}</Text>
        </View>

        {isExpanded && (
          <View style={styles.memberDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Presence Days</Text>
              <Text style={styles.detailValue}>{item.presenceDays}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Rent Share</Text>
              <Text style={styles.detailValue}>
                ₱{item.rentShare.toFixed(2)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Electricity Share</Text>
              <Text style={styles.detailValue}>
                ₱{item.electricityShare.toFixed(2)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Water Share</Text>
              <Text style={styles.detailValue}>
                ₱{item.waterShare.toFixed(2)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Internet Share</Text>
              <Text style={styles.detailValue}>
                ₱{item.internetShare.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.detailRow, styles.totalRow]}>
              <Text style={styles.detailLabel}>Total Due</Text>
              <Text style={styles.totalValue}>₱{item.totalDue.toFixed(2)}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderPaymentStatus = ({ item }) => {
    const allPaid =
      item.rentStatus === "paid" &&
      item.electricityStatus === "paid" &&
      item.waterStatus === "paid" &&
      item.internetStatus === "paid";

    return (
      <View style={styles.paymentStatusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusMemberName}>{item.memberName}</Text>
          {allPaid ? (
            <View style={styles.allPaidBadge}>
              <Text style={styles.allPaidText}>✓ All Paid</Text>
            </View>
          ) : (
            <View style={styles.partialPaidBadge}>
              <Text style={styles.partialPaidText}>Partial</Text>
            </View>
          )}
        </View>

        <View style={styles.statusGrid}>
          <View
            style={[
              styles.statusItem,
              {
                backgroundColor:
                  item.rentStatus === "paid" ? "#E8F5E9" : "#FFF3E0",
              },
            ]}
          >
            <Text style={styles.billType}>RENT</Text>
            <Text
              style={[
                styles.statusBadge,
                {
                  color: item.rentStatus === "paid" ? "#4CAF50" : "#FF9800",
                },
              ]}
            >
              {item.rentStatus}
            </Text>
            <Text style={styles.statusAmount}>
              ₱{item.rentAmount.toFixed(2)}
            </Text>
          </View>

          <View
            style={[
              styles.statusItem,
              {
                backgroundColor:
                  item.electricityStatus === "paid" ? "#E3F2FD" : "#FFF3E0",
              },
            ]}
          >
            <Text style={styles.billType}>ELEC</Text>
            <Text
              style={[
                styles.statusBadge,
                {
                  color:
                    item.electricityStatus === "paid" ? "#2196F3" : "#FF9800",
                },
              ]}
            >
              {item.electricityStatus}
            </Text>
            <Text style={styles.statusAmount}>
              ₱{item.electricityAmount.toFixed(2)}
            </Text>
          </View>

          <View
            style={[
              styles.statusItem,
              {
                backgroundColor:
                  item.waterStatus === "paid" ? "#E0F2F1" : "#FFF3E0",
              },
            ]}
          >
            <Text style={styles.billType}>WATER</Text>
            <Text
              style={[
                styles.statusBadge,
                {
                  color: item.waterStatus === "paid" ? "#009688" : "#FF9800",
                },
              ]}
            >
              {item.waterStatus}
            </Text>
            <Text style={styles.statusAmount}>
              ₱{item.waterAmount.toFixed(2)}
            </Text>
          </View>

          <View
            style={[
              styles.statusItem,
              {
                backgroundColor:
                  item.internetStatus === "paid" ? "#F3E5F5" : "#FFF3E0",
              },
            ]}
          >
            <Text style={styles.billType}>INTERNET</Text>
            <Text
              style={[
                styles.statusBadge,
                {
                  color: item.internetStatus === "paid" ? "#9C27B0" : "#FF9800",
                },
              ]}
            >
              {item.internetStatus}
            </Text>
            <Text style={styles.statusAmount}>
              ₱{item.internetAmount.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading billing details...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Billing Details</Text>
        <Text style={styles.headerSubtitle}>
          Cycle #{breakdown?.cycleNumber}
        </Text>
      </View>

      {/* Cycle Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Billing Summary</Text>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Room</Text>
          <Text style={styles.summaryValue}>{breakdown?.roomName}</Text>

          <View style={styles.divider} />

          <Text style={styles.summaryLabel}>Period</Text>
          <Text style={styles.summaryValue}>
            {new Date(breakdown?.startDate).toLocaleDateString()} -{" "}
            {new Date(breakdown?.endDate).toLocaleDateString()}
          </Text>

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryColumn}>
              <Text style={styles.summaryLabel}>Rent</Text>
              <Text style={styles.summaryAmount}>
                ₱{breakdown?.billBreakdown.rent.total.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryColumn}>
              <Text style={styles.summaryLabel}>Electricity</Text>
              <Text style={styles.summaryAmount}>
                ₱{breakdown?.billBreakdown.electricity.total.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryColumn}>
              <Text style={styles.summaryLabel}>Water</Text>
              <Text style={styles.summaryAmount}>
                ₱{breakdown?.billBreakdown.water.total.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryColumn}>
              <Text style={styles.summaryLabel}>Internet</Text>
              <Text style={styles.summaryAmount}>
                ₱{breakdown?.billBreakdown.internet.total.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalBilledRow}>
            <Text style={styles.totalLabel}>Total Billed</Text>
            <Text style={styles.totalAmount}>
              ₱{breakdown?.totalBilled.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Member Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Member Charges</Text>
        <FlatList
          data={breakdown?.memberBreakdown}
          renderItem={renderMemberBreakdown}
          keyExtractor={(item) => item.userId}
          scrollEnabled={false}
        />
      </View>

      {/* Collection Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Status</Text>
        <View style={styles.collectionSummary}>
          <View style={styles.collectionItem}>
            <Text style={styles.collectionLabel}>Total Due</Text>
            <Text style={styles.collectionValue}>
              ₱{collectionStatus?.summary?.totalDue.toFixed(2)}
            </Text>
          </View>
          <View style={styles.collectionItem}>
            <Text style={styles.collectionLabel}>Collected</Text>
            <Text style={[styles.collectionValue, { color: "#4CAF50" }]}>
              ₱{collectionStatus?.summary?.totalPaid.toFixed(2)}
            </Text>
          </View>
          <View style={styles.collectionItem}>
            <Text style={styles.collectionLabel}>Pending</Text>
            <Text style={[styles.collectionValue, { color: "#FF9800" }]}>
              ₱{collectionStatus?.summary?.totalPending.toFixed(2)}
            </Text>
          </View>
        </View>

        <FlatList
          data={collectionStatus?.memberStatus}
          renderItem={renderPaymentStatus}
          keyExtractor={(item) => item.userId}
          scrollEnabled={false}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setExportModalVisible(true)}
        >
          <Text style={styles.actionBtnText}>📊 Export Billing Data</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#FF6B6B" }]}
          onPress={() =>
            navigation.navigate("Adjustments", { room, cycleId: actualCycleId })
          }
        >
          <Text style={styles.actionBtnText}>⚙️ Adjust Charges</Text>
        </TouchableOpacity>
      </View>

      {/* Export Modal */}
      <Modal visible={exportModalVisible} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Export Billing Data</Text>

            <Text style={styles.exportInfo}>
              Export this billing cycle as JSON for records or further
              processing.
            </Text>

            <View style={styles.exportDetails}>
              <Text style={styles.exportLabel}>
                Room: {breakdown?.roomName}
              </Text>
              <Text style={styles.exportLabel}>
                Cycle #{breakdown?.cycleNumber}
              </Text>
              <Text style={styles.exportLabel}>
                Total: ₱{breakdown?.totalBilled.toFixed(2)}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setExportModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportBtn}
                onPress={() => {
                  handleExportData();
                  setExportModalVisible(false);
                }}
              >
                <Text style={styles.confirmBtnText}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.spacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  header: {
    backgroundColor: "#2E86AB",
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#E0E0E0",
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  summaryColumn: {
    flex: 1,
    alignItems: "center",
  },
  summaryAmount: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2E86AB",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#EEE",
    marginVertical: 12,
  },
  totalBilledRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: "#2E86AB",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E86AB",
  },
  memberCard: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
    overflow: "hidden",
  },
  memberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  memberStatus: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
  },
  memberTotal: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#2E86AB",
  },
  memberDetails: {
    backgroundColor: "#F9F9F9",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: "#666",
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#DDD",
    paddingTopVertical: 8,
    marginTop: 8,
  },
  totalValue: {
    fontWeight: "bold",
    color: "#2E86AB",
  },
  collectionSummary: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  collectionItem: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  collectionLabel: {
    fontSize: 11,
    color: "#999",
    marginBottom: 4,
  },
  collectionValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2E86AB",
  },
  paymentStatusCard: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusMemberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  allPaidBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  allPaidText: {
    color: "#4CAF50",
    fontSize: 11,
    fontWeight: "bold",
  },
  partialPaidBadge: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  partialPaidText: {
    color: "#FF9800",
    fontSize: 11,
    fontWeight: "bold",
  },
  statusGrid: {
    flexDirection: "row",
    gap: 8,
  },
  statusItem: {
    flex: 1,
    borderRadius: 6,
    padding: 8,
    alignItems: "center",
  },
  billType: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 4,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "capitalize",
  },
  statusAmount: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#333",
  },
  actionSection: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 8,
  },
  actionBtn: {
    backgroundColor: "#2196F3",
    borderRadius: 8,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    width: "85%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  exportInfo: {
    fontSize: 13,
    color: "#666",
    marginBottom: 16,
    lineHeight: 18,
  },
  exportDetails: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  exportLabel: {
    fontSize: 12,
    color: "#666",
    marginVertical: 4,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#333",
    fontWeight: "600",
    fontSize: 13,
  },
  exportBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 13,
  },
  spacing: {
    height: 20,
  },
});

export default AdminBillingDetailsScreen;
