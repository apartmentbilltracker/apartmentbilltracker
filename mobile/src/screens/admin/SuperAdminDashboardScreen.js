import React, { useContext, useEffect, useState, useCallback } from "react";
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
  Platform,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { hostRoleService, supportService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const SuperAdminDashboardScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { state } = useContext(AuthContext);
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalHosts: 0,
    totalClients: 0,
    totalAdmins: 0,
  });
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [supportStats, setSupportStats] = useState({
    openTickets: 0,
    openBugs: 0,
  });
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (isFocused) fetchAll();
  }, [isFocused]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchUsers(),
        fetchPendingRequests(),
        fetchSupportStats(),
      ]);
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await hostRoleService.getAllUsers();
      const users = response?.users || [];
      setAllUsers(users);
      setStats({
        totalUsers: users.length,
        totalHosts: users.filter((u) => u.role === "host").length,
        totalClients: users.filter((u) => u.role === "client").length,
        totalAdmins: users.filter(
          (u) => u.role === "admin" || u.is_admin === true,
        ).length,
      });
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await hostRoleService.getPendingHostRequests();
      setPendingRequests(response?.requests || []);
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    }
  };

  const fetchSupportStats = async () => {
    try {
      const ticketsResponse = await supportService.getAllTickets();
      const tickets = Array.isArray(ticketsResponse)
        ? ticketsResponse
        : ticketsResponse?.data || [];
      const openTickets = tickets.filter(
        (t) => t.status === "open" || t.status === "in-progress",
      ).length;

      const bugsResponse = await supportService.getAllBugReports();
      const bugs = Array.isArray(bugsResponse)
        ? bugsResponse
        : bugsResponse?.data || [];
      const openBugs = bugs.filter(
        (b) => b.status === "open" || b.status === "in-progress",
      ).length;

      setSupportStats({ openTickets, openBugs });
    } catch (error) {
      console.error("Error fetching support stats:", error);
    }
  };

  const handleApproveHost = async (userId, userName) => {
    Alert.alert("Approve Host Request", `Approve ${userName} as a room host?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          try {
            setProcessingId(userId);
            await hostRoleService.approveHost(userId);
            Alert.alert("Success", `${userName} is now a host!`);
            fetchPendingRequests();
            fetchUsers();
          } catch (error) {
            Alert.alert("Error", "Failed to approve host request");
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
  };

  const handleRejectHost = async (userId, userName) => {
    Alert.alert("Reject Host Request", `Reject ${userName}'s host request?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            setProcessingId(userId);
            await hostRoleService.rejectHost(userId);
            Alert.alert("Done", `${userName}'s request has been rejected.`);
            fetchPendingRequests();
            fetchUsers();
          } catch (error) {
            Alert.alert("Error", "Failed to reject host request");
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
  };

  const handleDemoteHost = async (userId, userName) => {
    Alert.alert(
      "Demote Host",
      `Remove host privileges from ${userName}? They will become a regular client.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Demote",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessingId(userId);
              await hostRoleService.demoteHost(userId);
              Alert.alert("Done", `${userName} is now a regular client.`);
              fetchUsers();
            } catch (error) {
              Alert.alert("Error", "Failed to demote host");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, []);

  const hosts = allUsers.filter((u) => u.role === "host");

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
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
        <Text style={styles.greeting}>
          Hello, {state.user?.name || "Admin"} 👋
        </Text>
        <Text style={styles.headerSub}>System Overview</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.infoBg }]}>
          <View style={[styles.statIconWrap, { backgroundColor: colors.info }]}>
            <Ionicons name="people" size={18} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: colors.info }]}>
            {stats.totalUsers}
          </Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.warningBg }]}>
          <View
            style={[styles.statIconWrap, { backgroundColor: colors.warning }]}
          >
            <Ionicons name="key" size={18} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: colors.warning }]}>
            {stats.totalHosts}
          </Text>
          <Text style={styles.statLabel}>Hosts</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.successBg }]}>
          <View
            style={[styles.statIconWrap, { backgroundColor: colors.success }]}
          >
            <Ionicons name="person" size={18} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {stats.totalClients}
          </Text>
          <Text style={styles.statLabel}>Clients</Text>
        </View>
      </View>

      {/* Pending Host Requests */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons
              name="hourglass-outline"
              size={16}
              color={colors.accent}
            />
          </View>
          <Text style={styles.sectionTitle}>Pending Host Requests</Text>
          {pendingRequests.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingRequests.length}</Text>
            </View>
          )}
        </View>

        {pendingRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="checkmark-circle-outline"
              size={32}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyText}>No pending requests</Text>
          </View>
        ) : (
          pendingRequests.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.requestInfo}>
                {req.avatar?.url ? (
                  <Image
                    source={{ uri: req.avatar.url }}
                    style={styles.requestAvatar}
                  />
                ) : (
                  <View style={styles.requestAvatarPlaceholder}>
                    <Text style={styles.requestAvatarText}>
                      {(req.name || "U").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.requestDetails}>
                  <Text style={styles.requestName}>
                    {req.name || "Unknown"}
                  </Text>
                  <Text style={styles.requestEmail}>{req.email || "N/A"}</Text>
                  <Text style={styles.requestDate}>
                    Requested:{" "}
                    {req.host_requested_at
                      ? new Date(req.host_requested_at).toLocaleDateString()
                      : "N/A"}
                  </Text>
                </View>
              </View>
              <View style={styles.requestActions}>
                {processingId === req.id ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApproveHost(req.id, req.name)}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleRejectHost(req.id, req.name)}
                    >
                      <Ionicons name="close" size={18} color="#e74c3c" />
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Active Hosts */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="key-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.sectionTitle}>Active Hosts</Text>
          <Text style={styles.sectionCount}>{hosts.length}</Text>
        </View>

        {hosts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="people-outline"
              size={32}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyText}>No active hosts</Text>
          </View>
        ) : (
          hosts.map((host) => (
            <View key={host.id} style={styles.hostCard}>
              <View style={styles.hostInfo}>
                {host.avatar?.url ? (
                  <Image
                    source={{ uri: host.avatar.url }}
                    style={styles.requestAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.requestAvatarPlaceholder,
                      { backgroundColor: "#b38604" },
                    ]}
                  >
                    <Text style={styles.requestAvatarText}>
                      {(host.name || "H").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.requestDetails}>
                  <Text style={styles.requestName}>
                    {host.name || "Unknown"}
                  </Text>
                  <Text style={styles.requestEmail}>{host.email || "N/A"}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.demoteBtn}
                onPress={() => handleDemoteHost(host.id, host.name)}
                disabled={processingId === host.id}
              >
                {processingId === host.id ? (
                  <ActivityIndicator size="small" color="#e74c3c" />
                ) : (
                  <>
                    <Ionicons
                      name="arrow-down-outline"
                      size={14}
                      color="#e74c3c"
                    />
                    <Text style={styles.demoteBtnText}>Demote</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="flash-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() =>
              navigation
                .getParent()
                ?.navigate("SupportStack", { screen: "SupportTickets" })
            }
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: "rgba(52,152,219,0.12)" },
              ]}
            >
              <Ionicons name="chatbubbles-outline" size={20} color="#3498DB" />
            </View>
            <Text style={styles.quickActionLabel}>Support</Text>
            {supportStats.openTickets > 0 && (
              <View style={styles.quickActionBadge}>
                <Text style={styles.quickActionBadgeText}>
                  {supportStats.openTickets}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() =>
              navigation
                .getParent()
                ?.navigate("SupportStack", { screen: "BugReports" })
            }
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: "rgba(231,76,60,0.12)" },
              ]}
            >
              <Ionicons name="bug-outline" size={20} color="#E74C3C" />
            </View>
            <Text style={styles.quickActionLabel}>Bug Reports</Text>
            {supportStats.openBugs > 0 && (
              <View style={styles.quickActionBadge}>
                <Text style={styles.quickActionBadgeText}>
                  {supportStats.openBugs}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() =>
              navigation
                .getParent()
                ?.navigate("ProfileStack", { screen: "Broadcast" })
            }
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: "rgba(179,134,4,0.12)" },
              ]}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#b38604"
              />
            </View>
            <Text style={styles.quickActionLabel}>Broadcast</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() =>
              navigation
                .getParent()
                ?.navigate("ProfileStack", { screen: "VersionControl" })
            }
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: "rgba(142,68,173,0.12)" },
              ]}
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#8E44AD" />
            </View>
            <Text style={styles.quickActionLabel}>Version</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() =>
              navigation
                .getParent()
                ?.navigate("ManageStack", { screen: "UserManagement" })
            }
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: "rgba(52,152,219,0.12)" },
              ]}
            >
              <Ionicons name="people-outline" size={20} color="#2980B9" />
            </View>
            <Text style={styles.quickActionLabel}>Users</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() =>
              navigation
                .getParent()
                ?.navigate("ManageStack", { screen: "AllRooms" })
            }
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: "rgba(39,174,96,0.12)" },
              ]}
            >
              <Ionicons name="home-outline" size={20} color="#27AE60" />
            </View>
            <Text style={styles.quickActionLabel}>All Rooms</Text>
          </TouchableOpacity>
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
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textTertiary,
    },
    headerSection: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    greeting: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 4,
    },
    headerSub: {
      fontSize: 14,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    statsRow: {
      flexDirection: "row",
      paddingHorizontal: 12,
      gap: 8,
      marginVertical: 12,
    },
    statCard: {
      flex: 1,
      borderRadius: 14,
      padding: 14,
      alignItems: "center",
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
    statIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    statValue: {
      fontSize: 22,
      fontWeight: "800",
    },
    statLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
      marginTop: 2,
    },
    section: {
      marginHorizontal: 12,
      marginTop: 12,
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
    sectionCount: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    badge: {
      backgroundColor: "#e74c3c",
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 6,
    },
    badgeText: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "700",
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 24,
      gap: 8,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    requestCard: {
      backgroundColor: colors.cardAlt || colors.background,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
    },
    requestInfo: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    requestAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    requestAvatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    requestAvatarText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
    },
    requestDetails: {
      flex: 1,
    },
    requestName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    requestEmail: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 1,
    },
    requestDate: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 3,
    },
    requestActions: {
      flexDirection: "row",
      gap: 8,
    },
    approveBtn: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: "#27AE60",
      borderRadius: 10,
      paddingVertical: 10,
      justifyContent: "center",
      alignItems: "center",
      gap: 4,
    },
    approveBtnText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
    },
    rejectBtn: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: "rgba(231,76,60,0.1)",
      borderRadius: 10,
      paddingVertical: 10,
      justifyContent: "center",
      alignItems: "center",
      gap: 4,
    },
    rejectBtnText: {
      color: "#e74c3c",
      fontSize: 13,
      fontWeight: "700",
    },
    hostCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.cardAlt || colors.background,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    hostInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    demoteBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(231,76,60,0.1)",
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 4,
    },
    demoteBtnText: {
      color: "#e74c3c",
      fontSize: 12,
      fontWeight: "600",
    },
    quickActionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    quickAction: {
      width: "47%",
      backgroundColor: colors.cardAlt || colors.background,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 14,
      alignItems: "center",
      position: "relative",
    },
    quickActionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    quickActionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.text,
    },
    quickActionBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "#e74c3c",
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    quickActionBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "700",
    },
  });

export default SuperAdminDashboardScreen;
