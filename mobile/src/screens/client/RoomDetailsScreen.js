import React, { useState, useEffect, useContext, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  RefreshControl,
  Image,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import { AuthContext } from "../../context/AuthContext";
import { roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const WATER_BILL_PER_DAY = 5;

const AMENITY_MAP = {
  wifi: { icon: "wifi", label: "WiFi", bg: "#e3f2fd", color: "#1976d2" },
  kitchen: {
    icon: "restaurant",
    label: "Kitchen",
    bg: "#fff3e0",
    color: "#e65100",
  },
  bathroom: {
    icon: "water",
    label: "Bathroom",
    bg: "#e3f2fd",
    color: "#0288d1",
  },
  bedroom: { icon: "bed", label: "Bedroom", bg: "#fce4ec", color: "#c62828" },
  hotwater: {
    icon: "flame",
    label: "Hot Water",
    bg: "#fff8e1",
    color: "#ef6c00",
  },
  parking: { icon: "car", label: "Parking", bg: "#e8f5e9", color: "#2e7d32" },
  aircon: { icon: "snow", label: "Air-con", bg: "#e3f2fd", color: "#0277bd" },
  laundry: { icon: "shirt", label: "Laundry", bg: "#f3e5f5", color: "#6a1b9a" },
  tv: { icon: "tv", label: "TV", bg: "#eceff1", color: "#37474f" },
  cctv: { icon: "videocam", label: "CCTV", bg: "#eceff1", color: "#455a64" },
  common: {
    icon: "people",
    label: "Common Area",
    bg: "#e8f5e9",
    color: "#388e3c",
  },
  gym: { icon: "barbell", label: "Gym", bg: "#fbe9e7", color: "#d84315" },
};

const RoomDetailsScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets);

  const { roomId } = route.params;
  const { state } = useContext(AuthContext);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFullMap, setShowFullMap] = useState(false);
  const [photoViewVisible, setPhotoViewVisible] = useState(false);
  const [photoViewIdx, setPhotoViewIdx] = useState(0);

  useEffect(() => {
    fetchRoomDetails();
  }, [roomId]);

  // Refetch whenever user profile changes (name or avatar)
  useEffect(() => {
    fetchRoomDetails();
  }, [state.user?.name, state.user?.avatar?.url]);

  const fetchRoomDetails = async () => {
    try {
      setLoading(true);
      const roomResponse = await roomService.getRoomById(roomId);
      const roomData = roomResponse.data || roomResponse;

      // Extract the room object (it might be wrapped)
      const room = roomData.room || roomData;
      setRoom(room);
    } catch (error) {
      console.error("Error fetching room details:", error.message);
      Alert.alert("Error", "Failed to load room details");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRoomDetails();
    setRefreshing(false);
  };

  const handleShareRoom = async () => {
    try {
      const roomCode = room?.code || "N/A";
      await Share.share({
        message: `Join my apartment room! Room Code: ${roomCode}`,
        title: room?.name,
      });
    } catch (error) {
      console.error("Error sharing room:", error);
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString();
  };

  const calculateTotalWaterBill = () => {
    if (!room?.members) return 0;
    const start = room?.billing?.start;
    const end = room?.billing?.end;
    let totalDays = 0;
    room.members.forEach((member) => {
      const presenceArr = Array.isArray(member.presence) ? member.presence : [];
      if (start && end) {
        const s = new Date(start);
        s.setHours(0, 0, 0, 0);
        const e = new Date(end);
        e.setHours(23, 59, 59, 999);
        totalDays += presenceArr.filter((day) => {
          const d = new Date(day);
          return d >= s && d <= e;
        }).length;
      } else {
        totalDays += presenceArr.length;
      }
    });
    return totalDays * WATER_BILL_PER_DAY;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.textSecondary}
        />
        <Text style={styles.errText}>Room not found</Text>
      </View>
    );
  }

  const billing = {
    billing: room.billing,
    members: room.members,
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ─── HEADER ─── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerIcon}>
              <Ionicons name="home" size={22} color={colors.accent} />
            </View>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShareRoom}>
              <Ionicons name="share-outline" size={18} color={colors.accent} />
            </TouchableOpacity>
          </View>
          <Text style={styles.roomName}>{room.name}</Text>
          <View style={styles.codePill}>
            <Ionicons name="key-outline" size={13} color={colors.accent} />
            <Text style={styles.codeText}>Code: {room.code}</Text>
          </View>
        </View>

        {/* ─── DESCRIPTION ─── */}
        {room.description && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.accent}
              />
              <Text style={styles.cardTitle}>About</Text>
            </View>
            <Text style={styles.descText}>{room.description}</Text>
          </View>
        )}

        {/* ─── PHOTO GALLERY ─── */}
        {(() => {
          const photos = Array.isArray(room.photos) ? room.photos : [];
          if (photos.length === 0) return null;
          const galWidth = SCREEN_WIDTH - 32;
          return (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="images" size={18} color={colors.accent} />
                <Text style={styles.cardTitle}>Photos</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{photos.length}</Text>
                </View>
              </View>
              <View style={{ position: "relative" }}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={styles.galScroll}
                  onScroll={(e) => {
                    const idx = Math.round(
                      e.nativeEvent.contentOffset.x / galWidth,
                    );
                    setPhotoViewIdx(idx);
                  }}
                  scrollEventThrottle={16}
                >
                  {photos.map((uri, idx) => (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.9}
                      onPress={() => {
                        setPhotoViewIdx(idx);
                        setPhotoViewVisible(true);
                      }}
                    >
                      <Image
                        source={{ uri }}
                        style={[styles.galPhoto, { width: galWidth }]}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {/* Overlay badge */}
                <View style={styles.galOverlay}>
                  <TouchableOpacity
                    style={styles.galExpandBtn}
                    onPress={() => {
                      setPhotoViewIdx(0);
                      setPhotoViewVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="expand-outline" size={13} color="#fff" />
                    <Text style={styles.galExpandText}>View</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {photos.length > 1 && (
                <View style={styles.galDotRow}>
                  {photos.map((_, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.galDot,
                        idx === photoViewIdx && styles.galDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })()}

        {/* ─── LOCATION MAP ─── */}
        {room.latitude != null && room.longitude != null && (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => setShowFullMap(true)}
          >
            <View style={styles.cardTitleRow}>
              <Ionicons name="location" size={18} color={colors.accent} />
              <Text style={styles.cardTitle}>Location</Text>
              <Ionicons
                name="expand-outline"
                size={16}
                color={colors.accent}
                style={{ marginLeft: "auto" }}
              />
            </View>
            <View style={styles.mapPreviewWrap}>
              <MapView
                style={styles.mapPreview}
                initialRegion={{
                  latitude: parseFloat(room.latitude),
                  longitude: parseFloat(room.longitude),
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                liteMode={true}
              >
                <Marker
                  coordinate={{
                    latitude: parseFloat(room.latitude),
                    longitude: parseFloat(room.longitude),
                  }}
                />
              </MapView>
            </View>
            {room.address ? (
              <View style={styles.mapAddressRow}>
                <Ionicons name="location" size={14} color={colors.accent} />
                <Text style={styles.mapAddressText} numberOfLines={2}>
                  {room.address}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )}

        {/* ─── AMENITIES ─── */}
        {(() => {
          const amenities = Array.isArray(room.amenities) ? room.amenities : [];
          if (amenities.length === 0) return null;
          return (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="sparkles" size={18} color={colors.accent} />
                <Text style={styles.cardTitle}>Amenities</Text>
              </View>
              <View style={styles.amenitiesGrid}>
                {amenities.map((key, idx) => {
                  const a = AMENITY_MAP[key] || {
                    icon: "ellipse",
                    label: key,
                    bg: colors.inputBg,
                    color: colors.textTertiary,
                  };
                  return (
                    <View key={idx} style={styles.amenityItem}>
                      <View
                        style={[styles.amenityIcon, { backgroundColor: a.bg }]}
                      >
                        <Ionicons name={a.icon} size={20} color={a.color} />
                      </View>
                      <Text style={styles.amenityLabel}>{a.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })()}

        {/* ─── HOUSE RULES ─── */}
        {(() => {
          const rules = Array.isArray(room.houseRules || room.house_rules)
            ? room.houseRules || room.house_rules
            : [];
          if (rules.length === 0) return null;
          return (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons
                  name="clipboard-outline"
                  size={18}
                  color={colors.accent}
                />
                <Text style={styles.cardTitle}>House Rules</Text>
              </View>
              {rules.map((rule, idx) => (
                <View key={idx} style={styles.ruleRow}>
                  <View style={styles.ruleCheck}>
                    <Ionicons
                      name="checkmark"
                      size={12}
                      color={colors.textOnAccent}
                    />
                  </View>
                  <Text style={styles.ruleText}>{rule}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {/* ─── BILLING SUMMARY ─── */}
        {billing?.billing?.start && billing?.billing?.end ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons
                name="receipt-outline"
                size={18}
                color={colors.accent}
              />
              <Text style={styles.cardTitle}>Billing Summary</Text>
            </View>

            {/* Period strip */}
            <View style={styles.periodStrip}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.periodText}>
                {formatDate(billing.billing.start)} —{" "}
                {formatDate(billing.billing.end)}
              </Text>
            </View>

            {/* Bill rows */}
            {[
              {
                label: "Rent",
                icon: "home",
                color: "#e65100",
                value: billing.billing.rent,
              },
              {
                label: "Electricity",
                icon: "flash",
                color: colors.electricityColor,
                value: billing.billing.electricity,
              },
              {
                label: "Water",
                icon: "water",
                color: colors.waterColor,
                value: calculateTotalWaterBill(),
              },
              {
                label: "Internet",
                icon: "wifi",
                color: colors.internetColor,
                value: billing.billing.internet,
              },
            ].map((item, idx) => (
              <View key={idx} style={styles.billRow}>
                <View style={styles.billRowLeft}>
                  <View
                    style={[styles.billDot, { backgroundColor: item.color }]}
                  />
                  <Ionicons name={item.icon} size={16} color={item.color} />
                  <Text style={styles.billLabel}>{item.label}</Text>
                </View>
                <Text style={styles.billValue}>
                  ₱
                  {parseFloat(item.value || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
            ))}

            {/* Grand total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalValue}>
                ₱
                {(
                  parseFloat(billing.billing.rent || 0) +
                  parseFloat(billing.billing.electricity || 0) +
                  calculateTotalWaterBill() +
                  parseFloat(billing.billing.internet || 0)
                ).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.detailsBtn}
              onPress={() => navigation.navigate("BillsStack")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="document-text-outline"
                size={16}
                color={colors.accent}
              />
              <Text style={styles.detailsBtnText}>
                View Full Billing Details
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.accent}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons
                name="receipt-outline"
                size={18}
                color={colors.accent}
              />
              <Text style={styles.cardTitle}>Billing Summary</Text>
            </View>
            <View style={styles.emptyState}>
              <Ionicons
                name="time-outline"
                size={32}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>No Active Billing Cycle</Text>
            </View>
          </View>
        )}

        {/* ─── MEMBERS ─── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="people" size={18} color={colors.accent} />
            <Text style={styles.cardTitle}>Members</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {room.members?.length || 0}
              </Text>
            </View>
          </View>

          {room.members && room.members.length > 0 ? (
            room.members.map((member, index) => (
              <View key={index}>
                <View style={styles.memberRow}>
                  <View style={styles.memberLeft}>
                    {member.user?.avatar?.url ? (
                      <Image
                        source={{ uri: member.user.avatar.url }}
                        style={styles.memberAvatar}
                      />
                    ) : (
                      <View style={styles.memberAvatarFallback}>
                        <Text style={styles.memberAvatarLetter}>
                          {(member.user?.name || "U").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.memberName}>
                      {member.user?.name || "Unknown"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.rolePill,
                      member.isPayer
                        ? { backgroundColor: colors.successBg }
                        : { backgroundColor: colors.inputBg },
                    ]}
                  >
                    <Ionicons
                      name={member.isPayer ? "checkmark-circle" : "person"}
                      size={12}
                      color={
                        member.isPayer ? colors.success : colors.textTertiary
                      }
                    />
                    <Text
                      style={[
                        styles.rolePillText,
                        member.isPayer
                          ? { color: colors.success }
                          : { color: colors.textTertiary },
                      ]}
                    >
                      {member.isPayer ? "Payor" : "Non-Payor"}
                    </Text>
                  </View>
                </View>
                {index < room.members.length - 1 && (
                  <View style={styles.divider} />
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="person-add-outline"
                size={32}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>No members yet</Text>
            </View>
          )}
        </View>

        {/* ─── QUICK ACTIONS ─── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionPrimary}
            onPress={() =>
              navigation.navigate("Presence", { roomId: room.id || room._id })
            }
            activeOpacity={0.7}
          >
            <Ionicons name="calendar" size={18} color={colors.textOnAccent} />
            <Text style={styles.actionPrimaryText}>Mark Presence</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionOutline}
            onPress={() => navigation.navigate("BillsStack")}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={18} color={colors.accent} />
            <Text style={styles.actionOutlineText}>View Billing</Text>
          </TouchableOpacity>
        </View>

        {/* ─── FOOTER INFO ─── */}
        <View style={styles.footerInfo}>
          <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
          <Text style={styles.footerText}>
            Created {formatDate(room.created_at || room.createdAt)}
          </Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ─── FULL-SCREEN MAP MODAL ─── */}
      {room.latitude != null && room.longitude != null && (
        <Modal
          visible={showFullMap}
          animationType="slide"
          onRequestClose={() => setShowFullMap(false)}
        >
          <View style={{ flex: 1 }}>
            <MapView
              style={StyleSheet.absoluteFillObject}
              initialRegion={{
                latitude: parseFloat(room.latitude),
                longitude: parseFloat(room.longitude),
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              showsUserLocation
              showsMyLocationButton
            >
              <Marker
                coordinate={{
                  latitude: parseFloat(room.latitude),
                  longitude: parseFloat(room.longitude),
                }}
                title={room.name}
                description={room.address || ""}
              />
            </MapView>
            {/* Floating Header */}
            <View style={styles.fullMapHeader}>
              <TouchableOpacity
                style={styles.fullMapBackBtn}
                onPress={() => setShowFullMap(false)}
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.fullMapTitle} numberOfLines={1}>
                {room.name}
              </Text>
            </View>
            {/* Floating Address */}
            {room.address ? (
              <View style={styles.fullMapAddressBar}>
                <Ionicons name="location" size={16} color={colors.accent} />
                <Text style={styles.fullMapAddressText} numberOfLines={2}>
                  {room.address}
                </Text>
              </View>
            ) : null}
          </View>
        </Modal>
      )}

      {/* ─── FULL-SCREEN PHOTO VIEWER ─── */}
      <Modal
        visible={photoViewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewVisible(false)}
      >
        <View style={styles.pvBg}>
          <View style={styles.pvHeader}>
            <TouchableOpacity
              style={styles.pvCloseBtn}
              onPress={() => setPhotoViewVisible(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.pvTitle} numberOfLines={1}>
              {room?.name || "Photos"}
            </Text>
            <Text style={styles.pvCount}>
              {photoViewIdx + 1} / {(room?.photos || []).length}
            </Text>
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentOffset={{ x: photoViewIdx * SCREEN_WIDTH, y: 0 }}
            onScroll={(e) => {
              const idx = Math.round(
                e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
              );
              setPhotoViewIdx(idx);
            }}
            scrollEventThrottle={16}
          >
            {(room?.photos || []).map((uri, idx) => (
              <Image
                key={idx}
                source={{ uri }}
                style={styles.pvImg}
                resizeMode="contain"
              />
            ))}
          </ScrollView>
          {(room?.photos?.length || 0) > 1 && (
            <View style={styles.pvDotRow}>
              {room.photos.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.pvDot,
                    idx === photoViewIdx && styles.pvDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </Modal>
    </>
  );
};

const createStyles = (colors, insets = { bottom: 0 }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    errText: {
      fontSize: 15,
      color: colors.textTertiary,
      marginTop: 10,
    },

    /* ─── Header ─── */
    header: {
      backgroundColor: colors.card,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      marginBottom: 6,
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    headerIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
    },
    shareBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
    },
    roomName: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
    },
    codePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: colors.accentSurface,
    },
    codeText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },

    /* ─── Cards ─── */
    card: {
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
    },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },

    /* ─── Description ─── */
    descText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
    },

    /* ─── Billing ─── */
    periodStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.cardAlt,
      borderRadius: 8,
      marginBottom: 12,
    },
    periodText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    billRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    billRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    billDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    billLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    billValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    totalValue: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.success,
    },
    detailsBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      backgroundColor: colors.accentSurface,
      borderRadius: 10,
      marginTop: 10,
    },
    detailsBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },

    /* ─── Members ─── */
    countBadge: {
      backgroundColor: colors.inputBg,
      paddingHorizontal: 9,
      paddingVertical: 2,
      borderRadius: 10,
    },
    countBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
    },
    memberLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    memberAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.inputBg,
    },
    memberAvatarFallback: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
    },
    memberAvatarLetter: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.accent,
    },
    memberName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    rolePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    rolePillText: {
      fontSize: 11,
      fontWeight: "600",
    },
    divider: {
      height: 1,
      backgroundColor: colors.inputBg,
    },

    /* ─── Amenities ─── */
    amenitiesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    amenityItem: {
      width: "30%",
      alignItems: "center",
      marginBottom: 4,
    },
    amenityIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    amenityLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.textSecondary,
      textAlign: "center",
    },

    /* ─── House Rules ─── */
    ruleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 10,
    },
    ruleCheck: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.success,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 1,
    },
    ruleText: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },

    /* ─── Quick Actions ─── */
    actionsRow: {
      flexDirection: "row",
      gap: 10,
      marginHorizontal: 16,
      marginTop: 14,
    },
    actionPrimary: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
    },
    actionPrimaryText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
    },
    actionOutline: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionOutlineText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "600",
    },

    /* ─── Footer ─── */
    footerInfo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 16,
    },
    footerText: {
      fontSize: 12,
      color: colors.textTertiary,
    },

    /* ─── Empty State ─── */
    emptyState: {
      alignItems: "center",
      paddingVertical: 20,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 8,
    },

    /* ─── Map ─── */
    mapPreviewWrap: {
      borderRadius: 12,
      overflow: "hidden",
      marginTop: 10,
    },
    mapPreview: {
      width: "100%",
      height: 160,
    },
    mapAddressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
    },
    mapAddressText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
    },
    fullMapHeader: {
      position: "absolute",
      top: 50,
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    fullMapBackBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      alignItems: "center",
    },
    fullMapTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: "700",
      color: "#fff",
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    fullMapAddressBar: {
      position: "absolute",
      bottom: Math.max(30, insets.bottom + 12),
      left: 16,
      right: 16,
      backgroundColor: colors.card,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
        },
        android: { elevation: 6 },
      }),
    },
    fullMapAddressText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
    },

    /* ─── Photo Gallery ─── */
    galScroll: {
      borderRadius: 10,
      overflow: "hidden",
    },
    galPhoto: {
      height: 200,
      borderRadius: 10,
    },
    galOverlay: {
      position: "absolute",
      bottom: 8,
      right: 8,
      flexDirection: "row",
      gap: 6,
    },
    galExpandBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(0,0,0,0.55)",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    galExpandText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "600",
    },
    galDotRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 5,
      marginTop: 8,
    },
    galDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    galDotActive: {
      backgroundColor: colors.accent,
      width: 14,
    },

    /* ─── Fullscreen Photo Viewer ─── */
    pvBg: {
      flex: 1,
      backgroundColor: "#000",
    },
    pvHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: Platform.OS === "ios" ? 54 : 38,
      paddingHorizontal: 16,
      paddingBottom: 10,
      gap: 12,
    },
    pvCloseBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(255,255,255,0.15)",
      justifyContent: "center",
      alignItems: "center",
    },
    pvTitle: {
      flex: 1,
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    pvCount: {
      color: "rgba(255,255,255,0.6)",
      fontSize: 13,
    },
    pvImg: {
      width: SCREEN_WIDTH,
      height: "100%",
    },
    pvDotRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 5,
      paddingBottom: Math.max(24, insets.bottom + 8),
    },
    pvDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.35)",
    },
    pvDotActive: {
      backgroundColor: "#fff",
      width: 14,
    },
  });

export default RoomDetailsScreen;
