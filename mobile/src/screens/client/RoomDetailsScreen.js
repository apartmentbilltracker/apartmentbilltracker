import React, { useState, useEffect, useContext, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  RefreshControl,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const WATER_BILL_PER_DAY = 5;

const RoomDetailsScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { roomId } = route.params;
  const { state } = useContext(AuthContext);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRoomDetails();
  }, [roomId]);

  // Refetch whenever user profile changes (name or avatar)
  useEffect(() => {
    console.log("User profile changed, refetching room details");
    fetchRoomDetails();
  }, [state.user?.name, state.user?.avatar?.url]);

  const fetchRoomDetails = async () => {
    try {
      setLoading(true);
      console.log("Fetching room details for:", roomId);
      const roomResponse = await roomService.getRoomById(roomId);
      const roomData = roomResponse.data || roomResponse;
      console.log("RoomDetailsScreen - Room data:", roomData);

      // Extract the room object (it might be wrapped)
      const room = roomData.room || roomData;
      console.log("RoomDetailsScreen - room members:", room?.members);
      setRoom(room);
    } catch (error) {
      console.error("Error fetching room details:", error.message);
      console.error("Error details:", error);
      Alert.alert("Error", "Failed to load room details");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRoomDetails();
    setRefreshing(false);
  };

  const handleShareRoom = async () => {
    try {
      const roomCode = room?.code || "N/A";
      await Share.share({
        message: `Join my apartment room! Room Code: ${roomCode}`,
        title: room?.name,
      });
    } catch (error) {
      console.error("Error sharing room:", error);
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString();
  };

  const calculateTotalWaterBill = () => {
    if (!room?.members) return 0;
    let totalDays = 0;
    room.members.forEach((member) => {
      const presenceDays = member.presence ? member.presence.length : 0;
      totalDays += presenceDays;
    });
    return totalDays * WATER_BILL_PER_DAY;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.textSecondary}
        />
        <Text style={styles.errText}>Room not found</Text>
      </View>
    );
  }

  const billing = {
    billing: room.billing,
    members: room.members,
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ─── HEADER ─── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerIcon}>
            <Ionicons name="home" size={22} color={colors.accent} />
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShareRoom}>
            <Ionicons name="share-outline" size={18} color={colors.accent} />
          </TouchableOpacity>
        </View>
        <Text style={styles.roomName}>{room.name}</Text>
        <View style={styles.codePill}>
          <Ionicons name="key-outline" size={13} color={colors.accent} />
          <Text style={styles.codeText}>Code: {room.code}</Text>
        </View>
      </View>

      {/* ─── DESCRIPTION ─── */}
      {room.description && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.accent}
            />
            <Text style={styles.cardTitle}>About</Text>
          </View>
          <Text style={styles.descText}>{room.description}</Text>
        </View>
      )}

      {/* ─── BILLING SUMMARY ─── */}
      {billing?.billing?.start && billing?.billing?.end ? (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="receipt-outline" size={18} color={colors.accent} />
            <Text style={styles.cardTitle}>Billing Summary</Text>
          </View>

          {/* Period strip */}
          <View style={styles.periodStrip}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.periodText}>
              {formatDate(billing.billing.start)} —{" "}
              {formatDate(billing.billing.end)}
            </Text>
          </View>

          {/* Bill rows */}
          {[
            {
              label: "Rent",
              icon: "home",
              color: "#e65100",
              value: billing.billing.rent,
            },
            {
              label: "Electricity",
              icon: "flash",
              color: colors.electricityColor,
              value: billing.billing.electricity,
            },
            {
              label: "Water",
              icon: "water",
              color: colors.waterColor,
              value: calculateTotalWaterBill(),
            },
            {
              label: "Internet",
              icon: "wifi",
              color: colors.internetColor,
              value: billing.billing.internet,
            },
          ].map((item, idx) => (
            <View key={idx} style={styles.billRow}>
              <View style={styles.billRowLeft}>
                <View
                  style={[styles.billDot, { backgroundColor: item.color }]}
                />
                <Ionicons name={item.icon} size={16} color={item.color} />
                <Text style={styles.billLabel}>{item.label}</Text>
              </View>
              <Text style={styles.billValue}>
                ₱
                {parseFloat(item.value || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
          ))}

          {/* Grand total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>
              ₱
              {(
                parseFloat(billing.billing.rent || 0) +
                parseFloat(billing.billing.electricity || 0) +
                calculateTotalWaterBill() +
                parseFloat(billing.billing.internet || 0)
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() =>
              navigation.navigate("Billing", { roomId: room.id || room._id })
            }
            activeOpacity={0.7}
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={colors.accent}
            />
            <Text style={styles.detailsBtnText}>View Full Billing Details</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.accent} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="receipt-outline" size={18} color={colors.accent} />
            <Text style={styles.cardTitle}>Billing Summary</Text>
          </View>
          <View style={styles.emptyState}>
            <Ionicons
              name="time-outline"
              size={32}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyText}>No Active Billing Cycle</Text>
          </View>
        </View>
      )}

      {/* ─── MEMBERS ─── */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="people" size={18} color={colors.accent} />
          <Text style={styles.cardTitle}>Members</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {room.members?.length || 0}
            </Text>
          </View>
        </View>

        {room.members && room.members.length > 0 ? (
          room.members.map((member, index) => (
            <View key={index}>
              <View style={styles.memberRow}>
                <View style={styles.memberLeft}>
                  {member.user?.avatar?.url ? (
                    <Image
                      source={{ uri: member.user.avatar.url }}
                      style={styles.memberAvatar}
                    />
                  ) : (
                    <View style={styles.memberAvatarFallback}>
                      <Text style={styles.memberAvatarLetter}>
                        {(member.user?.name || "U").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.memberName}>
                    {member.user?.name || "Unknown"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.rolePill,
                    member.isPayer
                      ? { backgroundColor: colors.successBg }
                      : { backgroundColor: colors.inputBg },
                  ]}
                >
                  <Ionicons
                    name={member.isPayer ? "checkmark-circle" : "person"}
                    size={12}
                    color={member.isPayer ? colors.success : colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.rolePillText,
                      member.isPayer
                        ? { color: colors.success }
                        : { color: colors.textTertiary },
                    ]}
                  >
                    {member.isPayer ? "Payor" : "Non-Payor"}
                  </Text>
                </View>
              </View>
              {index < room.members.length - 1 && (
                <View style={styles.divider} />
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="person-add-outline"
              size={32}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyText}>No members yet</Text>
          </View>
        )}
      </View>

      {/* ─── AMENITIES ─── */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="sparkles" size={18} color={colors.accent} />
          <Text style={styles.cardTitle}>Amenities</Text>
        </View>
        <View style={styles.amenitiesGrid}>
          {[
            {
              icon: "wifi",
              label: "WiFi",
              bg: colors.infoBg,
              color: colors.waterColor,
            },
            {
              icon: "restaurant",
              label: "Kitchen",
              bg: colors.warningBg,
              color: "#e65100",
            },
            {
              icon: "water",
              label: "Bathroom",
              bg: colors.infoBg,
              color: colors.waterColor,
            },
            {
              icon: "bed",
              label: "Bedroom",
              bg: colors.errorBg,
              color: colors.error,
            },
            {
              icon: "flame",
              label: "Hot Water",
              bg: colors.accentSurface,
              color: colors.electricityColor,
            },
            {
              icon: "people",
              label: "Common Area",
              bg: colors.successBg,
              color: colors.success,
            },
          ].map((item, idx) => (
            <View key={idx} style={styles.amenityItem}>
              <View style={[styles.amenityIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={styles.amenityLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ─── HOUSE RULES ─── */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="clipboard-outline" size={18} color={colors.accent} />
          <Text style={styles.cardTitle}>House Rules</Text>
        </View>
        {[
          "Quiet hours: 10 PM – 7 AM",
          "Keep common areas clean at all times",
          "Guests must be informed in advance",
          "Share responsibility for utilities",
          "No smoking inside the room",
        ].map((rule, idx) => (
          <View key={idx} style={styles.ruleRow}>
            <View style={styles.ruleCheck}>
              <Ionicons
                name="checkmark"
                size={12}
                color={colors.textOnAccent}
              />
            </View>
            <Text style={styles.ruleText}>{rule}</Text>
          </View>
        ))}
      </View>

      {/* ─── QUICK ACTIONS ─── */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionPrimary}
          onPress={() =>
            navigation.navigate("Presence", { roomId: room.id || room._id })
          }
          activeOpacity={0.7}
        >
          <Ionicons name="calendar" size={18} color={colors.textOnAccent} />
          <Text style={styles.actionPrimaryText}>Mark Presence</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionOutline}
          onPress={() =>
            navigation.navigate("Billing", { roomId: room.id || room._id })
          }
          activeOpacity={0.7}
        >
          <Ionicons name="receipt-outline" size={18} color={colors.accent} />
          <Text style={styles.actionOutlineText}>View Billing</Text>
        </TouchableOpacity>
      </View>

      {/* ─── FOOTER INFO ─── */}
      <View style={styles.footerInfo}>
        <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
        <Text style={styles.footerText}>
          Created {formatDate(room.created_at || room.createdAt)}
        </Text>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    errText: {
      fontSize: 15,
      color: colors.textTertiary,
      marginTop: 10,
    },

    /* ─── Header ─── */
    header: {
      backgroundColor: colors.card,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      marginBottom: 6,
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    headerIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
    },
    shareBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
    },
    roomName: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
    },
    codePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: colors.accentSurface,
    },
    codeText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },

    /* ─── Cards ─── */
    card: {
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
    },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },

    /* ─── Description ─── */
    descText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
    },

    /* ─── Billing ─── */
    periodStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.cardAlt,
      borderRadius: 8,
      marginBottom: 12,
    },
    periodText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    billRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    billRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    billDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    billLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    billValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    totalValue: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.success,
    },
    detailsBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      backgroundColor: colors.accentSurface,
      borderRadius: 10,
      marginTop: 10,
    },
    detailsBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },

    /* ─── Members ─── */
    countBadge: {
      backgroundColor: colors.inputBg,
      paddingHorizontal: 9,
      paddingVertical: 2,
      borderRadius: 10,
    },
    countBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
    },
    memberLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    memberAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.inputBg,
    },
    memberAvatarFallback: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
    },
    memberAvatarLetter: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.accent,
    },
    memberName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    rolePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    rolePillText: {
      fontSize: 11,
      fontWeight: "600",
    },
    divider: {
      height: 1,
      backgroundColor: colors.inputBg,
    },

    /* ─── Amenities ─── */
    amenitiesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    amenityItem: {
      width: "30%",
      alignItems: "center",
      marginBottom: 4,
    },
    amenityIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    amenityLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.textSecondary,
      textAlign: "center",
    },

    /* ─── House Rules ─── */
    ruleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 10,
    },
    ruleCheck: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.success,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 1,
    },
    ruleText: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },

    /* ─── Quick Actions ─── */
    actionsRow: {
      flexDirection: "row",
      gap: 10,
      marginHorizontal: 16,
      marginTop: 14,
    },
    actionPrimary: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
    },
    actionPrimaryText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
    },
    actionOutline: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionOutlineText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "600",
    },

    /* ─── Footer ─── */
    footerInfo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 16,
    },
    footerText: {
      fontSize: 12,
      color: colors.textTertiary,
    },

    /* ─── Empty State ─── */
    emptyState: {
      alignItems: "center",
      paddingVertical: 20,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 8,
    },
  });

export default RoomDetailsScreen;
