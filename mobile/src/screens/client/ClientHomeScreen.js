import React, { useContext, useEffect, useState, useMemo} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import {
  roomService,
  memberService,
  billingCycleService,
  apiService,
} from "../../services/apiService";
import { roundTo2 as r2 } from "../../utils/helpers";
import { useTheme } from "../../theme/ThemeContext";

const ClientHomeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { state } = useContext(AuthContext);
  const [userJoinedRoom, setUserJoinedRoom] = useState(null);
  const [unjoinedRooms, setUnjoinedRooms] = useState([]);
  const [pendingRoomIds, setPendingRoomIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expandedStats, setExpandedStats] = useState(false);
  const [activeCycle, setActiveCycle] = useState(null);
  const [statusChangeNotifications, setStatusChangeNotifications] = useState(
    [],
  );

  const userId = state?.user?.id || state?.user?._id;
  const userName = state?.user?.name || "User";

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Check if current user is a payor
  const isCurrentUserPayor = () => {
    if (!userJoinedRoom || !userId) return false;
    const userMember = userJoinedRoom.members.find(
      (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
    );
    return userMember?.isPayer || false;
  };

  // Calculate user's payment status in the room
  const getPaymentStatus = () => {
    if (!userJoinedRoom || !userId) return null;

    const userMember = userJoinedRoom.members.find(
      (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
    );

    if (!userMember) return null;

    // Only show payment status for payors
    if (!userMember.isPayer) return null;

    // Need active billing to show payment status
    if (!userJoinedRoom.billing) return null;

    // FIX: Compare memberPayment's user ID (mp.member) with user's actual ID (userMember.user)
    // NOT with member ID (userMember._id)
    const userPayment = userJoinedRoom.memberPayments?.find(
      (mp) =>
        String(mp.member?.id || mp.member?._id || mp.member) ===
        String(userMember.user?.id || userMember.user?._id || userMember.user),
    );

    // If no payment record found but user is a payor with active billing, default to all unpaid
    const paymentData = userPayment || {
      rentStatus: "unpaid",
      electricityStatus: "unpaid",
      waterStatus: "unpaid",
      internetStatus: "unpaid",
    };

    const allPaid =
      paymentData.rentStatus === "paid" &&
      paymentData.electricityStatus === "paid" &&
      paymentData.waterStatus === "paid" &&
      (paymentData.internetStatus === "paid" ||
        !userJoinedRoom.billing?.internet);

    const pendingCount = [
      paymentData.rentStatus,
      paymentData.electricityStatus,
      paymentData.waterStatus,
      paymentData.internetStatus,
    ].filter((status) => status === "unpaid").length;

    return {
      allPaid,
      pendingCount,
      status: paymentData,
    };
  };

  // Calculate billing countdown
  const getBillingCountdown = () => {
    if (!userJoinedRoom?.billing?.end) return null;

    // CRITICAL: Only show countdown if the current cycle is still active (not completed)
    if (activeCycle && activeCycle.status !== "active") {
      console.log(
        "📌 Billing cycle is",
        activeCycle.status,
        "- hiding countdown",
      );
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(userJoinedRoom.billing.end);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = endDate - today;
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return { daysRemaining: 0, overdue: true, percentage: 100 };
    }

    // Calculate percentage (assuming billing cycle is 30 days)
    const billingStart = new Date(userJoinedRoom.billing.start);
    billingStart.setHours(0, 0, 0, 0);
    const totalDays = Math.ceil(
      (endDate - billingStart) / (1000 * 60 * 60 * 24),
    );
    const daysPassed = totalDays - daysRemaining;
    const percentage = Math.min(100, (daysPassed / totalDays) * 100);

    return {
      daysRemaining,
      overdue: false,
      percentage,
      totalDays,
      billingEnd: endDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    };
  };

  // Calculate current user's water share from presence data
  const WATER_BILL_PER_DAY = 5;
  const calcWaterFromPresence = (members, payorCount) => {
    if (!members?.length) return 0;
    const myMember = members.find(
      (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
    );
    if (!myMember?.isPayer) return 0;

    const myWater = (myMember.presence?.length || 0) * WATER_BILL_PER_DAY;
    let nonPayorWater = 0;
    members.forEach((m) => {
      if (!m.isPayer) {
        nonPayorWater += (m.presence?.length || 0) * WATER_BILL_PER_DAY;
      }
    });
    return r2(myWater + (payorCount > 0 ? nonPayorWater / payorCount : 0));
  };

  // Get expense breakdown for modal
  const getExpenseBreakdown = () => {
    // Use activeCycle memberCharges if populated (backend pre-calculated)
    if (activeCycle?.memberCharges?.length > 0) {
      const payorCount =
        activeCycle.memberCharges.filter((c) => c.isPayer).length || 1;
      const total = activeCycle.totalBilledAmount || 0;

      const userCharge = activeCycle.memberCharges.find(
        (c) => String(c.userId) === String(userId),
      );

      if (userCharge && userCharge.isPayer) {
        const perPayor = userCharge.totalDue || 0;

        return {
          rent: {
            amount: userCharge.rentShare || 0,
            percentage:
              total > 0 ? ((userCharge.rentShare || 0) / total) * 100 : 0,
          },
          electricity: {
            amount: userCharge.electricityShare || 0,
            percentage:
              total > 0
                ? ((userCharge.electricityShare || 0) / total) * 100
                : 0,
          },
          internet: {
            amount: userCharge.internetShare || 0,
            percentage:
              total > 0 ? ((userCharge.internetShare || 0) / total) * 100 : 0,
          },
          water: {
            amount: userCharge.waterBillShare || 0,
            percentage:
              total > 0 ? ((userCharge.waterBillShare || 0) / total) * 100 : 0,
          },
          total,
          perPayor,
          payorCount,
        };
      }
    }

    // Use activeCycle amounts + presence-based water (memberCharges empty or not found)
    const members = userJoinedRoom?.members || [];
    const payorCount = Math.max(
      1,
      members.filter((m) => m.isPayer).length || 1,
    );

    // Get bill amounts from activeCycle or room billing
    const billing = activeCycle
      ? {
          rent: activeCycle.rent || 0,
          electricity: activeCycle.electricity || 0,
          internet: activeCycle.internet || 0,
        }
      : userJoinedRoom?.billing
        ? {
            rent: userJoinedRoom.billing.rent || 0,
            electricity: userJoinedRoom.billing.electricity || 0,
            internet: userJoinedRoom.billing.internet || 0,
          }
        : null;

    if (!billing) return null;

    const rent = r2(billing.rent / payorCount);
    const electricity = r2(billing.electricity / payorCount);
    const internet = r2(billing.internet / payorCount);
    // Water: calculate from member presence data (each day = ₱5)
    const water = calcWaterFromPresence(members, payorCount);

    const total = r2(rent + electricity + internet + water);
    const perPayor = total;

    return {
      rent: { amount: rent, percentage: total > 0 ? (rent / total) * 100 : 0 },
      electricity: {
        amount: electricity,
        percentage: total > 0 ? (electricity / total) * 100 : 0,
      },
      internet: {
        amount: internet,
        percentage: total > 0 ? (internet / total) * 100 : 0,
      },
      water: {
        amount: water,
        percentage: total > 0 ? (water / total) * 100 : 0,
      },
      total,
      perPayor,
      payorCount,
    };
  };

  // Get member presence summary
  const getMemberPresenceSummary = () => {
    if (!userJoinedRoom?.members) return [];

    return userJoinedRoom.members.map((member) => {
      const userPayment = userJoinedRoom.memberPayments?.find(
        (mp) =>
          String(mp.member?.id || mp.member?._id || mp.member) ===
          String(member.id || member._id),
      );

      return {
        name: member.user?.name || "Unknown",
        avatar: member.user?.avatar?.url,
        isPayer: member.isPayer,
        allPaid:
          userPayment?.rentStatus === "paid" &&
          userPayment?.electricityStatus === "paid" &&
          userPayment?.waterStatus === "paid" &&
          (userPayment?.internetStatus === "paid" ||
            !userJoinedRoom.billing?.internet),
      };
    });
  };

  // Get payors' payment status details
  const getPayorsPaymentStatus = () => {
    if (!userJoinedRoom?.members || !userJoinedRoom?.billing) return [];

    const payors = userJoinedRoom.members.filter((m) => m.isPayer);

    return payors.map((payor) => {
      const payment = userJoinedRoom.memberPayments?.find(
        (mp) =>
          String(mp.member?.id || mp.member?._id || mp.member) ===
          String(payor.user?.id || payor.user?._id || payor.user),
      );

      const paymentData = payment || {
        rentStatus: "unpaid",
        electricityStatus: "unpaid",
        waterStatus: "unpaid",
        internetStatus: "unpaid",
      };

      return {
        name: payor.user?.name || "Unknown",
        userId: String(payor.user?.id || payor.user?._id || payor.user),
        payment: {
          rent: paymentData.rentStatus || "unpaid",
          electricity: paymentData.electricityStatus || "unpaid",
          water: paymentData.waterStatus || "unpaid",
          internet: paymentData.internetStatus || "unpaid",
        },
        allPaid:
          paymentData.rentStatus === "paid" &&
          paymentData.electricityStatus === "paid" &&
          paymentData.waterStatus === "paid" &&
          (paymentData.internetStatus === "paid" ||
            !userJoinedRoom.billing?.internet),
      };
    });
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchStatusChangeNotifications = async () => {
    try {
      const response = await apiService.get("/api/v2/notifications");
      const allNotifications = response.notifications || [];
      // Filter for only unread member status change notifications
      const statusChanges = allNotifications.filter(
        (notif) =>
          notif.notificationType === "member_status_changed" && !notif.isRead,
      );
      setStatusChangeNotifications(statusChanges);
    } catch (error) {
      console.error("Error fetching status notifications:", error);
    }
  };

  // Refresh room data when screen comes into focus to update payment status and billing cycle
  useFocusEffect(
    React.useCallback(() => {
      fetchRooms();
      fetchStatusChangeNotifications();
    }, []),
  );

  // Fetch active billing cycle when room changes or when members/payments change
  useEffect(() => {
    if (userJoinedRoom?.id || userJoinedRoom?._id) {
      fetchActiveBillingCycle(userJoinedRoom.id || userJoinedRoom._id);
    }
  }, [
    userJoinedRoom?.id || userJoinedRoom?._id,
    userJoinedRoom?.members?.length,
    userJoinedRoom?.memberPayments?.length,
  ]);

  const fetchActiveBillingCycle = async (roomId) => {
    try {
      const response = await billingCycleService.getBillingCycles(roomId);
      const cycles = Array.isArray(response)
        ? response
        : response?.billingCycles || response?.data || [];
      const active = cycles.find((c) => c.status === "active");
      if (active) {
        setActiveCycle(active);
      }
    } catch (error) {
      console.error("Error fetching active billing cycle:", error);
    }
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);

      // Fetch user's rooms (current and previous memberships) - use client endpoint
      // to ensure even admins see only their joined rooms when in client view
      const userRoomsResponse = await roomService.getClientRooms();
      const userRoomsData = userRoomsResponse.data || userRoomsResponse;
      const userRooms = userRoomsData.rooms || userRoomsData || [];

      console.log("User rooms fetched:", userRooms.length);
      const firstRoom = userRooms[0] || null;
      setUserJoinedRoom(firstRoom);

      // Refetch active billing cycle if room exists
      if (firstRoom?.id || firstRoom?._id) {
        await fetchActiveBillingCycle(firstRoom.id || firstRoom._id);
      }

      // Fetch ALL available rooms to browse
      try {
        const availableRoomsResponse = await roomService.getAvailableRooms();
        const availableRoomsData =
          availableRoomsResponse.data || availableRoomsResponse;
        const allRooms = availableRoomsData.rooms || availableRoomsData || [];
        const pending = availableRoomsData.pendingRoomIds || [];
        setPendingRoomIds(pending);

        // Filter to get rooms user hasn't joined yet (but include pending ones)
        const userRoomIds = userRooms.map((r) => r.id || r._id);
        const notJoined = allRooms.filter(
          (room) => !userRoomIds.includes(room.id || room._id),
        );

        console.log("Available rooms to join:", notJoined.length);
        setUnjoinedRooms(notJoined);
      } catch (error) {
        console.error("Error fetching available rooms:", error);
        setUnjoinedRooms([]);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
      setUserJoinedRoom(null);
      setUnjoinedRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  };

  const handleJoinRoom = async (roomId) => {
    // Show alert asking if user is a payer
    Alert.alert(
      "Join Room",
      "Will you be a payer for this room?",
      [
        {
          text: "No (Non-Payer)",
          onPress: async () => await joinRoomWithPayerStatus(roomId, false),
          style: "destructive",
        },
        {
          text: "Yes (Payer)",
          onPress: async () => await joinRoomWithPayerStatus(roomId, true),
          style: "default",
        },
      ],
      { cancelable: false },
    );
  };

  const joinRoomWithPayerStatus = async (roomId, isPayer) => {
    try {
      setJoiningRoomId(roomId);
      const response = await memberService.addMember(roomId, {
        userId,
        isPayer,
      });
      if (response.pending) {
        Alert.alert(
          "Request Sent",
          "Your join request has been sent to the room admin for approval. You'll be notified once approved.",
        );
      } else {
        const payorStatus = isPayer ? "payor" : "non-payor";
        Alert.alert("Success", `You've joined the room as a ${payorStatus}!`);
      }
      await fetchRooms();
    } catch (error) {
      console.error("Error joining room:", error);
      const message =
        error.data?.message || error.message || "Failed to join room";
      Alert.alert("Error", message);
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleNavigateToRoom = () => {
    if (userJoinedRoom) {
      navigation.navigate("Presence", {
        roomId: userJoinedRoom.id || userJoinedRoom._id,
      });
    }
  };

  const RoomCard = ({ room, isJoined = false }) => {
    const roomId = room.id || room._id;
    const isPending = pendingRoomIds.includes(roomId);

    return (
      <View style={styles.roomCard}>
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="home" size={28} color={colors.accent} />
          </View>
          <View style={styles.roomInfo}>
            <Text style={styles.roomName}>{room.name}</Text>
            <Text style={styles.roomMembers}>
              {room.members?.length || 0} Members
            </Text>
          </View>
        </View>

        {room.description && (
          <Text style={styles.roomDescription}>{room.description}</Text>
        )}

        {isJoined ? (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => navigation.navigate("RoomDetails", { roomId })}
          >
            <Text style={styles.buttonText}>View Details</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.textOnAccent} />
          </TouchableOpacity>
        ) : isPending ? (
          <View style={[styles.button, styles.pendingButton]}>
            <Ionicons name="time-outline" size={14} color="#e67e22" />
            <Text style={styles.pendingButtonText}>Pending Approval</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => handleJoinRoom(roomId)}
            disabled={joiningRoomId === roomId}
          >
            {joiningRoomId === roomId ? (
              <ActivityIndicator color={colors.accent} size={16} />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={14} color={colors.accent} />
                <Text style={styles.joinButtonText}>Join Room</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Status Details Modal
  // ─── STATUS MODAL ───
  const StatusModal = () => (
    <Modal
      visible={showStatusModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowStatusModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View
                style={[styles.modalIconBg, { backgroundColor: colors.successBg }]}
              >
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              </View>
              <Text style={styles.modalTitle}>Payment Status</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowStatusModal(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {getPaymentStatus() && (
              <View>
                {[
                  {
                    bill: "Rent",
                    icon: "home",
                    status: getPaymentStatus().status.rentStatus,
                  },
                  {
                    bill: "Electricity",
                    icon: "flash",
                    status: getPaymentStatus().status.electricityStatus,
                  },
                  {
                    bill: "Water",
                    icon: "water",
                    status: getPaymentStatus().status.waterStatus,
                  },
                  {
                    bill: "Internet",
                    icon: "wifi",
                    status: getPaymentStatus().status.internetStatus,
                  },
                ].map((item, idx) => (
                  <View key={idx} style={styles.statusRow}>
                    <View style={styles.statusRowLeft}>
                      <Ionicons name={item.icon} size={18} color={colors.textSecondary} />
                      <Text style={styles.statusRowLabel}>{item.bill}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor:
                            item.status === "paid" ? colors.successBg : colors.warningBg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          item.status === "paid" ? "checkmark-circle" : "time"
                        }
                        size={14}
                        color={item.status === "paid" ? colors.success : "#e65100"}
                      />
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color:
                              item.status === "paid" ? colors.success : "#e65100",
                          },
                        ]}
                      >
                        {item.status === "paid" ? "Paid" : "Unpaid"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.modalActionBtn}
            onPress={() => {
              setShowStatusModal(false);
              userJoinedRoom &&
                navigation.navigate("BillsStack", {
                  screen: "BillsMain",
                  params: { roomId: userJoinedRoom.id || userJoinedRoom._id },
                });
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="receipt" size={16} color={colors.textOnAccent} />
            <Text style={styles.modalActionBtnText}>View Bills</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ─── EXPENSE MODAL ───
  const ExpenseModal = () => (
    <Modal
      visible={showExpenseModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowExpenseModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View
                style={[styles.modalIconBg, { backgroundColor: colors.warningBg }]}
              >
                <Ionicons name="pie-chart" size={18} color={colors.accent} />
              </View>
              <Text style={styles.modalTitle}>Expense Breakdown</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowExpenseModal(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {getExpenseBreakdown() && (
              <View>
                <View style={styles.expenseSummaryCard}>
                  <Text style={styles.expenseSummaryLabel}>
                    Your Monthly Total
                  </Text>
                  <Text style={styles.expenseSummaryAmount}>
                    {"\u20B1"}
                    {getExpenseBreakdown().perPayor.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                  <Text style={styles.expenseSummaryNote}>
                    Room total: {"\u20B1"}
                    {getExpenseBreakdown().total.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ({getExpenseBreakdown().payorCount} payor
                    {getExpenseBreakdown().payorCount !== 1 ? "s" : ""})
                  </Text>
                </View>

                {[
                  {
                    name: "Rent",
                    icon: "home",
                    color: "#e65100",
                    data: getExpenseBreakdown().rent,
                  },
                  {
                    name: "Electricity",
                    icon: "flash",
                    color: colors.electricityColor,
                    data: getExpenseBreakdown().electricity,
                  },
                  {
                    name: "Water",
                    icon: "water",
                    color: colors.waterColor,
                    data: getExpenseBreakdown().water,
                  },
                  {
                    name: "Internet",
                    icon: "wifi",
                    color: colors.internetColor,
                    data: getExpenseBreakdown().internet,
                  },
                ].map((item, idx) => (
                  <View key={idx} style={styles.expenseRow}>
                    <View style={styles.expenseRowLeft}>
                      <View
                        style={[
                          styles.expenseDot,
                          { backgroundColor: item.color },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.expenseRowName}>{item.name}</Text>
                        <View style={styles.expenseBarBg}>
                          <View
                            style={[
                              styles.expenseBarFill,
                              {
                                width: `${item.data.percentage}%`,
                                backgroundColor: item.color,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                    <View style={styles.expenseRowRight}>
                      <Text style={styles.expenseRowAmount}>
                        {"\u20B1"}
                        {item.data.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                      <Text style={styles.expenseRowPct}>
                        {item.data.percentage.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const fmt = (v) =>
    "\u20B1" +
    (parseFloat(v) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtShort = (v) =>
    "\u20B1" +
    (parseFloat(v) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatShortDate = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <>
      <StatusModal />
      <ExpenseModal />
      <View style={styles.container}>
        {/* ─── HEADER ─── */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{getTimeBasedGreeting()},</Text>
              <Text style={styles.userName}>{userName}</Text>
            </View>
            <View style={styles.headerIconBg}>
              <Ionicons name="person" size={20} color={colors.textOnAccent} />
            </View>
          </View>
        </View>

        {/* ─── NOTIFICATION BANNER ─── */}
        {statusChangeNotifications.length > 0 && (
          <TouchableOpacity
            style={styles.notifBanner}
            onPress={() => navigation.navigate("ProfileStack")}
            activeOpacity={0.7}
          >
            <View style={styles.notifDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>Status Update</Text>
              <Text style={styles.notifMessage} numberOfLines={1}>
                {statusChangeNotifications[0].message}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#e65100" />
          </TouchableOpacity>
        )}

        {loading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#b38604"]}
              />
            }
          >
            {userJoinedRoom ? (
              <>
                {/* ─── MY ROOM CARD ─── */}
                <View style={styles.myRoomCard}>
                  <View style={styles.myRoomHeader}>
                    <View style={styles.roomIconBg}>
                      <Ionicons name="home" size={22} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.myRoomName}>
                        {userJoinedRoom.name}
                      </Text>
                      <Text style={styles.myRoomSub}>
                        {userJoinedRoom.members?.length || 0} member
                        {(userJoinedRoom.members?.length || 0) !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.detailsChip}
                      onPress={() =>
                        navigation.navigate("HomeStack", {
                          screen: "RoomDetails",
                          params: {
                            roomId: userJoinedRoom.id || userJoinedRoom._id,
                          },
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.detailsChipText}>Details</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={colors.accent}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Billing Period Strip */}
                  {userJoinedRoom.billing && (
                    <View style={styles.periodStrip}>
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.periodText}>
                        {formatShortDate(userJoinedRoom.billing.start)}{" "}
                        {"\u2014"} {formatShortDate(userJoinedRoom.billing.end)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* ─── BILLING OVERVIEW (payors only) ─── */}
                {userJoinedRoom.billing && isCurrentUserPayor() && (
                  <TouchableOpacity
                    style={styles.billingCard}
                    onPress={() => {
                      if (userJoinedRoom?.id || userJoinedRoom?._id) {
                        fetchActiveBillingCycle(
                          userJoinedRoom.id || userJoinedRoom._id,
                        );
                      }
                      setShowExpenseModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.billingCardTop}>
                      <View>
                        <Text style={styles.billingCardLabel}>Your Share</Text>
                        <Text style={styles.billingCardAmount}>
                          {fmtShort(getExpenseBreakdown()?.perPayor || 0)}
                        </Text>
                      </View>
                      <View style={styles.billingBadge}>
                        <Text style={styles.billingBadgeText}>
                          Tap for details
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={colors.accent}
                        />
                      </View>
                    </View>

                    <View style={styles.billingBreakdownRow}>
                      {[
                        {
                          label: "Rent",
                          icon: "home",
                          amount: getExpenseBreakdown()?.rent?.amount,
                          color: "#e65100",
                        },
                        {
                          label: "Elec",
                          icon: "flash",
                          amount: getExpenseBreakdown()?.electricity?.amount,
                          color: colors.electricityColor,
                        },
                        {
                          label: "Water",
                          icon: "water",
                          amount: getExpenseBreakdown()?.water?.amount,
                          color: colors.waterColor,
                        },
                        {
                          label: "Net",
                          icon: "wifi",
                          amount: getExpenseBreakdown()?.internet?.amount,
                          color: colors.internetColor,
                        },
                      ].map((item, idx) => (
                        <View key={idx} style={styles.billingMiniCell}>
                          <Ionicons
                            name={item.icon}
                            size={14}
                            color={item.color}
                          />
                          <Text style={styles.billingMiniLabel}>
                            {item.label}
                          </Text>
                          <Text style={styles.billingMiniAmount}>
                            {fmtShort(item.amount || 0)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                )}

                {/* ─── PAYMENT STATUS ─── */}
                {getPaymentStatus() && (
                  <TouchableOpacity
                    style={[
                      styles.paymentCard,
                      {
                        borderLeftColor: getPaymentStatus().allPaid
                          ? colors.success
                          : "#e65100",
                      },
                    ]}
                    onPress={() => setShowStatusModal(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={
                        getPaymentStatus().allPaid ? "checkmark-circle" : "time"
                      }
                      size={22}
                      color={getPaymentStatus().allPaid ? colors.success : "#e65100"}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text
                        style={[
                          styles.paymentTitle,
                          {
                            color: getPaymentStatus().allPaid
                              ? colors.success
                              : "#e65100",
                          },
                        ]}
                      >
                        {getPaymentStatus().allPaid
                          ? "All Bills Paid"
                          : "Payment Pending"}
                      </Text>
                      {!getPaymentStatus().allPaid && (
                        <Text style={styles.paymentSub}>
                          {getPaymentStatus().pendingCount} bill
                          {getPaymentStatus().pendingCount !== 1
                            ? "s"
                            : ""}{" "}
                          awaiting payment
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}

                {/* ─── BILLING COUNTDOWN ─── */}
                {getBillingCountdown() && isCurrentUserPayor() && (
                  <TouchableOpacity
                    style={styles.countdownCard}
                    onPress={() => {
                      if (userJoinedRoom?.id || userJoinedRoom?._id) {
                        fetchActiveBillingCycle(
                          userJoinedRoom.id || userJoinedRoom._id,
                        );
                      }
                      setShowExpenseModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.countdownRow}>
                      <Ionicons
                        name="timer-outline"
                        size={18}
                        color={colors.accent}
                      />
                      <Text style={styles.countdownText}>
                        {getBillingCountdown().daysRemaining === 0
                          ? "Cycle ends today"
                          : getBillingCountdown().daysRemaining > 0
                            ? `${getBillingCountdown().daysRemaining} day${getBillingCountdown().daysRemaining !== 1 ? "s" : ""} remaining`
                            : "Cycle overdue"}
                      </Text>
                      <Text style={styles.countdownPct}>
                        {getBillingCountdown().percentage.toFixed(0)}%
                      </Text>
                    </View>
                    <View style={styles.countdownBarBg}>
                      <View
                        style={[
                          styles.countdownBarFill,
                          {
                            width: `${getBillingCountdown().percentage}%`,
                            backgroundColor:
                              getBillingCountdown().daysRemaining <= 3
                                ? "#ef5350"
                                : getBillingCountdown().daysRemaining <= 7
                                  ? "#ff9800"
                                  : colors.success,
                          },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                )}

                {/* ─── QUICK ACTIONS ─── */}
                <View style={styles.actionsRow}>
                  {isCurrentUserPayor() && (
                    <TouchableOpacity
                      style={styles.actionCard}
                      onPress={() =>
                        navigation.navigate("BillsStack", {
                          screen: "BillsMain",
                          params: {
                            roomId: userJoinedRoom.id || userJoinedRoom._id,
                          },
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.actionIconBg,
                          { backgroundColor: colors.warningBg },
                        ]}
                      >
                        <Ionicons name="card" size={20} color={colors.accent} />
                      </View>
                      <Text style={styles.actionLabel}>Pay Bills</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={() =>
                      navigation.navigate("PresenceStack", {
                        screen: "PresenceMain",
                        params: {
                          roomId: userJoinedRoom.id || userJoinedRoom._id,
                        },
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.actionIconBg,
                        { backgroundColor: colors.successBg },
                      ]}
                    >
                      <Ionicons name="calendar" size={20} color={colors.success} />
                    </View>
                    <Text style={styles.actionLabel}>Presence</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionCard}
                    onPress={() =>
                      navigation.navigate("HomeStack", {
                        screen: "RoomDetails",
                        params: {
                          roomId: userJoinedRoom.id || userJoinedRoom._id,
                        },
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.actionIconBg,
                        { backgroundColor: colors.infoBg },
                      ]}
                    >
                      <Ionicons
                        name="information-circle"
                        size={20}
                        color={colors.info}
                      />
                    </View>
                    <Text style={styles.actionLabel}>Room Info</Text>
                  </TouchableOpacity>
                </View>

                {/* ─── PAYORS PAYMENT STATUS ─── */}
                {getPayorsPaymentStatus().length > 0 && (
                  <View style={styles.payorsCard}>
                    <View style={styles.payorsHeader}>
                      <Ionicons name="people" size={18} color={colors.accent} />
                      <Text style={styles.payorsTitle}>
                        Payors Payment Status
                      </Text>
                    </View>

                    {userJoinedRoom?.billing?.start &&
                      userJoinedRoom?.billing?.end && (
                        <View style={styles.payorsPeriod}>
                          <Ionicons
                            name="calendar-outline"
                            size={13}
                            color={colors.info}
                          />
                          <Text style={styles.payorsPeriodText}>
                            {formatShortDate(userJoinedRoom.billing.start)}{" "}
                            {"\u2014"}{" "}
                            {formatShortDate(userJoinedRoom.billing.end)}
                          </Text>
                        </View>
                      )}

                    {getPayorsPaymentStatus().map((payor, index) => (
                      <View key={payor.userId}>
                        <View style={styles.payorRow}>
                          <View style={styles.payorAvatar}>
                            <Text style={styles.payorAvatarText}>
                              {(payor.name || "?").charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.payorNameRow}>
                              <Text style={styles.payorName}>{payor.name}</Text>
                              {payor.allPaid && (
                                <View style={styles.paidChip}>
                                  <Ionicons
                                    name="checkmark"
                                    size={10}
                                    color={colors.textOnAccent}
                                  />
                                  <Text style={styles.paidChipText}>Paid</Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.payorBillsRow}>
                              {[
                                { key: "R", status: payor.payment.rent },
                                { key: "E", status: payor.payment.electricity },
                                { key: "W", status: payor.payment.water },
                                ...(userJoinedRoom.billing?.internet
                                  ? [
                                      {
                                        key: "I",
                                        status: payor.payment.internet,
                                      },
                                    ]
                                  : []),
                              ].map((bill, bi) => (
                                <View
                                  key={bi}
                                  style={[
                                    styles.payorBillChip,
                                    {
                                      backgroundColor:
                                        bill.status === "paid"
                                          ? colors.successBg
                                          : "#fbe9e7",
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.payorBillChipText,
                                      {
                                        color:
                                          bill.status === "paid"
                                            ? colors.success
                                            : "#c62828",
                                      },
                                    ]}
                                  >
                                    {bill.key}
                                  </Text>
                                  <Ionicons
                                    name={
                                      bill.status === "paid"
                                        ? "checkmark"
                                        : "close"
                                    }
                                    size={10}
                                    color={
                                      bill.status === "paid"
                                        ? colors.success
                                        : "#c62828"
                                    }
                                  />
                                </View>
                              ))}
                            </View>
                          </View>
                        </View>
                        {index < getPayorsPaymentStatus().length - 1 && (
                          <View style={styles.payorDivider} />
                        )}
                      </View>
                    ))}

                    <View style={styles.legendRow}>
                      <Text style={styles.legendText}>
                        R = Rent {"\u2022"} E = Electricity {"\u2022"} W = Water
                        {userJoinedRoom.billing?.internet
                          ? " \u2022 I = Internet"
                          : ""}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              /* ─── NO ROOM JOINED ─── */
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="home-outline" size={40} color={colors.textSecondary} />
                </View>
                <Text style={styles.emptyTitle}>No Room Joined Yet</Text>
                <Text style={styles.emptySubtext}>
                  Browse available rooms below to join one
                </Text>
              </View>
            )}

            {/* ─── AVAILABLE ROOMS ─── */}
            {unjoinedRooms.length > 0 && (
              <View style={styles.availSection}>
                <Text style={styles.sectionLabel}>AVAILABLE ROOMS</Text>
                {unjoinedRooms.map((room) => {
                  const roomId = room.id || room._id;
                  const isPending = pendingRoomIds.includes(roomId);
                  return (
                    <View key={roomId} style={styles.availCard}>
                      <View style={styles.availHeader}>
                        <View style={styles.availIconBg}>
                          <Ionicons
                            name="home-outline"
                            size={18}
                            color={colors.accent}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.availName}>{room.name}</Text>
                          <Text style={styles.availMembers}>
                            {room.members?.length || 0} member
                            {(room.members?.length || 0) !== 1 ? "s" : ""}
                          </Text>
                        </View>
                        {isPending ? (
                          <View style={styles.pendingChip}>
                            <Ionicons
                              name="time-outline"
                              size={13}
                              color="#e67e22"
                            />
                            <Text style={styles.pendingChipText}>Pending</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.joinBtn}
                            onPress={() => handleJoinRoom(roomId)}
                            disabled={joiningRoomId === roomId}
                            activeOpacity={0.7}
                          >
                            {joiningRoomId === roomId ? (
                              <ActivityIndicator color={colors.textOnAccent} size="small" />
                            ) : (
                              <>
                                <Ionicons name="add" size={16} color={colors.textOnAccent} />
                                <Text style={styles.joinBtnText}>Join</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                      {room.description && (
                        <Text style={styles.availDesc} numberOfLines={2}>
                          {room.description}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* All rooms joined */}
            {unjoinedRooms.length === 0 && userJoinedRoom && (
              <View style={styles.allJoinedCard}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                <Text style={styles.allJoinedText}>
                  You've joined all available rooms
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
};

const createStyles = (colors) => StyleSheet.create({
  // ─── LAYOUT ───
  container: { flex: 1, backgroundColor: colors.background },
  centerLoader: { flex: 1, justifyContent: "center", alignItems: "center" },

  // ─── HEADER ───
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  greeting: { fontSize: 13, color: colors.textTertiary, fontWeight: "500" },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
    letterSpacing: -0.3,
  },
  headerIconBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },

  // ─── NOTIFICATION BANNER ───
  notifBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.accentSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffe0b2",
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e65100",
  },
  notifTitle: { fontSize: 12, fontWeight: "700", color: "#e65100" },
  notifMessage: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  // ─── MY ROOM CARD ───
  myRoomCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  myRoomHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  roomIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accentSurface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0e6c8",
  },
  myRoomName: { fontSize: 17, fontWeight: "700", color: colors.text },
  myRoomSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  detailsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: "#f0e6c8",
  },
  detailsChipText: { fontSize: 12, fontWeight: "600", color: colors.accent },
  periodStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.cardAlt,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  periodText: { fontSize: 12, color: colors.textTertiary, fontWeight: "500" },

  // ─── BILLING CARD ───
  billingCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  billingCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  billingCardLabel: { fontSize: 12, color: colors.textTertiary, fontWeight: "500" },
  billingCardAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.accent,
    marginTop: 2,
  },
  billingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.accentSurface,
  },
  billingBadgeText: { fontSize: 11, fontWeight: "600", color: colors.accent },
  billingBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.cardAlt,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  billingMiniCell: { alignItems: "center", gap: 3 },
  billingMiniLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: "500" },
  billingMiniAmount: { fontSize: 12, fontWeight: "700", color: colors.text },

  // ─── PAYMENT STATUS ───
  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
  },
  paymentTitle: { fontSize: 14, fontWeight: "700" },
  paymentSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },

  // ─── COUNTDOWN ───
  countdownCard: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  countdownText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },
  countdownPct: { fontSize: 12, fontWeight: "700", color: colors.textTertiary },
  countdownBarBg: {
    height: 5,
    backgroundColor: colors.inputBg,
    borderRadius: 3,
    overflow: "hidden",
  },
  countdownBarFill: { height: "100%", borderRadius: 3 },

  // ─── QUICK ACTIONS ───
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },

  // ─── PAYORS STATUS ───
  payorsCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  payorsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  payorsTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  payorsPeriod: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.infoBg,
    borderRadius: 8,
  },
  payorsPeriodText: { fontSize: 11, fontWeight: "600", color: colors.waterColor },
  payorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  payorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSurface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0e6c8",
  },
  payorAvatarText: { fontSize: 14, fontWeight: "700", color: colors.accent },
  payorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  payorName: { fontSize: 13, fontWeight: "600", color: colors.text },
  paidChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.success,
  },
  paidChipText: { fontSize: 9, fontWeight: "700", color: "#fff" },
  payorBillsRow: { flexDirection: "row", gap: 6 },
  payorBillChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  payorBillChipText: { fontSize: 10, fontWeight: "700" },
  payorDivider: { height: 1, backgroundColor: colors.background, marginHorizontal: 16 },
  legendRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    alignItems: "center",
  },
  legendText: { fontSize: 10, color: colors.textTertiary, fontStyle: "italic" },

  // ─── EMPTY STATE ───
  emptyState: { alignItems: "center", paddingVertical: 50 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptySubtext: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 40,
  },

  // ─── AVAILABLE ROOMS ───
  availSection: { marginHorizontal: 16, marginTop: 18 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  availCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  availHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  availIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.accentSurface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0e6c8",
  },
  availName: { fontSize: 14, fontWeight: "600", color: colors.text },
  availMembers: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  availDesc: {
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 17,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  pendingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: "#ffe0b2",
  },
  pendingChipText: { fontSize: 11, fontWeight: "600", color: "#e67e22" },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  joinBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  allJoinedCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 18,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: "#d4edd4",
  },
  allJoinedText: { fontSize: 13, fontWeight: "600", color: colors.success },

  // ─── MODALS ───
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalIconBg: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: { paddingHorizontal: 20, paddingVertical: 16 },
  modalActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 24,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  modalActionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // ─── STATUS MODAL ───
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusRowLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusPillText: { fontSize: 12, fontWeight: "700" },

  // ─── EXPENSE MODAL ───
  expenseSummaryCard: {
    backgroundColor: colors.accentSurface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f0e6c8",
  },
  expenseSummaryLabel: { fontSize: 12, color: colors.textTertiary, fontWeight: "500" },
  expenseSummaryAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.accent,
    marginTop: 4,
  },
  expenseSummaryNote: { fontSize: 12, color: colors.textTertiary, marginTop: 6 },
  expenseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  expenseRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  expenseDot: { width: 8, height: 8, borderRadius: 4 },
  expenseRowName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  expenseBarBg: {
    height: 4,
    backgroundColor: colors.inputBg,
    borderRadius: 2,
    overflow: "hidden",
    width: 100,
  },
  expenseBarFill: { height: "100%", borderRadius: 2 },
  expenseRowRight: { alignItems: "flex-end" },
  expenseRowAmount: { fontSize: 14, fontWeight: "700", color: colors.text },
  expenseRowPct: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
});

export default ClientHomeScreen;
