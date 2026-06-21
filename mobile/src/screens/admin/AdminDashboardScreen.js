import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  Platform,
  Animated,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Polyline,
  Circle,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Path,
} from "react-native-svg";
import { AuthContext } from "../../context/AuthContext";
import {
  roomService,
  apiService,
  chatService,
} from "../../services/apiService";
import chatReadTracker from "../../services/chatReadTracker";
import { screenCache } from "../../hooks/useScreenCache";
import AnimatedAmount from "../../components/AnimatedAmount";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SkeletonBlock = ({ colors, style, onHeader = false }) => {
  const opacity = useRef(new Animated.Value(0.42)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.86,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.42,
          duration: 700,
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
          backgroundColor: onHeader
            ? "rgba(255,255,255,0.2)"
            : colors.skeleton || colors.borderLight,
          borderRadius: 999,
          opacity,
        },
        style,
      ]}
    />
  );
};

const AdminDashboardSkeleton = ({ colors, styles }) => (
  <ScrollViewWithDetection
    style={styles.container}
    contentContainerStyle={styles.contentContainer}
    showsVerticalScrollIndicator={false}
  >
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.headerTopRow}>
          <SkeletonBlock
            colors={colors}
            style={styles.skelHeaderIcon}
            onHeader
          />
          <SkeletonBlock
            colors={colors}
            style={styles.skelHeaderPill}
            onHeader
          />
        </View>
        <View>
          <SkeletonBlock
            colors={colors}
            style={styles.skelHeaderEyebrow}
            onHeader
          />
          <SkeletonBlock
            colors={colors}
            style={styles.skelHeaderTitle}
            onHeader
          />
          <SkeletonBlock
            colors={colors}
            style={styles.skelHeaderSubtitle}
            onHeader
          />
          <SkeletonBlock
            colors={colors}
            style={styles.skelHeaderSubtitleShort}
            onHeader
          />
        </View>
        <View style={styles.headerStatusRow}>
          <SkeletonBlock
            colors={colors}
            style={styles.skelStatusChip}
            onHeader
          />
          <SkeletonBlock
            colors={colors}
            style={styles.skelStatusChipWide}
            onHeader
          />
        </View>
      </View>
    </View>

    <View style={styles.roomSelectorWrap}>
      <View style={styles.roomSelectorBtn}>
        <SkeletonBlock colors={colors} style={styles.skelSelectorIcon} />
        <SkeletonBlock colors={colors} style={styles.skelSelectorText} />
        <SkeletonBlock colors={colors} style={styles.skelSelectorChevron} />
      </View>
    </View>

    <View style={styles.sectionWrap}>
      <View style={styles.collectionCard}>
        <View style={styles.collectionHeader}>
          <View style={{ flex: 1 }}>
            <SkeletonBlock colors={colors} style={styles.skelCardTitle} />
            <SkeletonBlock colors={colors} style={styles.skelPeriodBadge} />
          </View>
          <SkeletonBlock colors={colors} style={styles.skelRateCircle} />
        </View>
        <View style={styles.collectionRow}>
          <View style={[styles.collectionMetric, styles.collectedMetric]}>
            <SkeletonBlock colors={colors} style={styles.skelMetricLabel} />
            <SkeletonBlock colors={colors} style={styles.skelMetricAmount} />
          </View>
          <View style={styles.collectionDivider} />
          <View style={[styles.collectionMetric, styles.pendingMetric]}>
            <SkeletonBlock colors={colors} style={styles.skelMetricLabel} />
            <SkeletonBlock colors={colors} style={styles.skelMetricAmount} />
          </View>
        </View>
        <SkeletonBlock colors={colors} style={styles.skelProgress} />
      </View>
    </View>

    <View style={styles.sectionWrap}>
      <View style={styles.statsGrid}>
        {[0, 1, 2, 3].map((item) => (
          <View key={item} style={styles.statCard}>
            <SkeletonBlock colors={colors} style={styles.skelStatIcon} />
            <SkeletonBlock colors={colors} style={styles.skelStatValue} />
            <SkeletonBlock colors={colors} style={styles.skelStatLabel} />
          </View>
        ))}
      </View>
    </View>

    <View style={styles.sectionWrap}>
      <SkeletonBlock colors={colors} style={styles.skelSectionTitle} />
      <View style={styles.actionsGrid}>
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <View key={item} style={styles.actionCard}>
            <SkeletonBlock colors={colors} style={styles.skelActionIcon} />
            <SkeletonBlock colors={colors} style={styles.skelActionLabel} />
          </View>
        ))}
      </View>
    </View>

    <View style={styles.sectionWrap}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <SkeletonBlock colors={colors} style={styles.skelSectionTitle} />
          <SkeletonBlock colors={colors} style={styles.skelSectionSubtitle} />
        </View>
        <SkeletonBlock colors={colors} style={styles.skelTrendBadge} />
      </View>
      <View style={styles.card}>
        <SkeletonBlock colors={colors} style={styles.skelLegend} />
        <View style={styles.skelChartArea}>
          {[0, 1, 2, 3].map((item) => (
            <SkeletonBlock
              key={item}
              colors={colors}
              style={[styles.skelChartLine, { top: 20 + item * 36 }]}
            />
          ))}
        </View>
        <View style={styles.chartSummary}>
          <SkeletonBlock colors={colors} style={styles.skelChartSummary} />
          <SkeletonBlock colors={colors} style={styles.skelChartSummary} />
        </View>
      </View>
    </View>

    <View style={styles.sectionWrap}>
      <View style={styles.sectionHeaderRow}>
        <SkeletonBlock colors={colors} style={styles.skelSectionTitle} />
        <SkeletonBlock colors={colors} style={styles.skelViewAll} />
      </View>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.roomCard}>
          <View style={styles.roomLeft}>
            <SkeletonBlock colors={colors} style={styles.skelRoomIcon} />
            <View style={styles.roomInfo}>
              <SkeletonBlock colors={colors} style={styles.skelRoomName} />
              <SkeletonBlock colors={colors} style={styles.skelRoomMeta} />
            </View>
          </View>
          <SkeletonBlock colors={colors} style={styles.skelRoomBadge} />
        </View>
      ))}
    </View>

    <View style={{ height: 32 }} />
  </ScrollViewWithDetection>
);

const AdminDashboardScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { state } = useContext(AuthContext);
  const isFocused = useIsFocused();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null); // null = All Rooms
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);
  const [paymentStats, setPaymentStats] = useState({
    totalCollected: 0,
    totalPending: 0,
    collectionRate: 0,
  });
  const [billingByMonth, setBillingByMonth] = useState([]);
  const [latestBillingCycle, setLatestBillingCycle] = useState(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const hostUserId = state?.user?.id || state?.user?._id;
  const hasLoaded = useRef(false);

  // Re-fetch filtered data when selectedRoomId changes (skip initial — isFocused handles it)
  useEffect(() => {
    if (hasLoaded.current && isFocused) {
      loadDashboardData(selectedRoomId);
    }
  }, [selectedRoomId]);

  // Fetch unread chat count for selected room (only messages after last read)
  const fetchChatBadge = async (targetRoomId, roomList = rooms) => {
    try {
      const rid = targetRoomId || roomList[0]?.id || roomList[0]?._id;
      if (!rid) {
        setUnreadChatCount(0);
        return;
      }
      const status = await chatService.getChatStatus(rid);
      if (!status.chatEnabled) {
        setUnreadChatCount(0);
        return;
      }
      const [res, lastRead] = await Promise.all([
        chatService.getMessages(rid, { limit: 5 }),
        chatReadTracker.getLastRead(rid),
      ]);
      const msgs = res.messages || [];
      const unread = msgs.filter(
        (m) =>
          String(m.senderId) !== String(hostUserId) &&
          new Date(m.createdAt).getTime() > lastRead,
      );
      setUnreadChatCount(unread.length);
    } catch {
      setUnreadChatCount(0);
    }
  };

  useEffect(() => {
    if (isFocused) {
      // Restore cached values immediately so cards are never blank
      screenCache.read("admin_dash_" + hostUserId).then((cached) => {
        if (cached) {
          if (cached.paymentStats) setPaymentStats(cached.paymentStats);
          if (cached.rooms) setRooms(cached.rooms);
          if (cached.latestBillingCycle !== undefined)
            setLatestBillingCycle(cached.latestBillingCycle);
          if (cached.billingByMonth) setBillingByMonth(cached.billingByMonth);
        }
      });
      loadDashboardData(selectedRoomId);
    }
  }, [isFocused]);

  const fetchFilteredData = async (roomId) => {
    await Promise.all([
      fetchBillingTotals(6, roomId),
      fetchPaymentStats(roomId),
      fetchLatestBillingCycle(roomId),
    ]);
  };

  const loadDashboardData = async (roomId) => {
    try {
      setLoading(true);
      const roomsPromise = fetchRooms();
      const filteredPromise = fetchFilteredData(roomId);
      const fetchedRooms = await roomsPromise;

      await Promise.all([
        filteredPromise,
        fetchChatBadge(roomId, fetchedRooms || rooms),
      ]);
    } finally {
      hasLoaded.current = true;
      setLoading(false);
    }
  };

  const fetchPaymentStats = async (roomId) => {
    try {
      const timestamp = Date.now();
      const roomQ = roomId ? `&roomId=${roomId}` : "";
      const response = await apiService.get(
        `/api/v2/admin/billing/payment-stats?t=${timestamp}${roomQ}`,
      );
      let stats = null;
      if (response?.success && response.data) {
        stats = response.data;
      } else if (response?.data) {
        stats = response.data;
      } else {
        stats = { totalCollected: 0, totalPending: 0, collectionRate: 0 };
      }
      setPaymentStats(stats);
      // Persist for stale-while-revalidate
      const prev = (await screenCache.read("admin_dash_" + hostUserId)) || {};
      screenCache.write("admin_dash_" + hostUserId, {
        ...prev,
        paymentStats: stats,
      });
    } catch (error) {
      console.log("Error fetching payment stats:", error);
      setPaymentStats({
        totalCollected: 0,
        totalPending: 0,
        collectionRate: 0,
      });
    }
  };

  const fetchLatestBillingCycle = async (roomId) => {
    try {
      const roomQ = roomId ? `?roomId=${roomId}` : "";
      const response = await apiService.get(
        `/api/v2/billing-cycles/totals/latest${roomQ}`,
      );
      let cycleData = null;
      if (response?.success && response.stats) {
        cycleData = response.stats;
      } else if (
        response?.success &&
        response.data &&
        (response.data.id || response.data._id)
      ) {
        cycleData = response.data;
      } else if (response && (response.id || response._id)) {
        cycleData = response;
      }
      setLatestBillingCycle(cycleData);
      const prev = (await screenCache.read("admin_dash_" + hostUserId)) || {};
      screenCache.write("admin_dash_" + hostUserId, {
        ...prev,
        latestBillingCycle: cycleData,
      });
    } catch (error) {
      console.log("Error fetching latest billing cycle:", error);
      setLatestBillingCycle(null);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await roomService.getRooms();
      const fetched = response.rooms || response.data?.rooms || [];
      setRooms(fetched);
      const prev = (await screenCache.read("admin_dash_" + hostUserId)) || {};
      screenCache.write("admin_dash_" + hostUserId, {
        ...prev,
        rooms: fetched,
      });
      return fetched;
    } catch (error) {
      console.log("Error fetching rooms:", error);
      return [];
    }
  };

  const fetchBillingTotals = async (months = 6, roomId) => {
    try {
      const roomQ = roomId ? `&roomId=${roomId}` : "";
      const res = await apiService.get(
        `/api/v2/billing-cycles/totals/month?months=${months}${roomQ}`,
      );
      if (res?.success) {
        setBillingByMonth(res.data || []);
        const prev = (await screenCache.read("admin_dash_" + hostUserId)) || {};
        screenCache.write("admin_dash_" + hostUserId, {
          ...prev,
          billingByMonth: res.data || [],
        });
      }
    } catch (error) {
      console.error("Error fetching billing totals:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchRooms(),
      fetchBillingTotals(6, selectedRoomId),
      fetchPaymentStats(selectedRoomId),
      fetchLatestBillingCycle(selectedRoomId),
    ]);
    setRefreshing(false);
  };

  const totalMembers = (
    selectedRoomId
      ? rooms.filter((r) => (r.id || r._id) === selectedRoomId)
      : rooms
  ).reduce((sum, room) => sum + (room.members?.length || 0), 0);
  const totalBilledLastN = billingByMonth.reduce(
    (s, b) => s + (b.totalBilled || 0),
    0,
  );
  const totalCollectedLastN = billingByMonth.reduce(
    (s, b) => s + (b.totalCollected || 0),
    0,
  );
  const overallCollectionRate =
    totalBilledLastN > 0
      ? Math.round((totalCollectedLastN / totalBilledLastN) * 100)
      : 0;

  // ─── Greeting by time of day ───
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // ─── Format currency ───
  const fmt = (val) =>
    "\u20B1" +
    (val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtShort = (val) => {
    if (val >= 1000000) return `\u20B1${(val / 1000000).toFixed(1)}M`;
    if (val >= 10000) return `\u20B1${(val / 1000).toFixed(0)}k`;
    return (
      "\u20B1" +
      (val || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  // ─── Chart rendering ───
  const renderChart = () => {
    if (billingByMonth.length === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <View style={styles.emptyChartIcon}>
            <Ionicons
              name="analytics-outline"
              size={40}
              color={colors.accent}
            />
          </View>
          <Text style={styles.emptyChartTitle}>No Billing Data Yet</Text>
          <Text style={styles.emptyChartSubtitle}>
            Create a billing cycle to see trends here
          </Text>
        </View>
      );
    }

    const chartWidth = SCREEN_WIDTH - 64;
    const chartHeight = 180;
    const pL = 48;
    const pR = 12;
    const pT = 16;
    const pB = 32;
    const gW = chartWidth - pL - pR;
    const gH = chartHeight - pT - pB;

    const allValues = billingByMonth.flatMap((b) => [
      b.totalBilled || 0,
      b.totalCollected || 0,
    ]);
    const maxVal = Math.max(...allValues, 1);
    const yMax = Math.ceil(maxVal / 1000) * 1000 || maxVal;
    const gridLines = 4;

    const getX = (i) =>
      pL +
      (billingByMonth.length > 1
        ? (i / (billingByMonth.length - 1)) * gW
        : gW / 2);
    const getY = (val) => pT + gH - (val / yMax) * gH;

    const billedPts = billingByMonth.map(
      (b, i) => `${getX(i)},${getY(b.totalBilled || 0)}`,
    );
    const collectedPts = billingByMonth.map(
      (b, i) => `${getX(i)},${getY(b.totalCollected || 0)}`,
    );

    const makeAreaPath = (data, key) => {
      if (data.length === 0) return "";
      return (
        `M ${getX(0)},${getY(0)} ` +
        data.map((b, i) => `L ${getX(i)},${getY(b[key] || 0)}`).join(" ") +
        ` L ${getX(data.length - 1)},${getY(0)} Z`
      );
    };

    return (
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="billedArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.16" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0.02" />
          </LinearGradient>
          <LinearGradient id="collectedArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.success} stopOpacity="0.14" />
            <Stop offset="1" stopColor={colors.success} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = pT + (i / gridLines) * gH;
          const val = yMax - (i / gridLines) * yMax;
          return (
            <React.Fragment key={`g-${i}`}>
              <Line
                x1={pL}
                y1={y}
                x2={pL + gW}
                y2={y}
                stroke={colors.borderLight}
                strokeWidth={1}
              />
              <SvgText
                x={pL - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={9}
                fill={colors.textTertiary}
              >
                {fmtShort(val)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Area fills */}
        <Path
          d={makeAreaPath(billingByMonth, "totalBilled")}
          fill="url(#billedArea)"
        />
        <Path
          d={makeAreaPath(billingByMonth, "totalCollected")}
          fill="url(#collectedArea)"
        />

        {/* Lines */}
        {billedPts.length > 1 && (
          <Polyline
            points={billedPts.join(" ")}
            fill="none"
            stroke={colors.accent}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {collectedPts.length > 1 && (
          <Polyline
            points={collectedPts.join(" ")}
            fill="none"
            stroke={colors.success}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Data points */}
        {billingByMonth.map((b, i) => (
          <Circle
            key={`bp-${i}`}
            cx={getX(i)}
            cy={getY(b.totalBilled || 0)}
            r={3.5}
            fill={colors.card}
            stroke={colors.accent}
            strokeWidth={1.5}
          />
        ))}
        {billingByMonth.map((b, i) => (
          <Circle
            key={`cp-${i}`}
            cx={getX(i)}
            cy={getY(b.totalCollected || 0)}
            r={3.5}
            fill="#fff"
            stroke={colors.success}
            strokeWidth={1.5}
          />
        ))}

        {/* X labels */}
        {billingByMonth.map((b, i) => (
          <SvgText
            key={`xl-${i}`}
            x={getX(i)}
            y={chartHeight - 6}
            textAnchor="middle"
            fontSize={10}
            fill={colors.textTertiary}
            fontWeight="500"
          >
            {b.month?.split(" ")[0]?.substring(0, 3) || ""}
          </SvgText>
        ))}
      </Svg>
    );
  };

  // ─── Quick action buttons ───
  const quickActions = [
    {
      icon: "home-outline",
      label: "Rooms",
      color: colors.accent,
      bg: colors.accentSurface,
      onPress: () =>
        navigation.navigate("RoomStack", { screen: "RoomManagement" }),
    },
    {
      icon: "receipt-outline",
      label: "Billing",
      color: colors.success,
      bg: colors.successBg,
      onPress: () =>
        navigation.navigate("BillingStack", { screen: "AdminBilling" }),
    },
    {
      icon: "people-outline",
      label: "Members",
      color: colors.waterColor,
      bg: colors.infoBg,
      onPress: () => navigation.navigate("Members", { screen: "Members" }),
    },
    {
      icon: "card-outline",
      label: "Payments",
      color: colors.internetColor,
      bg: colors.actionChatBg || colors.accentLight,
      onPress: () =>
        navigation.navigate("BillingStack", { screen: "AdminBilling" }),
    },
    {
      icon: "settings-outline",
      label: "Pay Settings",
      color: colors.accent,
      bg: colors.actionRoomInfoBg || colors.accentLight,
      onPress: () => {
        // Payment settings must be per-room — resolve the target room
        const targetRoomId =
          selectedRoomId ||
          (rooms.length === 1 ? rooms[0].id || rooms[0]._id : null);
        if (!targetRoomId) {
          Alert.alert(
            "Select a Room",
            "Please select a specific room from the dropdown first. Payment settings are configured per room.",
          );
          return;
        }
        navigation.navigate("PaymentSettingsFromDash", {
          selectedRoomId: targetRoomId,
        });
      },
    },
    {
      icon: "chatbubble-ellipses-outline",
      label: "Chat",
      color: colors.accent,
      bg: colors.actionPresenceBg || colors.accentLight,
      onPress: () => {
        const room = selectedRoomId
          ? rooms.find((r) => (r.id || r._id) === selectedRoomId)
          : rooms[0];
        if (!room) {
          Alert.alert("No Room", "Create a room first to use chat.");
          return;
        }
        navigation.navigate("ChatRoom", {
          roomId: room.id || room._id,
          roomName: room.name,
          isHost: true,
        });
      },
    },
  ];

  if (loading && !refreshing) {
    return <AdminDashboardSkeleton colors={colors} styles={styles} />;
  }

  return (
    <ScrollViewWithDetection
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="leaf-outline" size={21} color="#ffffff" />
            </View>
            <View style={styles.headerTopPill}>
              <Ionicons name="shield-checkmark" size={13} color="#ffffff" />
              <Text style={styles.headerTopPillText}>Admin Console</Text>
            </View>
          </View>

          <View style={styles.headerTitleRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerEyebrow}>{getGreeting()}</Text>
              <Text style={styles.headerTitle}>Dashboard</Text>
              <Text style={styles.headerSubtitle} numberOfLines={2}>
                {state.user?.name || "Admin"}, track collections, rooms, and
                billing activity from one place.
              </Text>
            </View>
          </View>

          <View style={styles.headerStatusRow}>
            <View style={styles.headerStatusChip}>
              <Ionicons name="home-outline" size={13} color="#ffffff" />
              <Text style={styles.headerStatusChipText}>
                {selectedRoomId ? "1 room" : `${rooms.length} rooms`}
              </Text>
            </View>
            <View style={styles.headerStatusChip}>
              <Ionicons name="people-outline" size={13} color="#ffffff" />
              <Text style={styles.headerStatusChipText}>
                {totalMembers} members
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Room Selector Dropdown */}
      {rooms.length > 1 && (
        <View style={styles.roomSelectorWrap}>
          <TouchableOpacity
            style={styles.roomSelectorBtn}
            activeOpacity={0.7}
            onPress={() => setRoomDropdownOpen(!roomDropdownOpen)}
          >
            <View style={styles.roomSelectorIconBg}>
              <Ionicons
                name={selectedRoomId ? "home" : "apps"}
                size={16}
                color={colors.accent}
              />
            </View>
            <Text style={styles.roomSelectorText} numberOfLines={1}>
              {selectedRoomId
                ? rooms.find((r) => (r.id || r._id) === selectedRoomId)?.name ||
                  "Room"
                : "All Rooms"}
            </Text>
            <Ionicons
              name={roomDropdownOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {roomDropdownOpen && (
            <View style={styles.roomDropdown}>
              <TouchableOpacity
                style={[
                  styles.roomDropdownItem,
                  !selectedRoomId && styles.roomDropdownItemActive,
                ]}
                onPress={() => {
                  setSelectedRoomId(null);
                  setRoomDropdownOpen(false);
                }}
              >
                <Ionicons
                  name="apps"
                  size={16}
                  color={!selectedRoomId ? colors.accent : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.roomDropdownText,
                    !selectedRoomId && styles.roomDropdownTextActive,
                  ]}
                >
                  All Rooms
                </Text>
                {!selectedRoomId && (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={colors.accent}
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </TouchableOpacity>
              {rooms.map((room) => {
                const rid = room.id || room._id;
                const isActive = selectedRoomId === rid;
                return (
                  <TouchableOpacity
                    key={rid}
                    style={[
                      styles.roomDropdownItem,
                      isActive && styles.roomDropdownItemActive,
                    ]}
                    onPress={() => {
                      setSelectedRoomId(rid);
                      setRoomDropdownOpen(false);
                    }}
                  >
                    <Ionicons
                      name="home"
                      size={16}
                      color={isActive ? colors.accent : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.roomDropdownText,
                        isActive && styles.roomDropdownTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {room.name}
                    </Text>
                    <Text style={styles.roomDropdownMeta}>
                      {room.members?.length || 0} member
                      {(room.members?.length || 0) !== 1 ? "s" : ""}
                    </Text>
                    {isActive && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={colors.accent}
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Payment Collection Card */}
      <View style={styles.sectionWrap}>
        <View style={styles.collectionCard}>
          <View style={styles.collectionHeader}>
            <View>
              <Text style={styles.collectionTitle}>Payment Collection</Text>
              {latestBillingCycle?.startDate && latestBillingCycle?.endDate && (
                <View style={styles.periodBadge}>
                  <Ionicons
                    name="calendar-outline"
                    size={11}
                    color={colors.accent}
                  />
                  <Text style={styles.periodText}>
                    {new Date(latestBillingCycle.startDate).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}{" "}
                    -{" "}
                    {new Date(latestBillingCycle.endDate).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.rateCircle}>
              <AnimatedAmount
                value={latestBillingCycle?.collectionRate || 0}
                formatter={(n) => `${Math.round(n)}%`}
                style={styles.rateValue}
              />
              <Text style={styles.rateLabel}>Rate</Text>
            </View>
          </View>

          <View style={styles.collectionRow}>
            <View style={[styles.collectionMetric, styles.collectedMetric]}>
              <View style={styles.metricIconRow}>
                <View style={styles.metricIconBg}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.metricLabel}>Collected</Text>
              </View>
              <AnimatedAmount
                value={latestBillingCycle?.totalCollected || 0}
                formatter={fmt}
                style={[styles.metricAmount, { color: colors.success }]}
              />
            </View>
            <View style={styles.collectionDivider} />
            <View style={[styles.collectionMetric, styles.pendingMetric]}>
              <View style={styles.metricIconRow}>
                <View
                  style={[
                    styles.metricIconBg,
                    { backgroundColor: colors.errorBg },
                  ]}
                >
                  <Ionicons name="time" size={18} color="#c62828" />
                </View>
                <Text style={styles.metricLabel}>Pending</Text>
              </View>
              <AnimatedAmount
                value={latestBillingCycle?.totalPending || 0}
                formatter={fmt}
                style={[styles.metricAmount, { color: "#c62828" }]}
              />
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, latestBillingCycle?.collectionRate || 0)}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* ─── Cycle Closed: Unpaid Members Warning ─── */}
          {(() => {
            // Show for rooms where:
            // 1. No active cycle and prior cycle had unpaid members (cycleStatus = "cycle_closed")
            // 2. Has a NEW active cycle but a prior closed cycle still has unpaid members (hasPriorUnpaid)
            const closedRooms = (
              selectedRoomId
                ? rooms.filter(
                    (r) => String(r.id || r._id) === String(selectedRoomId),
                  )
                : rooms
            ).filter(
              (r) =>
                r.cycleStatus === "cycle_closed" || r.hasPriorUnpaid === true,
            );

            if (closedRooms.length === 0) return null;

            const firstRoom = closedRooms[0];
            return (
              <View
                style={{
                  backgroundColor: "#fff8e1",
                  borderRadius: 10,
                  padding: 12,
                  marginTop: 14,
                  borderWidth: 1,
                  borderColor: "#ffe082",
                  borderLeftWidth: 4,
                  borderLeftColor: "#f9a825",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "#fff3cd",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    <Ionicons name="warning" size={20} color="#f9a825" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: "#7b5800",
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      Cycle Closed — Unpaid Balance Remaining
                    </Text>
                    <Text
                      style={{
                        color: "#7b5800",
                        fontSize: 11,
                        marginTop: 2,
                        opacity: 0.85,
                      }}
                    >
                      {closedRooms.length === 1
                        ? `${firstRoom.name} has members who haven't paid after cycle close.`
                        : `${closedRooms.length} rooms have members who haven't paid after cycle close.`}
                    </Text>
                  </View>
                </View>

                {/* Per-room reminder buttons */}
                <View style={{ marginTop: 10, gap: 6 }}>
                  {closedRooms.map((r) => (
                    <TouchableOpacity
                      key={r.id || r._id}
                      style={{
                        backgroundColor: "#f9a825",
                        borderRadius: 8,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                      onPress={() =>
                        navigation.getParent()?.navigate("BillingStack", {
                          screen: "Reminders",
                          params: { room: r },
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <Ionicons name="notifications" size={15} color="#fff" />
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "700",
                          fontSize: 13,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {closedRooms.length > 1
                          ? `Send Reminders — ${r.name}`
                          : "Send Reminders to Unpaid Members"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })()}

          {/* ─── All Paid / Cycle Complete Success Notice ─── */}
          {latestBillingCycle &&
            ((latestBillingCycle.cycleStatus === "completed" &&
              (latestBillingCycle.totalPending || 0) === 0) ||
              (latestBillingCycle.collectionRate >= 100 &&
                latestBillingCycle.cycleStatus !== "completed")) && (
              <View
                style={{
                  backgroundColor: colors.successBg,
                  borderRadius: 10,
                  padding: 12,
                  marginTop: 14,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.success + "22",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <Ionicons
                    name="checkmark-done-circle"
                    size={20}
                    color={colors.success}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.success,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    {latestBillingCycle.cycleStatus === "completed"
                      ? "Billing Cycle Complete"
                      : "All Payors Have Paid!"}
                  </Text>
                  <Text
                    style={{
                      color: colors.success,
                      fontSize: 11,
                      marginTop: 2,
                      opacity: 0.8,
                    }}
                  >
                    {latestBillingCycle.cycleStatus === "completed"
                      ? "This cycle has been closed. You can start a new billing cycle."
                      : "100% collection achieved. You may close this cycle."}
                  </Text>
                </View>
              </View>
            )}
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.sectionWrap}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: colors.accentSurface },
              ]}
            >
              <Ionicons name="home" size={20} color={colors.accent} />
            </View>
            <Text
              style={styles.statValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {selectedRoomId ? 1 : rooms.length}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              Rooms
            </Text>
          </View>
          <View style={styles.statCard}>
            <View
              style={[styles.statIconWrap, { backgroundColor: colors.infoBg }]}
            >
              <Ionicons name="people" size={20} color={colors.info} />
            </View>
            <Text
              style={styles.statValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {totalMembers}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              Members
            </Text>
          </View>
          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: colors.successBg },
              ]}
            >
              <Ionicons name="cash" size={20} color={colors.success} />
            </View>
            <Text
              style={styles.statValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {fmtShort(totalBilledLastN)}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              Billed
            </Text>
          </View>
          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: colors.purpleBg },
              ]}
            >
              <Ionicons
                name="trending-up"
                size={20}
                color={colors.internetColor}
              />
            </View>
            <AnimatedAmount
              value={overallCollectionRate}
              formatter={(n) => `${Math.round(n)}%`}
              style={styles.statValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            />
            <Text style={styles.statLabel} numberOfLines={1}>
              Collected
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.actionCard}
              activeOpacity={0.7}
              onPress={action.onPress}
            >
              <View
                style={[styles.actionIconWrap, { backgroundColor: action.bg }]}
              >
                <Ionicons name={action.icon} size={22} color={action.color} />
                {action.label === "Chat" && unreadChatCount > 0 && (
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>
                      {unreadChatCount > 99 ? "99+" : unreadChatCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={styles.actionLabel}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Billing Trend Chart */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Billing Trend</Text>
            <Text style={styles.sectionSubtitle}>Last 6 months overview</Text>
          </View>
          <View style={styles.trendBadge}>
            <Ionicons name="analytics" size={18} color={colors.accent} />
          </View>
        </View>

        <View style={styles.card}>
          {/* Legend */}
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: colors.accent }]}
              />
              <Text style={styles.legendText}>Billed</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: colors.success }]}
              />
              <Text style={styles.legendText}>Collected</Text>
            </View>
          </View>

          {renderChart()}

          {/* Chart summary */}
          {billingByMonth.length > 0 && (
            <View style={styles.chartSummary}>
              <View style={styles.chartSumItem}>
                <View
                  style={[
                    styles.chartSumIcon,
                    { backgroundColor: colors.accentSurface },
                  ]}
                >
                  <Ionicons
                    name="receipt-outline"
                    size={16}
                    color={colors.accent}
                  />
                </View>
                <View>
                  <Text style={styles.chartSumLabel}>Total Billed</Text>
                  <AnimatedAmount
                    value={totalBilledLastN}
                    formatter={fmt}
                    style={styles.chartSumValue}
                  />
                </View>
              </View>
              <View style={styles.chartSumDivider} />
              <View style={styles.chartSumItem}>
                <View
                  style={[
                    styles.chartSumIcon,
                    { backgroundColor: colors.successBg },
                  ]}
                >
                  <Ionicons
                    name="checkmark-done-outline"
                    size={16}
                    color={colors.success}
                  />
                </View>
                <View>
                  <Text style={styles.chartSumLabel}>Total Collected</Text>
                  <AnimatedAmount
                    value={totalCollectedLastN}
                    formatter={fmt}
                    style={styles.chartSumValue}
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Rooms Overview */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Rooms Overview</Text>
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() =>
              navigation.navigate("RoomStack", { screen: "RoomManagement" })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {rooms.length === 0 ? (
          <View style={styles.emptyRooms}>
            <View style={styles.emptyRoomsIcon}>
              <Ionicons name="home-outline" size={36} color={colors.accent} />
            </View>
            <Text style={styles.emptyRoomsTitle}>No rooms yet</Text>
            <Text style={styles.emptyRoomsSubtitle}>
              Create a room to start managing tenants
            </Text>
          </View>
        ) : (
          (selectedRoomId
            ? rooms.filter((r) => (r.id || r._id) === selectedRoomId)
            : rooms.slice(0, 4)
          ).map((room, index) => (
            <TouchableOpacity
              key={room.id || room._id || `room-${index}`}
              style={styles.roomCard}
              activeOpacity={0.65}
              onPress={() =>
                navigation.navigate("BillingStack", {
                  screen: "AdminBilling",
                  params: { roomId: room.id || room._id, roomName: room.name },
                })
              }
            >
              <View style={styles.roomLeft}>
                <View style={styles.roomIconWrap}>
                  <Ionicons name="home" size={18} color={colors.textOnAccent} />
                </View>
                <View style={styles.roomInfo}>
                  <Text style={styles.roomName} numberOfLines={1}>
                    {room.name}
                  </Text>
                  <Text style={styles.roomMeta}>
                    {room.members?.length || 0} member
                    {(room.members?.length || 0) !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
              <View style={styles.roomRight}>
                <View style={styles.roomBadge}>
                  <Ionicons name="people" size={12} color={colors.accent} />
                  <Text style={styles.roomBadgeText}>
                    {room.members?.length || 0}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollViewWithDetection>
  );
};

const createStyles = (colors) => {
  const isDarkMode = colors.statusBarStyle === "light-content";
  const forestHeader = isDarkMode ? colors.background : "#063f39";
  const softSurface = isDarkMode
    ? "rgba(255,255,255,0.06)"
    : "rgba(3,109,65,0.055)";
  const softBorder = isDarkMode
    ? "rgba(158,208,205,0.16)"
    : "rgba(3,109,65,0.12)";
  const cardShadow = isDarkMode ? "#000000" : "#0a4240";

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      paddingBottom: 28,
    },

    // Header
    header: {
      backgroundColor: forestHeader,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 72,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
    },
    headerContent: {
      gap: 18,
    },
    headerTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerLeft: {
      flex: 1,
    },
    headerEyebrow: {
      fontSize: 11,
      color: "rgba(255,255,255,0.72)",
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    headerTitle: {
      fontSize: 31,
      fontWeight: "900",
      color: "#ffffff",
    },
    headerTitleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    headerSubtitle: {
      fontSize: 13,
      lineHeight: 19,
      color: "rgba(255,255,255,0.78)",
      marginTop: 8,
      fontWeight: "500",
    },
    headerTopPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
    },
    headerTopPillText: {
      fontSize: 11,
      fontWeight: "800",
      color: "#ffffff",
    },
    headerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
      justifyContent: "center",
      alignItems: "center",
    },
    headerStatusRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    headerStatusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.10)",
    },
    headerStatusChipText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#effaf7",
    },

    // Room Selector
    roomSelectorWrap: {
      paddingHorizontal: 16,
      marginTop: -48,
      zIndex: 10,
    },
    roomSelectorBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingHorizontal: 15,
      paddingVertical: 13,
      borderWidth: 1,
      borderColor: softBorder,
      shadowColor: cardShadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 5,
    },
    roomSelectorIconBg: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    roomSelectorText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    roomDropdown: {
      backgroundColor: colors.card,
      borderRadius: 18,
      marginTop: 8,
      borderWidth: 1,
      borderColor: softBorder,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: cardShadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.1,
          shadowRadius: 18,
        },
        android: { elevation: 8 },
      }),
    },
    roomDropdownItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    roomDropdownItemActive: {
      backgroundColor: softSurface,
    },
    roomDropdownText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
    },
    roomDropdownTextActive: {
      fontWeight: "700",
      color: colors.accent,
    },
    roomDropdownMeta: {
      fontSize: 11,
      color: colors.textTertiary,
    },

    // Section
    sectionWrap: {
      paddingHorizontal: 16,
      marginTop: 18,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.text,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },

    // Collection Card
    collectionCard: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: softBorder,
      ...Platform.select({
        ios: {
          shadowColor: cardShadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.1,
          shadowRadius: 18,
        },
        android: { elevation: 5 },
      }),
    },
    collectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    collectionTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: colors.text,
    },
    periodBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      marginTop: 6,
    },
    periodText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.accent,
    },
    rateCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: softSurface,
      borderWidth: 2,
      borderColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    rateValue: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.accent,
    },
    rateLabel: {
      fontSize: 9,
      fontWeight: "700",
      color: colors.textTertiary,
      marginTop: -1,
    },
    collectionRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    collectionMetric: {
      flex: 1,
    },
    collectedMetric: {
      paddingRight: 14,
    },
    pendingMetric: {
      paddingLeft: 14,
    },
    collectionDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.borderLight,
    },
    metricIconRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 6,
    },
    metricIconBg: {
      width: 28,
      height: 28,
      borderRadius: 10,
      backgroundColor: colors.successBg,
      justifyContent: "center",
      alignItems: "center",
    },
    metricLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    metricAmount: {
      fontSize: 19,
      fontWeight: "900",
    },
    progressWrap: {
      marginTop: 14,
    },
    progressTrack: {
      height: 6,
      backgroundColor: softSurface,
      borderRadius: 3,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.accent,
      borderRadius: 3,
    },

    // Stats Grid
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    statCard: {
      width: (SCREEN_WIDTH - 32 - 10) / 2,
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingVertical: 15,
      paddingHorizontal: 14,
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: softBorder,
      ...Platform.select({
        ios: {
          shadowColor: cardShadow,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.07,
          shadowRadius: 12,
        },
        android: { elevation: 3 },
      }),
    },
    statIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 13,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    statValue: {
      fontSize: 20,
      fontWeight: "900",
      color: colors.text,
      marginBottom: 3,
      textAlign: "left",
      width: "100%",
    },
    statLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textTertiary,
      textAlign: "left",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    // Quick Actions
    actionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 10,
    },
    actionCard: {
      width: (SCREEN_WIDTH - 32 - 20) / 3,
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 6,
      alignItems: "center",
      borderWidth: 1,
      borderColor: softBorder,
      ...Platform.select({
        ios: {
          shadowColor: cardShadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
        },
        android: { elevation: 2 },
      }),
    },
    actionIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 15,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    actionLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.textSecondary,
      textAlign: "center",
      width: "100%",
    },
    chatBadge: {
      position: "absolute",
      top: -6,
      right: -8,
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

    // Chart
    card: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: softBorder,
      ...Platform.select({
        ios: {
          shadowColor: cardShadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
        android: { elevation: 4 },
      }),
    },
    trendBadge: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    chartLegend: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 14,
      marginBottom: 8,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    legendDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 11,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    chartSummary: {
      flexDirection: "row",
      backgroundColor: softSurface,
      borderRadius: 16,
      padding: 12,
      marginTop: 12,
      borderWidth: 1,
      borderColor: softBorder,
    },
    chartSumItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    chartSumDivider: {
      width: 1,
      backgroundColor: colors.borderLight,
      marginHorizontal: 8,
    },
    chartSumIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      justifyContent: "center",
      alignItems: "center",
    },
    chartSumLabel: {
      fontSize: 10,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    chartSumValue: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
      marginTop: 1,
    },
    emptyChartContainer: {
      alignItems: "center",
      paddingVertical: 28,
    },
    emptyChartIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    emptyChartTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textSecondary,
      marginBottom: 4,
    },
    emptyChartSubtitle: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: "center",
    },

    // View All
    viewAllBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    viewAllText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "600",
    },

    // Rooms
    roomCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 15,
      marginBottom: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: softBorder,
      ...Platform.select({
        ios: {
          shadowColor: cardShadow,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
        },
        android: { elevation: 2 },
      }),
    },
    roomLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 12,
    },
    roomIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    roomInfo: {
      flex: 1,
    },
    roomName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 3,
    },
    roomMeta: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    roomRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    roomBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: softBorder,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    roomBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.accent,
    },
    emptyRooms: {
      alignItems: "center",
      paddingVertical: 28,
      backgroundColor: colors.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: softBorder,
    },
    emptyRoomsIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    emptyRoomsTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textSecondary,
      marginBottom: 4,
    },
    emptyRoomsSubtitle: {
      fontSize: 12,
      color: colors.textTertiary,
    },

    // Skeleton
    skelHeaderIcon: {
      width: 44,
      height: 44,
      borderRadius: 18,
    },
    skelHeaderPill: {
      width: 134,
      height: 34,
      borderRadius: 999,
    },
    skelHeaderEyebrow: {
      width: 96,
      height: 10,
      marginBottom: 12,
    },
    skelHeaderTitle: {
      width: 210,
      height: 34,
      marginBottom: 12,
      borderRadius: 12,
    },
    skelHeaderSubtitle: {
      width: "92%",
      height: 12,
      marginBottom: 8,
    },
    skelHeaderSubtitleShort: {
      width: "64%",
      height: 12,
    },
    skelStatusChip: {
      width: 92,
      height: 32,
    },
    skelStatusChipWide: {
      width: 118,
      height: 32,
    },
    skelSelectorIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
    },
    skelSelectorText: {
      flex: 1,
      height: 14,
    },
    skelSelectorChevron: {
      width: 18,
      height: 18,
    },
    skelCardTitle: {
      width: 156,
      height: 17,
      marginBottom: 10,
    },
    skelPeriodBadge: {
      width: 118,
      height: 24,
    },
    skelRateCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    skelMetricLabel: {
      width: 92,
      height: 28,
      marginBottom: 10,
      borderRadius: 10,
    },
    skelMetricAmount: {
      width: "82%",
      height: 20,
      borderRadius: 8,
    },
    skelProgress: {
      height: 6,
      marginTop: 16,
    },
    skelStatIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      marginBottom: 10,
    },
    skelStatValue: {
      width: "58%",
      height: 22,
      marginBottom: 8,
      borderRadius: 8,
    },
    skelStatLabel: {
      width: "72%",
      height: 11,
    },
    skelSectionTitle: {
      width: 132,
      height: 18,
      borderRadius: 8,
    },
    skelSectionSubtitle: {
      width: 118,
      height: 11,
      marginTop: 8,
    },
    skelActionIcon: {
      width: 42,
      height: 42,
      borderRadius: 15,
      marginBottom: 8,
    },
    skelActionLabel: {
      width: "68%",
      height: 11,
    },
    skelTrendBadge: {
      width: 38,
      height: 38,
      borderRadius: 14,
    },
    skelLegend: {
      width: 138,
      height: 12,
      alignSelf: "flex-end",
      marginBottom: 14,
    },
    skelChartArea: {
      height: 180,
      position: "relative",
      overflow: "hidden",
    },
    skelChartLine: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      borderRadius: 1,
    },
    skelChartSummary: {
      flex: 1,
      height: 38,
      borderRadius: 12,
      marginHorizontal: 4,
    },
    skelViewAll: {
      width: 68,
      height: 14,
    },
    skelRoomIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
    },
    skelRoomName: {
      width: "72%",
      height: 14,
      marginBottom: 8,
    },
    skelRoomMeta: {
      width: "48%",
      height: 12,
    },
    skelRoomBadge: {
      width: 54,
      height: 26,
    },
  });
};

export default AdminDashboardScreen;
