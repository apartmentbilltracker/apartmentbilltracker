import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiService, roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const AdminBroadcastScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all"); // "all" | "room" | "user"
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchUsers();
    fetchHistory();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await roomService.getRooms();
      const allRooms = response.rooms || response.data?.rooms || [];
      setRooms(allRooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiService.get("/api/v2/admin/broadcast/users");
      setUsers(response.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await apiService.get("/api/v2/admin/broadcast/history");
      setHistory(response.broadcasts || []);
    } catch (error) {
      console.error("Error fetching broadcast history:", error);
    } finally {
      setLoadingHistory(false);
      setRefreshing(false);
    }
  };

  const canSend =
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    (target === "all" ||
      (target === "room" && selectedRoomId) ||
      (target === "user" && selectedUserIds.length > 0));

  const handleSend = async () => {
    if (!canSend) return;

    const targetLabel =
      target === "all"
        ? "all users"
        : target === "user"
          ? `${selectedUserIds.length} selected user(s)`
          : rooms.find((r) => (r.id || r._id) === selectedRoomId)?.name ||
            "selected room";

    Alert.alert(
      "Send Notification",
      `Send "${title}" to ${targetLabel}?${sendEmail ? "\n\nEmails will also be sent." : ""}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            try {
              setSending(true);
              const response = await apiService.post(
                "/api/v2/admin/broadcast",
                {
                  title: title.trim(),
                  message: message.trim(),
                  target,
                  roomId: target === "room" ? selectedRoomId : undefined,
                  userIds: target === "user" ? selectedUserIds : undefined,
                  sendEmail,
                },
              );

              const sent = response.sent || 0;
              const emailed = response.emailed || 0;
              let summary = `Notification sent to ${sent} user(s).`;
              if (sendEmail) summary += `\n${emailed} email(s) delivered.`;

              Alert.alert("Sent!", summary);
              setTitle("");
              setMessage("");
              setSendEmail(false);
              fetchHistory();
            } catch (error) {
              console.error("Error sending broadcast:", error);
              Alert.alert(
                "Error",
                error.message || "Failed to send notification",
              );
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Notification</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchHistory();
            }}
          />
        }
      >
        {/* Compose Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create-outline" size={18} color={colors.accent} />
            <Text style={styles.sectionTitle}>Compose</Text>
          </View>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Maintenance Notice"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Type your message here..."
            placeholderTextColor={colors.textTertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={styles.charCount}>{message.length}/2000</Text>
        </View>

        {/* Target Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={18} color={colors.accent} />
            <Text style={styles.sectionTitle}>Recipients</Text>
          </View>

          <View style={styles.targetRow}>
            <TouchableOpacity
              style={[
                styles.targetChip,
                target === "all" && styles.targetChipActive,
              ]}
              onPress={() => setTarget("all")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="globe-outline"
                size={16}
                color={
                  target === "all" ? colors.textOnAccent : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.targetChipText,
                  target === "all" && styles.targetChipTextActive,
                ]}
              >
                All Users
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.targetChip,
                target === "room" && styles.targetChipActive,
              ]}
              onPress={() => setTarget("room")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="home-outline"
                size={16}
                color={
                  target === "room" ? colors.textOnAccent : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.targetChipText,
                  target === "room" && styles.targetChipTextActive,
                ]}
              >
                Specific Room
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.targetChip,
                target === "user" && styles.targetChipActive,
              ]}
              onPress={() => setTarget("user")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={
                  target === "user" ? colors.textOnAccent : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.targetChipText,
                  target === "user" && styles.targetChipTextActive,
                ]}
              >
                Specific User
              </Text>
            </TouchableOpacity>
          </View>

          {target === "room" && (
            <View style={styles.roomPicker}>
              {rooms.length === 0 ? (
                <Text style={styles.noRoomsText}>No rooms found</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {rooms.map((room) => {
                    const id = room.id || room._id;
                    const active = selectedRoomId === id;
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[
                          styles.roomChip,
                          active && styles.roomChipActive,
                        ]}
                        onPress={() => setSelectedRoomId(id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.roomChipText,
                            active && styles.roomChipTextActive,
                          ]}
                        >
                          {room.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {target === "user" && (
            <View style={styles.roomPicker}>
              <TextInput
                style={[styles.input, { marginBottom: 8 }]}
                placeholder="Search by name or email..."
                placeholderTextColor={colors.textTertiary}
                value={userSearch}
                onChangeText={setUserSearch}
              />
              {filteredUsers.length > 0 && (
                <View style={styles.selectAllRow}>
                  <Text style={styles.selectedCount}>
                    {selectedUserIds.length} selected
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const allFilteredIds = filteredUsers.map((u) => u.id);
                      const allSelected = allFilteredIds.every((id) =>
                        selectedUserIds.includes(id),
                      );
                      if (allSelected) {
                        setSelectedUserIds((prev) =>
                          prev.filter((id) => !allFilteredIds.includes(id)),
                        );
                      } else {
                        setSelectedUserIds((prev) => [
                          ...new Set([...prev, ...allFilteredIds]),
                        ]);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.selectAllText}>
                      {filteredUsers.every((u) =>
                        selectedUserIds.includes(u.id),
                      )
                        ? "Deselect All"
                        : "Select All"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {filteredUsers.length === 0 ? (
                <Text style={styles.noRoomsText}>No users found</Text>
              ) : (
                <ScrollView
                  style={{ maxHeight: 180 }}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {filteredUsers.map((user) => {
                    const active = selectedUserIds.includes(user.id);
                    return (
                      <TouchableOpacity
                        key={user.id}
                        style={[styles.userRow, active && styles.userRowActive]}
                        onPress={() =>
                          setSelectedUserIds((prev) =>
                            active
                              ? prev.filter((id) => id !== user.id)
                              : [...prev, user.id],
                          )
                        }
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={active ? "checkbox" : "square-outline"}
                          size={18}
                          color={active ? colors.accent : colors.textTertiary}
                        />
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text
                            style={[
                              styles.userName,
                              active && { color: colors.accent },
                            ]}
                            numberOfLines={1}
                          >
                            {user.name}
                          </Text>
                          <Text style={styles.userEmail} numberOfLines={1}>
                            {user.email}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {/* Options Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings-outline" size={18} color={colors.accent} />
            <Text style={styles.sectionTitle}>Options</Text>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Ionicons name="mail-outline" size={20} color={colors.text} />
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchLabel}>Also send via Email</Text>
                <Text style={styles.switchDesc}>
                  Recipients will get an email in addition to the in-app alert
                </Text>
              </View>
            </View>
            <Switch
              value={sendEmail}
              onValueChange={setSendEmail}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Send Button */}
        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!canSend || sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.sendBtnText}>Send Notification</Text>
            </>
          )}
        </TouchableOpacity>

        {/* History Section */}
        <View style={[styles.section, { marginTop: 24 }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={18} color={colors.accent} />
            <Text style={styles.sectionTitle}>Recent Broadcasts</Text>
          </View>

          {loadingHistory ? (
            <ActivityIndicator
              color={colors.accent}
              style={{ marginVertical: 20 }}
            />
          ) : history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="megaphone-outline"
                size={40}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyText}>No broadcasts sent yet</Text>
            </View>
          ) : (
            history.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.historyDate}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>
                <Text style={styles.historyMessage} numberOfLines={2}>
                  {item.message}
                </Text>
                {item.related_data?.target && (
                  <View style={styles.historyBadgeRow}>
                    <View style={styles.historyBadge}>
                      <Ionicons
                        name={
                          item.related_data.target === "all"
                            ? "globe-outline"
                            : item.related_data.target === "user"
                              ? "person-outline"
                              : "home-outline"
                        }
                        size={12}
                        color={colors.accent}
                      />
                      <Text style={styles.historyBadgeText}>
                        {item.related_data.target === "all"
                          ? "All Users"
                          : item.related_data.target === "user"
                            ? "Single User"
                            : "Room"}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 14,
      backgroundColor: colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    scroll: { flex: 1 },
    scrollContent: { padding: 16 },
    section: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 6,
      marginTop: 4,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      marginBottom: 10,
    },
    textArea: {
      minHeight: 110,
      paddingTop: 12,
    },
    charCount: {
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: "right",
      marginTop: -6,
      marginBottom: 4,
    },
    targetRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    targetChip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    targetChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    targetChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    targetChipTextActive: {
      color: colors.textOnAccent,
    },
    roomPicker: {
      marginTop: 12,
    },
    roomChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      marginRight: 8,
    },
    roomChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    roomChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    roomChipTextActive: {
      color: colors.textOnAccent,
    },
    noRoomsText: {
      fontSize: 13,
      color: colors.textTertiary,
      fontStyle: "italic",
    },
    selectAllRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    selectedCount: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "600",
    },
    selectAllText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },
    userRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 6,
      backgroundColor: colors.background,
    },
    userRowActive: {
      backgroundColor: colors.accent + "15",
      borderColor: colors.accent,
    },
    userName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    userEmail: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 1,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    switchInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
      marginRight: 12,
    },
    switchTextWrap: { flex: 1 },
    switchLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    switchDesc: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
      lineHeight: 16,
    },
    sendBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: 14,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    sendBtnDisabled: {
      opacity: 0.5,
    },
    sendBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 24,
      gap: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textTertiary,
    },
    historyCard: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    historyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    historyTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    historyDate: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    historyMessage: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    historyBadgeRow: {
      flexDirection: "row",
      marginTop: 6,
    },
    historyBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    historyBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.accent,
    },
  });

export default AdminBroadcastScreen;
