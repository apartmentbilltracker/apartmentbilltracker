import React, { useState, useContext, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
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
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { billingCycleService, roomService } from "../../services/apiService";
import { roundTo2 as r2 } from "../../utils/helpers";
import { useTheme } from "../../theme/ThemeContext";

const WATER_BILL_PER_DAY = 5;

/** Return only the presence dates that fall within a billing cycle's date range */
const filterPresenceByDates = (presenceArr, startDate, endDate) => {
  if (!presenceArr || !startDate || !endDate) return presenceArr || [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return presenceArr.filter((d) => {
    const pd = new Date(d);
    return pd >= start && pd <= end;
  });
};

const getBillColors = (c) => ({
  rent: "#e65100",
  electricity: c.electricityColor,
  water: c.waterColor,
  internet: c.internetColor,
});

const BillingScreen = ({ route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const BILL_COLORS = getBillColors(colors);

  const { roomId } = route.params;
  const { state } = useContext(AuthContext);
  const [billing, setBilling] = useState(null);
  const [activeCycle, setActiveCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchBilling();
    }, [roomId]),
  );

  const fetchBilling = async () => {
    try {
      setLoading(true);
      const response = await roomService.getRoomById(roomId);
      const data = response.data || response;
      const room = data.room || data;

      setBilling({
        billing: room.billing,
        members: room.members,
      });

      await fetchActiveBillingCycle(roomId);
    } catch (error) {
      Alert.alert("Error", "Failed to load billing information");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveBillingCycle = async (rid) => {
    try {
      const response = await billingCycleService.getBillingCycles(rid);
      // FIX: response is { success, billingCycles: [...] } after extractData
      const cycles = Array.isArray(response)
        ? response
        : response?.billingCycles || response?.data || [];

      const active = cycles.find((c) => c.status === "active");
      setActiveCycle(active || null);
    } catch (error) {
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
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const calculateTotalWaterBill = () => {
    if (!billing?.members) return 0;
    const startDate = billing.billing?.start;
    const endDate = billing.billing?.end;
    let totalDays = 0;
    billing.members.forEach((member) => {
      totalDays += filterPresenceByDates(member.presence, startDate, endDate).length;
    });
    return totalDays * WATER_BILL_PER_DAY;
  };

  const getPayorCount = () => {
    if (!billing?.members) return 1;
    const count = billing.members.filter((m) => m.isPayer).length;
    return count > 0 ? count : 1;
  };

  const calculateShare = (amount, payorCount) => {
    if (!amount || payorCount <= 0) return 0;
    return r2(amount / payorCount);
  };

  const calculatePayorWaterShare = () => {
    if (!billing?.members) return 0;

    // Use active billing cycle data if populated
    if (
      activeCycle?.memberCharges?.length > 0 &&
      (state?.user?.id || state?.user?._id)
    ) {
      const currentUserCharge = activeCycle.memberCharges.find(
        (c) => String(c.userId) === String(state.user.id || state.user._id),
      );
      if (currentUserCharge?.isPayer) {
        return currentUserCharge.waterBillShare || 0;
      }
    }

    // Fallback calculation
    const startDate = billing.billing?.start;
    const endDate = billing.billing?.end;
    const totalPayorCount =
      (billing.members || []).filter((m) => m.isPayer !== false).length || 1;

    const myMember = billing.members.find(
      (m) =>
        String(m.user?.id || m.user?._id || m.user) ===
        String(state?.user?.id || state?.user?._id),
    );

    if (!myMember || !myMember.isPayer) return 0;

    const myOwnWater = filterPresenceByDates(myMember.presence, startDate, endDate).length * WATER_BILL_PER_DAY;

    let nonPayorWater = 0;
    billing.members.forEach((member) => {
      if (!member.isPayer || member.isPayer === false) {
        nonPayorWater += filterPresenceByDates(member.presence, startDate, endDate).length * WATER_BILL_PER_DAY;
      }
    });

    return r2(
      myOwnWater + (totalPayorCount > 0 ? nonPayorWater / totalPayorCount : 0),
    );
  };

  const getPayorWaterBreakdown = () => {
    if (!billing?.members) return null;

    // PRIORITY 1: Use backend-computed breakdown from activeCycle
    if (
      activeCycle?.memberCharges?.length > 0 &&
      (state?.user?.id || state?.user?._id)
    ) {
      const currentUserCharge = activeCycle.memberCharges.find(
        (c) => String(c.userId) === String(state.user.id || state.user._id),
      );
      if (currentUserCharge?.isPayer) {
        const myOwnWater = currentUserCharge.waterOwn || 0;
        const sharedNonPayorWater = currentUserCharge.waterSharedNonpayor || 0;
        const payorCount =
          activeCycle.memberCharges.filter((c) => c.isPayer).length || 1;
        return {
          myOwnWater,
          nonPayorWater: r2(sharedNonPayorWater * payorCount),
          sharedNonPayorWater,
          payorCount,
          totalWaterShare:
            currentUserCharge.waterBillShare ||
            r2(myOwnWater + sharedNonPayorWater),
        };
      }
    }

    // FALLBACK
    const startDate = billing.billing?.start;
    const endDate = billing.billing?.end;
    const totalPayorCount =
      (billing.members || []).filter((m) => m.isPayer !== false).length || 1;

    const myPresenceDays =
      filterPresenceByDates(
        billing.members.find(
          (m) =>
            String(m.user?.id || m.user?._id || m.user) ===
            String(state?.user?.id || state?.user?._id),
        )?.presence,
        startDate,
        endDate,
      ).length;
    const myOwnWater = myPresenceDays * WATER_BILL_PER_DAY;

    let nonPayorWater = 0;
    billing.members.forEach((member) => {
      if (!member.isPayer || member.isPayer === false) {
        nonPayorWater += filterPresenceByDates(member.presence, startDate, endDate).length * WATER_BILL_PER_DAY;
      }
    });

    const sharedNonPayorWater =
      totalPayorCount > 0 ? r2(nonPayorWater / totalPayorCount) : 0;

    return {
      myOwnWater,
      nonPayorWater,
      sharedNonPayorWater,
      payorCount: totalPayorCount,
      totalWaterShare: r2(myOwnWater + sharedNonPayorWater),
    };
  };

  // ── helpers ──
  const payorCount = getPayorCount();

  // PRIORITY 1: Use backend-computed shares from activeCycle (single source of truth)
  const currentUserCharge =
    activeCycle?.memberCharges?.length > 0
      ? activeCycle.memberCharges.find(
          (c) =>
            String(c.userId) === String(state?.user?.id || state?.user?._id),
        )
      : null;

  let rentShare, elecShare, waterShare, netShare, totalShare;
  if (currentUserCharge?.isPayer) {
    rentShare = currentUserCharge.rentShare || 0;
    elecShare = currentUserCharge.electricityShare || 0;
    waterShare = currentUserCharge.waterBillShare || 0;
    netShare = currentUserCharge.internetShare || 0;
    totalShare = currentUserCharge.totalDue || 0;
  } else {
    // FALLBACK: local calculation when backend data unavailable
    rentShare = calculateShare(billing?.billing?.rent, payorCount);
    elecShare = calculateShare(billing?.billing?.electricity, payorCount);
    waterShare = calculatePayorWaterShare();
    netShare = r2((billing?.billing?.internet || 0) / payorCount);
    totalShare = r2(rentShare + elecShare + waterShare + netShare);
  }
  const waterBreakdown = getPayorWaterBreakdown();

  const grandTotal =
    parseFloat(billing?.billing?.rent || 0) +
    parseFloat(billing?.billing?.electricity || 0) +
    calculateTotalWaterBill() +
    parseFloat(billing?.billing?.internet || 0);

  // ── render ──
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading billing…</Text>
      </View>
    );
  }

  const billItems = [
    {
      label: "Rent",
      icon: "home-outline",
      color: BILL_COLORS.rent,
      amount: billing?.billing?.rent || 0,
    },
    {
      label: "Electricity",
      icon: "flash-outline",
      color: BILL_COLORS.electricity,
      amount: billing?.billing?.electricity || 0,
    },
    {
      label: "Water",
      icon: "water-outline",
      color: BILL_COLORS.water,
      amount: calculateTotalWaterBill(),
    },
    {
      label: "Internet",
      icon: "wifi-outline",
      color: BILL_COLORS.internet,
      amount: billing?.billing?.internet || 0,
    },
  ];

  const shareItems = [
    { label: "Rent", color: BILL_COLORS.rent, amount: rentShare },
    { label: "Electricity", color: BILL_COLORS.electricity, amount: elecShare },
    {
      label: "Water",
      color: BILL_COLORS.water,
      amount: waterShare,
      breakdown: waterBreakdown,
    },
    { label: "Internet", color: BILL_COLORS.internet, amount: netShare },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#b38604"]}
          tintcolor={colors.accent}
        />
      }
    >
      {/* ── Billing Period ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View
            style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.accent} />
          </View>
          <Text style={styles.cardTitle}>Billing Period</Text>
        </View>

        <View style={styles.periodRow}>
          <View style={styles.periodItem}>
            <Text style={styles.periodLabel}>Start</Text>
            <Text style={styles.periodValue}>
              {formatDate(billing?.billing?.start)}
            </Text>
          </View>
          <View style={styles.periodDivider}>
            <Ionicons name="arrow-forward" size={16} color={colors.accent} />
          </View>
          <View style={styles.periodItem}>
            <Text style={styles.periodLabel}>End</Text>
            <Text style={styles.periodValue}>
              {formatDate(billing?.billing?.end)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Billing Summary ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View
            style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}
          >
            <Ionicons name="receipt-outline" size={20} color={colors.accent} />
          </View>
          <Text style={styles.cardTitle}>Billing Summary</Text>
        </View>

        {billItems.map((item) => (
          <View key={item.label} style={styles.billRow}>
            <View style={styles.billRowLeft}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Ionicons
                name={item.icon}
                size={18}
                color={item.color}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.billLabel}>{item.label}</Text>
            </View>
            <Text style={[styles.billAmount, { color: item.color }]}>
              ₱{parseFloat(item.amount).toFixed(2)}
            </Text>
          </View>
        ))}

        <View style={styles.grandTotalBar}>
          <Text style={styles.grandTotalLabel}>Grand Total</Text>
          <Text style={styles.grandTotalAmount}>₱{grandTotal.toFixed(2)}</Text>
        </View>
      </View>

      {/* ── Your Share ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: "#27ae6015" }]}>
            <Ionicons name="person-outline" size={20} color="#27ae60" />
          </View>
          <Text style={styles.cardTitle}>Your Share</Text>
          <View style={styles.payorPill}>
            <Ionicons name="people-outline" size={13} color={colors.accent} />
            <Text style={styles.payorPillText}>
              {payorCount} payor{payorCount > 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {shareItems.map((item) => (
          <View key={item.label} style={styles.shareRow}>
            <View style={styles.shareRowLeft}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <View>
                <Text style={styles.shareLabel}>{item.label}</Text>
                {item.breakdown && item.breakdown.sharedNonPayorWater > 0 && (
                  <Text style={styles.shareNote}>
                    Own ₱{item.breakdown.myOwnWater.toFixed(2)} + shared ₱
                    {item.breakdown.sharedNonPayorWater.toFixed(2)}
                  </Text>
                )}
              </View>
            </View>
            <Text style={[styles.shareAmount, { color: item.color }]}>
              ₱{item.amount.toFixed(2)}
            </Text>
          </View>
        ))}

        <View style={styles.totalShareBar}>
          <Text style={styles.totalShareLabel}>Your Total</Text>
          <Text style={styles.totalShareAmount}>₱{totalShare.toFixed(2)}</Text>
        </View>
      </View>

      {/* ── Room Members ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: "#1565c015" }]}>
            <Ionicons name="people-outline" size={20} color={colors.info} />
          </View>
          <Text style={styles.cardTitle}>Room Members</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {billing?.members?.length || 0}
            </Text>
          </View>
        </View>

        {billing?.members && billing.members.length > 0 ? (
          billing.members.map((member, index) => {
            const isCurrentUser =
              String(member.user?.id || member.user?._id || member.user) ===
              String(state?.user?.id || state?.user?._id);
            return (
              <View key={index}>
                <View style={styles.memberRow}>
                  {member.user?.avatar?.url ? (
                    <Image
                      source={{ uri: member.user.avatar.url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarLetter}>
                        {(member.user?.name || "U").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.memberInfo}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Text style={styles.memberName}>
                        {member.user?.name || "Unknown"}
                      </Text>
                      {isCurrentUser && (
                        <View style={styles.youChip}>
                          <Text style={styles.youChipText}>You</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.memberEmail}>
                      {member.user?.email || "N/A"}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.roleBadge,
                      member.isPayer ? styles.payorBadge : styles.nonPayorBadge,
                    ]}
                  >
                    <Ionicons
                      name={
                        member.isPayer
                          ? "checkmark-circle"
                          : "remove-circle-outline"
                      }
                      size={12}
                      color={member.isPayer ? "#27ae60" : colors.textTertiary}
                      style={{ marginRight: 3 }}
                    />
                    <Text
                      style={
                        member.isPayer ? styles.payorText : styles.nonPayorText
                      }
                    >
                      {member.isPayer ? "Payor" : "Non-Payor"}
                    </Text>
                  </View>
                </View>
                {index < billing.members.length - 1 && (
                  <View style={styles.separator} />
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="people-outline"
              size={36}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyText}>No members found</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

/* ── Styles ── */
const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 16,
    },
    centered: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textTertiary,
    },

    /* card */
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },
    iconCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },

    /* billing period */
    periodRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 14,
    },
    periodItem: {
      flex: 1,
      alignItems: "center",
    },
    periodLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    periodValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    periodDivider: {
      width: 28,
      alignItems: "center",
    },

    /* bill rows */
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    billRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    billRowLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    billLabel: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "500",
    },
    billAmount: {
      fontSize: 15,
      fontWeight: "700",
    },
    grandTotalBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "#27ae6012",
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginTop: 12,
      borderLeftWidth: 3,
      borderLeftColor: "#27ae60",
    },
    grandTotalLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: "#27ae60",
    },
    grandTotalAmount: {
      fontSize: 18,
      fontWeight: "800",
      color: "#27ae60",
    },

    /* payor pill */
    payorPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.accentLight,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    payorPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.accent,
      marginLeft: 4,
    },

    /* share rows */
    shareRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    shareRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    shareLabel: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "500",
    },
    shareNote: {
      fontSize: 10,
      color: colors.textTertiary,
      fontStyle: "italic",
      marginTop: 2,
    },
    shareAmount: {
      fontSize: 15,
      fontWeight: "700",
    },
    totalShareBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.accentLight,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginTop: 12,
      borderLeftWidth: 3,
      borderLeftColor: "#b38604",
    },
    totalShareLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },
    totalShareAmount: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.accent,
    },

    /* count badge */
    countBadge: {
      backgroundColor: "#1565c015",
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      minWidth: 24,
      alignItems: "center",
    },
    countBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.waterColor,
    },

    /* members */
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
    },
    avatarPlaceholder: {
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarLetter: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
    },
    memberInfo: {
      flex: 1,
      marginLeft: 12,
    },
    memberName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    memberEmail: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    youChip: {
      backgroundColor: colors.accentLight,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 1,
      marginLeft: 6,
    },
    youChipText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.accent,
    },
    roleBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    payorBadge: {
      backgroundColor: "#27ae6015",
    },
    nonPayorBadge: {
      backgroundColor: colors.inputBg,
    },
    payorText: {
      fontSize: 11,
      fontWeight: "600",
      color: "#27ae60",
    },
    nonPayorText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.skeleton,
      marginLeft: 50,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 24,
    },
    emptyText: {
      marginTop: 8,
      fontSize: 13,
      color: colors.textTertiary,
    },
  });

export default BillingScreen;
