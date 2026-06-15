import React, {
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
  Platform,
  Linking,
  TextInput,
  LayoutAnimation,
  UIManager,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import SafeMapView from "../../components/SafeMapView";
import AdsCarousel from "../../components/AdsCarousel";
import RoommateProfileModal from "../../components/RoommateProfileModal";
import { AuthContext } from "../../context/AuthContext";
import AnimatedAmount from "../../components/AnimatedAmount";
import chatReadTracker from "../../services/chatReadTracker";
import {
  authService,
  roomService,
  memberService,
  billingCycleService,
  apiService,
  chatService,
  roommateService,
  announcementService,
  paymentService,
  badgeService,
} from "../../services/apiService";
import { roundTo2 as r2 } from "../../utils/helpers";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
import { getAPIBaseURL } from "../../config/config";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Toast, ConfirmModal } from "../../components/CustomAlert";
import HomeSpaceLoader from "../../components/SpaceLoader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ACTION_CARD_WIDTH = (SCREEN_WIDTH - 44) / 2;
const ROOMMATE_ONBOARDING_KEY = "@roommate_onboarding_seen";

const AmountSkeleton = ({ style, colors }) => {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.skeleton || colors.borderLight,
          borderRadius: 999,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Enable LayoutAnimation on Android (Old Architecture only).
// In the New Architecture, LayoutAnimation is enabled by default and
// setLayoutAnimationEnabledExperimental is a no-op that emits a warning,
// so we guard with `global.RN$Bridgeless` (true on New Arch) to skip the call.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental &&
  !global.RN$Bridgeless
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Same amenity map used by host — maps key to icon+label
const AMENITY_MAP = {
  wifi: { icon: "wifi", label: "WiFi", color: "#1976d2" },
  kitchen: { icon: "restaurant", label: "Kitchen", color: "#e65100" },
  bathroom: { icon: "water", label: "Bathroom", color: "#0288d1" },
  bedroom: { icon: "bed", label: "Bedroom", color: "#c62828" },
  hotwater: { icon: "flame", label: "Hot Water", color: "#ef6c00" },
  parking: { icon: "car", label: "Parking", color: "#2e7d32" },
  aircon: { icon: "snow", label: "Air-con", color: "#0277bd" },
  laundry: { icon: "shirt", label: "Laundry", color: "#6a1b9a" },
  tv: { icon: "tv", label: "TV", color: "#37474f" },
  cctv: { icon: "videocam", label: "CCTV", color: "#455a64" },
  common: { icon: "people", label: "Common Area", color: "#388e3c" },
  gym: { icon: "barbell", label: "Gym", color: "#d84315" },
};

const ClientHomeScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets);

  const { state } = useContext(AuthContext);
  const [userJoinedRoom, setUserJoinedRoom] = useState(null);
  const [unjoinedRooms, setUnjoinedRooms] = useState([]);
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [pendingRoomIds, setPendingRoomIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expandedStats, setExpandedStats] = useState(false);
  const [balanceBreakdownExpanded, setBalanceBreakdownExpanded] =
    useState(false);
  const [activeCycle, setActiveCycle] = useState(null);
  const [billingDataLoading, setBillingDataLoading] = useState(false);
  const [outstandingBalance, setOutstandingBalance] = useState({
    totalOutstanding: 0,
    unpaidCycles: [],
  });
  const [announcementBanner, setAnnouncementBanner] = useState(null);
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [statusChangeNotifications, setStatusChangeNotifications] = useState(
    [],
  );
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [previewRoom, setPreviewRoom] = useState(null);
  const [fullMapRoom, setFullMapRoom] = useState(null);
  const [photoViewData, setPhotoViewData] = useState(null);
  const [photoViewIdx, setPhotoViewIdx] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [memberActivity, setMemberActivity] = useState([]);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [roommateProfiles, setRoommateProfiles] = useState([]);
  const [roommateLoading, setRoommateLoading] = useState(false);
  const [roommateOnboardingVisible, setRoommateOnboardingVisible] =
    useState(false);
  const [myRoommateProfile, setMyRoommateProfile] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    type: "success",
    message: "",
  });
  const [joinConfirm, setJoinConfirm] = useState({
    visible: false,
    roomId: null,
  });
  const initialLoadDone = useRef(false);
  const lastFocusFetch = useRef(0);
  const joinedRoomIdRef = useRef(null);

  const showToast = (message, type = "success") =>
    setToast({ visible: true, type, message });

  const toggleBreakdown = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 280,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    setBalanceBreakdownExpanded((prev) => !prev);
  }, []);

  const userId = state?.user?.id || state?.user?._id;
  const joinedRoomId = userJoinedRoom?.id || userJoinedRoom?._id;
  joinedRoomIdRef.current = joinedRoomId;
  const userName = state?.user?.name || "User";
  const userEmail = state?.user?.email || "";
  const verifiedRoommateProfiles = useMemo(
    () =>
      roommateProfiles.filter(
        (profile) =>
          profile?.isVerified !== false && (profile?.id || profile?._id),
      ),
    [roommateProfiles],
  );
  const visibleUnjoinedRooms = useMemo(() => {
    const query = roomSearchQuery.trim().toLowerCase();
    if (!query) return unjoinedRooms;

    return unjoinedRooms.filter((room) => {
      const creator = room.creator || room.createdBy || {};
      const searchText = [
        room.name,
        room.code,
        room.roomCode,
        room.room_code,
        room.description,
        room.address,
        room.city,
        room.barangay,
        creator.name,
        creator.email,
        creator.username,
        ...(Array.isArray(room.amenities) ? room.amenities : []),
        ...(Array.isArray(room.houseRules || room.house_rules)
          ? room.houseRules || room.house_rules
          : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(query);
    });
  }, [roomSearchQuery, unjoinedRooms]);

  const getAvatarSource = () => {
    if (avatarError) return require("../../assets/default-avatar.png");
    // External URL (Google/Facebook): kept in /getuser response
    if (state?.user?.avatar?.url?.startsWith("http")) {
      return { uri: state.user.avatar.url };
    }
    // Base64 avatars are stripped from /getuser to save Supabase egress.
    // Use the server's cached avatar-image endpoint instead (1-hour TTL).
    if (userEmail) {
      return {
        uri: `${getAPIBaseURL()}/api/v2/user/avatar-image/${encodeURIComponent(userEmail)}`,
      };
    }
    return require("../../assets/default-avatar.png");
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const formatLastActive = (isoStr) => {
    if (!isoStr) return "Offline";
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Active just now";
    if (mins === 1) return "Active a minute ago";
    if (mins < 60) return `Active ${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs === 1) return "Active an hour ago";
    if (hrs < 24) return `Active ${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Active a day ago";
    return `Active ${days}d ago`;
  };

  const isNewAccountForRoommatePrompt = () => {
    const createdAt =
      state?.user?.created_at || state?.user?.createdAt || state?.user?.created;
    if (!createdAt) return false;
    const createdTime = new Date(createdAt).getTime();
    if (Number.isNaN(createdTime)) return false;
    return Date.now() - createdTime < 7 * 24 * 60 * 60 * 1000;
  };

  const getProfileId = (profile) => profile?.id || profile?._id;

  const getRoommateAvatarSource = (profile) => {
    const avatar = profile?.avatar;
    if (avatar?.url?.startsWith?.("http")) return { uri: avatar.url };
    if (typeof avatar === "string" && avatar.startsWith("http")) {
      return { uri: avatar };
    }
    return null;
  };

  const formatRoommateBudget = (budget) => {
    const amount = Number(budget);
    if (!Number.isFinite(amount) || amount <= 0) return "Budget open";
    if (amount >= 1000) {
      return `PHP ${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K/mo`;
    }
    return `PHP ${amount.toLocaleString()}/mo`;
  };

  const formatMoveInDate = (value) => {
    if (!value) return "Move-in flexible";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `Move in ${date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    })}`;
  };

  const getLocationLabel = (profile, fallback = "Location flexible") => {
    const locations = Array.isArray(profile?.preferredLocations)
      ? profile.preferredLocations
      : [];
    return locations.length > 0 ? locations.join(", ") : fallback;
  };

  const handleCloseRoommateOnboarding = async () => {
    setRoommateOnboardingVisible(false);
    if (userId) {
      await AsyncStorage.setItem(`${ROOMMATE_ONBOARDING_KEY}:${userId}`, "1");
    }
  };

  const handleRoommateSaved = (profile) => {
    setMyRoommateProfile(profile);
    if (profile) {
      setRoommateProfiles((current) =>
        current.filter(
          (item) =>
            String(item.userId || item.user_id) !== String(profile.userId),
        ),
      );
    }
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
      customChargesStatus: "unpaid",
    };

    // Check for custom charges
    let hasCustomCharges = false;
    if (activeCycle?.customCharges) {
      try {
        const customCharges = Array.isArray(activeCycle.customCharges)
          ? activeCycle.customCharges
          : typeof activeCycle.customCharges === "string"
            ? JSON.parse(activeCycle.customCharges)
            : [];
        hasCustomCharges = customCharges.length > 0;
      } catch (_) {
        hasCustomCharges = false;
      }
    }

    const allPaid =
      paymentData.rentStatus === "paid" &&
      paymentData.electricityStatus === "paid" &&
      paymentData.waterStatus === "paid" &&
      (paymentData.internetStatus === "paid" ||
        !userJoinedRoom.billing?.internet) &&
      (!hasCustomCharges || paymentData.customChargesStatus === "paid");

    const pendingStatuses = [
      paymentData.rentStatus,
      paymentData.electricityStatus,
      paymentData.waterStatus,
      paymentData.internetStatus,
    ];

    if (hasCustomCharges) {
      pendingStatuses.push(paymentData.customChargesStatus || "unpaid");
    }

    const pendingCount = pendingStatuses.filter(
      (status) => status === "unpaid",
    ).length;

    return {
      allPaid,
      pendingCount,
      status: paymentData,
    };
  };

  // Calculate remaining due (total - paid amounts)
  const getRemainingDue = () => {
    const breakdown = getExpenseBreakdown();
    if (!breakdown || !isCurrentUserPayor()) return 0;

    const paymentStatus = getPaymentStatus();
    if (!paymentStatus) return breakdown.perPayor;

    let totalDue = breakdown.perPayor;
    let totalPaid = 0;

    // Calculate paid amounts based on payment status
    if (paymentStatus.status.rentStatus === "paid") {
      totalPaid += breakdown.rent?.amount || 0;
    }
    if (paymentStatus.status.electricityStatus === "paid") {
      totalPaid += breakdown.electricity?.amount || 0;
    }
    if (paymentStatus.status.waterStatus === "paid") {
      totalPaid += breakdown.water?.amount || 0;
    }
    if (paymentStatus.status.internetStatus === "paid") {
      totalPaid += breakdown.internet?.amount || 0;
    }
    if (paymentStatus.status.customChargesStatus === "paid") {
      totalPaid +=
        breakdown.customCharges?.reduce((sum, c) => sum + c.amount, 0) || 0;
    }

    return Math.max(0, totalDue - totalPaid);
  };

  const getCycleDaysRemaining = () => {
    if (!activeCycle) return null;
    return Math.max(
      0,
      Math.ceil(
        (new Date(activeCycle.end_date || activeCycle.endDate).getTime() -
          Date.now()) /
          (1000 * 60 * 60 * 24),
      ),
    );
  };

  const getIndividualBills = () => {
    const breakdown = getExpenseBreakdown();
    const paymentStatus = getPaymentStatus();
    const daysRemaining = getCycleDaysRemaining() ?? 0;

    const bills = [
      {
        name: "Rent",
        icon: "home",
        color: "#e65100",
        iconBg: "#fff3e0",
        amount: breakdown?.rent?.amount || 0,
        status: paymentStatus?.status?.rentStatus || "unpaid",
      },
      {
        name: "Electricity",
        icon: "flash",
        color: colors.electricityColor,
        iconBg: "#fffde7",
        amount: breakdown?.electricity?.amount || 0,
        status: paymentStatus?.status?.electricityStatus || "unpaid",
      },
      {
        name: "Water",
        icon: "water",
        color: colors.waterColor,
        iconBg: "#e3f2fd",
        amount: breakdown?.water?.amount || 0,
        status: paymentStatus?.status?.waterStatus || "unpaid",
      },
      {
        name: "Internet",
        icon: "wifi",
        color: colors.internetColor,
        iconBg: "#f3e5f5",
        amount: breakdown?.internet?.amount || 0,
        status: paymentStatus?.status?.internetStatus || "unpaid",
      },
      ...(breakdown?.customCharges && breakdown.customCharges.length > 0
        ? breakdown.customCharges.map((charge) => ({
            name: charge.name || "Charge",
            icon: "pricetag",
            color: colors.accent,
            iconBg: colors.accentSurface,
            amount: charge.amount || 0,
            status: paymentStatus?.status?.customChargesStatus || "unpaid",
          }))
        : []),
    ].filter((bill) => bill.amount > 0);

    return { bills, daysRemaining };
  };

  // Calculate remaining amount for a specific bill type
  const getRemainingAmountForBill = (billType) => {
    const breakdown = getExpenseBreakdown();
    if (!breakdown || !isCurrentUserPayor()) return 0;

    const paymentStatus = getPaymentStatus();
    if (!paymentStatus) return 0;

    let fullAmount = 0;
    switch (billType) {
      case "rent":
        fullAmount = breakdown.rent?.amount || 0;
        return paymentStatus.status.rentStatus === "paid" ? 0 : fullAmount;
      case "electricity":
        fullAmount = breakdown.electricity?.amount || 0;
        return paymentStatus.status.electricityStatus === "paid"
          ? 0
          : fullAmount;
      case "water":
        fullAmount = breakdown.water?.amount || 0;
        return paymentStatus.status.waterStatus === "paid" ? 0 : fullAmount;
      case "internet":
        fullAmount = breakdown.internet?.amount || 0;
        return paymentStatus.status.internetStatus === "paid" ? 0 : fullAmount;
      case "customCharges":
        return paymentStatus.status.customChargesStatus === "paid"
          ? 0
          : breakdown.customCharges?.reduce((sum, c) => sum + c.amount, 0) || 0;
      default:
        return 0;
    }
  };

  // Check if a bill type is paid
  const isBillPaid = (billType) => {
    const paymentStatus = getPaymentStatus();
    if (!paymentStatus) return false;

    switch (billType) {
      case "rent":
        return paymentStatus.status.rentStatus === "paid";
      case "electricity":
        return paymentStatus.status.electricityStatus === "paid";
      case "water":
        return paymentStatus.status.waterStatus === "paid";
      case "internet":
        return paymentStatus.status.internetStatus === "paid";
      case "customCharges":
        return paymentStatus.status.customChargesStatus === "paid";
      default:
        return false;
    }
  };

  const getCustomChargeIcon = (chargeName) => {
    const name = chargeName?.toLowerCase() || "";
    if (name.includes("maintenance")) return "home-repair-service";
    if (name.includes("groceries") || name.includes("grocery"))
      return "local-grocery-store";
    if (name.includes("cleaning")) return "cleaning-services";
    if (name.includes("housekeeping")) return "cleaning-services";
    if (name.includes("parking")) return "local-parking";
    if (name.includes("pet") || name.includes("pets")) return "pets";
    if (name.includes("laundry")) return "local-laundry-service";
    return "add-home"; // fallback
  };

  // Calculate billing countdown
  const getBillingCountdown = () => {
    if (!userJoinedRoom?.billing?.end) return null;

    // CRITICAL: Only show countdown if the current cycle is still active (not completed)
    if (activeCycle && activeCycle.status !== "active") {
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
  const calcWaterFromPresence = (members, payorCount, cycleStart, cycleEnd) => {
    if (!members?.length) return 0;
    const myMember = members.find(
      (m) => String(m.user?.id || m.user?._id || m.user) === String(userId),
    );
    if (!myMember?.isPayer) return 0;

    // Filter presence to only dates within the current billing cycle
    const sd = cycleStart ? new Date(cycleStart) : null;
    const ed = cycleEnd ? new Date(cycleEnd) : null;
    const filterPresence = (presence) => {
      if (!sd || !ed || !Array.isArray(presence)) return presence || [];
      return presence.filter((d) => {
        const dt = new Date(d);
        return dt >= sd && dt <= ed;
      });
    };

    const myWater =
      filterPresence(myMember.presence).length * WATER_BILL_PER_DAY;
    let nonPayorWater = 0;
    members.forEach((m) => {
      if (!m.isPayer) {
        nonPayorWater += filterPresence(m.presence).length * WATER_BILL_PER_DAY;
      }
    });
    return r2(myWater + (payorCount > 0 ? nonPayorWater / payorCount : 0));
  };

  // Get expense breakdown for modal
  const getExpenseBreakdown = () => {
    // Parse custom charges from active cycle
    let customCharges = [];
    let customChargesTotal = 0;
    if (activeCycle?.customCharges) {
      try {
        customCharges = Array.isArray(activeCycle.customCharges)
          ? activeCycle.customCharges
          : typeof activeCycle.customCharges === "string"
            ? JSON.parse(activeCycle.customCharges)
            : [];
        customChargesTotal = customCharges.reduce(
          (sum, c) => sum + parseFloat(c.amount || 0),
          0,
        );
      } catch (_) {
        customCharges = [];
        customChargesTotal = 0;
      }
    }

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
          customCharges: customCharges.map((c) => ({
            name: c.name || "Charge",
            amount: r2(parseFloat(c.amount || 0) / payorCount),
            percentage:
              total > 0
                ? (parseFloat(c.amount || 0) / payorCount / total) * 100
                : 0,
          })),
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
    const customChargesPerPayor =
      payorCount > 0 ? r2(customChargesTotal / payorCount) : 0;

    // Water: fixed monthly or presence-based
    const isFixedWater =
      userJoinedRoom?.waterBillingMode === "fixed_monthly" ||
      userJoinedRoom?.water_billing_mode === "fixed_monthly";
    const fixedWaterAmt =
      parseFloat(
        userJoinedRoom?.waterFixedAmount ||
          userJoinedRoom?.water_fixed_amount ||
          0,
      ) || 0;
    const isPerPersonWater =
      (userJoinedRoom?.waterFixedType || userJoinedRoom?.water_fixed_type) ===
      "per_person";

    // For per-person fixed water, redistribute non-payor shares to payors
    const nonPayerCount = members.length - payorCount;
    const nonPayorWaterPerPayor =
      isFixedWater && isPerPersonWater && payorCount > 0
        ? r2((nonPayerCount * fixedWaterAmt) / payorCount)
        : 0;

    const water = isFixedWater
      ? isPerPersonWater
        ? r2(fixedWaterAmt + nonPayorWaterPerPayor)
        : r2(fixedWaterAmt / payorCount)
      : calcWaterFromPresence(
          members,
          payorCount,
          activeCycle?.start_date || activeCycle?.startDate,
          activeCycle?.end_date || activeCycle?.endDate,
        );

    const total = r2(
      rent + electricity + internet + water + customChargesPerPayor,
    );
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
      customCharges: customCharges.map((c) => ({
        name: c.name || "Charge",
        amount: r2(parseFloat(c.amount || 0) / payorCount),
        percentage:
          total > 0
            ? (parseFloat(c.amount || 0) / payorCount / total) * 100
            : 0,
      })),
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

      // Extract avatar URL - handle both string and object formats
      let avatarUrl = null;
      if (payor.user?.avatar) {
        if (typeof payor.user.avatar === "string") {
          avatarUrl = payor.user.avatar;
        } else if (
          typeof payor.user.avatar === "object" &&
          payor.user.avatar.url
        ) {
          avatarUrl = payor.user.avatar.url;
        }
      }

      const paymentData = payment || {
        rentStatus: "unpaid",
        electricityStatus: "unpaid",
        waterStatus: "unpaid",
        internetStatus: "unpaid",
      };

      return {
        name: payor.user?.name || "Unknown",
        userId: String(payor.user?.id || payor.user?._id || payor.user),
        avatar: avatarUrl,
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

  const fetchStatusChangeNotifications = async () => {
    try {
      const [response, counts] = await Promise.all([
        apiService.get("/api/v2/notifications"),
        badgeService.getCounts().catch(() => null),
      ]);
      const allNotifications = response.notifications || [];
      const fallbackUnreadCount = allNotifications.filter(
        (notif) => !notif.isRead,
      ).length;
      setUnreadNotificationCount(
        counts?.unreadNotifications ?? fallbackUnreadCount,
      );
      // Filter for only unread member status change notifications
      const statusChanges = allNotifications.filter(
        (notif) =>
          notif.notificationType === "member_status_changed" && !notif.isRead,
      );
      setStatusChangeNotifications(statusChanges);
    } catch (error) {
      console.error("Error fetching status notifications:", error);
      setUnreadNotificationCount(0);
    }
  };

  const fetchAnnouncementBanner = async (roomId) => {
    try {
      const response = await announcementService.getRoomAnnouncements(roomId);
      const currentUserId = state?.user?.id || state?.user?._id;
      const pinned = (response.announcements || []).filter((a) => {
        if (!(a.isPinned || a.is_pinned)) return false;
        // If targeted to a specific user, only show to that user
        const target = a.targetUserId || a.target_user_id;
        if (target && String(target) !== String(currentUserId)) return false;
        return true;
      });
      if (!pinned.length) return;
      pinned.sort(
        (a, b) =>
          new Date(b.createdAt || b.created_at) -
          new Date(a.createdAt || a.created_at),
      );
      const latest = pinned[0];
      const dismissedKey = `banner_dismissed_${currentUserId}_${latest.id || latest._id}`;
      const dismissed = await AsyncStorage.getItem(dismissedKey);
      if (!dismissed) setAnnouncementBanner(latest);
    } catch (_) {}
  };

  const dismissBanner = async () => {
    if (!announcementBanner) return;
    const id = announcementBanner.id || announcementBanner._id;
    const currentUserId = state?.user?.id || state?.user?._id;
    await AsyncStorage.setItem(`banner_dismissed_${currentUserId}_${id}`, "1");
    setAnnouncementBanner(null);
  };

  const fetchActiveBillingCycle = async (roomId) => {
    try {
      const response = await billingCycleService.getCurrentCycle(roomId);
      setActiveCycle(response?.billingCycle || response?.data || null);
    } catch (error) {
      console.error("Error fetching active billing cycle:", error);
      setActiveCycle(null);
    }
  };

  const fetchOutstandingBalance = async (roomId) => {
    try {
      const res = await billingCycleService.getOutstandingBalance(roomId);
      setOutstandingBalance({
        totalOutstanding: res?.totalOutstanding || 0,
        unpaidCycles: res?.unpaidCycles || [],
      });
    } catch (_) {
      setOutstandingBalance({ totalOutstanding: 0, unpaidCycles: [] });
    }
  };

  // Fetch unread chat count for the joined room (only messages after last read)
  const fetchChatBadge = async (roomId) => {
    try {
      const status = await chatService.getChatStatus(roomId);
      if (!status.chatEnabled) {
        setUnreadChatCount(0);
        return;
      }
      // Use lastRead timestamp as 'after' cursor — only fetches messages newer
      // than what was already read. Near-zero egress when no new messages.
      const lastRead = await chatReadTracker.getLastRead(roomId);
      const afterTs = lastRead ? new Date(lastRead).toISOString() : undefined;
      const res = await chatService.getMessages(roomId, {
        after: afterTs,
        limit: 50,
      });
      const msgs = res.messages || [];
      const unread = msgs.filter((m) => String(m.senderId) !== String(userId));
      setUnreadChatCount(unread.length);
    } catch {
      setUnreadChatCount(0);
    }
  };

  const fetchMemberActivity = async (roomId) => {
    try {
      const res = await roomService.getMemberActivity(roomId);
      setMemberActivity(res.members || []);
    } catch {
      setMemberActivity([]);
    }
  };

  // Lightweight poll: update only online/offline dots (zero DB queries on backend)
  const pollMemberStatus = async (roomId) => {
    try {
      const res = await roomService.getMemberStatus(roomId);
      const statuses = res.statuses || {};
      setMemberActivity((prev) =>
        prev.map((m) => {
          const s = statuses[m.userId];
          if (!s) return m;
          return {
            ...m,
            isOnline: s.isOnline,
            isRecentlyActive: s.isRecentlyActive,
            lastActiveAt: s.lastActiveAt,
          };
        }),
      );
    } catch {
      // silent — polling failure shouldn't affect UX
    }
  };

  // Fetch public user profile when member name is clicked
  const viewUserProfile = async (userId) => {
    try {
      const res = await authService.getPublicProfile(userId);
      // console.log("Profile response:", res);
      setSelectedUserProfile(res.user || null);
      setProfileModalVisible(true);
    } catch (err) {
      console.error("Profile fetch error:", err);
      showToast(
        "Could not load user profile. " + (err?.message || ""),
        "error",
      );
    }
  };

  const fetchRoommateProfiles = async () => {
    try {
      setRoommateLoading(true);
      const profiles = await roommateService.getProfiles();
      setRoommateProfiles(
        (Array.isArray(profiles) ? profiles : []).filter(
          (profile) => profile?.isVerified !== false,
        ),
      );
    } catch (error) {
      console.error("Error fetching roommate profiles:", error);
      setRoommateProfiles([]);
    } finally {
      setRoommateLoading(false);
    }
  };

  const fetchMyRoommateProfile = async ({ promptIfNew = false } = {}) => {
    if (!userId) return;

    try {
      const profile = await roommateService.getMyProfile();
      setMyRoommateProfile(profile);

      if (promptIfNew && !profile && isNewAccountForRoommatePrompt()) {
        const seen = await AsyncStorage.getItem(
          `${ROOMMATE_ONBOARDING_KEY}:${userId}`,
        );
        if (!seen) {
          setRoommateOnboardingVisible(true);
        }
      }
    } catch (error) {
      console.error("Error fetching my roommate profile:", error);
    }
  };

  // Immediately refresh outstanding balance and billing cycle when returning from payment with refresh param
  useEffect(() => {
    if (route.params?.refresh && userJoinedRoom) {
      const roomId = userJoinedRoom.id || userJoinedRoom._id;
      setBillingDataLoading(true);
      Promise.all([
        fetchOutstandingBalance(roomId),
        fetchActiveBillingCycle(roomId),
      ])
        .catch(() => {})
        .finally(() => setBillingDataLoading(false));
      // Clear the param so repeated navigation doesn't trigger multiple refreshes
      route.params.refresh = false;
    }
  }, [route.params?.refresh, userJoinedRoom]);

  // Refresh room data when screen comes into focus (throttled: max once per 30s).
  // Keep this independent from userJoinedRoom so setting the room does not
  // immediately trigger a second refetch and restart the balance skeleton.
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (!initialLoadDone.current) {
        lastFocusFetch.current = now;
        fetchRooms(true);
      } else if (now - lastFocusFetch.current > 30000) {
        lastFocusFetch.current = now;
        fetchRooms(false);
      }

      fetchRoommateProfiles();
      fetchStatusChangeNotifications();
    }, [userId]),
  );

  // Start lightweight status polling while screen is focused.
  useFocusEffect(
    useCallback(() => {
      if (!joinedRoomId) return undefined;

      fetchChatBadge(joinedRoomId);
      const interval = setInterval(() => pollMemberStatus(joinedRoomId), 30000);
      return () => {
        clearInterval(interval);
      };
    }, [joinedRoomId]),
  );

  useEffect(() => {
    fetchMyRoommateProfile({ promptIfNew: true });
  }, [userId]);

  const fetchRooms = async (showSpinner = false) => {
    try {
      // Only show full-screen spinner on initial load, not on refocus
      if (showSpinner) setLoading(true);

      // ── Wave 1: fetch room data (this is all we need to show the UI) ──
      const [userRoomsResponse, availableRoomsResponse] = await Promise.all([
        roomService.getClientRooms(),
        roomService.getAvailableRooms().catch((err) => {
          console.error("Error fetching available rooms:", err);
          return { rooms: [], pendingRoomIds: [] };
        }),
      ]);

      // Process user's rooms
      const userRoomsData = userRoomsResponse.data || userRoomsResponse;
      const userRooms = userRoomsData.rooms || userRoomsData || [];
      const firstRoom = userRooms[0] || null;
      const roomId = firstRoom?.id || firstRoom?._id;
      const currentJoinedRoomId = joinedRoomIdRef.current;
      const isSameRoom =
        roomId &&
        currentJoinedRoomId &&
        String(roomId) === String(currentJoinedRoomId);
      const shouldResetBillingData =
        !!roomId && (!initialLoadDone.current || !isSameRoom);

      if (!roomId) {
        setActiveCycle(null);
        setOutstandingBalance({ totalOutstanding: 0, unpaidCycles: [] });
        setHasPendingPayment(false);
        setBillingDataLoading(false);
      } else if (shouldResetBillingData) {
        setActiveCycle(null);
        setOutstandingBalance({ totalOutstanding: 0, unpaidCycles: [] });
        setHasPendingPayment(false);
        setBillingDataLoading(true);
      }
      setUserJoinedRoom(firstRoom);

      // Process available rooms
      const availableRoomsData =
        availableRoomsResponse.data || availableRoomsResponse;
      const allRooms = availableRoomsData.rooms || availableRoomsData || [];
      const pending = availableRoomsData.pendingRoomIds || [];
      setPendingRoomIds(pending);

      const userRoomIds = userRooms.map((r) => r.id || r._id);
      const notJoined = allRooms.filter(
        (room) => !userRoomIds.includes(room.id || room._id),
      );
      setUnjoinedRooms(notJoined);

      // ── Show room UI immediately ──
      setLoading(false);
      initialLoadDone.current = true;

      // ── Wave 2 (background, non-blocking): billing, notifications, chat ──
      if (roomId) {
        Promise.all([
          fetchActiveBillingCycle(roomId),
          fetchOutstandingBalance(roomId),
          paymentService
            .getPaymentHistory(roomId, {
              status: "pending",
              limit: 1,
              includeUser: false,
            })
            .then((res) => {
              const payments =
                res?.payments || res?.transactions || res?.data || [];
              setHasPendingPayment(
                payments.some(
                  (p) => p.status === "pending" || p.status === "submitted",
                ),
              );
            })
            .catch(() => {}),
        ])
          .catch(() => {})
          .finally(() => setBillingDataLoading(false));
      }

      Promise.all([
        fetchStatusChangeNotifications(),
        fetchRoommateProfiles(),
        roomId ? fetchChatBadge(roomId) : Promise.resolve(),
        roomId ? fetchAnnouncementBanner(roomId) : Promise.resolve(),
        roomId ? fetchMemberActivity(roomId) : Promise.resolve(),
      ]).catch(() => {});
    } catch (error) {
      console.error("Error fetching rooms:", error);
      setUserJoinedRoom(null);
      setUnjoinedRooms([]);
      setBillingDataLoading(false);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchRooms(),
      fetchRoommateProfiles(),
      fetchMyRoommateProfile(),
    ]);
    setRefreshing(false);
  };

  const handleJoinRoom = async (roomId) => {
    setJoinConfirm({ visible: true, roomId });
  };

  const joinRoomWithPayerStatus = async (roomId, isPayer) => {
    try {
      setJoiningRoomId(roomId);
      const response = await memberService.addMember(roomId, {
        userId,
        isPayer,
      });
      if (response.pending) {
        showToast(
          "Join request sent! You'll be notified once approved.",
          "info",
        );
      } else {
        const payorStatus = isPayer ? "payor" : "non-payor";
        showToast(`You've joined the room as a ${payorStatus}!`, "success");
      }
      await fetchRooms();
    } catch (error) {
      console.error("Error joining room:", error);
      const message =
        error.data?.message || error.message || "Failed to join room";
      showToast(message, "error");
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
            <Ionicons
              name="arrow-forward"
              size={14}
              color={colors.textOnAccent}
            />
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
                <Ionicons
                  name="add-circle-outline"
                  size={14}
                  color={colors.accent}
                />
                <Text style={styles.joinButtonText}>Join Room</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ─── FULL-SCREEN MAP MODAL ───
  const FullMapModal = () => {
    if (!fullMapRoom) return null;
    const openInMaps = () => {
      const lat = fullMapRoom.latitude;
      const lng = fullMapRoom.longitude;
      const label = encodeURIComponent(fullMapRoom.name || "Location");
      const url =
        Platform.OS === "ios"
          ? `maps:0,0?q=${label}@${lat},${lng}`
          : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
      Linking.openURL(url).catch(() =>
        Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`),
      );
    };
    return (
      <Modal
        visible={!!fullMapRoom}
        animationType="slide"
        onRequestClose={() => setFullMapRoom(null)}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <SafeMapView
            latitude={fullMapRoom.latitude}
            longitude={fullMapRoom.longitude}
            title={fullMapRoom.name}
            interactive
            hideOpenBtn
            style={{ flex: 1 }}
          />
          {/* Floating header */}
          <View style={styles.fullMapHeader}>
            <TouchableOpacity
              style={styles.fullMapBackBtn}
              onPress={() => setFullMapRoom(null)}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.fullMapTitleWrap}>
              <Text style={styles.fullMapTitle} numberOfLines={1}>
                {fullMapRoom.name}
              </Text>
              <Text style={styles.fullMapSubtitle}>Tap & drag to explore</Text>
            </View>
          </View>
          {/* Floating address bar */}
          {fullMapRoom.address ? (
            <View style={styles.fullMapAddressBar}>
              <Ionicons name="location" size={17} color={colors.accent} />
              <Text style={styles.fullMapAddressText} numberOfLines={2}>
                {fullMapRoom.address}
              </Text>
              <TouchableOpacity
                style={styles.fullMapOpenBtn}
                onPress={openInMaps}
                activeOpacity={0.8}
              >
                <Ionicons name="navigate" size={14} color="#fff" />
                <Text style={styles.fullMapOpenBtnText}>Maps</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    );
  };

  // ─── ROOM INFO PREVIEW MODAL ───
  const RoomInfoModal = () => {
    if (!previewRoom) return null;
    const rid = previewRoom.id || previewRoom._id;
    const isPending = pendingRoomIds.includes(rid);
    const hasLocation =
      previewRoom.latitude != null && previewRoom.longitude != null;
    const amenities = Array.isArray(previewRoom.amenities)
      ? previewRoom.amenities
      : [];
    const houseRules = Array.isArray(
      previewRoom.houseRules || previewRoom.house_rules,
    )
      ? previewRoom.houseRules || previewRoom.house_rules
      : [];
    const previewPhotos = Array.isArray(previewRoom.photos)
      ? previewRoom.photos
      : [];
    const previewRent = Number(
      previewRoom.rent ||
        previewRoom.price ||
        previewRoom.monthlyRent ||
        previewRoom.billing?.rent ||
        0,
    );
    const [activePhotoIdx, setActivePhotoIdx] = React.useState(0);
    const photoWidth = SCREEN_WIDTH - 48;

    return (
      <Modal
        visible={!!previewRoom}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewRoom(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.roomInfoModal}>
            {/* Header */}
            <View style={styles.roomInfoHeader}>
              <View style={styles.roomInfoHeaderLeft}>
                <View style={styles.roomInfoIconBg}>
                  <Ionicons name="home" size={20} color={colors.accent} />
                </View>
                <Text style={styles.roomInfoTitle} numberOfLines={1}>
                  {previewRoom.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPreviewRoom(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollViewWithDetection
              style={styles.roomInfoBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Photo Gallery */}
              {previewPhotos.length > 0 && (
                <View>
                  <View style={{ position: "relative" }}>
                    <ScrollViewWithDetection
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      style={styles.roomInfoPhotoScroll}
                      onScroll={(e) => {
                        const idx = Math.round(
                          e.nativeEvent.contentOffset.x / photoWidth,
                        );
                        setActivePhotoIdx(idx);
                      }}
                      scrollEventThrottle={16}
                    >
                      {previewPhotos.map((uri, idx) => (
                        <Image
                          key={idx}
                          source={{ uri }}
                          style={styles.roomInfoPhoto}
                          resizeMode="cover"
                        />
                      ))}
                    </ScrollViewWithDetection>
                    {/* Overlay: photo count + full view button */}
                    <View style={styles.photoModalOverlay}>
                      <View style={styles.photoCountBadge}>
                        <Ionicons name="images" size={12} color="#fff" />
                        <Text style={styles.photoCountText}>
                          {previewPhotos.length}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.photoFullViewBtn}
                        onPress={() => {
                          setPhotoViewIdx(0);
                          setPhotoViewData({
                            name: previewRoom.name,
                            photos: previewPhotos,
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="expand-outline"
                          size={13}
                          color="#fff"
                        />
                        <Text style={styles.photoFullViewText}>View</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {previewPhotos.length > 1 && (
                    <View style={styles.photoDotRow}>
                      {previewPhotos.map((_, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.photoDot,
                            idx === activePhotoIdx && styles.photoDotActive,
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Location Map — tappable to open full-screen */}
              {hasLocation && (
                <TouchableOpacity
                  style={styles.roomInfoMapWrap}
                  activeOpacity={0.8}
                  onPress={() => setFullMapRoom(previewRoom)}
                >
                  <SafeMapView
                    latitude={previewRoom.latitude}
                    longitude={previewRoom.longitude}
                    style={styles.roomInfoMap}
                  />
                  <View style={styles.roomInfoAddressRow}>
                    <Ionicons name="location" size={14} color={colors.accent} />
                    <Text style={styles.roomInfoAddressText} numberOfLines={2}>
                      {previewRoom.address || "Location pinned"}
                    </Text>
                    <Ionicons
                      name="expand-outline"
                      size={16}
                      color={colors.accent}
                    />
                  </View>
                </TouchableOpacity>
              )}

              {/* Description */}
              {previewRoom.description ? (
                <View style={styles.roomInfoSection}>
                  <View style={styles.roomInfoSectionHeader}>
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color={colors.accent}
                    />
                    <Text style={styles.roomInfoSectionTitle}>About</Text>
                  </View>
                  <Text style={styles.roomInfoDescText}>
                    {previewRoom.description}
                  </Text>
                </View>
              ) : null}

              {/* Stats Row */}
              <View style={styles.roomInfoStatsRow}>
                <View style={styles.roomInfoStat}>
                  <Ionicons name="people" size={18} color={colors.accent} />
                  <Text style={styles.roomInfoStatValue}>
                    {previewRoom.memberCount ??
                      previewRoom.members?.length ??
                      0}
                  </Text>
                  <Text style={styles.roomInfoStatLabel}>Tenants</Text>
                </View>
                <View style={styles.roomInfoStatDivider} />
                <View style={styles.roomInfoStat}>
                  <Ionicons
                    name={hasLocation ? "location" : "location-outline"}
                    size={18}
                    color={hasLocation ? colors.success : colors.textTertiary}
                  />
                  <Text style={styles.roomInfoStatValue}>
                    {hasLocation ? "Pinned" : "N/A"}
                  </Text>
                  <Text style={styles.roomInfoStatLabel}>Location</Text>
                </View>
                <View style={styles.roomInfoStatDivider} />
                <View style={styles.roomInfoStat}>
                  <Ionicons name="pricetag" size={18} color={colors.accent} />
                  <Text style={styles.roomInfoStatValue} numberOfLines={1}>
                    {previewRent > 0
                      ? `₱${previewRent.toLocaleString()}`
                      : "Ask"}
                  </Text>
                  <Text style={styles.roomInfoStatLabel}>Price</Text>
                </View>
              </View>

              {/* Amenities — dynamic from host */}
              {amenities.length > 0 && (
                <View style={styles.roomInfoSection}>
                  <View style={styles.roomInfoSectionHeader}>
                    <Ionicons name="sparkles" size={16} color={colors.accent} />
                    <Text style={styles.roomInfoSectionTitle}>Amenities</Text>
                  </View>
                  <View style={styles.roomInfoAmenitiesRow}>
                    {amenities.map((key, i) => {
                      const a = AMENITY_MAP[key] || {
                        icon: "ellipse",
                        label: key,
                        color: colors.textTertiary,
                      };
                      return (
                        <View key={i} style={styles.roomInfoAmenity}>
                          <Ionicons name={a.icon} size={16} color={a.color} />
                          <Text style={styles.roomInfoAmenityText}>
                            {a.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* House Rules — dynamic from host */}
              {houseRules.length > 0 && (
                <View style={styles.roomInfoSection}>
                  <View style={styles.roomInfoSectionHeader}>
                    <Ionicons
                      name="clipboard-outline"
                      size={16}
                      color={colors.accent}
                    />
                    <Text style={styles.roomInfoSectionTitle}>House Rules</Text>
                  </View>
                  {houseRules.map((rule, idx) => (
                    <View key={idx} style={styles.roomInfoRuleRow}>
                      <View style={styles.roomInfoRuleCheck}>
                        <Ionicons name="checkmark" size={11} color="#fff" />
                      </View>
                      <Text style={styles.roomInfoRuleText}>{rule}</Text>
                    </View>
                  ))}
                </View>
              )}
              <ModalBottomSpacer />
            </ScrollViewWithDetection>

            {/* Bottom action */}
            <View style={styles.roomInfoFooter}>
              {isPending ? (
                <View style={styles.roomInfoPendingBtn}>
                  <Ionicons name="time-outline" size={18} color="#e67e22" />
                  <Text style={styles.roomInfoPendingText}>
                    Pending Approval
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.roomInfoJoinBtn}
                  onPress={() => {
                    setPreviewRoom(null);
                    handleJoinRoom(rid);
                  }}
                  disabled={joiningRoomId === rid}
                  activeOpacity={0.7}
                >
                  {joiningRoomId === rid ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={18} color="#fff" />
                      <Text style={styles.roomInfoJoinText}>
                        Inquire this room
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
                style={[
                  styles.modalIconBg,
                  { backgroundColor: colors.successBg },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.success}
                />
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

          <ScrollViewWithDetection style={styles.modalBody}>
            {userJoinedRoom?.cycleStatus === "completed" && (
              <View
                style={{
                  backgroundColor: colors.successBg,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Ionicons
                  name="checkmark-done-circle"
                  size={20}
                  color={colors.success}
                />
                <Text
                  style={{
                    color: colors.success,
                    fontWeight: "600",
                    fontSize: 13,
                    marginLeft: 8,
                    flex: 1,
                  }}
                >
                  Billing cycle complete — all bills are settled!
                </Text>
              </View>
            )}
            {userJoinedRoom?.cycleStatus === "cycle_closed" &&
              !getPaymentStatus()?.allPaid && (
                <View
                  style={{
                    backgroundColor: "#fff3e0",
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="warning" size={20} color="#e65100" />
                  <Text
                    style={{
                      color: "#e65100",
                      fontWeight: "600",
                      fontSize: 13,
                      marginLeft: 8,
                      flex: 1,
                    }}
                  >
                    Billing cycle closed — you still have outstanding bills.
                  </Text>
                </View>
              )}
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
                    icon: "flash-on",
                    status: getPaymentStatus().status.electricityStatus,
                  },
                  {
                    bill: "Water",
                    icon: "water-drop",
                    status: getPaymentStatus().status.waterStatus,
                  },
                  {
                    bill: "Internet",
                    icon: "wifi",
                    status: getPaymentStatus().status.internetStatus,
                  },
                  ...(() => {
                    let customCharges = [];
                    if (activeCycle?.customCharges) {
                      try {
                        customCharges = Array.isArray(activeCycle.customCharges)
                          ? activeCycle.customCharges
                          : typeof activeCycle.customCharges === "string"
                            ? JSON.parse(activeCycle.customCharges)
                            : [];
                      } catch (_) {
                        customCharges = [];
                      }
                    }
                    return customCharges.map((charge) => ({
                      bill: charge.name || "Charge",
                      icon: getCustomChargeIcon(charge.name),
                      status:
                        getPaymentStatus().status.customChargesStatus ||
                        "unpaid",
                    }));
                  })(),
                ].map((item, idx) => (
                  <View key={idx} style={styles.statusRow}>
                    <View style={styles.statusRowLeft}>
                      <MaterialIcons
                        name={item.icon}
                        size={18}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.statusRowLabel}>{item.bill}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor:
                            item.status === "paid"
                              ? colors.successBg
                              : colors.warningBg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          item.status === "paid" ? "checkmark-circle" : "time"
                        }
                        size={14}
                        color={
                          item.status === "paid" ? colors.success : "#e65100"
                        }
                      />
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color:
                              item.status === "paid"
                                ? colors.success
                                : "#e65100",
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
            <ModalBottomSpacer />
          </ScrollViewWithDetection>

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
          {/* Drag handle pill */}
          <View style={styles.modalDragHandle} />

          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View
                style={[
                  styles.modalIconBg,
                  { backgroundColor: colors.breakdownHeaderBg },
                ]}
              >
                <Ionicons
                  name="pie-chart"
                  size={18}
                  color={colors.breakdownHeaderIcon}
                />
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

          <ScrollViewWithDetection style={styles.modalBody}>
            {getExpenseBreakdown() && (
              <View>
                {/* ── Summary hero card ── */}
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

                {/* ── Bill rows ── */}
                {[
                  {
                    name: "Rent",
                    icon: "home",
                    color: "#e65100",
                    iconBg: "rgba(230,81,0,0.10)",
                    data: getExpenseBreakdown().rent,
                    billType: "rent",
                  },
                  {
                    name: "Electricity",
                    icon: "flash",
                    color: colors.electricityColor,
                    iconBg: "rgba(122,89,0,0.10)",
                    data: getExpenseBreakdown().electricity,
                    billType: "electricity",
                  },
                  {
                    name:
                      userJoinedRoom?.waterBillingMode === "fixed_monthly" ||
                      userJoinedRoom?.water_billing_mode === "fixed_monthly"
                        ? "Water (Fixed)"
                        : "Water",
                    icon: "water",
                    color: colors.waterColor,
                    iconBg: "rgba(27,78,76,0.12)",
                    data: getExpenseBreakdown().water,
                    billType: "water",
                  },
                  {
                    name: "Internet",
                    icon: "wifi",
                    color: colors.internetColor,
                    iconBg: "rgba(0,82,48,0.10)",
                    data: getExpenseBreakdown().internet,
                    billType: "internet",
                  },
                  ...(getExpenseBreakdown().customCharges &&
                  getExpenseBreakdown().customCharges.length > 0
                    ? getExpenseBreakdown().customCharges.map((charge) => ({
                        name: charge.name,
                        icon: "pricetag",
                        color: colors.accent,
                        iconBg: colors.accentLight,
                        data: {
                          amount: charge.amount,
                          percentage: charge.percentage,
                        },
                        billType: "customCharges",
                      }))
                    : []),
                ]
                  .filter((item) => item.data?.amount > 0)
                  .map((item, idx) => {
                    const isPaid = isBillPaid(item.billType);
                    return (
                      <View key={idx} style={styles.expenseRow}>
                        <View style={styles.expenseRowLeft}>
                          {/* Icon with themed background */}
                          <View
                            style={[
                              styles.expenseIconBg,
                              { backgroundColor: item.iconBg },
                            ]}
                          >
                            <Ionicons
                              name={item.icon}
                              size={15}
                              color={item.color}
                            />
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={styles.expenseRowName}>
                              {item.name}
                            </Text>
                            <View style={styles.expenseBarBg}>
                              <View
                                style={[
                                  styles.expenseBarFill,
                                  {
                                    width: `${Math.max(
                                      item.data.percentage,
                                      2,
                                    )}%`,
                                    backgroundColor: item.color,
                                    opacity: isPaid ? 0.4 : 1,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        </View>

                        <View style={styles.expenseRowRight}>
                          <View style={styles.expenseRowAmountRow}>
                            <Text
                              style={[
                                styles.expenseRowAmount,
                                isPaid && styles.expenseRowAmountPaid,
                              ]}
                            >
                              {"\u20B1"}
                              {item.data.amount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </Text>
                            {isPaid && (
                              <Text style={styles.expensePaidBadge}>
                                ✓ Paid
                              </Text>
                            )}
                          </View>
                          <Text style={styles.expenseRowPct}>
                            {item.data.percentage.toFixed(0)}%
                          </Text>
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}
            <ModalBottomSpacer />
          </ScrollViewWithDetection>
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

  // ─── NEW USERS FEATURE CARDS ───
  const RoommateAvatar = ({ profile, style, placeholderStyle, textStyle }) => {
    const source = getRoommateAvatarSource(profile);
    if (source) {
      return <Image source={source} style={style} resizeMode="cover" />;
    }

    return (
      <View style={placeholderStyle}>
        <Text style={textStyle}>
          {(profile?.name || "R").charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  };

  const RoommateCard = ({ profile, isLast }) => {
    const locations = getLocationLabel(profile);
    return (
      <TouchableOpacity
        style={[styles.roommateCard, isLast && styles.roommateCardLast]}
        activeOpacity={0.86}
        onPress={() =>
          navigation.navigate("RoomieDetails", {
            profileId: getProfileId(profile),
            profile,
          })
        }
      >
        <View style={styles.roommatePhotoWrap}>
          <RoommateAvatar
            profile={profile}
            style={styles.roommatePhoto}
            placeholderStyle={styles.roommatePhotoPlaceholder}
            textStyle={styles.roommatePhotoInitial}
          />
          <View style={styles.roommatePhotoShade} />
          <View style={styles.roommateTopBadges}>
            <View style={styles.roommateVerifiedBadge}>
              <Ionicons name="shield-checkmark" size={11} color="#fff" />
              <Text style={styles.roommateVerifiedText}>Verified</Text>
            </View>
            {profile.hasRoom && (
              <View style={styles.roommateHasRoomBadge}>
                <Ionicons name="home" size={11} color="#063F39" />
                <Text style={styles.roommateHasRoomText}>Has room</Text>
              </View>
            )}
          </View>
          <View style={styles.roommateNameBlock}>
            <Text style={styles.roommateName} numberOfLines={1}>
              {profile.name}
              {profile.age ? `, ${profile.age}` : ""}
            </Text>
            {!!profile.work && (
              <Text style={styles.roommateWork} numberOfLines={1}>
                {profile.work}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.roommateCardBody}>
          <View style={styles.roommateMetaRow}>
            <Ionicons
              name="location-outline"
              size={13}
              color={colors.textTertiary}
            />
            <Text style={styles.roommateMetaText} numberOfLines={1}>
              {locations}
            </Text>
          </View>
          <View style={styles.roommateMetaRow}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color={colors.textTertiary}
            />
            <Text style={styles.roommateMetaText} numberOfLines={1}>
              {formatMoveInDate(profile.moveInDate)}
            </Text>
          </View>
          <View style={styles.roommateDivider} />
          <View style={styles.roommateChipRow}>
            <View style={styles.roommateChip}>
              <Ionicons name="wallet-outline" size={12} color={colors.accent} />
              <Text style={styles.roommateChipText} numberOfLines={1}>
                {formatRoommateBudget(profile.budget)}
              </Text>
            </View>
            {!!profile.gender && (
              <View style={styles.roommateChip}>
                <Ionicons
                  name="person-outline"
                  size={12}
                  color={colors.accent}
                />
                <Text style={styles.roommateChipText} numberOfLines={1}>
                  {profile.gender}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const RoommateSection = () => (
    <View style={styles.roommateSection}>
      <View style={styles.availSectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>Roomies Looking</Text>
          <Text style={styles.sectionDescription}>
            Verified renters who are looking for roommates.
          </Text>
        </View>
        <View style={styles.roommateHeaderActions}>
          <TouchableOpacity
            style={styles.roommateViewBtn}
            onPress={() => navigation.navigate("Roomies")}
            activeOpacity={0.75}
          >
            <Text style={styles.roommateViewText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.roommateCreateBtn}
            onPress={() => setRoommateOnboardingVisible(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="person-add-outline" size={14} color="#fff" />
            <Text style={styles.roommateCreateText}>
              {myRoommateProfile ? "Edit" : "Create"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {roommateLoading && verifiedRoommateProfiles.length === 0 ? (
        <View style={styles.roommateLoadingCard}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.roommateLoadingText}>Loading roomies...</Text>
        </View>
      ) : verifiedRoommateProfiles.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roommateCarouselContent}
          decelerationRate="fast"
          snapToInterval={styles.roommateCard.width + 12}
          snapToAlignment="start"
        >
          {verifiedRoommateProfiles.map((profile, index) => (
            <RoommateCard
              key={getProfileId(profile)}
              profile={profile}
              isLast={index === verifiedRoommateProfiles.length - 1}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.roommateEmptyCard}>
          <View style={styles.roommateEmptyIcon}>
            <Ionicons name="people-outline" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.roommateEmptyTitle}>No roomies listed yet</Text>
            <Text style={styles.roommateEmptyText}>
              Be the first verified renter to share a roommate profile.
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const FeatureCard = ({ icon, title, description, bgColor }) => (
    <View style={[styles.featureCard, { backgroundColor: bgColor }]}>
      <View style={styles.featureCardTop}>
        <Ionicons
          name={icon}
          size={28}
          color="#fff"
          style={styles.featureCardIcon}
        />
        <Text style={styles.featureCardTitle}>{title}</Text>
      </View>
      <Text style={styles.featureCardDesc}>{description}</Text>
    </View>
  );

  const NewUsersSection = () => (
    <View style={styles.newUsersSection}>
      <View style={styles.newUsersFlex}>
        <FeatureCard
          icon="shield-checkmark"
          title="Secure Payments"
          description="All transactions are encrypted and monitored for your safety."
          bgColor="#1B5E5B"
        />
        <FeatureCard
          icon="flash"
          title="Instant Approval"
          description="Get verified and move in within 24 hours of selection."
          bgColor="#9E5E00"
        />
      </View>
    </View>
  );

  const renderRoomSearchCard = (inline = false) => (
    <View
      style={[
        styles.searchBarCardWrap,
        inline && styles.searchBarCardWrapInline,
      ]}
    >
      <View style={styles.searchIntroCard}>
        <View style={styles.searchIntroHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.searchIntroLabel}>
              Discover available rooms
            </Text>
            <Text style={styles.searchHelperText}>
              Search by room name, code, owner, location, or amenities.
            </Text>
          </View>
          <View style={styles.searchIntroChip}>
            <Text style={styles.searchIntroChipText}>
              {visibleUnjoinedRooms.length}/{unjoinedRooms.length}
            </Text>
          </View>
        </View>
        <View style={styles.searchBar}>
          <Feather name="search" size={22} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search rooms, codes, owners..."
            placeholderTextColor={colors.textTertiary}
            value={roomSearchQuery}
            onChangeText={setRoomSearchQuery}
            returnKeyType="search"
          />
          {roomSearchQuery.trim().length > 0 && (
            <TouchableOpacity
              style={styles.searchClearBtn}
              onPress={() => setRoomSearchQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <>
      <StatusModal />
      <ExpenseModal />
      <RoomInfoModal />
      <FullMapModal />
      <RoommateProfileModal
        visible={roommateOnboardingVisible}
        initialProfile={myRoommateProfile}
        user={state?.user}
        onClose={handleCloseRoommateOnboarding}
        onSaved={handleRoommateSaved}
      />

      {/* ── Custom Alerts ── */}
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
      <ConfirmModal
        visible={joinConfirm.visible}
        title="Join Room"
        message="Will you be a payer for this room?"
        confirmText="Yes (Payer)"
        cancelText="No (Non-Payer)"
        confirmStyle="default"
        onConfirm={() => {
          const { roomId } = joinConfirm;
          setJoinConfirm({ visible: false, roomId: null });
          joinRoomWithPayerStatus(roomId, true);
        }}
        onCancel={() => {
          const { roomId } = joinConfirm;
          setJoinConfirm({ visible: false, roomId: null });
          joinRoomWithPayerStatus(roomId, false);
        }}
        onClose={() => setJoinConfirm({ visible: false, roomId: null })}
      />
      {/* Full-screen photo viewer */}
      <Modal
        visible={!!photoViewData}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewData(null)}
      >
        <View style={styles.pvBg}>
          <View style={[styles.pvHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              style={styles.pvBackBtn}
              onPress={() => setPhotoViewData(null)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.pvTitle} numberOfLines={1}>
              {photoViewData?.name || "Photos"}
            </Text>
            <Text style={styles.pvCount}>
              {photoViewIdx + 1} / {photoViewData?.photos?.length || 0}
            </Text>
          </View>
          <ScrollViewWithDetection
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            onScroll={(e) => {
              const idx = Math.round(
                e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
              );
              setPhotoViewIdx(idx);
            }}
            scrollEventThrottle={16}
          >
            {(photoViewData?.photos || []).map((uri, idx) => (
              <Image
                key={idx}
                source={{ uri }}
                style={styles.pvImg}
                resizeMode="contain"
              />
            ))}
          </ScrollViewWithDetection>
          {(photoViewData?.photos?.length || 0) > 1 && (
            <View style={styles.pvDotRow}>
              {photoViewData.photos.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.pvDot,
                    idx === photoViewIdx && styles.pvDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </Modal>
      <View style={styles.container}>
        {/* ─── FULL-SCREEN LOADER OVERLAY ─── */}
        {loading && (
          <View style={styles.centerLoader}>
            <HomeSpaceLoader />
          </View>
        )}

        <ScrollViewWithDetection
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
          {/* ─── HEADER ─── */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.headerMenuBtn}
                onPress={() =>
                  navigation.navigate("ProfileStack", {
                    screen: "Profile",
                  })
                }
                activeOpacity={0.7}
              >
                <Image
                  source={getAvatarSource()}
                  style={styles.headerAvatar}
                  defaultSource={require("../../assets/default-avatar.png")}
                  onError={() => setAvatarError(true)}
                />
              </TouchableOpacity>
              <View style={styles.headerNotifContainer}>
                <TouchableOpacity
                  style={styles.headerNotifBtn}
                  onPress={() =>
                    navigation.navigate("NotificationsInbox", {
                      view: "alerts",
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={26}
                    color="#fff"
                  />
                </TouchableOpacity>
                {(unreadNotificationCount > 0 || unreadChatCount > 0) && (
                  <View style={styles.headerNotifBadge}>
                    <Text style={styles.headerNotifBadgeText}>
                      {unreadNotificationCount + unreadChatCount > 99
                        ? "99+"
                        : unreadNotificationCount + unreadChatCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.headerTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerEyebrow}>
                  {userJoinedRoom ? "Your propflow hub" : "Find your next stay"}
                </Text>
                <Text style={styles.headerTitle}>Dashboard</Text>
              </View>
              <View style={styles.headerTopPill}>
                <Ionicons
                  name={userJoinedRoom ? "home-outline" : "compass-outline"}
                  size={14}
                  color="#fff"
                />
                <Text style={styles.headerTopPillText}>
                  {userJoinedRoom ? "Joined Room" : "Explore"}
                </Text>
              </View>
            </View>
            <View style={styles.headerGreetRow}>
              <Text style={styles.greeting}>
                {getTimeBasedGreeting()}, {userName}
              </Text>
              <Text style={styles.headerSubtitle}>
                {userJoinedRoom
                  ? `Here's what's happening in ${userJoinedRoom.name}.`
                  : "Find a space that fits your lifestyle perfectly."}
              </Text>
              <View style={styles.headerStatusRow}>
                <View style={styles.headerStatusChip}>
                  <Ionicons
                    name={userJoinedRoom ? "people-outline" : "bed-outline"}
                    size={13}
                    color="#d8efe8"
                  />
                  <Text style={styles.headerStatusChipText}>
                    {userJoinedRoom
                      ? `${userJoinedRoom.members?.length || 0} members`
                      : `${unjoinedRooms.length} rooms open`}
                  </Text>
                </View>
                <View style={styles.headerStatusChip}>
                  <Ionicons
                    name={
                      unreadChatCount > 0
                        ? "chatbubble-ellipses-outline"
                        : "sparkles-outline"
                    }
                    size={13}
                    color="#d8efe8"
                  />
                  <Text style={styles.headerStatusChipText}>
                    {unreadChatCount > 0
                      ? `${unreadChatCount} unread chats`
                      : statusChangeNotifications.length > 0
                        ? "New updates waiting"
                        : "Everything synced"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ─── BALANCE CARD (overlaps header) ─── */}
          {userJoinedRoom && isCurrentUserPayor()
            ? (() => {
                if (billingDataLoading) {
                  return (
                    <View style={styles.balanceCardWrap}>
                      <View style={styles.balanceCard}>
                        <View style={styles.balanceCardTopRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.balanceLabel}>
                              Total Balance
                            </Text>
                            <AmountSkeleton
                              colors={colors}
                              style={styles.balanceAmountSkeleton}
                            />
                            <Text style={styles.balanceSubLabel}>
                              Checking your latest balance...
                            </Text>
                            <View style={styles.balanceMetaRow}>
                              <AmountSkeleton
                                colors={colors}
                                style={styles.balanceMetaSkeleton}
                              />
                              <AmountSkeleton
                                colors={colors}
                                style={styles.balanceMetaSkeleton}
                              />
                            </View>
                          </View>
                          <View style={styles.balanceIconWrap}>
                            <View style={styles.balanceIconInner}>
                              <ActivityIndicator size="small" color="#00847B" />
                            </View>
                            <Text style={styles.balanceIconCaption}>
                              Syncing
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                }

                const breakdown = getExpenseBreakdown();
                const remaining = getRemainingDue();
                const totalBills = breakdown?.perPayor || 0;
                const paymentStatus = getPaymentStatus();
                const pendingCount = paymentStatus?.pendingCount || 0;
                const memberCount = userJoinedRoom.members?.length || 0;
                const cycleDaysRemaining = getCycleDaysRemaining();
                const allPaid =
                  paymentStatus?.allPaid ||
                  userJoinedRoom.cycleStatus === "completed";
                const { bills, daysRemaining: breakdownDaysRemaining } =
                  getIndividualBills();
                const paidBillCount = bills.filter(
                  (bill) => bill.status === "paid",
                ).length;

                return (
                  <View style={styles.balanceCardWrap}>
                    <View
                      style={[
                        styles.balanceCard,
                        allPaid && styles.balanceCardPaid,
                      ]}
                    >
                      <View style={styles.balanceCardTopRow}>
                        <View style={{ flex: 1 }}>
                          {allPaid ? (
                            <>
                              <View style={styles.balancePaidStatusRow}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={18}
                                  color={colors.success || "#4caf50"}
                                />
                                <Text style={styles.balancePaidStatusText}>
                                  All bills paid
                                </Text>
                              </View>
                              <Text style={styles.balanceAmount}>₱0.00</Text>
                              <Text style={styles.balanceSubLabel}>
                                You&apos;re up to date for this billing cycle
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text style={styles.balanceLabel}>
                                Total Balance
                              </Text>
                              <AnimatedAmount
                                value={remaining}
                                formatter={(val) => `₱${val.toFixed(2)}`}
                                style={styles.balanceAmount}
                                animateOnMount={false}
                              />
                              <Text style={styles.balanceSubLabel}>
                                You owe this cycle
                              </Text>
                            </>
                          )}
                          <View style={styles.balanceMetaRow}>
                            <View
                              style={[
                                styles.balanceMetaChip,
                                allPaid && styles.balanceMetaChipPaid,
                              ]}
                            >
                              <Ionicons
                                name={
                                  allPaid
                                    ? "checkmark-done-outline"
                                    : "document-text-outline"
                                }
                                size={13}
                                color={allPaid ? "#2e7d32" : "#0c7364"}
                              />
                              <Text
                                style={[
                                  styles.balanceMetaChipText,
                                  allPaid && styles.balanceMetaChipTextPaid,
                                ]}
                              >
                                {allPaid
                                  ? `${paidBillCount}/${bills.length || paidBillCount} paid`
                                  : `${pendingCount} pending`}
                              </Text>
                            </View>
                            <View style={styles.balanceMetaChip}>
                              <Ionicons
                                name="time-outline"
                                size={13}
                                color="#0c7364"
                              />
                              <Text style={styles.balanceMetaChipText}>
                                {cycleDaysRemaining != null
                                  ? `${cycleDaysRemaining} days left`
                                  : "Current cycle"}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.balanceIconWrap}>
                          <View
                            style={[
                              styles.balanceIconInner,
                              allPaid && styles.balanceIconInnerPaid,
                            ]}
                          >
                            <Ionicons
                              name={
                                allPaid ? "checkmark-done" : "wallet-outline"
                              }
                              size={30}
                              color={
                                allPaid
                                  ? colors.success || "#4caf50"
                                  : "#00847B"
                              }
                            />
                          </View>
                          <Text style={styles.balanceIconCaption}>
                            {allPaid ? "Paid in full" : "This month"}
                          </Text>
                        </View>
                      </View>

                      {activeCycle && bills.length > 0 && (
                        <>
                          <TouchableOpacity
                            style={styles.balanceExpandRow}
                            onPress={toggleBreakdown}
                            activeOpacity={0.75}
                          >
                            <Text style={styles.balanceExpandLabel}>
                              {balanceBreakdownExpanded
                                ? "Hide bill breakdown"
                                : "View bill breakdown"}
                            </Text>
                            <Ionicons
                              name={
                                balanceBreakdownExpanded
                                  ? "chevron-up"
                                  : "chevron-down"
                              }
                              size={18}
                              color="#00847B"
                            />
                          </TouchableOpacity>

                          {balanceBreakdownExpanded && (
                            <View style={styles.balanceBreakdownSection}>
                              <View style={styles.balanceBreakdownHeader}>
                                <Text style={styles.balanceBreakdownTitle}>
                                  {breakdownDaysRemaining === 0
                                    ? "Due Today"
                                    : breakdownDaysRemaining === 1
                                      ? "Due Tomorrow"
                                      : "Bill Breakdown"}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => setShowExpenseModal(true)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.upcomingBillsViewAll}>
                                    View all
                                  </Text>
                                </TouchableOpacity>
                              </View>
                              {bills.map((bill, idx) => (
                                <TouchableOpacity
                                  key={`${bill.name}-${idx}`}
                                  style={styles.balanceBreakdownBillCard}
                                  onPress={() => setShowExpenseModal(true)}
                                  activeOpacity={0.7}
                                >
                                  <View
                                    style={[
                                      styles.upcomingBillIconWrap,
                                      { backgroundColor: "rgba(3,109,65,0.1)" },
                                    ]}
                                  >
                                    <Ionicons
                                      name={bill.icon}
                                      size={20}
                                      color={bill.color}
                                    />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.upcomingBillName}>
                                      {bill.name}
                                    </Text>
                                    <Text style={styles.upcomingBillDue}>
                                      {bill.status === "paid"
                                        ? "Paid this cycle"
                                        : breakdownDaysRemaining === 0
                                          ? "Due Today"
                                          : breakdownDaysRemaining === 1
                                            ? "Due Tomorrow"
                                            : `Due in ${breakdownDaysRemaining} day${breakdownDaysRemaining !== 1 ? "s" : ""}`}
                                    </Text>
                                  </View>
                                  <View style={styles.upcomingBillRight}>
                                    <Text style={styles.upcomingBillAmount}>
                                      {fmt(bill.amount)}
                                    </Text>
                                    {bill.status === "paid" ? (
                                      <Text
                                        style={styles.upcomingBillPaidBadge}
                                      >
                                        ✓ Paid
                                      </Text>
                                    ) : breakdownDaysRemaining <= 5 ? (
                                      <Text
                                        style={styles.upcomingBillDueSoonBadge}
                                      >
                                        Due Soon
                                      </Text>
                                    ) : null}
                                  </View>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </>
                      )}

                      {allPaid && (
                        <TouchableOpacity
                          style={styles.balancePaidHistoryBtn}
                          onPress={() =>
                            navigation.navigate("BillsStack", {
                              screen: "BillsMain",
                            })
                          }
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="receipt-outline"
                            size={16}
                            color={colors.success || "#4caf50"}
                          />
                          <Text style={styles.balancePaidHistoryText}>
                            View payment history
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={colors.success || "#4caf50"}
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Quick Stats Row */}
                    <View style={styles.quickStatsRow}>
                      <View style={styles.quickStatCell}>
                        <View
                          style={[
                            styles.quickStatIcon,
                            { backgroundColor: "#e0f7fa" },
                          ]}
                        >
                          <Ionicons
                            name="document-text-outline"
                            size={22}
                            color="#0097a7"
                          />
                        </View>
                        <Text style={styles.quickStatValue}>
                          {pendingCount}
                        </Text>
                        <Text style={styles.quickStatLabel}>Pending Bills</Text>
                        <Text style={styles.quickStatHint}>
                          Needs attention
                        </Text>
                      </View>
                      <View style={styles.quickStatCell}>
                        <View
                          style={[
                            styles.quickStatIcon,
                            { backgroundColor: "#e8eaf6" },
                          ]}
                        >
                          <Ionicons
                            name="cash-outline"
                            size={22}
                            color="#3949ab"
                          />
                        </View>
                        <Text style={styles.quickStatValue} numberOfLines={1}>
                          ₱{totalBills.toFixed(2)}
                        </Text>
                        <Text style={styles.quickStatLabel}>Total Bills</Text>
                        <Text style={styles.quickStatHint}>
                          Shared this cycle
                        </Text>
                      </View>
                      <View style={styles.quickStatCell}>
                        <View
                          style={[
                            styles.quickStatIcon,
                            { backgroundColor: "#f3e5f5" },
                          ]}
                        >
                          <Ionicons
                            name="people-outline"
                            size={22}
                            color="#7b1fa2"
                          />
                        </View>
                        <Text style={styles.quickStatValue}>{memberCount}</Text>
                        <Text style={styles.quickStatLabel}>Members</Text>
                        <Text style={styles.quickStatHint}>
                          Living together
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()
            : !userJoinedRoom
              ? renderRoomSearchCard()
              : null}

          {/* ─── HOST BANNER ─── */}
          {announcementBanner && (
            <View style={styles.hostBanner}>
              <Ionicons
                name="bookmark"
                size={16}
                color={colors.accent}
                style={{ marginTop: 1 }}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.hostBannerTitle} numberOfLines={1}>
                  {announcementBanner.title}
                </Text>
                <Text style={styles.hostBannerBody} numberOfLines={2}>
                  {announcementBanner.content}
                </Text>
              </View>
              <TouchableOpacity
                onPress={dismissBanner}
                style={styles.hostBannerClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

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

          {/* ─── ADS CAROUSEL ─── */}
          <AdsCarousel screen="home" navigation={navigation} />

          <RoommateSection />

          {/* ─── NEW USERS FEATURES ─── */}
          {!userJoinedRoom && <NewUsersSection />}

          {!loading && (
            <>
              {userJoinedRoom && (
                <>
                  {/* ─── BILLING OVERVIEW (payors only) ─── */}
                  {(() => {
                    return (
                      <>
                        {/* ─── QUICK ACTIONS ─── */}
                        <View style={styles.actionsSection}>
                          <View style={styles.sectionHeaderRow}>
                            <View>
                              <Text style={styles.sectionTitle}>
                                Quick Actions
                              </Text>
                              <Text style={styles.sectionCaption}>
                                Jump into the things you use most.
                              </Text>
                            </View>
                          </View>
                          <View style={styles.actionsRow}>
                            {isCurrentUserPayor() && (
                              <TouchableOpacity
                                style={styles.actionCard}
                                onPress={() =>
                                  navigation.navigate("BillsStack", {
                                    screen: "BillsMain",
                                    params: {
                                      roomId:
                                        userJoinedRoom.id || userJoinedRoom._id,
                                    },
                                  })
                                }
                                activeOpacity={0.7}
                              >
                                <View
                                  style={[
                                    styles.actionIconBg,
                                    { backgroundColor: "#d6ede3" },
                                  ]}
                                >
                                  <Ionicons
                                    name="card"
                                    size={20}
                                    color="#036d41"
                                  />
                                </View>
                                <Text style={styles.actionLabel}>
                                  Pay Bills
                                </Text>
                                <Text style={styles.actionSubLabel}>
                                  Review dues fast
                                </Text>
                              </TouchableOpacity>
                            )}

                            {userJoinedRoom?.waterBillingMode !==
                              "fixed_monthly" &&
                              userJoinedRoom?.water_billing_mode !==
                                "fixed_monthly" && (
                                <TouchableOpacity
                                  style={styles.actionCard}
                                  onPress={() =>
                                    navigation.navigate("PresenceStack", {
                                      screen: "PresenceMain",
                                      params: {
                                        roomId:
                                          userJoinedRoom.id ||
                                          userJoinedRoom._id,
                                      },
                                    })
                                  }
                                  activeOpacity={0.7}
                                >
                                  <View
                                    style={[
                                      styles.actionIconBg,
                                      { backgroundColor: "#b3dece" },
                                    ]}
                                  >
                                    <Ionicons
                                      name="calendar"
                                      size={20}
                                      color="#025535"
                                    />
                                  </View>
                                  <Text style={styles.actionLabel}>
                                    Presence
                                  </Text>
                                  <Text style={styles.actionSubLabel}>
                                    Track daily stays
                                  </Text>
                                </TouchableOpacity>
                              )}

                            <TouchableOpacity
                              style={styles.actionCard}
                              onPress={() =>
                                navigation.navigate("HomeStack", {
                                  screen: "RoomDetails",
                                  params: {
                                    roomId:
                                      userJoinedRoom.id || userJoinedRoom._id,
                                  },
                                })
                              }
                              activeOpacity={0.7}
                            >
                              <View
                                style={[
                                  styles.actionIconBg,
                                  { backgroundColor: "#e8f5ef" },
                                ]}
                              >
                                <Ionicons
                                  name="information-circle"
                                  size={20}
                                  color="#036d41"
                                />
                              </View>
                              <Text style={styles.actionLabel}>Room Info</Text>
                              <Text style={styles.actionSubLabel}>
                                See amenities
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.actionCard}
                              onPress={() =>
                                navigation.navigate("ChatRoom", {
                                  roomId:
                                    userJoinedRoom.id || userJoinedRoom._id,
                                  roomName: userJoinedRoom.name,
                                  isHost: false,
                                })
                              }
                              activeOpacity={0.7}
                            >
                              <View
                                style={[
                                  styles.actionIconBg,
                                  { backgroundColor: "#c8e8d8" },
                                ]}
                              >
                                <Ionicons
                                  name="chatbubble-ellipses"
                                  size={20}
                                  color="#036d41"
                                />
                                {unreadChatCount > 0 && (
                                  <View style={styles.chatBadge}>
                                    <Text style={styles.chatBadgeText}>
                                      {unreadChatCount > 99
                                        ? "99+"
                                        : unreadChatCount}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.actionLabel}>Chat</Text>
                              <Text style={styles.actionSubLabel}>
                                Message housemates
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* ─── NON-PAYER: ALL PAYORS PAID BANNER ─── */}
                        {!isCurrentUserPayor() &&
                          userJoinedRoom?.billing &&
                          (() => {
                            const payors = getPayorsPaymentStatus();
                            return (
                              payors.length > 0 &&
                              payors.every((p) => p.allPaid)
                            );
                          })() && (
                            <View
                              style={{
                                marginHorizontal: 16,
                                marginTop: 12,
                                paddingHorizontal: 16,
                                paddingVertical: 16,
                                backgroundColor: colors.successBg || "#e8f5e9",
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: colors.success || "#4caf50",
                                borderLeftWidth: 4,
                                alignItems: "center",
                              }}
                            >
                              <Ionicons
                                name="checkmark-done-circle"
                                size={36}
                                color={colors.success || "#4caf50"}
                              />
                              <Text
                                style={{
                                  color: colors.success || "#2e7d32",
                                  fontWeight: "700",
                                  fontSize: 15,
                                  marginTop: 8,
                                  textAlign: "center",
                                }}
                              >
                                Billing cycle complete!
                              </Text>
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  fontSize: 12,
                                  marginTop: 4,
                                  textAlign: "center",
                                  lineHeight: 18,
                                }}
                              >
                                All payors in your room have settled their bills
                                for this cycle. Please wait for the host to
                                start a new billing period.
                              </Text>
                            </View>
                          )}

                        {/* ─── OUTSTANDING BALANCE BANNER ─── */}
                        {isCurrentUserPayor() &&
                          !billingDataLoading &&
                          outstandingBalance.totalOutstanding > 0 && (
                            <TouchableOpacity
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginHorizontal: 16,
                                marginTop: 12,
                                paddingHorizontal: 14,
                                paddingVertical: 13,
                                backgroundColor: "#fdecea",
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: "#ef9a9a",
                                borderLeftWidth: 4,
                                borderLeftColor: "#c62828",
                              }}
                              onPress={() =>
                                navigation.navigate("BillsStack", {
                                  screen: "BillsMain",
                                })
                              }
                              activeOpacity={0.8}
                            >
                              <MaterialIcons
                                name="error"
                                size={22}
                                color="#c62828"
                                style={{ marginRight: 12 }}
                              />
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    color: "#b71c1c",
                                    fontWeight: "700",
                                    fontSize: 14,
                                  }}
                                >
                                  Outstanding Balance
                                </Text>
                                <Text
                                  style={{
                                    color: "#c62828",
                                    fontWeight: "800",
                                    fontSize: 16,
                                    marginTop: 1,
                                  }}
                                >
                                  ₱
                                  {outstandingBalance.totalOutstanding.toFixed(
                                    2,
                                  )}
                                </Text>
                                <Text
                                  style={{
                                    color: "#b71c1c",
                                    fontSize: 12,
                                    marginTop: 3,
                                    opacity: 0.85,
                                  }}
                                >
                                  {outstandingBalance.unpaidCycles.length}{" "}
                                  unpaid closed cycle
                                  {outstandingBalance.unpaidCycles.length !== 1
                                    ? "s"
                                    : ""}
                                  {" · "}Tap to settle
                                </Text>
                              </View>
                              <MaterialIcons
                                name="chevron-right"
                                size={20}
                                color="#c62828"
                              />
                            </TouchableOpacity>
                          )}
                      </>
                    );
                  })()}
                </>
              )}

              {userJoinedRoom &&
                unjoinedRooms.length > 0 &&
                renderRoomSearchCard(true)}

              {/* ─── AVAILABLE ROOMS CAROUSEL ─── */}
              {unjoinedRooms.length > 0 && (
                <View style={styles.availSection}>
                  {/* Section header — stays outside the scroll */}
                  <View style={styles.availSectionHeader}>
                    <View>
                      <Text style={styles.sectionLabel}>Stays You'll Love</Text>
                      <Text style={styles.sectionDescription}>
                        {roomSearchQuery.trim()
                          ? `${visibleUnjoinedRooms.length} room${visibleUnjoinedRooms.length !== 1 ? "s" : ""} match your search.`
                          : "Handpicked rentals matched to your style and needs."}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate("RoomsStack", {
                          screen: "RoomsMain",
                        })
                      }
                    >
                      <Text style={styles.viewAllText}>View All</Text>
                    </TouchableOpacity>
                  </View>

                  {visibleUnjoinedRooms.length === 0 ? (
                    <View style={styles.searchEmptyCard}>
                      <Ionicons
                        name="search-outline"
                        size={24}
                        color={colors.textTertiary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.searchEmptyTitle}>
                          No rooms found
                        </Text>
                        <Text style={styles.searchEmptyText}>
                          Try another room name, code, owner, or location.
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.availCarouselContent}
                      decelerationRate="fast"
                      snapToInterval={styles.availCarouselCard.width + 12}
                      snapToAlignment="start"
                    >
                      {visibleUnjoinedRooms.map((room, index) => {
                        const roomId = room.id || room._id;
                        const isPending = pendingRoomIds.includes(roomId);
                        const hasLoc =
                          room.latitude != null && room.longitude != null;
                        const roomPhotos = Array.isArray(room.photos)
                          ? room.photos
                          : [];
                        const memberCount =
                          room.memberCount ?? room.members?.length ?? 0;

                        return (
                          <TouchableOpacity
                            key={roomId}
                            style={[
                              styles.availCarouselCard,
                              index === visibleUnjoinedRooms.length - 1 &&
                                styles.availCarouselCardLast,
                            ]}
                            activeOpacity={0.85}
                            onPress={() => setPreviewRoom(room)}
                          >
                            {/* ── Photo / placeholder banner ── */}
                            <View style={styles.availCarouselPhotoWrap}>
                              {roomPhotos.length > 0 ? (
                                <Image
                                  source={{ uri: roomPhotos[0] }}
                                  style={styles.availCarouselPhoto}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View
                                  style={styles.availCarouselPhotoPlaceholder}
                                >
                                  <Ionicons
                                    name="home-outline"
                                    size={36}
                                    color={colors.accent}
                                  />
                                </View>
                              )}

                              {/* Top-left badges: Verified + photo count */}
                              <View style={styles.availCarouselTopBadges}>
                                <View style={styles.availCarouselBadge}>
                                  <Ionicons
                                    name="shield-checkmark-outline"
                                    size={11}
                                    color="#fff"
                                  />
                                  <Text style={styles.availCarouselBadgeText}>
                                    Verified
                                  </Text>
                                </View>
                                {roomPhotos.length > 1 && (
                                  <View style={styles.availCarouselBadge}>
                                    <Ionicons
                                      name="images-outline"
                                      size={11}
                                      color="#fff"
                                    />
                                    <Text style={styles.availCarouselBadgeText}>
                                      {roomPhotos.length} photos
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {/* Bottom-left: member count pill */}
                              <View style={styles.availCarouselMemberPill}>
                                <Ionicons
                                  name="people-outline"
                                  size={11}
                                  color="#fff"
                                />
                                <Text style={styles.availCarouselMemberText}>
                                  {memberCount}
                                </Text>
                              </View>

                              {/* Bottom-right: expand photo */}
                              {roomPhotos.length > 0 && (
                                <TouchableOpacity
                                  style={styles.availCarouselExpandBtn}
                                  onPress={(e) => {
                                    e.stopPropagation?.();
                                    setPhotoViewIdx(0);
                                    setPhotoViewData({
                                      name: room.name,
                                      photos: roomPhotos,
                                    });
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Ionicons
                                    name="scan-outline"
                                    size={16}
                                    color="#fff"
                                  />
                                </TouchableOpacity>
                              )}
                            </View>

                            {/* ── Card body ── */}
                            <View style={styles.availCarouselBody}>
                              {/* Room name */}
                              <Text
                                style={styles.availCarouselName}
                                numberOfLines={2}
                              >
                                {room.name}
                              </Text>

                              {/* Location */}
                              {(hasLoc || room.address) && (
                                <View style={styles.availCarouselLocRow}>
                                  <Ionicons
                                    name="location-outline"
                                    size={11}
                                    color={colors.textTertiary}
                                  />
                                  <Text
                                    style={styles.availCarouselLocText}
                                    numberOfLines={1}
                                  >
                                    {room.address
                                      ? room.address
                                          .split(",")
                                          .slice(0, 2)
                                          .join(", ")
                                      : "Location pinned"}
                                  </Text>
                                </View>
                              )}

                              {/* Room type / description tag */}
                              {room.description && (
                                <View style={styles.availCarouselTypeRow}>
                                  <Ionicons
                                    name="bed-outline"
                                    size={11}
                                    color={colors.textTertiary}
                                  />
                                  <Text
                                    style={styles.availCarouselTypeText}
                                    numberOfLines={1}
                                  >
                                    {room.description}
                                  </Text>
                                </View>
                              )}

                              {/* Divider */}
                              <View style={styles.availCarouselDivider} />

                              {/* Price row + join/pending */}
                              <View style={styles.availCarouselFooter}>
                                <View>
                                  <Text style={styles.availCarouselPriceLabel}>
                                    Starts at
                                  </Text>
                                  <Text style={styles.availCarouselPrice}>
                                    {Number(
                                      room.rent ||
                                        room.price ||
                                        room.monthlyRent ||
                                        room.billing?.rent ||
                                        0,
                                    ) > 0
                                      ? `₱${Number(
                                          room.rent ||
                                            room.price ||
                                            room.monthlyRent ||
                                            room.billing?.rent,
                                        ).toLocaleString()}`
                                      : "Ask for price"}
                                  </Text>
                                </View>

                                {isPending ? (
                                  <View style={styles.pendingChip}>
                                    <Ionicons
                                      name="time-outline"
                                      size={11}
                                      color="#e67e22"
                                    />
                                    <Text style={styles.pendingChipText}>
                                      Pending
                                    </Text>
                                  </View>
                                ) : (
                                  <TouchableOpacity
                                    style={styles.availCarouselJoinBtn}
                                    onPress={(e) => {
                                      e.stopPropagation?.();
                                      handleJoinRoom(roomId);
                                    }}
                                    disabled={joiningRoomId === roomId}
                                    activeOpacity={0.7}
                                  >
                                    {joiningRoomId === roomId ? (
                                      <ActivityIndicator
                                        color={colors.textOnAccent}
                                        size="small"
                                      />
                                    ) : (
                                      <Text style={styles.joinBtnText}>
                                        Inquire
                                      </Text>
                                    )}
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* All rooms joined */}
              {unjoinedRooms.length === 0 && userJoinedRoom && (
                <View style={styles.allJoinedCard}>
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={colors.success}
                  />
                  <Text style={styles.allJoinedText}>
                    You've joined all available rooms
                  </Text>
                </View>
              )}
            </>
          )}

          {/* ─── USER PROFILE MODAL ─── */}
          <Modal
            visible={profileModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setProfileModalVisible(false)}
          >
            <View style={styles.profileModalBackground}>
              <View style={styles.profileModalContent}>
                {/* Modal Header */}
                <View style={styles.profileModalHeader}>
                  <Text style={styles.profileModalTitle}>User Profile</Text>
                  <TouchableOpacity
                    onPress={() => setProfileModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {selectedUserProfile ? (
                  <ScrollViewWithDetection style={styles.profileModalBody}>
                    {/* Avatar */}
                    {selectedUserProfile.avatar?.url ? (
                      <Image
                        source={{ uri: selectedUserProfile.avatar.url }}
                        style={styles.profileLargeAvatar}
                      />
                    ) : (
                      <View style={styles.profileLargeAvatarPlaceholder}>
                        <Text style={styles.profileLargeAvatarText}>
                          {(selectedUserProfile.name || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </Text>
                      </View>
                    )}

                    {/* Name */}
                    <Text style={styles.profileName}>
                      {selectedUserProfile.name}
                    </Text>

                    {/* Username */}
                    {selectedUserProfile.username && (
                      <Text style={styles.profileUsername}>
                        @{selectedUserProfile.username}
                      </Text>
                    )}

                    {/* Role Badge */}
                    <View style={styles.profileRoleBadge}>
                      <Text style={styles.profileRoleText}>
                        {selectedUserProfile.is_admin
                          ? "Administrator"
                          : selectedUserProfile.role === "host"
                            ? "Host"
                            : "Member"}
                      </Text>
                    </View>

                    {/* Info Grid */}
                    <View style={styles.profileInfoGrid}>
                      {selectedUserProfile.gender && (
                        <View style={styles.profileInfoItem}>
                          <Ionicons
                            name="person-outline"
                            size={16}
                            color={colors.accent}
                          />
                          <View>
                            <Text style={styles.profileInfoLabel}>Gender</Text>
                            <Text style={styles.profileInfoValue}>
                              {selectedUserProfile.gender}
                            </Text>
                          </View>
                        </View>
                      )}

                      {selectedUserProfile.date_of_birth && (
                        <View style={styles.profileInfoItem}>
                          <Ionicons
                            name="calendar-outline"
                            size={16}
                            color={colors.accent}
                          />
                          <View>
                            <Text style={styles.profileInfoLabel}>
                              Date of Birth
                            </Text>
                            <Text style={styles.profileInfoValue}>
                              {new Date(
                                selectedUserProfile.date_of_birth,
                              ).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                      )}

                      {selectedUserProfile.created_at && (
                        <View style={styles.profileInfoItem}>
                          <Ionicons
                            name="calendar"
                            size={16}
                            color={colors.accent}
                          />
                          <View>
                            <Text style={styles.profileInfoLabel}>
                              Member Since
                            </Text>
                            <Text style={styles.profileInfoValue}>
                              {new Date(
                                selectedUserProfile.created_at,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                year: "numeric",
                              })}
                            </Text>
                          </View>
                        </View>
                      )}

                      {selectedUserProfile.totalContributions !== undefined && (
                        <View style={styles.profileInfoItem}>
                          <Ionicons
                            name="wallet"
                            size={16}
                            color={colors.accent}
                          />
                          <View>
                            <Text style={styles.profileInfoLabel}>
                              Total Contributions
                            </Text>
                            <Text style={styles.profileInfoValue}>
                              ₱
                              {selectedUserProfile.totalContributions.toLocaleString(
                                "en-US",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                },
                              )}
                            </Text>
                          </View>
                        </View>
                      )}

                      {selectedUserProfile.roomCount !== undefined && (
                        <View style={styles.profileInfoItem}>
                          <Ionicons
                            name="home-outline"
                            size={16}
                            color={colors.accent}
                          />
                          <View>
                            <Text style={styles.profileInfoLabel}>Rooms</Text>
                            <Text style={styles.profileInfoValue}>
                              {selectedUserProfile.roomCount}
                            </Text>
                          </View>
                        </View>
                      )}

                      {selectedUserProfile.isOnline !== undefined && (
                        <View
                          style={[styles.profileInfoItem, { marginBottom: 45 }]}
                        >
                          <Ionicons
                            name="ellipse"
                            size={12}
                            color={
                              selectedUserProfile.isOnline
                                ? "#4CAF50"
                                : selectedUserProfile.isRecentlyActive
                                  ? "#FFC107"
                                  : "#999"
                            }
                            style={{ marginTop: 2 }}
                          />
                          <View>
                            <Text style={styles.profileInfoLabel}>Status</Text>
                            <Text style={styles.profileInfoValue}>
                              {selectedUserProfile.isOnline
                                ? "Online"
                                : selectedUserProfile.isRecentlyActive
                                  ? "Recently Active"
                                  : selectedUserProfile.lastActiveAt
                                    ? `Active ${formatLastActive(
                                        selectedUserProfile.lastActiveAt,
                                      )}`
                                    : "Offline"}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </ScrollViewWithDetection>
                ) : (
                  <View style={styles.profileModalLoading}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.profileLoadingText}>
                      Loading profile...
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        </ScrollViewWithDetection>
      </View>
    </>
  );
};

const createStyles = (colors, insets = { top: 0, bottom: 0 }) => {
  // Detect dark mode from the status bar style token
  const isDark = colors.statusBarStyle === "light-content";

  return StyleSheet.create({
    // ─── LAYOUT ───
    container: { flex: 1, backgroundColor: colors.background },
    centerLoader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
      zIndex: 999,
    },

    // ─── HEADER ───
    header: {
      paddingHorizontal: 20,
      // paddingTop: insets.top + 14,
      paddingTop: 20,
      paddingBottom: 88,
      backgroundColor: "#063F39",
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },
    headerTitleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 14,
    },
    headerEyebrow: {
      fontSize: 11,
      fontWeight: "700",
      color: "rgba(255,255,255,0.7)",
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 6,
    },
    headerTitle: {
      fontSize: 30,
      fontWeight: "900",
      color: "#fff",
      letterSpacing: -0.8,
    },
    headerTopPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.14)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
    },
    headerTopPillText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#fff",
    },
    headerMenuBtn: {
      padding: 3,
      borderRadius: 24,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
    },
    headerNotifContainer: {
      position: "relative",
      width: 50,
      height: 50,
    },
    headerNotifBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
    },
    headerNotifBadge: {
      position: "absolute",
      top: -2,
      right: -2,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "#ef4444",
      borderWidth: 2,
      borderColor: "#fff",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
      zIndex: 999,
    },
    headerNotifBadgeText: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "700",
      textAlign: "center",
    },
    headerGreetRow: {
      padding: 16,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.08)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
    },
    greeting: {
      fontSize: 20,
      fontWeight: "800",
      color: "#ffffff",
    },
    headerSubtitle: {
      fontSize: 13,
      color: "rgba(255,255,255,0.75)",
      marginTop: 4,
      lineHeight: 19,
    },
    headerStatusRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 14,
    },
    headerStatusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.1)",
    },
    headerStatusChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: "#effaf7",
    },
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
      overflow: "hidden",
    },
    headerAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.3)",
    },

    // ─── BALANCE CARD ───
    balanceCardWrap: {
      marginHorizontal: 16,
      marginTop: -58,
      zIndex: 10,
    },
    balanceCard: {
      backgroundColor: isDark ? colors.card : "#d4ece2",
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 20,
      flexDirection: "column",
      borderWidth: 1,
      borderColor: isDark ? "rgba(129,216,163,0.18)" : "rgba(3,109,65,0.15)",
      shadowColor: isDark ? "#000" : "#0a4240",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 14,
      elevation: 6,
    },
    balanceCardTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    balanceLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    balanceAmount: {
      fontSize: 28,
      fontWeight: "900",
      color: colors.text,
      marginTop: 4,
    },
    balanceAmountSkeleton: {
      width: 150,
      height: 34,
      marginTop: 8,
      marginBottom: 2,
    },
    balanceSubLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 4,
    },
    balanceMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 14,
    },
    balanceMetaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: isDark ? "rgba(129,216,163,0.12)" : "rgba(3,109,65,0.1)",
    },
    balanceMetaChipText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#0c7364",
    },
    balanceMetaSkeleton: {
      width: 104,
      height: 28,
    },
    balanceIconWrap: {
      alignItems: "center",
      marginLeft: 16,
      gap: 8,
    },
    balanceIconInner: {
      width: 62,
      height: 62,
      borderRadius: 18,
      backgroundColor: isDark
        ? "rgba(129,216,163,0.12)"
        : "rgba(3,109,65,0.12)",
      justifyContent: "center",
      alignItems: "center",
    },
    balanceIconCaption: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    balanceCardPaid: {
      backgroundColor: isDark ? colors.cardElevated : "#c2e4d0",
      borderColor: isDark ? "rgba(129,216,163,0.30)" : "#036d41",
    },
    balancePaidStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    balancePaidStatusText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.success || "#2e7d32",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    balanceMetaChipPaid: {
      backgroundColor: isDark
        ? "rgba(129,216,163,0.15)"
        : "rgba(3,109,65,0.12)",
    },
    balanceMetaChipTextPaid: {
      color: isDark ? "#81d8a3" : "#036d41",
    },
    balanceIconInnerPaid: {
      backgroundColor: isDark
        ? "rgba(129,216,163,0.15)"
        : "rgba(3,109,65,0.12)",
    },
    balanceExpandRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight || "rgba(6,109,65,0.08)",
    },
    balanceExpandLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: "#00847B",
    },
    balanceBreakdownSection: {
      marginTop: 4,
      paddingTop: 4,
      paddingBottom: 4,
    },
    balanceBreakdownHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    balanceBreakdownTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    balanceBreakdownBillCard: {
      backgroundColor: "rgba(3,109,65,0.1)",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.borderLight : "rgba(3,109,65,0.10)",
    },
    balancePaidHistoryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 10,
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: isDark
        ? "rgba(129,216,163,0.10)"
        : "rgba(3,109,65,0.08)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(129,216,163,0.30)" : "#036d41",
    },
    balancePaidHistoryText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: isDark ? "#81d8a3" : "#036d41",
    },

    // Searchbar
    searchBarCardWrap: {
      marginHorizontal: 16,
      marginTop: -52,
      zIndex: 10,
    },
    searchBarCardWrapInline: {
      marginTop: 18,
      marginBottom: 4,
      zIndex: 1,
    },
    searchIntroCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 6,
    },
    searchIntroHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 14,
    },
    searchIntroLabel: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.text,
    },
    searchHelperText: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 4,
    },
    searchIntroChip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: "#f0e6c8",
    },
    searchIntroChipText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.accent,
    },
    searchIcon: {
      color: colors.textTertiary,
      paddingRight: 10,
    },
    searchBar: {
      backgroundColor: colors.inputBg,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontWeight: "500",
    },
    searchClearBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
    },
    searchEmptyCard: {
      marginHorizontal: 16,
      marginTop: 4,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    searchEmptyTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
    },
    searchEmptyText: {
      marginTop: 3,
      fontSize: 12,
      color: colors.textTertiary,
      lineHeight: 17,
    },

    // ─── NEW USERS FEATURE SECTION ───
    newUsersSection: {
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 12,
    },
    newUsersFlex: {
      flexDirection: "row",
      gap: 12,
    },
    featureCard: {
      flex: 1,
      borderRadius: 20,
      padding: 16,
      minHeight: 180,
      justifyContent: "space-between",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    featureCardTop: {
      gap: 8,
    },
    featureCardIcon: {
      marginBottom: 4,
    },
    featureCardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
      lineHeight: 22,
    },
    featureCardDesc: {
      fontSize: 13,
      color: "rgba(255,255,255,0.85)",
      lineHeight: 18,
      fontWeight: "500",
    },

    // ─── QUICK STATS ROW ───
    quickStatsRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 14,
    },
    quickStatCell: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingVertical: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      shadowColor: "#555",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    quickStatIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    quickStatValue: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.text,
    },
    quickStatLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textTertiary,
      textTransform: "uppercase",
      marginTop: 4,
      textAlign: "center",
    },
    quickStatHint: {
      fontSize: 10,
      color: colors.textTertiary,
      marginTop: 4,
      textAlign: "center",
    },

    // ─── HOST ANNOUNCEMENT BANNER ───
    hostBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginHorizontal: 16,
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderLeftWidth: 4,
    },
    hostBannerTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
      marginBottom: 2,
    },
    hostBannerBody: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
    },
    hostBannerClose: {
      marginLeft: 8,
      padding: 2,
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
      marginTop: 16,
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
    billingCardLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "500",
    },
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
    billingMiniLabel: {
      fontSize: 10,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    billingMiniAmount: { fontSize: 12, fontWeight: "700", color: colors.text },

    // BILL BREAKDOWN
    // ─── UPCOMING BILLS SECTION ───
    upcomingBillsSection: {
      marginHorizontal: 16,
      marginTop: 14,
    },
    upcomingBillsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    upcomingBillsTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    upcomingBillsViewAll: {
      fontSize: 13,
      fontWeight: "600",
      color: "#00847B",
    },
    upcomingBillCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      shadowColor: "#555",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    upcomingBillIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    upcomingBillName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 3,
    },
    upcomingBillDue: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    upcomingBillRight: {
      alignItems: "flex-end",
      gap: 4,
    },
    upcomingBillAmount: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    upcomingBillPaidBadge: {
      fontSize: 9,
      fontWeight: "700",
      color: "#22c55e",
      backgroundColor: "rgba(34,197,94,0.12)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: "hidden",
      textTransform: "uppercase",
    },
    upcomingBillDueSoonBadge: {
      fontSize: 9,
      fontWeight: "700",
      color: "#ef4444",
      backgroundColor: "#fee2e2",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: "hidden",
      textTransform: "uppercase",
    },

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
    countdownText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    countdownPct: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textTertiary,
    },
    countdownBarBg: {
      height: 5,
      backgroundColor: colors.inputBg,
      borderRadius: 3,
      overflow: "hidden",
    },
    countdownBarFill: { height: "100%", borderRadius: 3 },

    // ─── QUICK ACTIONS ───
    actionsSection: {
      marginTop: 14,
    },
    sectionHeaderRow: {
      marginHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.text,
    },
    sectionCaption: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 3,
    },
    actionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginHorizontal: 16,
      marginTop: 12,
    },
    actionCard: {
      width: ACTION_CARD_WIDTH,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      alignItems: "flex-start",
      minHeight: 122,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      shadowColor: "#555",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    actionIconBg: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    actionLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    actionSubLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 4,
    },
    chatBadge: {
      position: "absolute",
      top: -6,
      right: -10,
      backgroundColor: "#e74c3c",
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
      borderWidth: 1.5,
      borderColor: colors.card,
    },
    chatBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "700",
      lineHeight: 12,
    },

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
    payorsTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
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
    payorsPeriodText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.waterColor,
    },
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
    payorAvatarImg: {
      width: 34,
      height: 34,
      borderRadius: 17,
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
    payorDivider: {
      height: 1,
      backgroundColor: colors.background,
      marginHorizontal: 16,
    },
    legendRow: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      alignItems: "center",
    },
    legendText: {
      fontSize: 10,
      color: colors.textTertiary,
      fontStyle: "italic",
    },

    // ─── MEMBER ACTIVITY ───
    activityCard: {
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    activityHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    activityTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    onlineCountChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      backgroundColor: "#e8f5e9",
    },
    onlineDotSmall: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#4caf50",
    },
    onlineCountText: { fontSize: 11, fontWeight: "600", color: "#2e7d32" },
    activityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    activityAvatarWrap: { position: "relative" },
    activityAvatarImg: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: colors.border,
    },
    activityAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#f0e6c8",
    },
    activityAvatarText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.accent,
    },
    statusDot: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.card,
    },
    activityNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 3,
    },
    activityName: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      flexShrink: 1,
    },
    onlineChip: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 6,
      backgroundColor: "#e8f5e9",
    },
    onlineChipText: { fontSize: 9, fontWeight: "700", color: "#2e7d32" },
    recentChip: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 6,
      backgroundColor: "#fff3e0",
    },
    recentChipText: { fontSize: 9, fontWeight: "600", color: "#e65100" },
    offlineText: { fontSize: 9, fontWeight: "500", color: colors.textTertiary },
    contributionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    contributionText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.success,
    },
    contributionLabel: {
      fontSize: 10,
      color: colors.textTertiary,
      marginLeft: 2,
    },
    rankBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    rankText: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },
    activityDivider: {
      height: 1,
      backgroundColor: colors.background,
      marginHorizontal: 16,
    },

    // ─── new users ───
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
    roommateSection: {
      marginTop: 18,
    },
    roommateHeaderActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    roommateViewBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    roommateViewText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.accent,
    },
    roommateCreateBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "#063F39",
    },
    roommateCreateText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#fff",
    },
    roommateCarouselContent: {
      paddingLeft: 16,
      paddingRight: 8,
      paddingBottom: 4,
    },
    roommateCard: {
      width: SCREEN_WIDTH * 0.64,
      marginRight: 12,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 4,
    },
    roommateCardLast: {
      marginRight: 16,
    },
    roommatePhotoWrap: {
      height: 206,
      backgroundColor: "#063F39",
      position: "relative",
    },
    roommatePhoto: {
      width: "100%",
      height: "100%",
    },
    roommatePhotoPlaceholder: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0B5A52",
    },
    roommatePhotoInitial: {
      fontSize: 44,
      fontWeight: "900",
      color: "rgba(255,255,255,0.85)",
    },
    roommatePhotoShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.24)",
    },
    roommateTopBadges: {
      position: "absolute",
      top: 9,
      left: 9,
      right: 9,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    roommateVerifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: "rgba(6,63,57,0.78)",
    },
    roommateVerifiedText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#fff",
    },
    roommateHasRoomBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.88)",
    },
    roommateHasRoomText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#063F39",
    },
    roommateNameBlock: {
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 12,
    },
    roommateName: {
      fontSize: 18,
      fontWeight: "900",
      color: "#fff",
    },
    roommateWork: {
      fontSize: 12,
      fontWeight: "700",
      color: "rgba(255,255,255,0.86)",
      marginTop: 3,
    },
    roommateCardBody: {
      padding: 13,
      gap: 8,
    },
    roommateMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    roommateMetaText: {
      flex: 1,
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    roommateDivider: {
      height: 1,
      backgroundColor: colors.borderLight || colors.border,
      marginTop: 2,
    },
    roommateChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },
    roommateChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      maxWidth: "100%",
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    roommateChipText: {
      maxWidth: 112,
      fontSize: 10,
      fontWeight: "800",
      color: colors.textSecondary,
    },
    roommateLoadingCard: {
      marginHorizontal: 16,
      paddingVertical: 22,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    roommateLoadingText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    roommateEmptyCard: {
      marginHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    roommateEmptyIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSurface,
    },
    roommateEmptyTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
    },
    roommateEmptyText: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textTertiary,
      marginTop: 2,
    },
    roommateDetailSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: "90%",
      overflow: "hidden",
    },
    roommateDetailHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight || colors.border,
    },
    roommateDetailHeaderLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    roommateDetailAvatar: {
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor: colors.inputBg,
    },
    roommateDetailAvatarPlaceholder: {
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor: "#063F39",
      alignItems: "center",
      justifyContent: "center",
    },
    roommateDetailAvatarText: {
      fontSize: 24,
      fontWeight: "900",
      color: "#fff",
    },
    roommateDetailName: {
      fontSize: 19,
      fontWeight: "900",
      color: colors.text,
    },
    roommateDetailBadgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      marginTop: 7,
    },
    roommateDetailVerified: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.successBg,
    },
    roommateDetailVerifiedText: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.success,
    },
    roommateDetailRoomBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.accentSurface,
    },
    roommateDetailRoomText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#063F39",
    },
    roommateDetailBody: {
      paddingHorizontal: 18,
      paddingTop: 16,
    },
    roommateDetailAbout: {
      marginBottom: 16,
    },
    roommateDetailSectionTitle: {
      fontSize: 14,
      fontWeight: "900",
      color: colors.text,
      marginBottom: 7,
    },
    roommateDetailBio: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    roommateDetailGrid: {
      gap: 10,
    },
    roommateDetailItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 11,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.cardAlt || colors.inputBg,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    roommateDetailItemIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSurface,
    },
    roommateDetailLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textTertiary,
      marginBottom: 3,
    },
    roommateDetailValue: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
      lineHeight: 18,
    },
    roommateDetailFooter: {
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: Math.max(18, insets.bottom + 10),
      borderTopWidth: 1,
      borderTopColor: colors.borderLight || colors.border,
    },
    roommateDetailChatBtn: {
      height: 48,
      borderRadius: 14,
      backgroundColor: "#063F39",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    roommateDetailChatText: {
      fontSize: 15,
      fontWeight: "900",
      color: "#fff",
    },

    availSection: { marginTop: 18 },
    availSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      marginHorizontal: 16,
    },
    sectionLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: 0.5,
    },
    sectionDescription: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    viewAllText: { fontSize: 13, fontWeight: "600", color: colors.accent },

    // ─── CAROUSEL LAYOUT ───
    availCarouselContent: {
      paddingLeft: 16,
      paddingRight: 8,
      paddingBottom: 4,
    },
    availCarouselCard: {
      width: SCREEN_WIDTH * 0.66,
      backgroundColor: colors.card,
      borderRadius: 22,
      marginRight: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 4,
    },
    availCarouselCardLast: {
      marginRight: 16,
    },

    // ── Photo area ──
    availCarouselPhotoWrap: {
      width: "100%",
      height: 164,
      position: "relative",
      backgroundColor: colors.inputBg,
    },
    availCarouselPhoto: {
      width: "100%",
      height: "100%",
    },
    availCarouselPhotoPlaceholder: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.accentSurface,
    },

    // ── Overlay badges (top-left) ──
    availCarouselTopBadges: {
      position: "absolute",
      top: 8,
      left: 8,
      flexDirection: "row",
      gap: 5,
    },
    availCarouselBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "rgba(6,63,57,0.72)",
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 20,
    },
    availCarouselBadgeText: {
      fontSize: 10,
      fontWeight: "600",
      color: "#fff",
    },

    // ── Member count pill (bottom-left) ──
    availCarouselMemberPill: {
      position: "absolute",
      bottom: 8,
      left: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(6,63,57,0.72)",
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 20,
    },
    availCarouselMemberText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#fff",
    },

    // ── Heart / expand button (bottom-right) ──
    availCarouselExpandBtn: {
      position: "absolute",
      bottom: 8,
      right: 8,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(6,63,57,0.58)",
      justifyContent: "center",
      alignItems: "center",
    },

    // ── Card body ──
    availCarouselBody: {
      padding: 14,
    },
    availCarouselName: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
      lineHeight: 20,
      marginBottom: 7,
    },
    availCarouselLocRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginBottom: 3,
    },
    availCarouselLocText: {
      flex: 1,
      fontSize: 10,
      color: colors.textTertiary,
    },
    availCarouselTypeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginBottom: 2,
    },
    availCarouselTypeText: {
      flex: 1,
      fontSize: 10,
      color: colors.textTertiary,
    },
    availCarouselDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    availCarouselFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    availCarouselPriceLabel: {
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: colors.textTertiary,
      marginBottom: 3,
    },
    availCarouselPrice: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.accent,
    },
    availCarouselJoinBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.accent,
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
      borderColor: colors.stayIconBorder,
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
      paddingVertical: 8,
      borderRadius: 999,
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
    joinBtnText: { fontSize: 12, fontWeight: "800", color: "#fff" },
    allJoinedCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 18,
      paddingVertical: 18,
      borderRadius: 18,
      backgroundColor: colors.successBg,
      borderWidth: 1,
      borderColor: "#d4edd4",
    },
    allJoinedText: { fontSize: 14, fontWeight: "700", color: colors.success },

    // ─── AVAILABLE ROOM EXTRAS ───
    availLocRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingBottom: 6,
      marginTop: -4,
    },
    availLocFullText: {
      flex: 1,
      fontSize: 11,
      fontWeight: "500",
      color: colors.accent,
    },
    availInfoHint: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    availInfoHintText: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.accent,
    },
    availAmenityRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingBottom: 10,
    },
    availAmenityChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: colors.inputBg,
    },
    availAmenityText: {
      fontSize: 10,
      fontWeight: "500",
      color: colors.textSecondary,
    },
    availAmenityMore: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
    },

    // ─── ROOM INFO MODAL ───
    roomInfoModal: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "90%",
    },
    roomInfoHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    roomInfoHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    roomInfoIconBg: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
    },
    roomInfoTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    roomInfoBody: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 8,
    },
    roomInfoPhotoScroll: {
      marginHorizontal: 2,
      borderRadius: 12,
      overflow: "hidden",
      marginTop: 10,
      marginBottom: 14,
      maxHeight: 180,
    },
    roomInfoPhoto: {
      width: SCREEN_WIDTH - 48,
      height: 180,
    },
    photoDotRow: {
      position: "absolute",
      bottom: 18,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 8,
      marginBottom: 4,
      gap: 6,
    },
    photoDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    photoDotActive: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: colors.accent,
    },
    availPhotoBanner: {
      width: "100%",
      height: 200,
    },
    roomInfoMapWrap: {
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    roomInfoMap: {
      width: "100%",
      height: 180,
    },
    roomInfoAddressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.cardAlt,
    },
    roomInfoAddressText: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 17,
    },
    roomInfoSection: {
      marginBottom: 14,
    },
    roomInfoSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    roomInfoSectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    roomInfoDescText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    roomInfoStatsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      backgroundColor: colors.cardAlt,
      borderRadius: 12,
      paddingVertical: 16,
      marginBottom: 14,
    },
    roomInfoStat: {
      alignItems: "center",
      gap: 4,
    },
    roomInfoStatValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    roomInfoStatLabel: {
      fontSize: 10,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    roomInfoStatDivider: {
      width: 1,
      height: 30,
      backgroundColor: colors.border,
    },
    roomInfoAmenitiesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    roomInfoAmenity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    roomInfoAmenityText: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.textSecondary,
    },
    roomInfoFooter: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: Math.max(16, insets.bottom + 8),
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    roomInfoJoinBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.accent,
    },
    roomInfoJoinText: {
      fontSize: 15,
      fontWeight: "700",
      color: "#fff",
    },
    roomInfoPendingBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.warningBg,
      borderWidth: 1,
      borderColor: "#ffe0b2",
    },
    roomInfoPendingText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#e67e22",
    },
    roomInfoRuleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 8,
    },
    roomInfoRuleCheck: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.success,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 1,
    },
    roomInfoRuleText: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },

    // ─── FULL MAP MODAL ───
    fullMapHeader: {
      position: "absolute",
      top: Math.max(16, insets.top + 8),
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "rgba(15,15,15,0.85)",
      borderRadius: 20,
      paddingVertical: 8,
      paddingLeft: 8,
      paddingRight: 14,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 12,
        },
        android: { elevation: 14 },
      }),
    },
    fullMapBackBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(255,255,255,0.12)",
      justifyContent: "center",
      alignItems: "center",
    },
    fullMapTitleWrap: {
      flex: 1,
    },
    fullMapTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: "#fff",
      letterSpacing: 0.1,
    },
    fullMapSubtitle: {
      fontSize: 11,
      color: "rgba(255,255,255,0.5)",
      marginTop: 1,
    },
    fullMapAddressBar: {
      position: "absolute",
      bottom: Math.max(24, insets.bottom + 16),
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: "rgba(15,15,15,0.85)",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 12,
        },
        android: { elevation: 14 },
      }),
    },
    fullMapAddressText: {
      flex: 1,
      fontSize: 13,
      color: "rgba(255,255,255,0.88)",
      fontWeight: "500",
      lineHeight: 19,
    },
    fullMapOpenBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.accent,
      borderRadius: 12,
    },
    fullMapOpenBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#fff",
    },

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
      marginBottom: Math.max(24, insets.bottom + 12),
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
    // Drag handle (shared across all bottom-sheet modals)
    modalDragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 4,
    },
    expenseSummaryCard: {
      backgroundColor: colors.breakdownHeaderBg,
      borderRadius: 16,
      padding: 18,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? "rgba(129,216,163,0.20)" : "rgba(3,109,65,0.14)",
    },
    expenseSummaryLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    expenseSummaryAmount: {
      fontSize: 30,
      fontWeight: "900",
      color: colors.accent,
      marginTop: 4,
      letterSpacing: -0.5,
    },
    expenseSummaryNote: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 8,
    },
    expenseRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      marginBottom: 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    expenseRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    // Icon badge replacing the old plain dot
    expenseIconBg: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    // kept for legacy usage elsewhere in the file
    expenseDot: { width: 8, height: 8, borderRadius: 4 },
    expenseRowName: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 6,
    },
    expenseBarBg: {
      height: 5,
      backgroundColor: colors.borderLight,
      borderRadius: 3,
      overflow: "hidden",
      width: 120,
    },
    expenseBarFill: { height: "100%", borderRadius: 3 },
    expenseRowRight: { alignItems: "flex-end" },
    expenseRowAmountRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
    },
    expenseRowAmount: { fontSize: 14, fontWeight: "700", color: colors.text },
    expenseRowAmountPaid: {
      color: colors.textTertiary,
      textDecorationLine: "line-through",
    },
    // ✓ Paid badge — uses design-system tokens instead of hardcoded #22c55e
    expensePaidBadge: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.breakdownPaidBadge,
      backgroundColor: colors.breakdownPaidBadgeBg,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 10,
      overflow: "hidden",
    },
    expenseRowPct: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    /* Photo overlay & full-screen viewer */
    photoOverlay: {
      position: "absolute",
      bottom: 8,
      left: 8,
      right: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    photoModalOverlay: {
      position: "absolute",
      bottom: 20,
      left: 8,
      right: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    photoCountBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(0,0,0,0.55)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    photoCountText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#fff",
    },
    photoFullViewBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(0,0,0,0.55)",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    photoFullViewText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#fff",
    },
    pvBg: { flex: 1, backgroundColor: "#000" },
    pvHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    pvBackBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.15)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    pvTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: "#fff" },
    pvCount: {
      fontSize: 13,
      fontWeight: "600",
      color: "rgba(255,255,255,0.7)",
    },
    pvImg: { width: SCREEN_WIDTH, height: "100%" },
    pvDotRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
      paddingTop: 12,
      gap: 6,
    },
    pvDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: "rgba(255,255,255,0.35)",
    },
    pvDotActive: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: colors.card,
    },

    // ─── USER PROFILE MODAL ───
    profileModalBackground: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    profileModalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "90%",
      paddingTop: 0,
    },
    profileModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    profileModalTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    profileModalBody: {
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    profileModalLoading: {
      height: 200,
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
    },
    profileLoadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    profileLargeAvatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      alignSelf: "center",
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    profileLargeAvatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
      marginBottom: 16,
      borderWidth: 2,
      borderColor: "#f0e6c8",
    },
    profileLargeAvatarText: {
      fontSize: 40,
      fontWeight: "700",
      color: colors.accent,
    },
    profileName: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
      marginBottom: 4,
    },
    profileUsername: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 12,
    },
    profileRoleBadge: {
      alignSelf: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.accentSurface,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: "#f0e6c8",
    },
    profileRoleText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.accent,
    },
    profileInfoGrid: {
      gap: 12,
    },
    profileInfoItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    profileInfoLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      fontWeight: "500",
      marginBottom: 2,
    },
    profileInfoValue: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "600",
    },
  });
};

export default ClientHomeScreen;
