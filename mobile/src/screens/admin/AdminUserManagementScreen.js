import React, { useState, useEffect, useCallback, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../context/AuthContext";
import { hostRoleService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const ROLE_FILTERS = [
  { key: "all", label: "All" },
  { key: "client", label: "Clients" },
  { key: "host", label: "Hosts" },
  { key: "admin", label: "Admins" },
];

const AdminUserManagementScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { state } = useContext(AuthContext);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  const fetchUsers = async () => {
    try {
      const response = await hostRoleService.getAllUsers();
      setUsers(response?.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchUsers();
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      fetchUsers();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, []);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !search ||
      (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase());
    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "admin" ? u.is_admin : u.role === roleFilter);
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    clients: users.filter((u) => u.role === "client" && !u.is_admin).length,
    hosts: users.filter((u) => u.role === "host").length,
    admins: users.filter((u) => u.is_admin).length,
  };

  const openUserActions = (user) => {
    if (user.id === state.user?.id) return;
    setSelectedUser(user);
    setActionModalVisible(true);
  };

  const handleChangeRole = async (newRole) => {
    if (!selectedUser) return;
    Alert.alert(
      "Change Role",
      `Change ${selectedUser.name}'s role to ${newRole}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setProcessingAction(true);
              await hostRoleService.changeRole(selectedUser.id, newRole);
              Alert.alert("Success", `Role changed to ${newRole}`);
              setActionModalVisible(false);
              await fetchUsers();
            } catch (error) {
              Alert.alert(
                "Error",
                error?.response?.data?.message || "Failed to change role",
              );
            } finally {
              setProcessingAction(false);
            }
          },
        },
      ],
    );
  };

  const handleToggleStatus = async () => {
    if (!selectedUser) return;
    const newStatus = selectedUser.is_active === false ? true : false;
    const actionText = newStatus ? "activate" : "deactivate";
    Alert.alert(
      `${newStatus ? "Activate" : "Deactivate"} Account`,
      `Are you sure you want to ${actionText} ${selectedUser.name}'s account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: newStatus ? "default" : "destructive",
          onPress: async () => {
            try {
              setProcessingAction(true);
              await hostRoleService.toggleStatus(selectedUser.id, newStatus);
              Alert.alert(
                "Success",
                `Account ${newStatus ? "activated" : "deactivated"}`,
              );
              setActionModalVisible(false);
              await fetchUsers();
            } catch (error) {
              Alert.alert(
                "Error",
                error?.response?.data?.message ||
                  `Failed to ${actionText} account`,
              );
            } finally {
              setProcessingAction(false);
            }
          },
        },
      ],
    );
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    Alert.alert(
      "Delete Account",
      `This will permanently delete ${selectedUser.name}'s account. This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessingAction(true);
              await hostRoleService.deleteUser(selectedUser.id);
              Alert.alert("Success", "Account deleted");
              setActionModalVisible(false);
              await fetchUsers();
            } catch (error) {
              Alert.alert(
                "Error",
                error?.response?.data?.message || "Failed to delete account",
              );
            } finally {
              setProcessingAction(false);
            }
          },
        },
      ],
    );
  };

  const getRoleBadgeStyle = (user) => {
    if (user.is_admin)
      return { bg: "rgba(179,134,4,0.12)", color: "#b38604", text: "Admin" };
    if (user.role === "host")
      return { bg: "rgba(52,152,219,0.12)", color: "#2980B9", text: "Host" };
    return { bg: "rgba(39,174,96,0.12)", color: "#27AE60", text: "Client" };
  };

  const renderUser = ({ item: user }) => {
    const badge = getRoleBadgeStyle(user);
    const isCurrentUser = user.id === state.user?.id;
    const isInactive = user.is_active === false;

    return (
      <TouchableOpacity
        style={[styles.userCard, isInactive && styles.userCardInactive]}
        onPress={() => openUserActions(user)}
        activeOpacity={isCurrentUser ? 1 : 0.7}
        disabled={isCurrentUser}
      >
        <View style={styles.userRow}>
          {user.avatar?.url ? (
            <Image source={{ uri: user.avatar.url }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: badge.color },
              ]}
            >
              <Text style={styles.avatarText}>
                {(user.name || "U").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.name || "Unknown"}
              </Text>
              {isCurrentUser && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>You</Text>
                </View>
              )}
              {isInactive && (
                <View style={styles.inactiveBadge}>
                  <Text style={styles.inactiveBadgeText}>Inactive</Text>
                </View>
              )}
            </View>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user.email || "N/A"}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.roleBadgeText, { color: badge.color }]}>
                  {badge.text}
                </Text>
              </View>
              {user.host_request_status === "pending" && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>Pending Host</Text>
                </View>
              )}
              <Text style={styles.dateText}>
                {user.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : ""}
              </Text>
            </View>
          </View>
          {!isCurrentUser && (
            <Ionicons
              name="ellipsis-vertical"
              size={18}
              color={colors.textTertiary}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Management</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#EBF5FB" }]}>
          <Text style={[styles.statValue, { color: "#2980B9" }]}>
            {stats.total}
          </Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#EAFAF1" }]}>
          <Text style={[styles.statValue, { color: "#27AE60" }]}>
            {stats.clients}
          </Text>
          <Text style={styles.statLabel}>Clients</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#EBF5FB" }]}>
          <Text style={[styles.statValue, { color: "#2980B9" }]}>
            {stats.hosts}
          </Text>
          <Text style={styles.statLabel}>Hosts</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#FEF9E7" }]}>
          <Text style={[styles.statValue, { color: "#b38604" }]}>
            {stats.admins}
          </Text>
          <Text style={styles.statLabel}>Admins</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Role Filter */}
      <View style={styles.filterRow}>
        {ROLE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterBtn,
              roleFilter === f.key && styles.filterBtnActive,
            ]}
            onPress={() => setRoleFilter(f.key)}
          >
            <Text
              style={[
                styles.filterLabel,
                roleFilter === f.key && styles.filterLabelActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="people-outline"
              size={48}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
      />

      {/* User Actions Modal */}
      <Modal
        visible={actionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !processingAction && setActionModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => !processingAction && setActionModalVisible(false)}
        >
          <View
            style={styles.actionSheet}
            onStartShouldSetResponder={() => true}
          >
            {selectedUser && (
              <>
                {/* User Info Header */}
                <View style={styles.actionSheetHeader}>
                  {selectedUser.avatar?.url ? (
                    <Image
                      source={{ uri: selectedUser.avatar.url }}
                      style={styles.modalAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.modalAvatarPlaceholder,
                        {
                          backgroundColor:
                            getRoleBadgeStyle(selectedUser).color,
                        },
                      ]}
                    >
                      <Text style={styles.modalAvatarText}>
                        {(selectedUser.name || "U").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.modalUserInfo}>
                    <Text style={styles.modalUserName}>
                      {selectedUser.name || "Unknown"}
                    </Text>
                    <Text style={styles.modalUserEmail}>
                      {selectedUser.email || "N/A"}
                    </Text>
                    <View
                      style={[
                        styles.roleBadge,
                        {
                          backgroundColor: getRoleBadgeStyle(selectedUser).bg,
                          marginTop: 4,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBadgeText,
                          { color: getRoleBadgeStyle(selectedUser).color },
                        ]}
                      >
                        {getRoleBadgeStyle(selectedUser).text}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setActionModalVisible(false)}
                    disabled={processingAction}
                  >
                    <Ionicons name="close" size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {processingAction ? (
                  <View style={styles.processingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.processingText}>Processing...</Text>
                  </View>
                ) : (
                  <View style={styles.actionsList}>
                    {/* Change Role */}
                    {!selectedUser.is_admin && (
                      <>
                        <Text style={styles.actionSectionLabel}>
                          Change Role
                        </Text>
                        {selectedUser.role !== "host" && (
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleChangeRole("host")}
                          >
                            <View
                              style={[
                                styles.actionIconWrap,
                                { backgroundColor: "rgba(52,152,219,0.12)" },
                              ]}
                            >
                              <Ionicons
                                name="key-outline"
                                size={18}
                                color="#2980B9"
                              />
                            </View>
                            <View style={styles.actionContent}>
                              <Text style={styles.actionTitle}>
                                Promote to Host
                              </Text>
                              <Text style={styles.actionDesc}>
                                Allow user to create and manage rooms
                              </Text>
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={16}
                              color={colors.textTertiary}
                            />
                          </TouchableOpacity>
                        )}
                        {selectedUser.role !== "client" && (
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleChangeRole("client")}
                          >
                            <View
                              style={[
                                styles.actionIconWrap,
                                { backgroundColor: "rgba(39,174,96,0.12)" },
                              ]}
                            >
                              <Ionicons
                                name="person-outline"
                                size={18}
                                color="#27AE60"
                              />
                            </View>
                            <View style={styles.actionContent}>
                              <Text style={styles.actionTitle}>
                                Demote to Client
                              </Text>
                              <Text style={styles.actionDesc}>
                                Remove host privileges
                              </Text>
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={16}
                              color={colors.textTertiary}
                            />
                          </TouchableOpacity>
                        )}
                      </>
                    )}

                    {/* Account Actions */}
                    <Text
                      style={[styles.actionSectionLabel, { marginTop: 12 }]}
                    >
                      Account Actions
                    </Text>
                    {!selectedUser.is_admin && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={handleToggleStatus}
                      >
                        <View
                          style={[
                            styles.actionIconWrap,
                            {
                              backgroundColor:
                                selectedUser.is_active === false
                                  ? "rgba(39,174,96,0.12)"
                                  : "rgba(243,156,18,0.12)",
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              selectedUser.is_active === false
                                ? "checkmark-circle-outline"
                                : "ban-outline"
                            }
                            size={18}
                            color={
                              selectedUser.is_active === false
                                ? "#27AE60"
                                : "#F39C12"
                            }
                          />
                        </View>
                        <View style={styles.actionContent}>
                          <Text style={styles.actionTitle}>
                            {selectedUser.is_active === false
                              ? "Activate Account"
                              : "Deactivate Account"}
                          </Text>
                          <Text style={styles.actionDesc}>
                            {selectedUser.is_active === false
                              ? "Re-enable user access"
                              : "Temporarily disable user access"}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={colors.textTertiary}
                        />
                      </TouchableOpacity>
                    )}

                    {/* Delete */}
                    {!selectedUser.is_admin && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { borderBottomWidth: 0 }]}
                        onPress={handleDeleteUser}
                      >
                        <View
                          style={[
                            styles.actionIconWrap,
                            { backgroundColor: "rgba(231,76,60,0.12)" },
                          ]}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#E74C3C"
                          />
                        </View>
                        <View style={styles.actionContent}>
                          <Text
                            style={[styles.actionTitle, { color: "#E74C3C" }]}
                          >
                            Delete Account
                          </Text>
                          <Text style={styles.actionDesc}>
                            Permanently remove this user
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={colors.textTertiary}
                        />
                      </TouchableOpacity>
                    )}

                    {selectedUser.is_admin && (
                      <View style={styles.adminNotice}>
                        <Ionicons
                          name="shield-checkmark"
                          size={20}
                          color={colors.accent}
                        />
                        <Text style={styles.adminNoticeText}>
                          Admin accounts cannot be modified from here
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
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
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textTertiary,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    statsRow: {
      flexDirection: "row",
      paddingHorizontal: 12,
      gap: 8,
      marginBottom: 12,
    },
    statCard: {
      flex: 1,
      borderRadius: 12,
      padding: 10,
      alignItems: "center",
    },
    statValue: {
      fontSize: 18,
      fontWeight: "800",
    },
    statLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
      marginTop: 2,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      marginHorizontal: 12,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      marginBottom: 10,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      paddingVertical: 0,
    },
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: 12,
      gap: 8,
      marginBottom: 10,
    },
    filterBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: "transparent",
    },
    filterBtnActive: {
      backgroundColor: colors.accentSurface || "rgba(179,134,4,0.12)",
      borderColor: colors.accent,
    },
    filterLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    filterLabelActive: {
      color: colors.accent,
    },
    listContent: {
      paddingHorizontal: 12,
      paddingBottom: 32,
    },
    userCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    userCardInactive: {
      opacity: 0.55,
    },
    userRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: 12,
    },
    avatarPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: "700",
      color: "#fff",
    },
    userInfo: {
      flex: 1,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    userName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      flexShrink: 1,
    },
    userEmail: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
      gap: 6,
    },
    roleBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    roleBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    pendingBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: "rgba(243,156,18,0.12)",
    },
    pendingBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#F39C12",
    },
    youBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: "rgba(179,134,4,0.12)",
    },
    youBadgeText: {
      fontSize: 9,
      fontWeight: "700",
      color: "#b38604",
    },
    inactiveBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: "rgba(231,76,60,0.12)",
    },
    inactiveBadgeText: {
      fontSize: 9,
      fontWeight: "700",
      color: "#E74C3C",
    },
    dateText: {
      fontSize: 10,
      color: colors.textTertiary,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 48,
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textTertiary,
    },

    /* Action Modal */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    actionSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 32,
      maxHeight: "80%",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowOffset: { width: 0, height: -4 },
          shadowRadius: 16,
        },
        android: { elevation: 16 },
      }),
    },
    actionSheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight || colors.border,
    },
    modalAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: 14,
    },
    modalAvatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
    },
    modalAvatarText: {
      fontSize: 20,
      fontWeight: "700",
      color: "#fff",
    },
    modalUserInfo: {
      flex: 1,
    },
    modalUserName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    modalUserEmail: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    processingContainer: {
      alignItems: "center",
      paddingVertical: 40,
      gap: 12,
    },
    processingText: {
      fontSize: 14,
      color: colors.textTertiary,
    },
    actionsList: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    actionSectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight || colors.border,
    },
    actionIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    actionContent: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    actionDesc: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    adminNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 16,
      backgroundColor: "rgba(179,134,4,0.08)",
      borderRadius: 12,
      marginTop: 8,
    },
    adminNoticeText: {
      fontSize: 13,
      color: colors.textTertiary,
      flex: 1,
    },
  });

export default AdminUserManagementScreen;
