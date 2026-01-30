import React, { useState, useEffect, useContext } from "react";
import { useIsFocused } from "@react-navigation/native";
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
import { billingService, roomService } from "../../services/apiService";

const colors = {
  primary: "#bdb246",
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    } catch (error) {
      console.error("Error fetching billing:", error.message);
      console.error("Error details:", error);
      Alert.alert("Error", "Failed to load billing information");
    } finally {
      setLoading(false);
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

  const calculateShare = (amount, totalMembers) => {
    if (!amount || !totalMembers) return 0;
    return amount / totalMembers;
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

        <View style={styles.billingRow}>
          <View>
            <Text style={styles.label}>Total Rent</Text>
            <Text style={styles.amount}>₱{billing?.billing?.rent || "0"}</Text>
          </View>
          <View style={styles.dividerVertical} />
          <View>
            <Text style={styles.label}>Total Electricity</Text>
            <Text style={styles.amount}>
              ₱{billing?.billing?.electricity || "0"}
            </Text>
          </View>
          <View style={styles.dividerVertical} />
          <View>
            <Text style={styles.label}>Total Water</Text>
            <Text style={[styles.amount, { color: "#2196F3" }]}>
              ₱{calculateTotalWaterBill().toFixed(2)}
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={styles.label}>Grand Total</Text>
          <Text
            style={[styles.amount, { color: colors.success, fontSize: 20 }]}
          >
            ₱
            {(
              parseFloat(billing?.billing?.rent || 0) +
              parseFloat(billing?.billing?.electricity || 0) +
              calculateTotalWaterBill()
            ).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Per-Member Breakdown */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="people" size={24} color={colors.primary} />
          <Text style={styles.cardTitle}>Per Payor Breakdown</Text>
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
            <Text style={styles.label}>Water per Payor</Text>
            <Text style={[styles.value, { color: "#2196F3" }]}>
              ₱
              {calculateShare(
                calculateTotalWaterBill(),
                getPayorCount(),
              ).toFixed(2)}
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
                calculateShare(billing?.billing?.rent, getPayorCount()) +
                calculateShare(billing?.billing?.electricity, getPayorCount()) +
                calculateShare(calculateTotalWaterBill(), getPayorCount())
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
});

export default BillingScreen;
