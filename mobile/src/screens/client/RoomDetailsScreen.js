import React, { useState, useEffect, useContext } from "react";
import { useIsFocused } from "@react-navigation/native";
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
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { roomService } from "../../services/apiService";

const colors = {
  primary: "#bdb246",
  dark: "#1a1a1a",
  lightGray: "#f5f5f5",
  border: "#e0e0e0",
  success: "#27ae60",
  danger: "#e74c3c",
};

const WATER_BILL_PER_DAY = 5; // ₱5 per day

const RoomDetailsScreen = ({ route, navigation }) => {
  const { roomId } = route.params;
  const { state } = useContext(AuthContext);
  const isFocused = useIsFocused();
  const [room, setRoom] = useState(null);
  const [billing, setBilling] = useState(null);
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

      // Billing is included in room data
      setBilling({
        billing: room.billing,
        members: room.members,
      });
      console.log("RoomDetailsScreen - billing set to:", {
        billing: room.billing,
        members: room.members,
      });
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
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Room not found</Text>
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
      {/* Room Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerContent}>
          <Text style={styles.roomName}>{room.name}</Text>
          <View style={styles.roomMeta}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={styles.roomCode}>Code: {room.code}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.shareButton} onPress={handleShareRoom}>
          <MaterialIcons name="share" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Room Description */}
      {room.description && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.description}>{room.description}</Text>
        </View>
      )}

      {/* Billing Summary */}
      {billing?.billing?.start && billing?.billing?.end ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="receipt" size={24} color={colors.primary} />
            <Text style={styles.cardTitle}>Billing Summary</Text>
          </View>

          <View style={styles.billingGrid}>
            <View style={styles.billingItem}>
              <Text style={styles.billingLabel}>Period</Text>
              <Text style={styles.billingValue}>
                {formatDate(billing?.billing?.start)} -{" "}
                {formatDate(billing?.billing?.end)}
              </Text>
            </View>
            <View style={styles.billingItem}>
              <Text style={styles.billingLabel}>Total Rent</Text>
              <Text style={styles.billingValue}>
                ₱{billing?.billing?.rent || "0"}
              </Text>
            </View>
            <View style={styles.billingItem}>
              <Text style={styles.billingLabel}>Total Electricity</Text>
              <Text style={styles.billingValue}>
                ₱{billing?.billing?.electricity || "0"}
              </Text>
            </View>
            <View style={styles.billingItem}>
              <Text style={styles.billingLabel}>Total Water</Text>
              <Text style={[styles.billingValue, { color: "#2196F3" }]}>
                ₱{calculateTotalWaterBill().toFixed(2)}
              </Text>
            </View>
            <View style={styles.billingItem}>
              <Text style={[styles.billingLabel, { fontWeight: "700" }]}>
                Grand Total
              </Text>
              <Text
                style={[
                  styles.billingValue,
                  { color: colors.success, fontWeight: "700" },
                ]}
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

          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={() => navigation.navigate("Billing", { roomId: room._id })}
          >
            <Text style={styles.viewDetailsButtonText}>
              View Full Billing Details
            </Text>
            <MaterialIcons
              name="arrow-forward"
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="receipt" size={24} color={colors.primary} />
            <Text style={styles.cardTitle}>Billing Summary</Text>
          </View>
          <Text style={styles.emptyText}>No Active Billing Cycle</Text>
        </View>
      )}

      {/* Members */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="group" size={24} color={colors.primary} />
          <Text style={styles.cardTitle}>
            Members ({room.members?.length || 0})
          </Text>
        </View>

        {room.members && room.members.length > 0 ? (
          <View>
            {room.members.map((member, index) => (
              <View key={index}>
                <View style={styles.memberItem}>
                  <View style={styles.memberInfo}>
                    {member.user?.avatar?.url ? (
                      <Image
                        source={{ uri: member.user.avatar.url }}
                        style={styles.memberAvatarImage}
                      />
                    ) : (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {(member.user?.name || "U").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.memberName}>
                        {member.user?.name || "Unknown"}
                      </Text>
                      {/* <Text style={styles.memberEmail}>
                        {member.user?.email || "N/A"}
                      </Text> */}
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
                {index < room.members.length - 1 && (
                  <View style={styles.separator} />
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No members yet</Text>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryAction]}
          onPress={() => navigation.navigate("Presence", { roomId: room._id })}
        >
          <MaterialIcons name="calendar-today" size={20} color="white" />
          <Text style={styles.actionButtonText}>Mark Presence</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryAction]}
          onPress={() => navigation.navigate("Billing", { roomId: room._id })}
        >
          <MaterialIcons name="receipt" size={20} color={colors.primary} />
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>
            View Billing
          </Text>
        </TouchableOpacity>
      </View>

      {/* Created Info */}
      <View style={styles.infoCard}>
        <View style={styles.infoItem}>
          <MaterialIcons name="info" size={16} color="#999" />
          <Text style={styles.infoText}>
            Created on {formatDate(room.createdAt)}
          </Text>
        </View>
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
  headerCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerContent: {
    flex: 1,
  },
  roomName: {
    fontSize: 22,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  roomMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roomCode: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.dark,
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  billingGrid: {
    marginBottom: 12,
  },
  billingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  billingLabel: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  billingValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.dark,
  },
  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lightGray,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  viewDetailsButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.lightGray,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 14,
  },
  memberAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.lightGray,
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
    marginVertical: 12,
  },
  actionsCard: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  primaryAction: {
    backgroundColor: colors.primary,
  },
  secondaryAction: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "white",
  },
  infoCard: {
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: "#666",
  },
  errorText: {
    fontSize: 16,
    color: colors.danger,
    textAlign: "center",
  },
});

export default RoomDetailsScreen;
