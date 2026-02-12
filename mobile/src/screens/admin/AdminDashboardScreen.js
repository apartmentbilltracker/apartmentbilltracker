import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
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
import { roomService, apiService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const AdminDashboardScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { state } = useContext(AuthContext);
  const isFocused = useIsFocused();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentStats, setPaymentStats] = useState({
    totalCollected: 0,
    totalPending: 0,
    collectionRate: 0,
  });
  const [billingByMonth, setBillingByMonth] = useState([]);
  const [latestBillingCycle, setLatestBillingCycle] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (isFocused) {
      setPaymentStats({
        totalCollected: 0,
        totalPending: 0,
        collectionRate: 0,
      });
      fetchAll();
    }
  }, [isFocused]);

  const fetchAll = () => {
    fetchRooms();
    fetchBillingTotals();
    fetchPaymentStats();
    fetchLatestBillingCycle();
  };

  const fetchPaymentStats = async () => {
    try {
      const timestamp = Date.now();
      const response = await apiService.get(
        `/api/v2/admin/billing/payment-stats?t=${timestamp}`,
      );
      if (response?.success && response.data) {
        setPaymentStats(response.data);
      } else if (response?.data) {
        setPaymentStats(response.data);
      } else {
        setPaymentStats({
          totalCollected: 0,
          totalPending: 0,
          collectionRate: 0,
        });
      }
    } catch (error) {
      console.log("Error fetching payment stats:", error);
      setPaymentStats({
        totalCollected: 0,
        totalPending: 0,
        collectionRate: 0,
      });
    }
  };

  const fetchLatestBillingCycle = async () => {
    try {
      const response = await apiService.get(
        "/api/v2/billing-cycles/totals/latest",
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
    } catch (error) {
      console.log("Error fetching latest billing cycle:", error);
      setLatestBillingCycle(null);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await roomService.getRooms();
      setRooms(response.rooms || response.data?.rooms || []);
    } catch (error) {
      console.log("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBillingTotals = async (months = 6) => {
    try {
      const res = await apiService.get(
        `/api/v2/billing-cycles/totals/month?months=${months}`,
      );
      if (res?.success) setBillingByMonth(res.data || []);
    } catch (error) {
      console.error("Error fetching billing totals:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchRooms(),
      fetchBillingTotals(),
      fetchPaymentStats(),
      fetchLatestBillingCycle(),
    ]);
    setRefreshing(false);
  };

  const totalMembers = rooms.reduce(
    (sum, room) => sum + (room.members?.length || 0),
    0,
  );
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
            <Stop offset="0" stopcolor={colors.accent} stopOpacity="0.12" />
            <Stop offset="1" stopcolor={colors.accent} stopOpacity="0.01" />
          </LinearGradient>
          <LinearGradient id="collectedArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.success} stopOpacity="0.10" />
            <Stop offset="1" stopColor={colors.success} stopOpacity="0.01" />
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
                stroke="#eee"
                strokeWidth={1}
              />
              <SvgText
                x={pL - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={9}
                fill="#aaa"
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
            stroke="#b38604"
            strokeWidth={2}
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
            fill="#fff"
            stroke="#b38604"
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
            fill="#888"
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
      onPress: () => navigation.navigate("MembersStack", { screen: "Members" }),
    },
    {
      icon: "card-outline",
      label: "Payments",
      color: colors.internetColor,
      bg: colors.purpleBg,
      onPress: () =>
        navigation.navigate("BillingStack", { screen: "AdminBilling" }),
    },
    {
      icon: "settings-outline",
      label: "Pay Settings",
      color: "#e65100",
      bg: "#fff3e0",
      onPress: () =>
        navigation.navigate("BillingStack", { screen: "PaymentSettings" }),
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintcolor={colors.accent}
          colors={["#b38604"]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {state.user?.name || "Admin"}
            </Text>
          </View>
          <View style={styles.headerIconWrap}>
            <Ionicons name="grid" size={22} color={colors.accent} />
          </View>
        </View>
      </View>

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
              <Text style={styles.rateValue}>
                {(latestBillingCycle?.collectionRate || 0).toFixed(0)}%
              </Text>
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
              <Text style={[styles.metricAmount, { color: colors.success }]}>
                {fmt(latestBillingCycle?.totalCollected || 0)}
              </Text>
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
              <Text style={[styles.metricAmount, { color: "#c62828" }]}>
                {fmt(latestBillingCycle?.totalPending || 0)}
              </Text>
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

          {/* All Payors Paid Notice */}
          {latestBillingCycle &&
            (latestBillingCycle.collectionRate >= 100 ||
              latestBillingCycle.cycleStatus === "completed") && (
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
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{rooms.length}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Rooms</Text>
          </View>
          <View style={styles.statCard}>
            <View
              style={[styles.statIconWrap, { backgroundColor: colors.infoBg }]}
            >
              <Ionicons name="people" size={20} color={colors.info} />
            </View>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{totalMembers}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Members</Text>
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
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{fmtShort(totalBilledLastN)}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Billed</Text>
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
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{overallCollectionRate}%</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Collected</Text>
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
              </View>
              <Text style={styles.actionLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{action.label}</Text>
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
                  <Text style={styles.chartSumValue}>
                    {fmt(totalBilledLastN)}
                  </Text>
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
                  <Text style={styles.chartSumValue}>
                    {fmt(totalCollectedLastN)}
                  </Text>
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

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.accent}
            style={{ marginTop: 24 }}
          />
        ) : rooms.length === 0 ? (
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
          rooms.slice(0, 4).map((room, index) => (
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
    </ScrollView>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      paddingBottom: 16,
    },

    // Header
    header: {
      backgroundColor: colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e8e8e8",
    },
    headerContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 18,
    },
    headerLeft: {
      flex: 1,
    },
    greeting: {
      fontSize: 13,
      color: colors.textTertiary,
      fontWeight: "500",
      letterSpacing: 0.3,
    },
    userName: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      marginTop: 2,
    },
    headerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
    },

    // Section
    sectionWrap: {
      paddingHorizontal: 16,
      marginTop: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
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
      borderRadius: 16,
      padding: 18,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        android: { elevation: 3 },
      }),
    },
    collectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    collectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    periodBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.accentSurface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
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
      backgroundColor: colors.accentSurface,
      borderWidth: 2.5,
      borderColor: "#b38604",
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
      fontWeight: "500",
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
      backgroundColor: colors.skeleton,
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
      borderRadius: 8,
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
      fontSize: 18,
      fontWeight: "700",
    },
    progressWrap: {
      marginTop: 14,
    },
    progressTrack: {
      height: 6,
      backgroundColor: colors.inputBg,
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
      width: (SCREEN_WIDTH - 32 - 30) / 4,
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 6,
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        },
        android: { elevation: 2 },
      }),
    },
    statIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    statValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
      textAlign: "center",
      width: "100%",
    },
    statLabel: {
      fontSize: 10,
      fontWeight: "500",
      color: colors.textTertiary,
      textAlign: "center",
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
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 6,
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        },
        android: { elevation: 2 },
      }),
    },
    actionIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    actionLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
      textAlign: "center",
      width: "100%",
    },

    // Chart
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        android: { elevation: 3 },
      }),
    },
    trendBadge: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.accentSurface,
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
      backgroundColor: colors.cardAlt,
      borderRadius: 12,
      padding: 12,
      marginTop: 12,
    },
    chartSumItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    chartSumDivider: {
      width: 1,
      backgroundColor: colors.skeleton,
      marginHorizontal: 8,
    },
    chartSumIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
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
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
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
      borderRadius: 12,
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
      backgroundColor: colors.accentSurface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
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
      borderRadius: 16,
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
  });

export default AdminDashboardScreen;
