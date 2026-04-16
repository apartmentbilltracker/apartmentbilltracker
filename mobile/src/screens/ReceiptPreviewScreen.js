import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { AuthContext } from "../context/AuthContext";
import { roomService, billingCycleService } from "../services/apiService";

const ReceiptPreviewScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.state?.user;
  const userId = currentUser?.id || currentUser?._id;

  const [receiptType, setReceiptType] = useState("cash");
  const [loading, setLoading] = useState(true);
  const [receiptData, setReceiptData] = useState(null);

  // Fetch real data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await roomService.getClientRooms();
        const rooms =
          response?.data?.rooms || response?.rooms || response || [];

        if (rooms.length > 0) {
          const firstRoom = rooms[0];
          const roomId = firstRoom.id || firstRoom._id;

          // Fetch billing data
          const cycles = await billingCycleService.getBillingCycles(roomId);
          const cycles_arr = Array.isArray(cycles)
            ? cycles
            : cycles?.billingCycles || cycles?.data || [];
          const activeCycle = cycles_arr.find((c) => c.status === "active");

          // Get member info
          const memberInfo = firstRoom.members?.find(
            (m) =>
              String(m.user?.id || m.user?._id || m.user) === String(userId),
          );

          // Calculate bill shares
          let billShares = {
            rent: 0,
            electricity: 0,
            internet: 0,
            water: 0,
            total: 0,
          };

          if (activeCycle?.memberCharges?.length > 0) {
            const userCharge = activeCycle.memberCharges.find(
              (c) => String(c.userId) === String(userId),
            );
            if (userCharge) {
              billShares = {
                rent: userCharge.rentShare || 0,
                electricity: userCharge.electricityShare || 0,
                internet: userCharge.internetShare || 0,
                water:
                  userCharge.isPayer !== false
                    ? userCharge.waterBillShare || 0
                    : userCharge.waterOwn || 0,
                total: userCharge.totalDue || 0,
              };
            }
          }

          const joinedDate = memberInfo?.joinedAt || memberInfo?.joined_at;
          const status = memberInfo?.isPayer ? "Payor" : "Non-Payor";

          setReceiptData({
            receiptNumber: `RCP${Date.now()}`.slice(0, 12),
            referenceNumber: `REF${Math.random().toString().slice(2, 8).toUpperCase()}`,
            roomName: firstRoom.name || "Room",
            clientName: currentUser?.name || "Tenant",
            status: status,
            memberSince: joinedDate
              ? new Date(joinedDate).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "Unknown",
            location: firstRoom.address || firstRoom.location || "Apartment",
            rent: billShares.rent,
            electricity: billShares.electricity,
            internet: billShares.internet,
            water: billShares.water,
            total: billShares.total,
          });
        } else {
          // Fallback sample data if no rooms
          setReceiptData({
            receiptNumber: "RCP20260416001",
            referenceNumber: "REFABC123",
            roomName: "Room 101",
            clientName: currentUser?.name || "John Smith",
            status: "Payor",
            memberSince: "Jan 15, 2025",
            location: "Apartment Address",
            rent: 5000,
            electricity: 800,
            internet: 500,
            water: 600,
            total: 6900,
          });
        }
      } catch (error) {
        console.error("Error fetching receipt data:", error);
        // Fallback sample data on error
        setReceiptData({
          receiptNumber: "RCP20260416001",
          referenceNumber: "REFABC123",
          roomName: "Room 101",
          clientName: currentUser?.name || "John Smith",
          status: "Payor",
          memberSince: "Jan 15, 2025",
          location: "Apartment Address",
          rent: 5000,
          electricity: 800,
          internet: 500,
          water: 600,
          total: 6900,
        });
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Receipt Preview</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ marginTop: 10, color: colors.text }}>
            Loading receipt data...
          </Text>
        </View>
      ) : (
        <>
          {/* Type Selector */}
          <View style={styles.typeSelector}>
            {["cash", "bank", "gcash"].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  receiptType === type && styles.typeButtonActive,
                ]}
                onPress={() => setReceiptType(type)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    receiptType === type && styles.typeButtonTextActive,
                  ]}
                >
                  {type === "cash"
                    ? "Cash"
                    : type === "bank"
                      ? "Bank"
                      : "GCash"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Receipt Preview */}
          <ScrollView
            style={styles.previewScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.receiptContainer}>
              {receiptData && (
                <>
                  {/* Title */}
                  <View style={styles.titleRow}>
                    <Text style={styles.receiptTitle}>
                      {receiptType === "cash"
                        ? "CASH RECEIPT"
                        : receiptType === "bank"
                          ? "BANK TRANSFER RECEIPT"
                          : "GCASH RECEIPT"}
                    </Text>
                    <Text style={styles.titleSubtitle}>
                      Apartment Bill Tracker
                    </Text>
                  </View>

                  {/* Dashed Line */}
                  <Text style={styles.dashedLine}>
                    {Array(46).fill("-").join("")}
                  </Text>

                  {/* Receipt Header Info */}
                  <View style={styles.headerInfo}>
                    <View style={styles.headerRow}>
                      <Text style={styles.headerLabelRight}>
                        Room: {receiptData.roomName}
                      </Text>
                      <Text style={styles.headerLabel}>
                        Receipt No. {receiptData.receiptNumber}
                      </Text>
                    </View>
                    {(receiptType === "cash" || receiptType === "gcash") && (
                      <View style={styles.headerRow}>
                        <Text style={styles.headerLabel}>
                          Ref No. {receiptData.referenceNumber}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Date */}
                  <View style={styles.dateSection}>
                    <Text style={styles.dateText}>
                      {new Date().toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}{" "}
                      {new Date().toLocaleTimeString("en-PH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>

                  {/* Dashed Line */}
                  <Text style={styles.dashedLine}>
                    {Array(46).fill("-").join("")}
                  </Text>

                  {/* Client Section */}
                  <Text style={styles.sectionTitle}>Client Information</Text>
                  <View style={styles.clientInfo}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Name</Text>
                      <Text style={styles.infoValue}>
                        : {receiptData.clientName}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Status</Text>
                      <Text style={styles.infoValue}>
                        : {receiptData.status}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Member Since</Text>
                      <Text style={styles.infoValue}>
                        : {receiptData.memberSince}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Location</Text>
                      <Text style={styles.infoValue}>
                        : {receiptData.location}
                      </Text>
                    </View>
                  </View>

                  {/* Dashed Line */}
                  <Text style={styles.dashedLine}>
                    {Array(46).fill("-").join("")}
                  </Text>

                  {/* Cost Breakdown */}
                  <View style={styles.costBreakdown}>
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Rent</Text>
                      <Text style={styles.costDots}>
                        {Array(26).fill(".").join("")}
                      </Text>
                      <Text style={styles.costAmount}>
                        ₱{receiptData.rent.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Electricity</Text>
                      <Text style={styles.costDots}>
                        {Array(26).fill(".").join("")}
                      </Text>
                      <Text style={styles.costAmount}>
                        ₱{receiptData.electricity.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Internet</Text>
                      <Text style={styles.costDots}>
                        {Array(26).fill(".").join("")}
                      </Text>
                      <Text style={styles.costAmount}>
                        ₱{receiptData.internet.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Water</Text>
                      <Text style={styles.costDots}>
                        {Array(26).fill(".").join("")}
                      </Text>
                      <Text style={styles.costAmount}>
                        ₱{receiptData.water.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Dashed Line */}
                  <Text style={styles.dashedLine}>
                    {Array(46).fill("-").join("")}
                  </Text>

                  {/* Total */}
                  <View style={styles.totalSection}>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>TOTAL</Text>
                      <Text style={styles.totalDots}>
                        {Array(26).fill(".").join("")}
                      </Text>
                      <Text style={styles.totalAmount}>
                        ₱{receiptData.total.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Card Info - only shown for bank transfers and gcash */}
                  {(receiptType === "bank" || receiptType === "gcash") && (
                    <>
                      <View style={styles.cardSection}>
                        <Text style={styles.cardNumber}>
                          XXXX XXXX XXXX 1234
                        </Text>
                        <Text style={styles.cardType}>
                          {receiptType === "bank" ? "TRANSFER/" : "GCASH/"}
                          {receiptData.roomName}
                        </Text>
                      </View>

                      {/* Dashed Line */}
                      <Text style={styles.dashedLine}>
                        {Array(46).fill("-").join("")}
                      </Text>
                    </>
                  )}

                  {/* Barcode */}
                  <View style={styles.barcodeSection}>
                    <View style={styles.barcode}>
                      {Array(30)
                        .fill(0)
                        .map((_, i) => (
                          <View
                            key={i}
                            style={{
                              width: Math.random() > 0.4 ? 1.5 : 4,
                              height: Math.random() > 0.1 ? 30 : 30,
                              backgroundColor: "#333",
                              marginHorizontal: 0.3,
                            }}
                          />
                        ))}
                    </View>
                    <Text style={styles.barcodeNumber}>
                      Receipt Barcode Number
                    </Text>
                  </View>

                  {/* Dashed Line */}
                  <Text style={styles.dashedLine}>
                    {Array(46).fill("-").join("")}
                  </Text>

                  {/* Thank You */}
                  <Text style={styles.thankYouText}>
                    THANK YOU FOR TRUSTING!
                  </Text>

                  {/* Footer */}
                  <Text style={styles.footerText}>
                    Host your apartment with us and experience hassle-free
                    management and seamless payments. Visit our website to learn
                    more about our services and how we can help you manage your
                    property efficiently.
                  </Text>
                  <Text style={styles.websiteText}>
                    www.apartmentbilltracker-ph.onrender.com
                  </Text>
                </>
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Enhancement Note */}
          <View style={styles.enhancementNote}>
            <Text style={styles.noteText}>
              💡 This receipt displays your actual bill breakdown. Payor share
              includes: Rent, Electricity, Internet + shared water bills from
              non-payors.
            </Text>
          </View>
        </>
      )}
    </SafeAreaView>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    typeSelector: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    typeButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    typeButtonActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    typeButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    typeButtonTextActive: {
      color: colors.textOnAccent,
    },
    previewScroll: {
      flex: 1,
    },
    receiptContainer: {
      backgroundColor: "#f5f5f5",
      paddingHorizontal: 16,
      paddingVertical: 20,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 16,
    },
    titleRow: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    titleSubtitle: {
      fontSize: 9,
      color: "#666",
      letterSpacing: 1,
    },
    receiptTitle: {
      textAlign: "center",
      fontSize: 16,
      fontWeight: "bold",
      marginBottom: 2,
      letterSpacing: 2,
      color: "#333",
    },
    dashedLine: {
      textAlign: "center",
      fontSize: 10,
      color: "#999",
      marginBottom: 10,
      letterSpacing: 1,
    },
    headerInfo: {
      marginBottom: 2,
    },
    headerRow: {
      flexDirection: "column",
      marginBottom: 2,
      justifyContent: "space-between",
    },
    headerLabel: {
      fontSize: 9,
      color: "#333",
      flex: 0.5,
    },
    headerLabelRight: {
      fontSize: 9,
      color: "#333",
      flex: 0.5,
    },
    dateSection: {
      marginBottom: 10,
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "end",
    },
    referenceText: {
      fontSize: 9,
      color: "#333",
      textAlign: "left",
    },
    refLabel: {
      fontSize: 9,
      color: "#333",
      textAlign: "right",
    },
    dateText: {
      fontSize: 9,
      color: "#333",
      textAlign: "right",
    },
    sectionTitle: {
      fontSize: 9,
      fontWeight: "600",
      marginBottom: 4,
      color: "#333",
    },
    clientInfo: {
      marginBottom: 10,
    },
    infoRow: {
      flexDirection: "row",
      marginBottom: 1,
    },
    infoLabel: {
      fontSize: 8,
      color: "#333",
      width: "40%",
    },
    infoValue: {
      fontSize: 8,
      color: "#333",
    },
    billsBreakdown: {
      marginBottom: 8,
    },
    billItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    billItemLabel: {
      fontSize: 8,
      color: "#333",
      flex: 0.65,
    },
    billItemAmount: {
      fontSize: 8,
      color: "#333",
      textAlign: "right",
      width: "35%",
    },
    costBreakdown: {
      marginBottom: 8,
      paddingBottom: 8,
    },
    costRow: {
      flexDirection: "row",
      marginBottom: 3,
      alignItems: "center",
    },
    costLabel: {
      fontSize: 8,
      color: "#333",
      fontWeight: "600",
      flex: 0.3,
    },
    costDots: {
      fontSize: 8,
      color: "#999",
      flex: 1,
      letterSpacing: 1,
    },
    costAmount: {
      fontSize: 8,
      color: "#333",
      textAlign: "right",
      width: "25%",
    },
    totalSection: {
      marginBottom: 8,
    },
    totalRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    totalLabel: {
      fontSize: 10,
      fontWeight: "bold",
      color: "#333",
      flex: 0.3,
    },
    totalDots: {
      fontSize: 8,
      color: "#999",
      flex: 1,
      letterSpacing: 1,
    },
    totalAmount: {
      fontSize: 11,
      fontWeight: "bold",
      color: "#333",
      textAlign: "right",
      width: "28%",
    },
    cardSection: {
      marginBottom: 8,
      alignItems: "center",
    },
    cardNumber: {
      fontSize: 8,
      color: "#333",
      letterSpacing: 2,
      marginBottom: 4,
      fontWeight: "600",
    },
    cardType: {
      fontSize: 7,
      color: "#666",
      letterSpacing: 1,
    },
    barcodeSection: {
      marginBottom: 8,
      alignItems: "center",
      justifyContent: "center",
      height: 45,
    },
    barcode: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "center",
      marginBottom: 2,
    },
    barcodeNumber: {
      fontSize: 7,
      color: "#333",
      letterSpacing: 1.5,
      marginTop: 2,
    },
    thankYouText: {
      textAlign: "center",
      fontSize: 11,
      fontWeight: "bold",
      marginBottom: 6,
      letterSpacing: 1,
      color: "#333",
    },
    footerText: {
      textAlign: "center",
      fontSize: 7,
      color: "#666",
      marginBottom: 1,
    },
    websiteText: {
      textAlign: "center",
      fontSize: 7,
      color: "#999",
      marginTop: 2,
    },
    enhancementNote: {
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    noteText: {
      fontSize: 12,
      color: colors.text,
      fontWeight: "500",
    },
  });

export default ReceiptPreviewScreen;
