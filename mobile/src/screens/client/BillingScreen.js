import React, { useState, useEffect, useContext } from "react";
import { useIsFocused, useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import {
  billingService,
  billingCycleService,
  roomService,
} from "../../services/apiService";

const colors = {
  primary: "#b38604",
  dark: "#1a1a1a",
  lightGray: "#f5f5f5",
  border: "#e0e0e0",
  danger: "#e74c3c",
  success: "#27ae60",
  warning: "#f39c12",
};

const WATER_BILL_PER_DAY = 5; // ₱5 per day

const BillingScreen = ({ route }) => {
  const { roomId } = route.params;
  const { state } = useContext(AuthContext);
  const isFocused = useIsFocused();
  const [billing, setBilling] = useState(null);
  const [activeCycle, setActiveCycle] = useState(null); // Active billing cycle with memberCharges
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Guaranteed refresh when screen comes into focus (e.g., after new billing cycle created)
  useFocusEffect(
    React.useCallback(() => {
      console.log(
        "🔄🔄 BillingScreen - useFocusEffect TRIGGERED (guaranteed fresh data after cycle creation)",
      );
      const forceRefresh = async () => {
        try {
          // Wait for backend to process any new cycle creation
          console.log(
            "⏳ Waiting 2 seconds for backend to process new billing cycle...",
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
          console.log("📡 Fetching fresh billing data NOW...");
          await fetchBilling();
        } catch (error) {
          console.error("❌ Error in BillingScreen useFocusEffect:", error);
        }
      };
      forceRefresh();
    }, [roomId]),
  );

  useEffect(() => {
    fetchBilling();
  }, [roomId]);

  // Refetch whenever user profile changes (name or avatar)
  useEffect(() => {
    console.log("User profile changed, refetching billing");
    fetchBilling();
  }, [state.user?.name, state.user?.avatar?.url]);

  const fetchBilling = async () => {
    try {
      setLoading(true);
      console.log("Fetching billing for room:", roomId);
      // Get room data which includes billing
      const response = await roomService.getRoomById(roomId);
      console.log("BillingScreen - Room response:", response);
      const data = response.data || response;
      const room = data.room || data;
      console.log("BillingScreen - room members:", room?.members);

      setBilling({
        billing: room.billing,
        members: room.members,
      });
      console.log("BillingScreen - billing set to:", {
        billing: room.billing,
        members: room.members,
      });

      // CRITICAL: Fetch active billing cycle BEFORE marking as loaded
      // This ensures activeCycle is available for accurate water calculations
      console.log("🔄 Fetching active billing cycle before rendering charges...");
      await fetchActiveBillingCycle(roomId);
      console.log("✅ Active billing cycle loaded - ready to render accurate charges");
    } catch (error) {
      console.error("Error fetching billing:", error.message);
      console.error("Error details:", error);
      Alert.alert("Error", "Failed to load billing information");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveBillingCycle = async (roomId) => {
    try {
      console.log("Fetching active billing cycle for room:", roomId);
      const response = await billingCycleService.getBillingCycles(roomId);
      const cycles = response?.data || response || [];

      // Find active cycle
      const active = cycles.find((c) => c.status === "active");
      if (active) {
        setActiveCycle(active);
        console.log(
          "Active cycle found:",
          active._id,
          "with memberCharges:",
          active.memberCharges,
        );
      } else {
        setActiveCycle(null);
      }
    } catch (error) {
      console.error("Error fetching active billing cycle:", error);
      setActiveCycle(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBilling();
    setRefreshing(false);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString();
  };

  const calculateTotalWaterBill = () => {
    // Total water = ALL members' presence days × ₱5 (including non-payors)
    if (!billing?.members) return 0;
    let totalDays = 0;
    billing.members.forEach((member) => {
      const presenceDays = member.presence ? member.presence.length : 0;
      totalDays += presenceDays;
    });
    return totalDays * WATER_BILL_PER_DAY;
  };

  const getPayorCount = () => {
    if (!billing?.members) return 1;
    const payorCount = billing.members.filter((m) => m.isPayer).length;
    return payorCount > 0 ? payorCount : 1;
  };

  // Simple share calculator: divide amount by payor count
  // This is fallback for when activeCycle is not available
  const calculateShare = (amount, payorCount) => {
    if (!amount || payorCount <= 0) return 0;
    return amount / payorCount;
  };

  // Get current user's charges from active cycle if available
  const getCurrentUserChargesFromCycle = () => {
    if (!activeCycle?.memberCharges || !state?.user?._id) return null;
    return activeCycle.memberCharges.find(
      (c) => String(c.userId) === String(state.user._id),
    );
  };

  const calculatePayorWaterShare = () => {
    // Each payor's water = their own presence × ₱5 + (non-payors' water / payor count)
    if (!billing?.members) return 0;

    // PRIORITY 1: Use active billing cycle data if available (backend pre-calculated, most accurate)
    if (activeCycle?.memberCharges && state?.user?._id) {
      console.log(
        `💧 BillingScreen calculatePayorWaterShare: Using activeCycle memberCharges (most accurate)`,
      );
      const currentUserCharge = activeCycle.memberCharges.find(
        (c) => String(c.userId) === String(state.user._id),
      );
      if (currentUserCharge && currentUserCharge.isPayer) {
        console.log(
          `   ✅ Found user charge water share: ${currentUserCharge.waterBillShare} (from pre-calculated backend data)`,
        );
        return currentUserCharge.waterBillShare || 0;
      }
    }

    // FALLBACK: Only used if activeCycle is not yet loaded (shouldn't happen in normal flow)
    // This fallback is intentionally SIMPLE to avoid calculation inconsistencies
    console.log(
      `⚠️ BillingScreen calculatePayorWaterShare: No activeCycle loaded yet, using simple fallback`,
    );
    console.warn(
      "   ⚠️ NOTICE: Water calculation is using fallback (activeCycle not loaded). This should be rare!",
    );

    // Simple fallback: just count all members with isPayer set to true
    const totalPayorCount = (billing.members || []).filter(
      (m) => m.isPayer !== false,
    ).length || 1;
    
    // Find current user
    const myMember = billing.members.find(
      (m) => String(m.user?._id || m.user) === String(state?.user?._id),
    );
    
    if (!myMember || !myMember.isPayer) {
      return 0; // Non-payors don't pay water
    }

    // Calculate this user's water share: own consumption + split non-payor water
    const myPresenceDays = myMember.presence ? myMember.presence.length : 0;
    const myOwnWater = myPresenceDays * WATER_BILL_PER_DAY;

    let nonPayorWater = 0;
    billing.members.forEach((member) => {
      if (!member.isPayer || member.isPayer === false) {
        const presenceDays = member.presence ? member.presence.length : 0;
        nonPayorWater += presenceDays * WATER_BILL_PER_DAY;
      }
    });

    const sharedNonPayorWater =
      totalPayorCount > 0 ? nonPayorWater / totalPayorCount : 0;
    const totalWaterShare = myOwnWater + sharedNonPayorWater;

    console.log(
      `   Fallback calc: own=${myOwnWater}, shared=${sharedNonPayorWater}, total=${totalWaterShare} (totalPayors=${totalPayorCount})`,
    );
    return totalWaterShare;
  };

  // Get water breakdown details for display (shows own consumption vs split non-payor water)
  const getPayorWaterBreakdown = () => {
    if (!billing?.members) return null;

    // Use same calculation as calculatePayorWaterShare for consistency
    const totalPayorCount = (billing.members || []).filter(
      (m) => m.isPayer !== false,
    ).length || 1;

    const myPresenceDays =
      billing.members.find(
        (m) => String(m.user?._id || m.user) === String(state?.user?._id),
      )?.presence?.length || 0;
    const myOwnWater = myPresenceDays * WATER_BILL_PER_DAY;

    let nonPayorWater = 0;
    billing.members.forEach((member) => {
      if (!member.isPayer || member.isPayer === false) {
        const presenceDays = member.presence ? member.presence.length : 0;
        nonPayorWater += presenceDays * WATER_BILL_PER_DAY;
      }
    });

    const sharedNonPayorWater =
      totalPayorCount > 0 ? nonPayorWater / totalPayorCount : 0;
    const totalWaterShare = myOwnWater + sharedNonPayorWater;

    return {
      myOwnWater,
      nonPayorWater,
      sharedNonPayorWater,
      payorCount: totalPayorCount,
      totalWaterShare,
    };
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
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
      {/* Billing Period Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons
            name="calendar-today"
            size={24}
            color={colors.primary}
          />
          <Text style={styles.cardTitle}>Billing Period</Text>
        </View>
        <View style={styles.billingPeriod}>
          <View style={styles.dateItem}>
            <Text style={styles.label}>Start Date</Text>
            <Text style={styles.dateValue}>
              {formatDate(billing?.billing?.start)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.dateItem}>
            <Text style={styles.label}>End Date</Text>
            <Text style={styles.dateValue}>
              {formatDate(billing?.billing?.end)}
            </Text>
          </View>
        </View>
      </View>

      {/* Billing Summary Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="receipt" size={24} color={colors.primary} />
          <Text style={styles.cardTitle}>Billing Summary</Text>
        </View>

        <View style={styles.billingSummaryContainer}>
          <View style={styles.billingSummaryItem}>
            <Text style={styles.billingSummaryLabel}>Rent</Text>
            <Text style={styles.billingSummaryAmount}>
              ₱{billing?.billing?.rent || "0"}
            </Text>
          </View>
          <View style={styles.billingSummaryItem}>
            <Text style={styles.billingSummaryLabel}>Electricity</Text>
            <Text style={styles.billingSummaryAmount}>
              ₱{billing?.billing?.electricity || "0"}
            </Text>
          </View>
          <View style={styles.billingSummaryItem}>
            <Text style={styles.billingSummaryLabel}>Water</Text>
            <Text style={[styles.billingSummaryAmount, { color: "#2196F3" }]}>
              ₱{calculateTotalWaterBill().toFixed(2)}
            </Text>
          </View>
          <View style={styles.billingSummaryItem}>
            <Text style={styles.billingSummaryLabel}>Internet</Text>
            <Text style={[styles.billingSummaryAmount, { color: "#9c27b0" }]}>
              ₱{billing?.billing?.internet || "0"}
            </Text>
          </View>
        </View>

        <View style={styles.billingSummaryTotal}>
          <Text style={styles.billingSummaryTotalLabel}>Grand Total</Text>
          <Text style={styles.billingSummaryTotalAmount}>
            ₱
            {(
              parseFloat(billing?.billing?.rent || 0) +
              parseFloat(billing?.billing?.electricity || 0) +
              calculateTotalWaterBill() +
              parseFloat(billing?.billing?.internet || 0)
            ).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Per-Member Breakdown */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="people" size={24} color={colors.primary} />
          <Text style={styles.cardTitle}>Your Share</Text>
        </View>

        <View style={styles.memberBreakdown}>
          <View style={styles.breakdownItem}>
            <Text style={styles.label}>Payors</Text>
            <Text style={styles.value}>{getPayorCount()}</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.label}>Rent per Payor</Text>
            <Text style={styles.value}>
              ₱
              {calculateShare(billing?.billing?.rent, getPayorCount()).toFixed(
                2,
              )}
            </Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.label}>Electricity per Payor</Text>
            <Text style={styles.value}>
              ₱
              {calculateShare(
                billing?.billing?.electricity,
                getPayorCount(),
              ).toFixed(2)}
            </Text>
          </View>
          <View style={styles.breakdownItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Water per Payor</Text>
              {getPayorWaterBreakdown() &&
                getPayorWaterBreakdown().sharedNonPayorWater > 0 && (
                  <Text style={styles.breakdownNote}>
                    Your consumption: ₱
                    {getPayorWaterBreakdown().myOwnWater.toFixed(2)} +
                    Non-payors share: ₱
                    {getPayorWaterBreakdown().sharedNonPayorWater.toFixed(2)}
                  </Text>
                )}
            </View>
            <Text style={[styles.value, { color: "#2196F3" }]}>
              ₱{calculatePayorWaterShare().toFixed(2)}
            </Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.label}>Internet per Payor</Text>
            <Text style={styles.value}>
              ₱
              {((billing?.billing?.internet || 0) / getPayorCount()).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.breakdownItem, { borderBottomWidth: 0 }]}>
            <Text style={[styles.label, { fontWeight: "700" }]}>
              Total per Payor
            </Text>
            <Text
              style={[
                styles.value,
                { color: colors.success, fontWeight: "700" },
              ]}
            >
              ₱
              {(
                (billing?.billing?.rent || 0) / getPayorCount() +
                (billing?.billing?.electricity || 0) / getPayorCount() +
                calculatePayorWaterShare() +
                (billing?.billing?.internet || 0) / getPayorCount()
              ).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Members List */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="group" size={24} color={colors.primary} />
          <Text style={styles.cardTitle}>Room Members</Text>
        </View>

        {billing?.members && billing.members.length > 0 ? (
          <View>
            {billing.members.map((member, index) => (
              <View key={index}>
                <View style={styles.memberItem}>
                  <View style={styles.memberInfo}>
                    {member.user?.avatar?.url ? (
                      <Image
                        source={{ uri: member.user.avatar.url }}
                        style={styles.memberAvatar}
                      />
                    ) : (
                      <View style={styles.memberAvatarPlaceholder}>
                        <Text style={styles.memberAvatarText}>
                          {(member.user?.name || "U").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.memberName}>
                        {member.user?.name || "Unknown"}
                      </Text>
                      <Text style={styles.memberEmail}>
                        {member.user?.email || "N/A"}
                      </Text>
                    </View>
                  </View>
                  {member.isPayer && (
                    <View style={styles.payorBadge}>
                      <Text style={styles.payorBadgeText}>Payor</Text>
                    </View>
                  )}
                  {!member.isPayer && (
                    <View style={styles.nonPayorBadge}>
                      <Text style={styles.nonPayorBadgeText}>Non-Payor</Text>
                    </View>
                  )}
                </View>
                {index < billing.members.length - 1 && (
                  <View style={styles.separator} />
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No members found</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
    padding: 12,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    color: colors.dark,
  },
  billingPeriod: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateItem: {
    flex: 1,
    alignItems: "center",
  },
  label: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.dark,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  billingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amount: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 4,
  },
  dividerVertical: {
    width: 1,
    height: 50,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  memberBreakdown: {
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 12,
  },
  breakdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.dark,
  },
  breakdownNote: {
    fontSize: 10,
    color: "#999",
    fontStyle: "italic",
    marginTop: 6,
    marginRight: 8,
    flex: 1,
  },
  memberItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  memberAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.dark,
  },
  memberEmail: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  payorBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  payorBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "white",
  },
  nonPayorBadge: {
    backgroundColor: "#e0e0e0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nonPayorBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginVertical: 20,
  },
  billingSummaryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  billingSummaryItem: {
    width: "48%",
    backgroundColor: colors.lightGray,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  billingSummaryLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 6,
  },
  billingSummaryAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },
  billingSummaryTotal: {
    backgroundColor: colors.success + "15",
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    marginTop: 8,
  },
  billingSummaryTotalLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 6,
  },
  billingSummaryTotalAmount: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.success,
  },
});

export default BillingScreen;
