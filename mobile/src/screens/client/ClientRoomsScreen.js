import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  TextInput,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CARD_GAP = 12;
const H_PADDING = 16;
const VISIBLE_CARD_UNITS = 1.75;
const MIN_CARD_WIDTH = 210;

const safeRoom = (room = {}) => ({
  id: room.id || room._id,
  _id: room._id || room.id,
  name: room.name,
  description: room.description,
  address: room.address,
  city: room.city,
  barangay: room.barangay,
  rent: room.rent,
  price: room.price,
  monthlyRent: room.monthlyRent,
  photos: Array.isArray(room.photos) ? room.photos : [],
  amenities: Array.isArray(room.amenities) ? room.amenities : [],
  houseRules: Array.isArray(room.houseRules || room.house_rules)
    ? room.houseRules || room.house_rules
    : [],
  latitude: room.latitude,
  longitude: room.longitude,
});

const ClientRoomsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = useMemo(() => {
    const availableWidth = screenWidth - H_PADDING * 2 - CARD_GAP;
    return Math.max(
      MIN_CARD_WIDTH,
      Math.floor(availableWidth / VISIBLE_CARD_UNITS),
    );
  }, [screenWidth]);
  const styles = createStyles(colors, insets, cardWidth);

  const [rooms, setRooms] = useState([]);
  const [joinedRoomIds, setJoinedRoomIds] = useState([]);
  const [pendingRoomIds, setPendingRoomIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const getRoomId = (room) => String(room?.id || room?._id || "");

  const fetchRooms = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const [availableResponse, clientResponse] = await Promise.all([
        roomService.getAvailableRooms(),
        roomService.getClientRooms().catch(() => ({ rooms: [] })),
      ]);

      const availableData = availableResponse?.data || availableResponse || {};
      const clientData = clientResponse?.data || clientResponse || {};
      const allRooms = availableData.rooms || availableData || [];
      const myRooms = clientData.rooms || clientData || [];

      setRooms((Array.isArray(allRooms) ? allRooms : []).map(safeRoom));
      setJoinedRoomIds((Array.isArray(myRooms) ? myRooms : []).map(getRoomId));
      setPendingRoomIds((availableData.pendingRoomIds || []).map(String));
    } catch (error) {
      console.error("Error loading rooms:", error);
      setRooms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRooms(true);
    }, [fetchRooms]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRooms(false);
  }, [fetchRooms]);

  const getAddressParts = (room) => {
    const parts = String(room.address || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    const labelledBarangay = parts.find((part) =>
      /^(brgy\.?|barangay)\s/i.test(part),
    );
    const labelledCity = parts.find((part) => /city/i.test(part));
    const inferredBarangay = labelledBarangay || room.barangay || parts[0];
    const inferredCity = labelledCity || room.city || parts[1];

    return {
      barangay: inferredBarangay || "Barangay not set",
      city: inferredCity || "City not set",
      hasBarangay: Boolean(room.barangay || labelledBarangay || parts[0]),
      hasCity: Boolean(room.city || labelledCity || parts[1]),
    };
  };

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((room) => {
      const { city, barangay } = getAddressParts(room);
      const haystack = [
        room.name,
        room.address,
        room.description,
        city,
        barangay,
        ...(Array.isArray(room.amenities) ? room.amenities : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, rooms]);

  const stats = useMemo(() => {
    const available = rooms.filter(
      (room) =>
        !joinedRoomIds.includes(getRoomId(room)) &&
        !pendingRoomIds.includes(getRoomId(room)),
    ).length;

    return {
      total: rooms.length,
      joined: joinedRoomIds.length,
      available,
    };
  }, [joinedRoomIds, pendingRoomIds, rooms]);

  const featuredRooms = useMemo(() => {
    const featured = filteredRooms.filter(
      (room) =>
        room.photos?.length > 0 ||
        Number(getRoomPrice(room)) > 0 ||
        Boolean(room.description),
    );
    const source = featured.length > 0 ? featured : filteredRooms;

    return [...source].sort((a, b) => {
      const aScore =
        (a.photos?.length || 0) +
        (Number(getRoomPrice(a)) > 0 ? 1 : 0) +
        (a.description ? 1 : 0);
      const bScore =
        (b.photos?.length || 0) +
        (Number(getRoomPrice(b)) > 0 ? 1 : 0) +
        (b.description ? 1 : 0);
      return bScore - aScore;
    });
  }, [filteredRooms]);

  const cityRooms = useMemo(
    () =>
      filteredRooms
        .filter((room) => getAddressParts(room).hasCity)
        .sort((a, b) =>
          getAddressParts(a).city.localeCompare(getAddressParts(b).city),
        ),
    [filteredRooms],
  );

  const barangayRooms = useMemo(
    () =>
      filteredRooms
        .filter((room) => getAddressParts(room).hasBarangay)
        .sort((a, b) =>
          getAddressParts(a).barangay.localeCompare(
            getAddressParts(b).barangay,
          ),
        ),
    [filteredRooms],
  );

  const formatCurrency = (value) => {
    const amount = Number(value || 0);
    if (!amount) return "Ask";
    return `\u20B1${amount.toLocaleString()}`;
  };

  function getRoomPrice(room) {
    return room.rent || room.price || room.monthlyRent;
  }

  const getStatus = (roomId) => {
    if (joinedRoomIds.includes(roomId)) return "Joined";
    if (pendingRoomIds.includes(roomId)) return "Pending";
    return "Available";
  };

  const openRoom = (room) => {
    navigation.navigate("RoomView", {
      roomId: getRoomId(room),
      room: safeRoom(room),
    });
  };

  const renderRoomCard = (room, sectionType) => {
    const roomId = getRoomId(room);
    const photos = Array.isArray(room.photos) ? room.photos : [];
    const status = getStatus(roomId);
    const { city, barangay } = getAddressParts(room);
    const areaLabel = sectionType === "barangay" ? barangay : city;
    const amenities = Array.isArray(room.amenities)
      ? room.amenities.slice(0, 2)
      : [];

    return (
      <TouchableOpacity
        key={`${sectionType}-${roomId}`}
        style={styles.roomCard}
        activeOpacity={0.86}
        onPress={() => openRoom(room)}
      >
        <View style={styles.photoWrap}>
          {photos.length > 0 ? (
            <Image
              source={{ uri: photos[0] }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="home-outline" size={30} color={colors.accent} />
            </View>
          )}
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.roomName} numberOfLines={2}>
            {room.name || "Unnamed room"}
          </Text>
          <View style={styles.areaRow}>
            <Ionicons
              name="location-outline"
              size={12}
              color={colors.textTertiary}
            />
            <Text style={styles.areaText} numberOfLines={1}>
              {areaLabel}
            </Text>
          </View>
          <Text style={styles.description} numberOfLines={1}>
            {room.description || "Quiet, practical space ready to view."}
          </Text>
          {amenities.length > 0 && (
            <View style={styles.amenityRow}>
              {amenities.map((amenity) => (
                <View key={amenity} style={styles.amenityChip}>
                  <Text style={styles.amenityChipText} numberOfLines={1}>
                    {amenity}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.cardFooter}>
            <Text style={styles.priceText}>
              {formatCurrency(getRoomPrice(room))}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.accent} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (title, subtitle, data, sectionType) => {
    const sectionRooms = data.slice(0, 12);

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionSubtitle}>{subtitle}</Text>
          </View>
          <View style={styles.sectionCountPill}>
            <Text style={styles.sectionCountText}>{sectionRooms.length}</Text>
          </View>
        </View>

        {sectionRooms.length === 0 ? (
          <View style={styles.sectionEmpty}>
            <Ionicons name="leaf-outline" size={22} color={colors.accent} />
            <Text style={styles.sectionEmptyText}>
              No rooms in this section
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            snapToInterval={cardWidth + CARD_GAP}
            decelerationRate="fast"
          >
            {sectionRooms.map((room) => renderRoomCard(room, sectionType))}
          </ScrollView>
        )}
      </View>
    );
  };

  if (loading && rooms.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading properties...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="home" size={24} color={colors.textOnAccent} />
          </View>
          <Text style={styles.heroEyebrow}>Forest rooms</Text>
          <Text style={styles.heroTitle}>Rooms</Text>
          <Text style={styles.heroSubtitle}>
            Fresh room previews from cities and barangays near you.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.available}</Text>
              <Text style={styles.statLabel}>Open</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.joined}</Text>
              <Text style={styles.statLabel}>Joined</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textTertiary}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search rooms, cities, barangays"
            placeholderTextColor={colors.placeholder || colors.textTertiary}
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>

        {renderSection(
          "Featured Rooms",
          "Photo-rich spaces and strong public listings.",
          featuredRooms,
          "featured",
        )}
        {renderSection(
          "Rooms by City",
          "City-focused picks from the current room list.",
          cityRooms,
          "city",
        )}
        {renderSection(
          "Rooms by Barangay",
          "Neighborhood-level options from room addresses.",
          barangayRooms,
          "barangay",
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors, insets, cardWidth) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 12,
      color: colors.textTertiary,
      fontSize: 13,
      fontWeight: "600",
    },
    scrollContent: {
      paddingBottom: Math.max(28, insets.bottom + 24),
    },
    hero: {
      backgroundColor: colors.headerBg || "#002b29",
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 20,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    heroIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.14)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.16)",
      marginBottom: 14,
    },
    heroEyebrow: {
      color: "#9af2bb",
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      marginBottom: 5,
    },
    heroTitle: {
      color: "#fff",
      fontSize: 30,
      fontWeight: "900",
    },
    heroSubtitle: {
      color: "rgba(255,255,255,0.78)",
      fontSize: 13,
      lineHeight: 19,
      marginTop: 6,
      maxWidth: 340,
    },
    statsRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 18,
    },
    statCard: {
      flex: 1,
      minHeight: 70,
      borderRadius: 16,
      padding: 12,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
    },
    statValue: {
      color: "#fff",
      fontSize: 20,
      fontWeight: "900",
    },
    statLabel: {
      color: "rgba(255,255,255,0.66)",
      fontSize: 11,
      fontWeight: "700",
      marginTop: 4,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: H_PADDING,
      marginTop: 16,
      paddingHorizontal: 14,
      minHeight: 48,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow || "#000",
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 12,
        },
        android: { elevation: 2 },
      }),
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
      paddingVertical: 10,
    },
    section: {
      marginTop: 22,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      paddingHorizontal: H_PADDING,
      marginBottom: 12,
      gap: 12,
    },
    sectionTitleWrap: {
      flex: 1,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    sectionSubtitle: {
      color: colors.textTertiary,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },
    sectionCountPill: {
      minWidth: 34,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accentLight,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 9,
    },
    sectionCountText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "900",
    },
    carouselContent: {
      paddingHorizontal: H_PADDING,
      gap: CARD_GAP,
      paddingBottom: 2,
    },
    roomCard: {
      width: cardWidth,
      minHeight: 286,
      backgroundColor: colors.card,
      borderRadius: 18,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow || "#000",
          shadowOpacity: 0.07,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 14,
        },
        android: { elevation: 2 },
      }),
    },
    photoWrap: {
      height: 118,
      backgroundColor: colors.accentLight || colors.inputBg,
    },
    photo: {
      width: "100%",
      height: "100%",
    },
    photoPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentLight || colors.inputBg,
    },
    statusPill: {
      position: "absolute",
      top: 9,
      left: 9,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 13,
      backgroundColor: "rgba(0,43,41,0.78)",
    },
    statusText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "900",
    },
    cardBody: {
      flex: 1,
      padding: 12,
    },
    roomName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 18,
      minHeight: 36,
    },
    areaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 7,
    },
    areaText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
    },
    description: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 8,
      minHeight: 17,
    },
    amenityRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: 8,
    },
    amenityChip: {
      maxWidth: "48%",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: colors.accentLight || colors.inputBg,
    },
    amenityChipText: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: "800",
    },
    cardFooter: {
      marginTop: "auto",
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight || colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    priceText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "900",
    },
    sectionEmpty: {
      marginHorizontal: H_PADDING,
      minHeight: 92,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      gap: 6,
    },
    sectionEmptyText: {
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: "700",
    },
  });

export default ClientRoomsScreen;
