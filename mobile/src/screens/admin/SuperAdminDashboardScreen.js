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
  Modal,
  TextInput,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { hostRoleService, supportService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
import HomeSpaceLoader from "../../components/SpaceLoader";
import HostApplicationReviewModal from "../../components/HostApplicationReviewModal";

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
  const [selectedHostRequest, setSelectedHostRequest] = useState(null);
  const [rejectDraft, setRejectDraft] = useState({
    visible: false,
    userId: null,
    userName: "",
    reason: "",
  });

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
            setSelectedHostRequest(null);
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

  const handleRejectHost = (userId, userName) => {
    setSelectedHostRequest(null);
    setRejectDraft({
      visible: true,
      userId,
      userName: userName || "this applicant",
      reason: "",
    });
  };

  const submitRejectHost = async () => {
    const reason = rejectDraft.reason.trim();
    if (reason.length < 10) {
      Alert.alert(
        "Reason required",
        "Please add a clear rejection reason with at least 10 characters.",
      );
      return;
    }

    try {
      setProcessingId(rejectDraft.userId);
      await hostRoleService.rejectHost(rejectDraft.userId, reason);
      Alert.alert("Done", `${rejectDraft.userName}'s request has been rejected.`);
      setSelectedHostRequest(null);
      setRejectDraft({
        visible: false,
        userId: null,
        userName: "",
        reason: "",
      });
      fetchPendingRequests();
      fetchUsers();
    } catch (error) {
      Alert.alert(
        "Error",
        error.data?.message || error.message || "Failed to reject host request",
      );
    } finally {
      setProcessingId(null);
    }
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
  const greetingTime = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  })();

  const getRelativeTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.centerLoader}>
          <HomeSpaceLoader />
        </View>
      </View>
    );
  }

  return (
    <>
    <ScrollViewWithDetection
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
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
        <View style={styles.headerTopRow}>
          <View style={styles.avatarCircle}>
            {state.user?.avatar?.url ? (
              <Image
                source={{ uri: state.user.avatar.url }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons
                name="shield-checkmark"
                size={22}
                color={colors.headerText}
              />
            )}
          </View>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() =>
              navigation
                .getParent()
                ?.navigate("SupportStack", { screen: "SupportTickets" })
            }
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={colors.headerText}
            />
            {supportStats.openTickets > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {supportStats.openTickets}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.eyebrowRow}>
          <Text style={styles.eyebrowText}>YOUR CONTROL CENTER</Text>
          <View style={styles.rolePill}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={colors.headerText}
            />
            <Text style={styles.rolePillText}>Super Admin</Text>
          </View>
        </View>

        <Text style={styles.headerTitle}>Dashboard</Text>

        <View style={styles.greetingCard}>
          <Text style={styles.greeting}>
            {greetingTime}, {state.user?.name || "Admin"} 👋
          </Text>
          <Text style={styles.greetingSub}>
            Here's what's happening across the platform.
          </Text>
          <View style={styles.headerPillsRow}>
            <View style={styles.headerPill}>
              <Ionicons name="people" size={13} color={colors.headerText} />
              <Text style={styles.headerPillText}>
                {stats.totalUsers} users
              </Text>
            </View>
            <View style={styles.headerPill}>
              <Ionicons name="hourglass" size={13} color={colors.headerText} />
              <Text style={styles.headerPillText}>
                {pendingRequests.length} pending
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Overview / overlap card */}
      <TouchableOpacity
        style={styles.overviewCard}
        activeOpacity={0.85}
        onPress={() =>
          navigation
            .getParent()
            ?.navigate("ManageStack", { screen: "UserManagement" })
        }
      >
        <View style={styles.overviewTopRow}>
          <View>
            <Text style={styles.overviewLabel}>TOTAL PLATFORM USERS</Text>
            <Text style={styles.overviewValue}>{stats.totalUsers}</Text>
            <Text style={styles.overviewSub}>Registered across all roles</Text>
          </View>
          <View style={styles.overviewIconWrap}>
            <Ionicons name="people" size={24} color={colors.accent} />
          </View>
        </View>

        <View style={styles.overviewPillsRow}>
          <View style={styles.overviewPill}>
            <Ionicons name="key" size={13} color={colors.accent} />
            <Text style={styles.overviewPillText}>
              {stats.totalHosts} active hosts
            </Text>
          </View>
          <View style={styles.overviewPill}>
            <Ionicons name="bug" size={13} color={colors.accent} />
            <Text style={styles.overviewPillText}>
              {supportStats.openBugs} open bugs
            </Text>
          </View>
        </View>

        <View style={styles.overviewDivider} />

        <View style={styles.overviewFooterRow}>
          <Text style={styles.overviewFooterText}>View user management</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </View>
      </TouchableOpacity>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View
            style={[styles.statIconWrap, { backgroundColor: colors.infoBg }]}
          >
            <Ionicons name="people" size={18} color={colors.info} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats.totalUsers}
          </Text>
          <Text style={styles.statLabel}>Total Users</Text>
          <Text style={styles.statSub}>All roles</Text>
        </View>
        <View style={styles.statCard}>
          <View
            style={[styles.statIconWrap, { backgroundColor: colors.warningBg }]}
          >
            <Ionicons name="key" size={18} color={colors.warning} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats.totalHosts}
          </Text>
          <Text style={styles.statLabel}>Hosts</Text>
          <Text style={styles.statSub}>Managing rooms</Text>
        </View>
        <View style={styles.statCard}>
          <View
            style={[styles.statIconWrap, { backgroundColor: colors.successBg }]}
          >
            <Ionicons name="person" size={18} color={colors.success} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats.totalClients}
          </Text>
          <Text style={styles.statLabel}>Clients</Text>
          <Text style={styles.statSub}>Regular members</Text>
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
            <View
              style={[
                styles.emptyIconBadge,
                { backgroundColor: colors.successBg },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={28}
                color={colors.success}
              />
            </View>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyText}>
              No pending host requests right now
            </Text>
          </View>
        ) : (
          pendingRequests.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.requestTopRow}>
                <View style={styles.requestInfo}>
                  <View
                    style={[styles.avatarRing, { borderColor: colors.accent }]}
                  >
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
                  </View>
                  <View style={styles.requestDetails}>
                    <Text style={styles.requestName}>
                      {req.name || "Unknown"}
                    </Text>
                    <Text style={styles.requestEmail}>
                      {req.email || "N/A"}
                    </Text>
                    <View style={styles.timePill}>
                      <Ionicons
                        name="time-outline"
                        size={11}
                        color={colors.textTertiary}
                      />
                      <Text style={styles.timePillText}>
                        Requested {getRelativeTime(req.host_requested_at)}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.statusTag}>
                  <Text style={styles.statusTagText}>Pending</Text>
                </View>
              </View>

              <View style={styles.verificationStrip}>
                <View style={styles.verificationPill}>
                  <Ionicons
                    name={
                      req.host_application?.governmentId?.formatValid
                        ? "checkmark-circle"
                        : "alert-circle"
                    }
                    size={13}
                    color={
                      req.host_application?.governmentId?.formatValid
                        ? colors.success
                        : colors.warning
                    }
                  />
                  <Text style={styles.verificationPillText}>
                    {req.host_application?.governmentId?.typeLabel ||
                      "ID pending"}
                  </Text>
                </View>
                <View style={styles.verificationPill}>
                  <Ionicons
                    name={
                      req.host_application?.facialVerification?.selfie
                        ? "person-circle"
                        : "person-circle-outline"
                    }
                    size={13}
                    color={
                      req.host_application?.facialVerification?.selfie
                        ? colors.success
                        : colors.warning
                    }
                  />
                  <Text style={styles.verificationPillText}>
                    {req.host_application?.facialVerification?.selfie
                      ? "Selfie attached"
                      : "No selfie"}
                  </Text>
                </View>
              </View>

              <View style={styles.requestActions}>
                {processingId === req.id ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.reviewBtn}
                      onPress={() => setSelectedHostRequest(req)}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={18}
                        color={colors.textOnAccent}
                      />
                      <Text style={styles.reviewBtnText}>Review Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleRejectHost(req.id, req.name)}
                    >
                      <Ionicons name="close" size={18} color={colors.error} />
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
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{hosts.length}</Text>
          </View>
        </View>

        {hosts.length === 0 ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIconBadge,
                { backgroundColor: colors.warningBg },
              ]}
            >
              <Ionicons name="people" size={26} color={colors.warning} />
            </View>
            <Text style={styles.emptyTitle}>No active hosts yet</Text>
            <Text style={styles.emptyText}>
              Approved hosts will appear here
            </Text>
          </View>
        ) : (
          hosts.map((host) => (
            <View key={host.id} style={styles.hostCard}>
              <View style={styles.hostInfo}>
                <View
                  style={[styles.avatarRing, { borderColor: colors.warning }]}
                >
                  {host.avatar?.url ? (
                    <Image
                      source={{ uri: host.avatar.url }}
                      style={styles.requestAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.requestAvatarPlaceholder,
                        { backgroundColor: colors.warning },
                      ]}
                    >
                      <Text style={styles.requestAvatarText}>
                        {(host.name || "H").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.requestDetails}>
                  <Text style={styles.requestName}>
                    {host.name || "Unknown"}
                  </Text>
                  <Text style={styles.requestEmail}>{host.email || "N/A"}</Text>
                  <View style={styles.hostTag}>
                    <Ionicons name="key" size={10} color={colors.warning} />
                    <Text style={styles.hostTagText}>Host</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.demoteBtn}
                onPress={() => handleDemoteHost(host.id, host.name)}
                disabled={processingId === host.id}
              >
                {processingId === host.id ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <Ionicons
                      name="arrow-down-outline"
                      size={14}
                      color={colors.error}
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
                { backgroundColor: colors.infoBg },
              ]}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={20}
                color={colors.info}
              />
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
                { backgroundColor: colors.errorBg },
              ]}
            >
              <Ionicons name="bug-outline" size={20} color={colors.error} />
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
                { backgroundColor: colors.warningBg },
              ]}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color={colors.warning}
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
                { backgroundColor: colors.actionRoomInfoBg },
              ]}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={colors.actionRoomInfoIcon}
              />
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
                { backgroundColor: colors.actionPayBillsBg },
              ]}
            >
              <Ionicons
                name="people-outline"
                size={20}
                color={colors.actionPayBillsIcon}
              />
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
                { backgroundColor: colors.actionPresenceBg },
              ]}
            >
              <Ionicons
                name="home-outline"
                size={20}
                color={colors.actionPresenceIcon}
              />
            </View>
            <Text style={styles.quickActionLabel}>All Rooms</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() =>
              navigation
                .getParent()
                ?.navigate("DashboardStack", { screen: "AdminAds" })
            }
          >
            <View
              style={[
                styles.quickActionIcon,
                { backgroundColor: colors.actionChatBg },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={20}
                color={colors.actionChatIcon}
              />
            </View>
            <Text style={styles.quickActionLabel}>Ads</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionFooterRow}>
          <TouchableOpacity
            style={styles.sectionFooterLink}
            onPress={() => navigation.getParent()?.navigate("ManageStack")}
          >
            <Text style={styles.sectionFooterText}>
              Open full management hub
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollViewWithDetection>
    <HostApplicationReviewModal
      visible={Boolean(selectedHostRequest)}
      request={selectedHostRequest}
      onClose={() => !processingId && setSelectedHostRequest(null)}
      onApprove={handleApproveHost}
      onReject={handleRejectHost}
      processing={Boolean(processingId)}
    />
    <Modal
      animationType="slide"
      transparent
      visible={rejectDraft.visible}
      onRequestClose={() =>
        !processingId &&
        setRejectDraft({
          visible: false,
          userId: null,
          userName: "",
          reason: "",
        })
      }
    >
      <View style={styles.rejectModalOverlay}>
        <View style={styles.rejectSheet}>
          <View style={styles.rejectHandle} />
          <View style={styles.rejectHeader}>
            <View style={styles.rejectIconWrap}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
            </View>
            <View style={styles.rejectHeaderCopy}>
              <Text style={styles.rejectTitle}>Reject Application</Text>
              <Text style={styles.rejectSubtitle} numberOfLines={1}>
                {rejectDraft.userName}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.rejectClose}
              disabled={Boolean(processingId)}
              onPress={() =>
                setRejectDraft({
                  visible: false,
                  userId: null,
                  userName: "",
                  reason: "",
                })
              }
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.rejectHelp}>
            Add a specific reason so the applicant knows what to fix before
            submitting again.
          </Text>
          <TextInput
            style={styles.rejectInput}
            value={rejectDraft.reason}
            onChangeText={(reason) =>
              setRejectDraft((prev) => ({ ...prev, reason }))
            }
            placeholder="Example: The ID image is blurry and the selfie does not clearly show your face."
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlignVertical="top"
            editable={!processingId}
          />
          <TouchableOpacity
            style={[
              styles.rejectSubmit,
              (processingId || rejectDraft.reason.trim().length < 10) && {
                opacity: 0.6,
              },
            ]}
            disabled={Boolean(processingId) || rejectDraft.reason.trim().length < 10}
            onPress={submitRejectHost}
          >
            {processingId ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <>
                <Ionicons
                  name="send"
                  size={18}
                  color={colors.textOnAccent}
                />
                <Text style={styles.rejectSubmitText}>Reject with Reason</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: 8,
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

    // ── Header ──
    header: {
      backgroundColor: colors.headerBg,
      paddingTop: 24,
      paddingHorizontal: 20,
      paddingBottom: 56,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
    },
    headerTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    avatarCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(255,255,255,0.15)",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.25)",
    },
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    bellBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.15)",
      justifyContent: "center",
      alignItems: "center",
    },
    bellBadge: {
      position: "absolute",
      top: -2,
      right: -2,
      backgroundColor: colors.error,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: colors.headerBg,
    },
    bellBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "700",
    },
    eyebrowRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    eyebrowText: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.2,
      color: "rgba(255,255,255,0.65)",
    },
    rolePill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.15)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },
    rolePillText: {
      color: colors.headerText,
      fontSize: 12,
      fontWeight: "700",
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.headerText,
      marginBottom: 16,
    },
    greetingCard: {
      backgroundColor: "rgba(255,255,255,0.08)",
      borderRadius: 18,
      padding: 16,
    },
    greeting: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.headerText,
      marginBottom: 4,
    },
    greetingSub: {
      fontSize: 13,
      color: "rgba(255,255,255,0.75)",
      lineHeight: 18,
      marginBottom: 12,
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

    // ── Stats Row ──
    statsRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      gap: 10,
      marginTop: 20,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 14,
      alignItems: "center",
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
    statIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    statValue: {
      fontSize: 20,
      fontWeight: "800",
    },
    statLabel: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.4,
      color: colors.textTertiary,
      marginTop: 4,
      textTransform: "uppercase",
    },
    statSub: {
      fontSize: 10,
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
      marginBottom: 14,
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
    countPill: {
      backgroundColor: colors.cardAlt,
      minWidth: 26,
      height: 22,
      borderRadius: 11,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 8,
    },
    countPillText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    badge: {
      backgroundColor: colors.error,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 6,
    },
    badgeText: {
      color: colors.textOnAccent,
      fontSize: 11,
      fontWeight: "700",
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 28,
      gap: 4,
    },
    emptyIconBadge: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    emptyText: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    avatarRing: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      padding: 2,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    requestCard: {
      backgroundColor: colors.cardAlt || colors.background,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
    },
    requestTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 14,
    },
    requestInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    requestAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    requestAvatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
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
    timePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    timePillText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    statusTag: {
      backgroundColor: colors.warningBg,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      marginLeft: 8,
    },
    statusTagText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.warning,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    hostTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.warningBg,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      marginTop: 5,
      alignSelf: "flex-start",
    },
    hostTagText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.warning,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    requestActions: {
      flexDirection: "row",
      gap: 8,
    },
    verificationStrip: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    verificationPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 11,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    verificationPillText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    reviewBtn: {
      flex: 1.25,
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 12,
      justifyContent: "center",
      alignItems: "center",
      gap: 4,
    },
    reviewBtnText: {
      color: colors.textOnAccent,
      fontSize: 13,
      fontWeight: "800",
    },
    approveBtn: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: colors.success,
      borderRadius: 14,
      paddingVertical: 12,
      justifyContent: "center",
      alignItems: "center",
      gap: 4,
      ...Platform.select({
        ios: {
          shadowColor: colors.success,
          shadowOpacity: 0.3,
          shadowOffset: { width: 0, height: 3 },
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
    approveBtnText: {
      color: colors.textOnAccent,
      fontSize: 13,
      fontWeight: "700",
    },
    rejectBtn: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: colors.errorBg,
      borderRadius: 14,
      paddingVertical: 12,
      justifyContent: "center",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderColor: colors.error,
    },
    rejectBtnText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: "700",
    },
    hostCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.cardAlt || colors.background,
      borderRadius: 16,
      padding: 12,
      marginBottom: 10,
    },
    hostInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    demoteBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.errorBg,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
      gap: 4,
    },
    demoteBtnText: {
      color: colors.error,
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
      borderRadius: 18,
      paddingVertical: 18,
      paddingHorizontal: 14,
      alignItems: "center",
      position: "relative",
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    quickActionIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    quickActionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.text,
    },
    quickActionBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: colors.error,
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
    sectionFooterRow: {
      marginTop: 14,
      alignItems: "center",
    },
    sectionFooterLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
    },
    sectionFooterText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
    },
    rejectModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    rejectSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      paddingBottom: 22,
    },
    rejectHandle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.skeleton,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 14,
    },
    rejectHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    rejectIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.errorBg,
    },
    rejectHeaderCopy: {
      flex: 1,
      minWidth: 0,
    },
    rejectTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },
    rejectSubtitle: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSecondary,
    },
    rejectClose: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    rejectHelp: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
      marginBottom: 10,
    },
    rejectInput: {
      minHeight: 110,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      color: colors.inputText,
      fontSize: 14,
      marginBottom: 14,
    },
    rejectSubmit: {
      minHeight: 50,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      backgroundColor: colors.error,
    },
    rejectSubmitText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textOnAccent,
    },
  });

export default SuperAdminDashboardScreen;
