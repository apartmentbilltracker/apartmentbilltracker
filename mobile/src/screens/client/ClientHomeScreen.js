import React, { useContext, useEffect, useState } from "react";
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
  FlatList,
  Image,
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

const ClientHomeScreen = ({ navigation }) => {
  const { state } = useContext(AuthContext);
  const [userJoinedRoom, setUserJoinedRoom] = useState(null);
  const [unjoinedRooms, setUnjoinedRooms] = useState([]);
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

  const userId = state?.user?._id;
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
      (m) => String(m.user?._id || m.user) === String(userId),
    );
    return userMember?.isPayer || false;
  };

  // Calculate user's payment status in the room
  const getPaymentStatus = () => {
    if (!userJoinedRoom || !userId) return null;

    const userMember = userJoinedRoom.members.find(
      (m) => String(m.user?._id || m.user) === String(userId),
    );

    if (!userMember) return null;

    // Only show payment status for payors
    if (!userMember.isPayer) return null;

    // FIX: Compare memberPayment's user ID (mp.member) with user's actual ID (userMember.user)
    // NOT with member ID (userMember._id)
    const userPayment = userJoinedRoom.memberPayments?.find(
      (mp) =>
        String(mp.member?._id || mp.member) ===
        String(userMember.user?._id || userMember.user),
    );

    if (!userPayment) return null;

    const allPaid =
      userPayment.rentStatus === "paid" &&
      userPayment.electricityStatus === "paid" &&
      userPayment.waterStatus === "paid" &&
      (userPayment.internetStatus === "paid" ||
        !userJoinedRoom.billing?.internet);

    const pendingCount = [
      userPayment.rentStatus,
      userPayment.electricityStatus,
      userPayment.waterStatus,
      userPayment.internetStatus,
    ].filter((status) => status === "unpaid").length;

    return {
      allPaid,
      pendingCount,
      status: userPayment,
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

  // Get expense breakdown for modal
  const getExpenseBreakdown = () => {
    // Use activeCycle if available for accurate calculations
    if (activeCycle?.memberCharges) {
      const payorCount =
        activeCycle.memberCharges?.filter((c) => c.isPayer).length || 1;
      const total = activeCycle.totalBilledAmount || 0;

      // Get current user's actual share
      const userCharge = activeCycle.memberCharges?.find(
        (c) => String(c.userId) === String(userId),
      );

      if (userCharge && userCharge.isPayer) {
        // For payors, show their actual per-payor share (includes own consumption + shared non-payor consumption)
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
            // Already calculated correctly: own consumption + shared non-payor consumption
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

    // Fallback to billing data if no activeCycle
    if (!userJoinedRoom?.billing) return null;

    const members = userJoinedRoom.members || [];
    const payorCount = Math.max(
      1,
      members.filter((m) => m.isPayer).length || 1,
    );

    const rent = (userJoinedRoom.billing.rent || 0) / payorCount;
    const electricity = (userJoinedRoom.billing.electricity || 0) / payorCount;
    const internet = (userJoinedRoom.billing.internet || 0) / payorCount;
    // Note: Water calculation in fallback is estimated as total/payorCount
    // For accurate calculation (own consumption + shared non-payor), use activeCycle data
    const water = (userJoinedRoom.billing.water || 0) / payorCount;

    const total = rent + electricity + internet + water;

    // Per payor is each payor's share (already divided above)
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
        (mp) => String(mp.member?._id || mp.member) === String(member._id),
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
    if (!userJoinedRoom?.members || !userJoinedRoom?.memberPayments) return [];

    const payors = userJoinedRoom.members.filter((m) => m.isPayer);

    return payors.map((payor) => {
      const payment = userJoinedRoom.memberPayments.find(
        (mp) =>
          String(mp.member?._id || mp.member) ===
          String(payor.user?._id || payor.user),
      );

      return {
        name: payor.user?.name || "Unknown",
        userId: String(payor.user?._id || payor.user),
        payment: {
          rent: payment?.rentStatus || "unpaid",
          electricity: payment?.electricityStatus || "unpaid",
          water: payment?.waterStatus || "unpaid",
          internet: payment?.internetStatus || "unpaid",
        },
        allPaid:
          payment?.rentStatus === "paid" &&
          payment?.electricityStatus === "paid" &&
          payment?.waterStatus === "paid" &&
          (payment?.internetStatus === "paid" ||
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
    if (userJoinedRoom?._id) {
      fetchActiveBillingCycle(userJoinedRoom._id);
    }
  }, [
    userJoinedRoom?._id,
    userJoinedRoom?.members?.length,
    userJoinedRoom?.memberPayments?.length,
  ]);

  const fetchActiveBillingCycle = async (roomId) => {
    try {
      const response = await billingCycleService.getBillingCycles(roomId);
      const cycles = Array.isArray(response) ? response : response?.data || [];
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
      if (firstRoom?._id) {
        await fetchActiveBillingCycle(firstRoom._id);
      }

      // Fetch ALL available rooms to browse
      try {
        const availableRoomsResponse = await roomService.getAvailableRooms();
        const availableRoomsData =
          availableRoomsResponse.data || availableRoomsResponse;
        const allRooms = availableRoomsData.rooms || availableRoomsData || [];

        // Filter to get rooms user hasn't joined yet
        const userRoomIds = userRooms.map((r) => r._id);
        const notJoined = allRooms.filter(
          (room) => !userRoomIds.includes(room._id),
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
      await memberService.addMember(roomId, { userId, isPayer });
      const payorStatus = isPayer ? "payor" : "non-payor";
      Alert.alert("Success", `You've joined the room as a ${payorStatus}!`);
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
      navigation.navigate("Presence", { roomId: userJoinedRoom._id });
    }
  };

  const RoomCard = ({ room, isJoined = false }) => (
    <View style={styles.roomCard}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="home" size={28} color="#b38604" />
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
          onPress={() =>
            navigation.navigate("RoomDetails", { roomId: room._id })
          }
        >
          <Text style={styles.buttonText}>View Details</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => handleJoinRoom(room._id)}
          disabled={joiningRoomId === room._id}
        >
          {joiningRoomId === room._id ? (
            <ActivityIndicator color="#b38604" size={16} />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={14} color="#b38604" />
              <Text style={styles.joinButtonText}>Join Room</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  // Status Details Modal
  const StatusModal = () => (
    <Modal
      visible={showStatusModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowStatusModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Payment Status</Text>
            <TouchableOpacity onPress={() => setShowStatusModal(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {getPaymentStatus() && (
              <View>
                <Text style={styles.modalSectionTitle}>Your Bills</Text>
                {[
                  {
                    bill: "Rent",
                    status: getPaymentStatus().status.rentStatus,
                  },
                  {
                    bill: "Electricity",
                    status: getPaymentStatus().status.electricityStatus,
                  },
                  {
                    bill: "Water",
                    status: getPaymentStatus().status.waterStatus,
                  },
                  {
                    bill: "Internet",
                    status: getPaymentStatus().status.internetStatus,
                  },
                ].map((item, idx) => (
                  <View key={idx} style={styles.billStatusItem}>
                    <Text style={styles.billStatusName}>{item.bill}</Text>
                    <View
                      style={[
                        styles.badgeStatus,
                        {
                          backgroundColor:
                            item.status === "paid"
                              ? "#d4edda"
                              : item.status === "unpaid"
                                ? "#f8d7da"
                                : "#fff3cd",
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={
                          item.status === "paid"
                            ? "check-circle"
                            : "pending-actions"
                        }
                        size={16}
                        color={item.status === "paid" ? "#27ae60" : "#ff9800"}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.badgeStatusText,
                          {
                            color:
                              item.status === "paid" ? "#27ae60" : "#ff9800",
                          },
                        ]}
                      >
                        {item.status.charAt(0).toUpperCase() +
                          item.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => {
              setShowStatusModal(false);
              userJoinedRoom &&
                navigation.navigate("BillsStack", {
                  screen: "BillsMain",
                  params: { roomId: userJoinedRoom._id },
                });
            }}
          >
            <Text style={styles.modalButtonText}>View Full Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Expense Breakdown Modal
  const ExpenseModal = () => (
    <Modal
      visible={showExpenseModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowExpenseModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Expense Breakdown</Text>
            <TouchableOpacity onPress={() => setShowExpenseModal(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {getExpenseBreakdown() && (
              <View>
                <View style={styles.expenseSummary}>
                  <Text style={styles.expenseLabel}>Total Monthly</Text>
                  <Text style={styles.expenseAmount}>
                    ₱{getExpenseBreakdown().total.toFixed(2)}
                  </Text>
                  <Text style={styles.expenseSubtext}>
                    ₱{getExpenseBreakdown().perPayor.toFixed(2)} per payor (
                    {getExpenseBreakdown().payorCount} payor
                    {getExpenseBreakdown().payorCount !== 1 ? "s" : ""})
                  </Text>
                </View>

                <Text style={styles.modalSectionTitle}>Bill Breakdown</Text>

                {[
                  {
                    name: "Rent",
                    icon: "home",
                    data: getExpenseBreakdown().rent,
                  },
                  {
                    name: "Electricity",
                    icon: "bolt",
                    data: getExpenseBreakdown().electricity,
                  },
                  {
                    name: "Internet",
                    icon: "wifi",
                    data: getExpenseBreakdown().internet,
                  },
                  {
                    name: "Water",
                    icon: "water-damage",
                    data: getExpenseBreakdown().water,
                  },
                ].map((item, idx) =>
                  item.data.amount > 0 ? (
                    <View key={idx} style={styles.expenseItemContainer}>
                      <View style={styles.expenseItemLeft}>
                        <MaterialIcons
                          name={item.icon}
                          size={20}
                          color="#b38604"
                          style={{ marginRight: 10 }}
                        />
                        <View>
                          <Text style={styles.expenseItemName}>
                            {item.name}
                          </Text>
                          <View style={styles.progressBarSmall}>
                            <View
                              style={[
                                styles.progressBarFillSmall,
                                { width: `${item.data.percentage}%` },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                      <View style={styles.expenseItemRight}>
                        <Text style={styles.expenseItemAmount}>
                          ₱{item.data.amount.toFixed(2)}
                        </Text>
                        <Text style={styles.expenseItemPercent}>
                          {item.data.percentage.toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                  ) : null,
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <StatusModal />
      <ExpenseModal />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getTimeBasedGreeting()}</Text>
          <Text style={styles.name}>{userName}! 👋</Text>
          <Text style={styles.subtitle}>
            Welcome to Apartment Bill Tracker
          </Text>
        </View>

        {/* Status Change Notifications Banner */}
        {statusChangeNotifications.length > 0 && (
          <View style={styles.notificationBanner}>
            <MaterialIcons name="info" size={20} color="#FF6B35" />
            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>Status Update</Text>
              <Text style={styles.notificationMessage} numberOfLines={2}>
                {statusChangeNotifications[0].message}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate("ProfileStack")}
              style={styles.notificationAction}
            >
              <Text style={styles.notificationActionText}>View</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#b38604" />
          </View>
        ) : (
          <>
            {/* My Room Section */}
            {userJoinedRoom ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>My Room</Text>
                <RoomCard room={userJoinedRoom} isJoined={true} />

                {/* Quick Stats */}
                <View style={styles.statsContainer}>
                  <View style={styles.statCard}>
                    <MaterialIcons name="people" size={22} color="#b38604" />
                    <Text style={styles.statValue}>
                      {userJoinedRoom.members?.length || 0}
                    </Text>
                    <Text style={styles.statLabel}>Members</Text>
                  </View>

                  {userJoinedRoom.billing && (
                    <View style={styles.statCard}>
                      <MaterialIcons
                        name="calendar-today"
                        size={22}
                        color="#b38604"
                      />
                      <Text style={styles.statValue}>
                        {new Date(
                          userJoinedRoom.billing.start,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                      <Text style={styles.statLabel}>Billing Start</Text>
                    </View>
                  )}
                </View>

                {/* Quick Action Buttons */}
                <View style={styles.quickActionsContainer}>
                  {isCurrentUserPayor() && (
                    <TouchableOpacity
                      style={styles.quickActionButton}
                      onPress={() =>
                        userJoinedRoom &&
                        navigation.navigate("BillsStack", {
                          screen: "BillsMain",
                          params: { roomId: userJoinedRoom._id },
                        })
                      }
                    >
                      <MaterialIcons name="payment" size={20} color="#b38604" />
                      <Text style={styles.quickActionText}>Pay Bills</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() =>
                      userJoinedRoom &&
                      navigation.navigate("PresenceStack", {
                        screen: "PresenceMain",
                        params: { roomId: userJoinedRoom._id },
                      })
                    }
                  >
                    <MaterialIcons
                      name="assignment"
                      size={20}
                      color="#b38604"
                    />
                    <Text style={styles.quickActionText}>Presence</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() =>
                      userJoinedRoom &&
                      navigation.navigate("HomeStack", {
                        screen: "RoomDetails",
                        params: { roomId: userJoinedRoom._id },
                      })
                    }
                  >
                    <MaterialIcons name="info" size={20} color="#b38604" />
                    <Text style={styles.quickActionText}>Details</Text>
                  </TouchableOpacity>
                </View>

                {/* Payment Status Card */}
                {getPaymentStatus() && (
                  <TouchableOpacity
                    style={styles.paymentStatusCard}
                    onPress={() => setShowStatusModal(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.paymentStatusHeader}>
                      <MaterialIcons
                        name={
                          getPaymentStatus().allPaid
                            ? "check-circle"
                            : "pending-actions"
                        }
                        size={24}
                        color={
                          getPaymentStatus().allPaid ? "#27ae60" : "#ff9800"
                        }
                      />
                      <Text
                        style={[
                          styles.paymentStatusTitle,
                          {
                            color: getPaymentStatus().allPaid
                              ? "#27ae60"
                              : "#ff9800",
                          },
                        ]}
                      >
                        {getPaymentStatus().allPaid
                          ? "All Paid ✓"
                          : "Payment Pending"}
                      </Text>
                      <MaterialIcons
                        name="chevron-right"
                        size={20}
                        color="#b38604"
                        style={{ marginLeft: "auto" }}
                      />
                    </View>
                    {!getPaymentStatus().allPaid && (
                      <Text style={styles.paymentStatusSubtext}>
                        {getPaymentStatus().pendingCount} bill(s) awaiting
                        payment
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                {/* Billing Countdown Card - Only show if user has NOT paid all bills */}
                {getBillingCountdown() &&
                  isCurrentUserPayor() &&
                  getPaymentStatus() &&
                  !getPaymentStatus().allPaid && (
                    <TouchableOpacity
                      style={styles.billingCountdownCard}
                      onPress={() => {
                        // Refetch active cycle to get latest presence data
                        if (userJoinedRoom?._id) {
                          fetchActiveBillingCycle(userJoinedRoom._id);
                        }
                        setShowExpenseModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.countdownHeader}>
                        <MaterialIcons name="timer" size={20} color="#b38604" />
                        <Text style={styles.countdownTitle}>
                          {getBillingCountdown().daysRemaining === 0
                            ? "Billing cycle ends today"
                            : getBillingCountdown().daysRemaining > 0
                              ? `Billing cycle ends in ${getBillingCountdown().daysRemaining} day${getBillingCountdown().daysRemaining === 1 ? "" : "s"}`
                              : "Billing cycle overdue"}
                        </Text>
                      </View>
                      <View style={styles.progressBarContainer}>
                        <View
                          style={[
                            styles.progressBar,
                            {
                              width: `${getBillingCountdown().percentage}%`,
                              backgroundColor:
                                getBillingCountdown().daysRemaining <= 3
                                  ? "#e74c3c"
                                  : getBillingCountdown().daysRemaining <= 7
                                    ? "#ff9800"
                                    : "#27ae60",
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.countdownFooter}>
                        <Text style={styles.countdownSubtext}>
                          {getBillingCountdown().percentage.toFixed(0)}% through
                          billing cycle
                        </Text>
                        <MaterialIcons
                          name="chevron-right"
                          size={20}
                          color="#b38604"
                        />
                      </View>
                    </TouchableOpacity>
                  )}

                {/* Payors Payment Status */}
                {getPayorsPaymentStatus().length > 0 && (
                  <View style={styles.payorsStatusCard}>
                    <View style={styles.cardHeaderRow}>
                      <MaterialIcons name="people" size={20} color="#b38604" />
                      <Text style={styles.payorsStatusTitle}>
                        Payors Payment Status
                      </Text>
                    </View>

                    {/* Billing Period Info */}
                    {userJoinedRoom?.billing?.start &&
                      userJoinedRoom?.billing?.end && (
                        <View style={styles.billingPeriodInfo}>
                          <MaterialIcons
                            name="calendar-today"
                            size={14}
                            color="#666"
                          />
                          <Text style={styles.billingPeriodText}>
                            {new Date(
                              userJoinedRoom.billing.start,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            -{" "}
                            {new Date(
                              userJoinedRoom.billing.end,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </Text>
                        </View>
                      )}

                    {getPayorsPaymentStatus().map((payor, index) => (
                      <View key={payor.userId} style={styles.payorStatusRow}>
                        <View style={styles.payorInfo}>
                          <Text style={styles.payorName}>{payor.name}</Text>
                          {payor.allPaid && (
                            <View style={styles.allPaidBadge}>
                              <MaterialIcons
                                name="check-circle"
                                size={14}
                                color="#fff"
                              />
                              <Text style={styles.allPaidText}>All Paid</Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.billsStatusGrid}>
                          {/* Rent Status */}
                          <View style={styles.billStatus}>
                            <Text style={styles.billLabel}>R</Text>
                            <MaterialIcons
                              name={
                                payor.payment.rent === "paid"
                                  ? "check-circle"
                                  : "cancel"
                              }
                              size={16}
                              color={
                                payor.payment.rent === "paid"
                                  ? "#27ae60"
                                  : "#e74c3c"
                              }
                            />
                          </View>

                          {/* Electricity Status */}
                          <View style={styles.billStatus}>
                            <Text style={styles.billLabel}>E</Text>
                            <MaterialIcons
                              name={
                                payor.payment.electricity === "paid"
                                  ? "check-circle"
                                  : "cancel"
                              }
                              size={16}
                              color={
                                payor.payment.electricity === "paid"
                                  ? "#27ae60"
                                  : "#e74c3c"
                              }
                            />
                          </View>

                          {/* Water Status */}
                          <View style={styles.billStatus}>
                            <Text style={styles.billLabel}>W</Text>
                            <MaterialIcons
                              name={
                                payor.payment.water === "paid"
                                  ? "check-circle"
                                  : "cancel"
                              }
                              size={16}
                              color={
                                payor.payment.water === "paid"
                                  ? "#27ae60"
                                  : "#e74c3c"
                              }
                            />
                          </View>

                          {/* Internet Status - Only if internet is billed */}
                          {userJoinedRoom.billing?.internet && (
                            <View style={styles.billStatus}>
                              <Text style={styles.billLabel}>I</Text>
                              <MaterialIcons
                                name={
                                  payor.payment.internet === "paid"
                                    ? "check-circle"
                                    : "cancel"
                                }
                                size={16}
                                color={
                                  payor.payment.internet === "paid"
                                    ? "#27ae60"
                                    : "#e74c3c"
                                }
                              />
                            </View>
                          )}
                        </View>

                        {index < getPayorsPaymentStatus().length - 1 && (
                          <View style={styles.payorDivider} />
                        )}
                      </View>
                    ))}

                    <View style={styles.billLegend}>
                      <Text style={styles.legendLabel}>
                        R = Rent • E = Electricity • W = Water
                        {userJoinedRoom.billing?.internet && " • I = Internet"}
                      </Text>
                    </View>

                    {/* Info Note */}
                    <View style={styles.infoNote}>
                      <MaterialIcons name="info" size={14} color="#2196F3" />
                      <Text style={styles.infoNoteText}>
                        Payment status automatically resets when a new billing
                        period is created.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.section}>
                <View style={styles.emptyState}>
                  <MaterialIcons name="inbox" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>No Room Joined Yet</Text>
                  <Text style={styles.emptySubtext}>
                    Browse available rooms below to join one
                  </Text>
                </View>
              </View>
            )}

            {/* Available Rooms Section */}
            {unjoinedRooms.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Available Rooms ({unjoinedRooms.length})
                </Text>
                {unjoinedRooms.map((room) => (
                  <RoomCard key={room._id} room={room} isJoined={false} />
                ))}
              </View>
            )}

            {/* All Joined Message */}
            {unjoinedRooms.length === 0 && userJoinedRoom && (
              <View style={styles.section}>
                <View style={styles.emptyState}>
                  <MaterialIcons
                    name="check-circle"
                    size={48}
                    color="#b38604"
                  />
                  <Text style={styles.emptyText}>All Rooms Joined</Text>
                  <Text style={styles.emptySubtext}>
                    You've joined all available rooms
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    marginTop: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  greeting: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
    color: "#333",
    marginTop: 5,
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
    marginBottom: 14,
  },
  roomCard: {
    backgroundColor: "#fff",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    marginBottom: 11,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 9,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  roomInfo: {
    flex: 1,
    justifyContent: "center",
  },
  roomName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  roomMembers: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },
  roomDescription: {
    fontSize: 13,
    color: "#666",
    marginBottom: 11,
    lineHeight: 18,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#b38604",
  },
  secondaryButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#b38604",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    marginRight: 6,
  },
  joinButtonText: {
    color: "#b38604",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    borderRadius: 9,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 3,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 35,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  paymentStatusCard: {
    backgroundColor: "#f0f9ff",
    borderRadius: 9,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#27ae60",
  },
  paymentStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  paymentStatusTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 8,
  },
  paymentStatusSubtext: {
    fontSize: 12,
    color: "#ff9800",
    marginLeft: 32,
    marginTop: 2,
  },
  billingCountdownCard: {
    backgroundColor: "#fffbf0",
    borderRadius: 9,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#b38604",
  },
  countdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  countdownTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
    flex: 1,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  countdownSubtext: {
    fontSize: 11,
    color: "#666",
  },
  countdownFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 10,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#333",
    marginTop: 6,
  },
  // Payors Payment Status Styles
  payorsStatusCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  payorsStatusTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginLeft: 8,
  },
  billingPeriodInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f9ff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 12,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#2196F3",
  },
  billingPeriodText: {
    fontSize: 12,
    color: "#2196F3",
    fontWeight: "600",
    flex: 1,
  },
  payorStatusRow: {
    marginBottom: 12,
  },
  payorInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  payorName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  allPaidBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#27ae60",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  allPaidText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  billsStatusGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
  },
  billStatus: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  billLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#666",
  },
  payorDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginTop: 12,
  },
  billLegend: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    alignItems: "center",
  },
  legendLabel: {
    fontSize: 11,
    color: "#999",
    fontStyle: "italic",
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 12,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#2196F3",
  },
  infoNoteText: {
    fontSize: 11,
    color: "#1565c0",
    fontWeight: "500",
    flex: 1,
    lineHeight: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  modalBody: {
    padding: 16,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
    marginTop: 12,
  },
  billStatusItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  billStatusName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  badgeStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  badgeStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  expenseSummary: {
    backgroundColor: "#fffbf0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#b38604",
  },
  expenseLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  expenseAmount: {
    fontSize: 28,
    fontWeight: "700",
    color: "#b38604",
    marginVertical: 8,
  },
  expenseSubtext: {
    fontSize: 12,
    color: "#999",
  },
  expenseItemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  expenseItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  expenseItemRight: {
    alignItems: "flex-end",
  },
  expenseItemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  expenseItemAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b38604",
  },
  expenseItemPercent: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  progressBarSmall: {
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    overflow: "hidden",
    width: 100,
  },
  progressBarFillSmall: {
    height: "100%",
    backgroundColor: "#b38604",
    borderRadius: 2,
  },
  modalButton: {
    backgroundColor: "#b38604",
    borderRadius: 8,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 24,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  notificationBanner: {
    backgroundColor: "#FFF3E0",
    borderLeftWidth: 4,
    borderLeftColor: "#FF6B35",
    marginHorizontal: 12,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FF6B35",
  },
  notificationMessage: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  notificationAction: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  notificationActionText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});

export default ClientHomeScreen;
