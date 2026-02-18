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
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
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
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>Management</Text>
        <Text style={styles.headerSubtitle}>
          Control users, rooms, and system settings
        </Text>
      </View>

      {/* Overview Stats */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: "#EBF5FB" }]}>
          <View style={[styles.statIconWrap, { backgroundColor: "#2980B9" }]}>
            <Ionicons name="people" size={16} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: "#2980B9" }]}>
            {stats.totalUsers}
          </Text>
          <Text style={styles.statLabel}>Users</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#EAFAF1" }]}>
          <View style={[styles.statIconWrap, { backgroundColor: "#27AE60" }]}>
            <Ionicons name="home" size={16} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: "#27AE60" }]}>
            {stats.totalRooms}
          </Text>
          <Text style={styles.statLabel}>Rooms</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#FEF9E7" }]}>
          <View style={[styles.statIconWrap, { backgroundColor: "#b38604" }]}>
            <Ionicons name="key" size={16} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: "#b38604" }]}>
            {stats.totalHosts}
          </Text>
          <Text style={styles.statLabel}>Hosts</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#FDEDEC" }]}>
          <View style={[styles.statIconWrap, { backgroundColor: "#E74C3C" }]}>
            <Ionicons name="hourglass" size={16} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: "#E74C3C" }]}>
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
            style={[
              styles.actionIconWrap,
              { backgroundColor: "rgba(52,152,219,0.12)" },
            ]}
          >
            <Ionicons name="people-outline" size={22} color="#2980B9" />
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
              { backgroundColor: "rgba(39,174,96,0.12)" },
            ]}
          >
            <Ionicons name="home-outline" size={22} color="#27AE60" />
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
              { backgroundColor: "rgba(142,68,173,0.12)" },
            ]}
          >
            <Ionicons name="settings-outline" size={22} color="#8E44AD" />
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
              { backgroundColor: "rgba(230,126,34,0.12)" },
            ]}
          >
            <Ionicons name="receipt-outline" size={22} color="#E67E22" />
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
            style={[
              styles.actionIconWrap,
              { backgroundColor: "rgba(231,76,60,0.12)" },
            ]}
          >
            <Ionicons name="person-outline" size={22} color="#E74C3C" />
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
    headerSection: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    statsGrid: {
      flexDirection: "row",
      paddingHorizontal: 12,
      gap: 8,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      borderRadius: 12,
      padding: 10,
      alignItems: "center",
    },
    statIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
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
    section: {
      marginHorizontal: 12,
      marginTop: 4,
      marginBottom: 8,
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
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
      gap: 8,
    },
    sectionIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(179,134,4,0.12)",
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
      borderRadius: 12,
      padding: 14,
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
