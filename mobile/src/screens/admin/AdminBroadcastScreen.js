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
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiService, roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";

// ─────────────────────────────────────────────────────────────────────────────
// BroadcastDetailModal
// Named export so RecentBroadcastsWidget can reuse it without duplication.
// ─────────────────────────────────────────────────────────────────────────────
export const BroadcastDetailModal = ({
  broadcast,
  visible,
  onClose,
  colors,
}) => {
  if (!broadcast) return null;

  const formatDateFull = (dateStr) => {
    if (!dateStr) return "Unknown date";
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const target = broadcast.related_data?.target;
  const targetConfig =
    target === "all"
      ? { icon: "globe-outline", label: "All Users", bg: "infoBg", fg: "info" }
      : target === "user"
        ? {
            icon: "person-outline",
            label: "Specific User(s)",
            bg: "accentLight",
            fg: "accent",
          }
        : {
            icon: "home-outline",
            label: "Specific Room",
            bg: "accentLight",
            fg: "accent",
          };

  const badgeBg = colors[targetConfig.bg] || colors.accentLight;
  const badgeFg = colors[targetConfig.fg] || colors.accent;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,43,41,0.65)",
        }}
      >
        {/* Tap-outside to close */}
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={onClose}
          activeOpacity={1}
        />

        <View
          style={{
            backgroundColor: colors.modal,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: "88%",
            paddingBottom: Platform.OS === "ios" ? 34 : 20,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 24,
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              alignSelf: "center",
              marginTop: 10,
              marginBottom: 2,
            }}
          />

          {/* Modal header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 16,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: colors.accentLight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="megaphone" size={24} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 1.8,
                  color: colors.accent,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                BROADCAST DETAIL
              </Text>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: colors.text,
                  lineHeight: 22,
                }}
              >
                {broadcast.title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.background,
                alignItems: "center",
                justifyContent: "center",
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Badge row */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 14,
              }}
            >
              {/* Target */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: badgeBg,
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  borderRadius: 20,
                }}
              >
                <Ionicons name={targetConfig.icon} size={13} color={badgeFg} />
                <Text
                  style={{ fontSize: 12, fontWeight: "700", color: badgeFg }}
                >
                  {targetConfig.label}
                </Text>
              </View>

              {/* Sent count */}
              {broadcast.sent_count != null && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    backgroundColor: colors.successBg,
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: 20,
                  }}
                >
                  <Ionicons
                    name="people-outline"
                    size={13}
                    color={colors.success}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: colors.success,
                    }}
                  >
                    {broadcast.sent_count} received
                  </Text>
                </View>
              )}

              {/* Email badge */}
              {broadcast.related_data?.sendEmail && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    backgroundColor: colors.infoBg,
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: 20,
                  }}
                >
                  <Ionicons name="mail-outline" size={13} color={colors.info} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: colors.info,
                    }}
                  >
                    Email delivered
                  </Text>
                </View>
              )}
            </View>

            {/* Timestamp */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 20,
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={14}
                color={colors.textTertiary}
              />
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                {formatDateFull(broadcast.created_at)}
              </Text>
            </View>

            {/* Divider */}
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.divider,
                marginBottom: 18,
              }}
            />

            {/* Message label */}
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 1.4,
                color: colors.textTertiary,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              MESSAGE
            </Text>

            {/* Message body */}
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: 14,
                padding: 16,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{ fontSize: 15, color: colors.text, lineHeight: 24 }}
              >
                {broadcast.message}
              </Text>
            </View>

            {/* Room name if applicable */}
            {broadcast.related_data?.roomName && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 14,
                  backgroundColor: colors.accentLight,
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: colors.accent + "22",
                }}
              >
                <Ionicons name="home-outline" size={16} color={colors.accent} />
                <Text
                  style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}
                >
                  Sent to room:{" "}
                  <Text style={{ color: colors.accent, fontWeight: "700" }}>
                    {broadcast.related_data.roomName}
                  </Text>
                </Text>
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const TARGET_OPTIONS = [
  { key: "all", icon: "globe-outline", label: "All Users" },
  { key: "room", icon: "home-outline", label: "By Room" },
  { key: "user", icon: "person-outline", label: "By User" },
];

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// AdminBroadcastScreen
// ─────────────────────────────────────────────────────────────────────────────
const AdminBroadcastScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // ── Compose form ──
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [sending, setSending] = useState(false);

  // ── History ──
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Detail modal ──
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchUsers();
    fetchHistory();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await roomService.getRooms();
      setRooms(response.rooms || response.data?.rooms || []);
    } catch (e) {
      console.error("fetchRooms:", e);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiService.get("/api/v2/admin/broadcast/users");
      setUsers(response.users || []);
    } catch (e) {
      console.error("fetchUsers:", e);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await apiService.get("/api/v2/admin/broadcast/history");
      setHistory(response.broadcasts || []);
    } catch (e) {
      console.error("fetchHistory:", e);
    } finally {
      setLoadingHistory(false);
      setRefreshing(false);
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
      "Send Broadcast",
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
            } catch (e) {
              Alert.alert("Error", e.message || "Failed to send notification");
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  };

  const openDetail = (broadcast) => {
    setSelectedBroadcast(broadcast);
    setDetailVisible(true);
  };

  // ─ Render history card ─
  const renderHistoryCard = (item, index) => {
    const t = item.related_data?.target;
    const targetIcon =
      t === "all"
        ? "globe-outline"
        : t === "user"
          ? "person-outline"
          : "home-outline";
    const targetLabel =
      t === "all" ? "All Users" : t === "user" ? "User(s)" : "Room";

    return (
      <TouchableOpacity
        key={item.id || index}
        style={styles.historyCard}
        onPress={() => openDetail(item)}
        activeOpacity={0.72}
      >
        {/* Accent strip */}
        <View style={styles.historyStrip} />

        <View
          style={{
            flex: 1,
            paddingVertical: 11,
            paddingRight: 12,
            paddingLeft: 10,
          }}
        >
          {/* Top row: title + date */}
          <View style={styles.historyTopRow}>
            <Text style={styles.historyTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.historyDate}>
              {formatDate(item.created_at)}
            </Text>
          </View>

          {/* Message preview */}
          <Text style={styles.historyMessage} numberOfLines={2}>
            {item.message}
          </Text>

          {/* Footer badges + tap hint */}
          <View style={styles.historyFooter}>
            {t && (
              <View style={styles.historyBadge}>
                <Ionicons name={targetIcon} size={11} color={colors.accent} />
                <Text style={styles.historyBadgeText}>{targetLabel}</Text>
              </View>
            )}
            {item.sent_count != null && (
              <View
                style={[
                  styles.historyBadge,
                  { backgroundColor: colors.successBg, marginLeft: 6 },
                ]}
              >
                <Ionicons
                  name="people-outline"
                  size={11}
                  color={colors.success}
                />
                <Text
                  style={[styles.historyBadgeText, { color: colors.success }]}
                >
                  {item.sent_count}
                </Text>
              </View>
            )}
            {item.related_data?.sendEmail && (
              <View
                style={[
                  styles.historyBadge,
                  { backgroundColor: colors.infoBg, marginLeft: 6 },
                ]}
              >
                <Ionicons name="mail-outline" size={11} color={colors.info} />
                <Text style={[styles.historyBadgeText, { color: colors.info }]}>
                  Email
                </Text>
              </View>
            )}
            <View style={styles.tapHint}>
              <Text style={styles.tapHintText}>View full</Text>
              <Ionicons
                name="chevron-forward"
                size={12}
                color={colors.accent}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Live broadcast count pill */}
          {!loadingHistory && (
            <View style={styles.heroPill}>
              <Ionicons
                name="megaphone-outline"
                size={12}
                color={colors.headerBg}
              />
              <Text style={styles.heroPillText}>
                {history.length} broadcast{history.length !== 1 ? "s" : ""} sent
              </Text>
            </View>
          )}
        </View>

        <View style={styles.heroBody}>
          <Text style={styles.heroEyebrow}>ADMIN TOOLS</Text>
          <Text style={styles.heroTitle}>Broadcasts</Text>
          <Text style={styles.heroSubtitle}>
            Push notifications &amp; emails to your tenants
          </Text>
        </View>
      </View>

      {/* ── Scrollable Content ───────────────────────────────────────────── */}
      <ScrollViewWithDetection
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
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* ─ Compose ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBar} />
            <View style={styles.sectionIconWrap}>
              <Ionicons name="create-outline" size={16} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>Compose</Text>
          </View>

          <Text style={styles.label}>TITLE</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Maintenance Notice"
            placeholderTextColor={colors.placeholder}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={styles.label}>MESSAGE</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Type your message here..."
            placeholderTextColor={colors.placeholder}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={styles.charCount}>{message.length} / 2000</Text>
        </View>

        {/* ─ Recipients ───────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBar} />
            <View style={styles.sectionIconWrap}>
              <Ionicons name="people-outline" size={16} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>Recipients</Text>
          </View>

          <View style={styles.targetRow}>
            {TARGET_OPTIONS.map(({ key, icon, label }) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.targetChip,
                  target === key && styles.targetChipActive,
                ]}
                onPress={() => setTarget(key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={icon}
                  size={15}
                  color={
                    target === key ? colors.textOnAccent : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.targetChipText,
                    target === key && styles.targetChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Room picker */}
          {target === "room" && (
            <View style={styles.subPicker}>
              {rooms.length === 0 ? (
                <Text style={styles.emptyPickerText}>No rooms found</Text>
              ) : (
                <ScrollViewWithDetection
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
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
                        {active && (
                          <Ionicons
                            name="checkmark-circle"
                            size={13}
                            color="#fff"
                          />
                        )}
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
                </ScrollViewWithDetection>
              )}
            </View>
          )}

          {/* User picker */}
          {target === "user" && (
            <View style={styles.subPicker}>
              <TextInput
                style={[styles.input, { marginBottom: 10 }]}
                placeholder="Search by name or email…"
                placeholderTextColor={colors.placeholder}
                value={userSearch}
                onChangeText={setUserSearch}
              />
              {filteredUsers.length > 0 && (
                <View style={styles.selectAllRow}>
                  <Text style={styles.selectedCount}>
                    {selectedUserIds.length} of {filteredUsers.length} selected
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const allIds = filteredUsers.map((u) => u.id);
                      const allSel = allIds.every((id) =>
                        selectedUserIds.includes(id),
                      );
                      setSelectedUserIds(
                        allSel
                          ? selectedUserIds.filter((id) => !allIds.includes(id))
                          : [...new Set([...selectedUserIds, ...allIds])],
                      );
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
                <Text style={styles.emptyPickerText}>No users found</Text>
              ) : (
                <ScrollViewWithDetection
                  style={{ maxHeight: 200 }}
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
                </ScrollViewWithDetection>
              )}
            </View>
          )}
        </View>

        {/* ─ Options ──────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBar} />
            <View style={styles.sectionIconWrap}>
              <Ionicons
                name="settings-outline"
                size={16}
                color={colors.accent}
              />
            </View>
            <Text style={styles.sectionTitle}>Options</Text>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchIconWrap}>
              <Ionicons name="mail-outline" size={20} color={colors.accent} />
            </View>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchLabel}>Also send via Email</Text>
              <Text style={styles.switchDesc}>
                Recipients get an email in addition to the in-app alert
              </Text>
            </View>
            <Switch
              value={sendEmail}
              onValueChange={setSendEmail}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ─ Send Button ──────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!canSend || sending) && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={!canSend || sending}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.sendBtnText}>Send Broadcast</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ─ Recent Broadcasts ─────────────────────────────────────────────── */}
        <View style={[styles.section, { marginTop: 24 }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBar} />
            <View style={styles.sectionIconWrap}>
              <Ionicons name="time-outline" size={16} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>Recent Broadcasts</Text>
          </View>

          {loadingHistory ? (
            <ActivityIndicator
              color={colors.accent}
              style={{ marginVertical: 24 }}
            />
          ) : history.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name="megaphone-outline"
                  size={30}
                  color={colors.textTertiary}
                />
              </View>
              <Text style={styles.emptyTitle}>No broadcasts yet</Text>
              <Text style={styles.emptySubtitle}>
                Compose your first message above
              </Text>
            </View>
          ) : (
            history.map(renderHistoryCard)
          )}
        </View>

        <View style={{ height: 48 }} />
      </ScrollViewWithDetection>

      {/* ── Detail Modal ─────────────────────────────────────────────────── */}
      <BroadcastDetailModal
        broadcast={selectedBroadcast}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        colors={colors}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // ── Hero ──
    hero: {
      backgroundColor: colors.headerBg,
      paddingTop: 16,
      paddingBottom: 28,
      paddingHorizontal: 20,
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    heroPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.accentSurface || "#9af2bb",
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
    },
    heroPillText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.headerBg,
    },
    heroBody: { gap: 4 },
    heroEyebrow: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 2,
      color: "rgba(255,255,255,0.55)",
      textTransform: "uppercase",
    },
    heroTitle: {
      fontSize: 30,
      fontWeight: "800",
      color: "#ffffff",
      lineHeight: 36,
    },
    heroSubtitle: {
      fontSize: 13,
      color: "rgba(255,255,255,0.60)",
      marginTop: 2,
    },

    // ── Scroll ──
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingTop: 20 },

    // ── Section Card ──
    section: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 6,
      elevation: 2,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    sectionBar: {
      width: 3,
      height: 18,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    sectionIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.accentLight,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },

    // ── Form ──
    label: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: colors.textTertiary,
      textTransform: "uppercase",
      marginBottom: 7,
      marginTop: 4,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1.5,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.inputText,
      marginBottom: 12,
    },
    textArea: { minHeight: 120, paddingTop: 12 },
    charCount: {
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: "right",
      marginTop: -8,
      marginBottom: 4,
    },

    // ── Target chips ──
    targetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    targetChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    targetChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    targetChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    targetChipTextActive: { color: colors.textOnAccent },

    // ── Sub-pickers ──
    subPicker: { marginTop: 14 },
    roomChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 20,
      borderWidth: 1.5,
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
    roomChipTextActive: { color: "#fff" },
    emptyPickerText: {
      fontSize: 13,
      color: colors.textTertiary,
      fontStyle: "italic",
    },

    // ── User list ──
    selectAllRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    selectedCount: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "600",
    },
    selectAllText: { fontSize: 13, fontWeight: "700", color: colors.accent },
    userRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 6,
      backgroundColor: colors.background,
    },
    userRowActive: {
      backgroundColor: colors.accentLight,
      borderColor: colors.accent,
    },
    userName: { fontSize: 14, fontWeight: "600", color: colors.text },
    userEmail: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },

    // ── Options ──
    switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    switchIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.accentLight,
      alignItems: "center",
      justifyContent: "center",
    },
    switchTextWrap: { flex: 1 },
    switchLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
    switchDesc: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
      lineHeight: 17,
    },

    // ── Send button ──
    sendBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.accent,
      paddingVertical: 17,
      borderRadius: 16,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
    sendBtnDisabled: { opacity: 0.45 },
    sendBtnText: {
      fontSize: 16,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0.4,
    },

    // ── Empty state ──
    emptyState: { alignItems: "center", paddingVertical: 28, gap: 6 },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    emptySubtitle: { fontSize: 13, color: colors.textTertiary },

    // ── History cards ──
    historyCard: {
      flexDirection: "row",
      borderRadius: 12,
      marginBottom: 10,
      backgroundColor: colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    historyStrip: { width: 4, backgroundColor: colors.accent },
    historyTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 5,
    },
    historyTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    historyDate: { fontSize: 11, color: colors.textTertiary },
    historyMessage: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
      marginBottom: 10,
    },
    historyFooter: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
    },
    historyBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: colors.accentLight,
    },
    historyBadgeText: { fontSize: 11, fontWeight: "600", color: colors.accent },
    tapHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      marginLeft: "auto",
    },
    tapHintText: { fontSize: 11, fontWeight: "600", color: colors.accent },
  });

export default AdminBroadcastScreen;
