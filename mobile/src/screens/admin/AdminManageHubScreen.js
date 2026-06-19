import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../context/AuthContext";
import { hostRoleService, roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
import HomeSpaceLoader from "../../components/SpaceLoader";

const AdminManageHubScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { state } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalHosts: 0,
    totalClients: 0,
    totalRooms: 0,
    totalMembers: 0,
    pendingRequests: 0,
  });

  const fetchStats = async () => {
    try {
      const [usersRes, roomsRes, pendingRes] = await Promise.all([
        hostRoleService.getAllUsers().catch(() => ({ users: [] })),
        roomService.getAdminAllRooms().catch(() => ({ rooms: [] })),
        hostRoleService
          .getPendingHostRequests()
          .catch(() => ({ requests: [] })),
      ]);

      const users = usersRes?.users || [];
      const rooms = roomsRes?.rooms || [];
      const pending = pendingRes?.requests || [];

      setStats({
        totalUsers: users.length,
        totalHosts: users.filter((u) => u.role === "host").length,
        totalClients: users.filter((u) => u.role === "client" && !u.is_admin)
          .length,
        totalRooms: rooms.length,
        totalMembers: rooms.reduce((acc, r) => acc + (r.memberCount || 0), 0),
        pendingRequests: pending.length,
      });
    } catch (error) {
      console.error("Error fetching manage stats:", error);
    }
  };

  const hasLoaded = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", async () => {
      if (!hasLoaded.current) {
        setLoading(true);
        await fetchStats();
        setLoading(false);
        hasLoaded.current = true;
      } else {
        fetchStats();
      }
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, []);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.centerLoader}>
          <HomeSpaceLoader />
        </View>
      </View>
    );
  }

  return (
    <ScrollViewWithDetection
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrowText}>ADMIN TOOLS</Text>
        <Text style={styles.headerTitle}>Management</Text>
        <Text style={styles.headerSubtitle}>
          Control users, rooms, and system settings
        </Text>

        <View style={styles.headerPillsRow}>
          <View style={styles.headerPill}>
            <Ionicons name="people" size={13} color={colors.headerText} />
            <Text style={styles.headerPillText}>{stats.totalUsers} users</Text>
          </View>
          <View style={styles.headerPill}>
            <Ionicons name="hourglass" size={13} color={colors.headerText} />
            <Text style={styles.headerPillText}>
              {stats.pendingRequests} pending
            </Text>
          </View>
        </View>
      </View>

      {/* Overview / overlap card */}
      <TouchableOpacity
        style={styles.overviewCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("AllRooms")}
      >
        <View style={styles.overviewTopRow}>
          <View>
            <Text style={styles.overviewLabel}>TOTAL ROOMS</Text>
            <Text style={styles.overviewValue}>{stats.totalRooms}</Text>
            <Text style={styles.overviewSub}>Active across the platform</Text>
          </View>
          <View style={styles.overviewIconWrap}>
            <Ionicons name="home" size={24} color={colors.accent} />
          </View>
        </View>

        <View style={styles.overviewPillsRow}>
          <View style={styles.overviewPill}>
            <Ionicons name="people" size={13} color={colors.accent} />
            <Text style={styles.overviewPillText}>
              {stats.totalMembers} members
            </Text>
          </View>
          <View style={styles.overviewPill}>
            <Ionicons name="key" size={13} color={colors.accent} />
            <Text style={styles.overviewPillText}>
              {stats.totalHosts} hosts
            </Text>
          </View>
        </View>

        <View style={styles.overviewDivider} />

        <View style={styles.overviewFooterRow}>
          <Text style={styles.overviewFooterText}>View room overview</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </View>
      </TouchableOpacity>

      {/* Overview Stats */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.infoBg }]}>
          <View style={[styles.statIconWrap, { backgroundColor: colors.info }]}>
            <Ionicons name="people" size={16} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: colors.info }]}>
            {stats.totalUsers}
          </Text>
          <Text style={styles.statLabel}>Users</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.successBg }]}>
          <View
            style={[styles.statIconWrap, { backgroundColor: colors.success }]}
          >
            <Ionicons name="home" size={16} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {stats.totalRooms}
          </Text>
          <Text style={styles.statLabel}>Rooms</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.warningBg }]}>
          <View
            style={[styles.statIconWrap, { backgroundColor: colors.warning }]}
          >
            <Ionicons name="key" size={16} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: colors.warning }]}>
            {stats.totalHosts}
          </Text>
          <Text style={styles.statLabel}>Hosts</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.errorBg }]}>
          <View
            style={[styles.statIconWrap, { backgroundColor: colors.error }]}
          >
            <Ionicons name="hourglass" size={16} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: colors.error }]}>
            {stats.pendingRequests}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Management Actions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons
              name="construct-outline"
              size={16}
              color={colors.accent}
            />
          </View>
          <Text style={styles.sectionTitle}>Management Tools</Text>
        </View>

        {/* User Management */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate("UserManagement")}
          activeOpacity={0.7}
        >
          <View
            style={[styles.actionIconWrap, { backgroundColor: colors.infoBg }]}
          >
            <Ionicons name="people-outline" size={22} color={colors.info} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>User Management</Text>
            <Text style={styles.actionDesc}>
              View all users, change roles, activate/deactivate accounts
            </Text>
            <View style={styles.actionStatsRow}>
              <View style={styles.actionStatChip}>
                <Text style={styles.actionStatText}>
                  {stats.totalClients} clients
                </Text>
              </View>
              <View style={styles.actionStatChip}>
                <Text style={styles.actionStatText}>
                  {stats.totalHosts} hosts
                </Text>
              </View>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        {/* Room Overview */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate("AllRooms")}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.actionIconWrap,
              { backgroundColor: colors.successBg },
            ]}
          >
            <Ionicons name="home-outline" size={22} color={colors.success} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Room Overview</Text>
            <Text style={styles.actionDesc}>
              Browse all rooms, view members, check occupancy
            </Text>
            <View style={styles.actionStatsRow}>
              <View style={styles.actionStatChip}>
                <Text style={styles.actionStatText}>
                  {stats.totalRooms} rooms
                </Text>
              </View>
              <View style={styles.actionStatChip}>
                <Text style={styles.actionStatText}>
                  {stats.totalMembers} members
                </Text>
              </View>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        {/* Room Management */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate("RoomManagement")}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.actionIconWrap,
              { backgroundColor: colors.actionRoomInfoBg },
            ]}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={colors.actionRoomInfoIcon}
            />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Room Management</Text>
            <Text style={styles.actionDesc}>
              Create rooms, edit details, manage amenities and house rules
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        {/* Billing */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate("AdminBilling")}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.actionIconWrap,
              { backgroundColor: colors.warningBg },
            ]}
          >
            <Ionicons name="receipt-outline" size={22} color={colors.warning} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Billing</Text>
            <Text style={styles.actionDesc}>
              Manage billing cycles, verify payments, view financial reports
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        {/* Members */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate("Members")}
          activeOpacity={0.7}
        >
          <View
            style={[styles.actionIconWrap, { backgroundColor: colors.errorBg }]}
          >
            <Ionicons name="person-outline" size={22} color={colors.error} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Members</Text>
            <Text style={styles.actionDesc}>
              Review membership requests, manage room members
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Quick Info Cards */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons
              name="analytics-outline"
              size={16}
              color={colors.accent}
            />
          </View>
          <Text style={styles.sectionTitle}>Quick Insights</Text>
        </View>

        <View style={styles.insightCard}>
          <View style={styles.insightRow}>
            <View style={styles.insightItem}>
              <Text style={styles.insightLabel}>Users per Room</Text>
              <Text style={styles.insightValue}>
                {stats.totalRooms > 0
                  ? (stats.totalMembers / stats.totalRooms).toFixed(1)
                  : "0"}
              </Text>
            </View>
            <View style={styles.insightDivider} />
            <View style={styles.insightItem}>
              <Text style={styles.insightLabel}>Host Ratio</Text>
              <Text style={styles.insightValue}>
                {stats.totalUsers > 0
                  ? `${((stats.totalHosts / stats.totalUsers) * 100).toFixed(0)}%`
                  : "0%"}
              </Text>
            </View>
            <View style={styles.insightDivider} />
            <View style={styles.insightItem}>
              <Text style={styles.insightLabel}>Rooms per Host</Text>
              <Text style={styles.insightValue}>
                {stats.totalHosts > 0
                  ? (stats.totalRooms / stats.totalHosts).toFixed(1)
                  : "0"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollViewWithDetection>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContainer: {
      justifyContent: "center",
      alignItems: "center",
    },
    contentContainer: {
      paddingBottom: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textTertiary,
    },

    // ── Header ──
    header: {
      backgroundColor: colors.headerBg,
      paddingTop: 24,
      paddingHorizontal: 20,
      paddingBottom: 56,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
    },
    eyebrowText: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.2,
      color: "rgba(255,255,255,0.65)",
      marginBottom: 8,
    },
    headerTitle: {
      fontSize: 30,
      fontWeight: "800",
      color: colors.headerText,
      marginBottom: 6,
    },
    headerSubtitle: {
      fontSize: 14,
      color: "rgba(255,255,255,0.75)",
      fontWeight: "500",
      lineHeight: 19,
      marginBottom: 16,
    },
    headerPillsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    headerPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
    },
    headerPillText: {
      color: colors.headerText,
      fontSize: 12,
      fontWeight: "600",
    },

    // ── Overview overlap card ──
    overviewCard: {
      marginHorizontal: 16,
      marginTop: -40,
      backgroundColor: colors.accentSurface,
      borderRadius: 24,
      padding: 20,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 14,
        },
        android: { elevation: 4 },
      }),
    },
    overviewTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    overviewLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    overviewValue: {
      fontSize: 36,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 4,
    },
    overviewSub: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    overviewIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
    },
    overviewPillsRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 16,
      flexWrap: "wrap",
    },
    overviewPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.accentLight,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      gap: 6,
    },
    overviewPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.text,
    },
    overviewDivider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: 16,
      opacity: 0.4,
    },
    overviewFooterRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
    },
    overviewFooterText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
    },

    // ── Stats Grid ──
    statsGrid: {
      flexDirection: "row",
      paddingHorizontal: 16,
      gap: 8,
      marginTop: 20,
      marginBottom: 4,
    },
    statCard: {
      flex: 1,
      borderRadius: 16,
      padding: 10,
      alignItems: "center",
    },
    statIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    statValue: {
      fontSize: 18,
      fontWeight: "800",
    },
    statLabel: {
      fontSize: 9,
      fontWeight: "600",
      color: colors.textTertiary,
      marginTop: 2,
    },

    // ── Sections ──
    section: {
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 18,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
        },
        android: { elevation: 1 },
      }),
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      gap: 10,
    },
    sectionIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: colors.accentLight,
      justifyContent: "center",
      alignItems: "center",
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    actionCard: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight || colors.border,
    },
    actionIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
    },
    actionContent: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 3,
    },
    actionDesc: {
      fontSize: 12,
      color: colors.textTertiary,
      lineHeight: 17,
      marginBottom: 8,
    },
    actionStatsRow: {
      flexDirection: "row",
      gap: 6,
    },
    actionStatChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: colors.cardAlt || "rgba(0,0,0,0.04)",
    },
    actionStatText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    insightCard: {
      backgroundColor: colors.cardAlt || colors.background,
      borderRadius: 16,
      padding: 16,
    },
    insightRow: {
      flexDirection: "row",
    },
    insightItem: {
      flex: 1,
      alignItems: "center",
    },
    insightDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    insightLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
      marginBottom: 4,
    },
    insightValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
  });

export default AdminManageHubScreen;
