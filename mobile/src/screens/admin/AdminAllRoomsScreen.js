import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Image,
  Modal,
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const SCREEN_WIDTH = Dimensions.get("window").width;

const AdminAllRoomsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [photoViewRoom, setPhotoViewRoom] = useState(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const fetchRooms = async () => {
    try {
      const response = await roomService.getAdminAllRooms();
      setRooms(response?.rooms || []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchRooms();
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      fetchRooms();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  }, []);

  const filteredRooms = rooms.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.name || "").toLowerCase().includes(q) ||
      (r.code || "").toLowerCase().includes(q) ||
      (r.creator?.name || "").toLowerCase().includes(q) ||
      (r.creator?.email || "").toLowerCase().includes(q)
    );
  });

  const stats = {
    totalRooms: rooms.length,
    totalMembers: rooms.reduce((acc, r) => acc + (r.memberCount || 0), 0),
    totalPayers: rooms.reduce((acc, r) => acc + (r.payerCount || 0), 0),
    activeRooms: rooms.filter((r) => r.billingCycle).length,
  };

  const handleDeleteRoom = (room) => {
    Alert.alert(
      "Delete Room",
      `Are you sure you want to delete "${room.name}"?\n\nThis will remove all members, billing cycles, and data. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await roomService.adminDeleteRoom(room.id);
              Alert.alert("Deleted", `Room "${room.name}" has been deleted.`);
              fetchRooms();
            } catch (error) {
              Alert.alert("Error", "Failed to delete room");
            }
          },
        },
      ],
    );
  };

  const renderRoom = ({ item: room }) => {
    const hasBilling = !!room.billingCycle;
    const roomPhotos = Array.isArray(room.photos)
      ? room.photos
      : typeof room.photos === "string"
        ? (() => {
            try {
              return JSON.parse(room.photos);
            } catch {
              return [];
            }
          })()
        : [];
    return (
      <TouchableOpacity
        style={styles.roomCard}
        onPress={() =>
          navigation.navigate("RoomDetail", {
            room,
          })
        }
        activeOpacity={0.7}
      >
        {roomPhotos.length > 0 && (
          <View>
            <Image
              source={{ uri: roomPhotos[0] }}
              style={styles.roomPhotoBanner}
              resizeMode="cover"
            />
            {/* Photo count badge + view button */}
            <View style={styles.photoBannerOverlay}>
              <View style={styles.photoCountBadge}>
                <Ionicons name="images" size={12} color="#fff" />
                <Text style={styles.photoCountText}>{roomPhotos.length}</Text>
              </View>
              <TouchableOpacity
                style={styles.photoViewBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  setActivePhotoIdx(0);
                  setPhotoViewRoom({ ...room, parsedPhotos: roomPhotos });
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="expand-outline" size={13} color="#fff" />
                <Text style={styles.photoViewBtnText}>View</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={styles.roomCardBody}>
          <View style={styles.roomHeader}>
            <View style={styles.roomIconWrap}>
              <Ionicons name="home-outline" size={20} color={colors.accent} />
            </View>
            <View style={styles.roomInfo}>
              <Text style={styles.roomName} numberOfLines={1}>
                {room.name}
              </Text>
              <Text style={styles.roomCode} numberOfLines={1}>
                {room.code}
              </Text>
            </View>
            <View style={styles.memberCountBadge}>
              <Ionicons name="people" size={14} color={colors.info} />
              <Text style={[styles.memberCountText, { color: colors.info }]}>
                {room.memberCount}
              </Text>
            </View>
          </View>

          {/* Creator Info */}
          <View style={styles.creatorRow}>
            <Ionicons
              name="person-circle-outline"
              size={16}
              color={colors.textTertiary}
            />
            <Text style={styles.creatorText}>
              Created by:{" "}
              <Text style={styles.creatorName}>
                {room.creator?.name || "Unknown"}
              </Text>
            </Text>
          </View>

          {/* Location Info */}
          {room.address ? (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={colors.accent} />
              <Text style={styles.locationText} numberOfLines={1}>
                {room.address}
              </Text>
            </View>
          ) : null}

          {/* Amenities & House Rules indicators */}
          {(Array.isArray(room.amenities) && room.amenities.length > 0) ||
          (Array.isArray(room.house_rules) && room.house_rules.length > 0) ? (
            <View style={styles.featureChipsRow}>
              {Array.isArray(room.amenities) && room.amenities.length > 0 && (
                <View style={styles.featureChip}>
                  <Ionicons name="sparkles" size={12} color="#8E44AD" />
                  <Text style={styles.featureChipText}>
                    {room.amenities.length} amenities
                  </Text>
                </View>
              )}
              {Array.isArray(room.house_rules) &&
                room.house_rules.length > 0 && (
                  <View style={styles.featureChip}>
                    <Ionicons
                      name="clipboard-outline"
                      size={12}
                      color="#E67E22"
                    />
                    <Text style={styles.featureChipText}>
                      {room.house_rules.length} rules
                    </Text>
                  </View>
                )}
            </View>
          ) : null}

          {/* Stats Row */}
          <View style={styles.roomStatsRow}>
            <View style={styles.roomStat}>
              <Text style={styles.roomStatValue}>{room.memberCount}</Text>
              <Text style={styles.roomStatLabel}>Members</Text>
            </View>
            <View style={styles.roomStatDivider} />
            <View style={styles.roomStat}>
              <Text style={styles.roomStatValue}>{room.payerCount}</Text>
              <Text style={styles.roomStatLabel}>Payers</Text>
            </View>
            <View style={styles.roomStatDivider} />
            <View style={styles.roomStat}>
              <View
                style={[
                  styles.billingBadge,
                  {
                    backgroundColor: hasBilling
                      ? colors.successBg
                      : colors.warningBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.billingBadgeText,
                    { color: hasBilling ? colors.success : colors.warning },
                  ]}
                >
                  {hasBilling ? "Active" : "None"}
                </Text>
              </View>
              <Text style={styles.roomStatLabel}>Billing</Text>
            </View>
            <View style={styles.roomStatDivider} />
            <View style={styles.roomStat}>
              <Text style={styles.roomStatValue}>
                {room.created_at
                  ? new Date(room.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "N/A"}
              </Text>
              <Text style={styles.roomStatLabel}>Created</Text>
            </View>
          </View>

          {/* Actions row */}
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.viewDetailsBtn}
              onPress={() =>
                navigation.navigate("RoomDetail", {
                  room,
                })
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={colors.accent}
              />
              <Text style={styles.viewDetailsText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteRoomBtn}
              onPress={() => handleDeleteRoom(room)}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading rooms...</Text>
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
        <Text style={styles.headerTitle}>All Rooms</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Stats */}
      <View style={styles.topStatsRow}>
        <View style={[styles.topStatCard, { backgroundColor: colors.infoBg }]}>
          <Ionicons name="home" size={18} color={colors.info} />
          <Text style={[styles.topStatValue, { color: colors.info }]}>
            {stats.totalRooms}
          </Text>
          <Text style={styles.topStatLabel}>Rooms</Text>
        </View>
        <View
          style={[styles.topStatCard, { backgroundColor: colors.successBg }]}
        >
          <Ionicons name="people" size={18} color={colors.success} />
          <Text style={[styles.topStatValue, { color: colors.success }]}>
            {stats.totalMembers}
          </Text>
          <Text style={styles.topStatLabel}>Members</Text>
        </View>
        <View
          style={[styles.topStatCard, { backgroundColor: colors.warningBg }]}
        >
          <Ionicons name="wallet" size={18} color={colors.warning} />
          <Text style={[styles.topStatValue, { color: colors.warning }]}>
            {stats.totalPayers}
          </Text>
          <Text style={styles.topStatLabel}>Payers</Text>
        </View>
        <View
          style={[styles.topStatCard, { backgroundColor: colors.purpleBg }]}
        >
          <Ionicons
            name="pulse"
            size={18}
            color={colors.internetColor || "#8E44AD"}
          />
          <Text
            style={[
              styles.topStatValue,
              { color: colors.internetColor || "#8E44AD" },
            ]}
          >
            {stats.activeRooms}
          </Text>
          <Text style={styles.topStatLabel}>Active</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search rooms, codes, or owners..."
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

      {/* Rooms List */}
      <FlatList
        data={filteredRooms}
        renderItem={renderRoom}
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
              name="home-outline"
              size={48}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyText}>No rooms found</Text>
          </View>
        }
      />

      {/* Full-screen photo viewer modal */}
      <Modal
        visible={!!photoViewRoom}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewRoom(null)}
      >
        <View style={styles.photoModalBg}>
          {/* Header */}
          <View style={styles.photoModalHeader}>
            <TouchableOpacity
              style={styles.photoModalBackBtn}
              onPress={() => setPhotoViewRoom(null)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.photoModalTitle} numberOfLines={1}>
              {photoViewRoom?.name || "Photos"}
            </Text>
            <Text style={styles.photoModalCount}>
              {activePhotoIdx + 1} / {photoViewRoom?.parsedPhotos?.length || 0}
            </Text>
          </View>

          {/* Photos */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            onScroll={(e) => {
              const idx = Math.round(
                e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
              );
              setActivePhotoIdx(idx);
            }}
            scrollEventThrottle={16}
          >
            {(photoViewRoom?.parsedPhotos || []).map((uri, idx) => (
              <Image
                key={idx}
                source={{ uri }}
                style={styles.photoModalImg}
                resizeMode="contain"
              />
            ))}
          </ScrollView>

          {/* Dot indicators */}
          {(photoViewRoom?.parsedPhotos?.length || 0) > 1 && (
            <View style={styles.photoModalDotRow}>
              {photoViewRoom.parsedPhotos.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.photoModalDot,
                    idx === activePhotoIdx && styles.photoModalDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
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
    topStatsRow: {
      flexDirection: "row",
      paddingHorizontal: 12,
      gap: 8,
      marginBottom: 12,
    },
    topStatCard: {
      flex: 1,
      borderRadius: 12,
      padding: 10,
      alignItems: "center",
      gap: 3,
    },
    topStatValue: {
      fontSize: 17,
      fontWeight: "800",
    },
    topStatLabel: {
      fontSize: 9,
      fontWeight: "600",
      color: colors.textTertiary,
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
      marginBottom: 12,
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
    listContent: {
      paddingHorizontal: 12,
      paddingBottom: 32,
    },
    roomCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      marginBottom: 10,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
    roomCardBody: {
      padding: 16,
    },
    roomHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    roomIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accentLight,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    roomInfo: {
      flex: 1,
    },
    roomName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    roomCode: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    memberCountBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.infoBg,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    memberCountText: {
      fontSize: 13,
      fontWeight: "700",
    },
    creatorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 12,
      paddingLeft: 4,
    },
    creatorText: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    creatorName: {
      fontWeight: "600",
      color: colors.text,
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 4,
      paddingBottom: 10,
    },
    locationText: {
      fontSize: 12,
      color: colors.accent,
      fontWeight: "500",
      flex: 1,
    },
    featureChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: 4,
      paddingBottom: 10,
    },
    featureChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.cardAlt || colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    featureChipText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    roomStatsRow: {
      flexDirection: "row",
      backgroundColor: colors.cardAlt || colors.background,
      borderRadius: 10,
      padding: 10,
      marginBottom: 10,
    },
    roomStat: {
      flex: 1,
      alignItems: "center",
    },
    roomStatDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 2,
    },
    roomStatValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    roomStatLabel: {
      fontSize: 9,
      fontWeight: "600",
      color: colors.textTertiary,
      marginTop: 2,
    },
    billingBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    billingBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    cardActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight || colors.border,
    },
    viewDetailsBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    viewDetailsText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },
    deleteRoomBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.errorBg,
      justifyContent: "center",
      alignItems: "center",
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
    roomPhotoBanner: {
      width: "100%",
      height: 140,
    },
    photoBannerOverlay: {
      position: "absolute",
      bottom: 8,
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
    photoViewBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(0,0,0,0.55)",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    photoViewBtnText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#fff",
    },
    /* Full-screen photo viewer */
    photoModalBg: {
      flex: 1,
      backgroundColor: "#000",
    },
    photoModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: Platform.OS === "ios" ? 54 : 36,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    photoModalBackBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.15)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    photoModalTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
    },
    photoModalCount: {
      fontSize: 13,
      fontWeight: "600",
      color: "rgba(255,255,255,0.7)",
    },
    photoModalImg: {
      width: SCREEN_WIDTH,
      height: "100%",
    },
    photoModalDotRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
      paddingTop: 12,
      gap: 6,
    },
    photoModalDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: "rgba(255,255,255,0.35)",
    },
    photoModalDotActive: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: "#fff",
    },
  });

export default AdminAllRoomsScreen;
