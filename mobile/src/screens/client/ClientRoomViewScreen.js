import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import SafeMapView from "../../components/SafeMapView";
import HomeSpaceLoader from "../../components/SpaceLoader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const publicRoom = (room = {}) => ({
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

const ClientRoomViewScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets);

  const roomId = String(route?.params?.roomId || route?.params?.room?.id || "");
  const initialRoom = route?.params?.room
    ? publicRoom(route.params.room)
    : null;

  const [room, setRoom] = useState(initialRoom);
  const [loading, setLoading] = useState(!initialRoom);
  const [refreshing, setRefreshing] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const fetchPublicRoom = useCallback(
    async (showLoader = true) => {
      if (!roomId) return;

      try {
        if (showLoader) setLoading(true);
        const response = await roomService.getAvailableRooms();
        const data = response?.data || response || {};
        const rooms = data.rooms || data || [];
        const match = (Array.isArray(rooms) ? rooms : []).find(
          (item) => String(item.id || item._id) === roomId,
        );
        setRoom(match ? publicRoom(match) : null);
      } catch (error) {
        console.error("Error loading public room:", error);
        setRoom(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [roomId],
  );

  useEffect(() => {
    if (!initialRoom) fetchPublicRoom(true);
  }, [fetchPublicRoom, initialRoom]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPublicRoom(false);
  }, [fetchPublicRoom]);

  const formatCurrency = (value) => {
    const amount = Number(value || 0);
    if (!amount) return "Ask for price";
    return `\u20B1${amount.toLocaleString()}`;
  };

  const getPrice = (r) => r?.rent || r?.price || r?.monthlyRent;

  const getArea = (r) => {
    const parts = String(r?.address || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      barangay:
        r?.barangay ||
        parts.find((part) => /^(brgy\.?|barangay)\s/i.test(part)) ||
        parts[0] ||
        "Barangay not set",
      city:
        r?.city ||
        parts.find((part) => /city/i.test(part)) ||
        parts[1] ||
        "City not set",
    };
  };

  const openGallery = (index = photoIndex) => {
    if (photos.length === 0) return;
    setGalleryIndex(index);
    setGalleryVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <View style={styles.centerLoader}>
          <HomeSpaceLoader />
        </View>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.center}>
        <TouchableOpacity style={styles.backCircle} onPress={navigation.goBack}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </TouchableOpacity>
        <Ionicons name="home-outline" size={48} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>Room preview unavailable</Text>
      </View>
    );
  }

  const photos = Array.isArray(room.photos) ? room.photos : [];
  const amenities = Array.isArray(room.amenities) ? room.amenities : [];
  const rules = Array.isArray(room.houseRules) ? room.houseRules : [];
  const area = getArea(room);
  const hasLocation = room.latitude != null && room.longitude != null;

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
          {photos.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(event) => {
                const idx = Math.round(
                  event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
                );
                setPhotoIndex(idx);
              }}
              scrollEventThrottle={16}
            >
              {photos.map((photo, index) => (
                <TouchableOpacity
                  key={`${photo}-${index}`}
                  activeOpacity={0.92}
                  onPress={() => openGallery(index)}
                  style={styles.heroPhoto}
                >
                  <Image
                    source={{ uri: photo }}
                    style={styles.heroPhotoImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="home-outline" size={58} color={colors.accent} />
            </View>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={navigation.goBack}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          {photos.length > 0 && (
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={() => openGallery(photoIndex)}
              activeOpacity={0.8}
            >
              <Ionicons name="images-outline" size={17} color="#fff" />
            </TouchableOpacity>
          )}

          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <View style={styles.pricePill}>
              <Ionicons name="pricetag" size={13} color={colors.textOnAccent} />
              <Text style={styles.priceText}>
                {formatCurrency(getPrice(room))}
              </Text>
            </View>
            <Text style={styles.roomName} numberOfLines={2}>
              {room.name || "Unnamed room"}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#d8efe8" />
              <Text style={styles.locationText} numberOfLines={2}>
                {room.address || `${area.barangay}, ${area.city}`}
              </Text>
            </View>
          </View>

          {photos.length > 1 && (
            <View style={styles.dots}>
              {photos.map((_, index) => (
                <View
                  key={index}
                  style={[styles.dot, index === photoIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Ionicons name="business-outline" size={18} color={colors.accent} />
            <Text style={styles.metaValue} numberOfLines={1}>
              {area.city}
            </Text>
            <Text style={styles.metaLabel}>City</Text>
          </View>
          <View style={styles.metaCard}>
            <Ionicons name="leaf-outline" size={18} color={colors.accent} />
            <Text style={styles.metaValue} numberOfLines={1}>
              {area.barangay}
            </Text>
            <Text style={styles.metaLabel}>Barangay</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons
              name="information-circle-outline"
              size={19}
              color={colors.accent}
            />
            <Text style={styles.cardTitle}>About This Room</Text>
          </View>
          <Text style={styles.bodyText}>
            {room.description ||
              "This public room preview has not added a description yet."}
          </Text>
        </View>

        {amenities.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons
                name="sparkles-outline"
                size={19}
                color={colors.accent}
              />
              <Text style={styles.cardTitle}>Amenities</Text>
            </View>
            <View style={styles.chipWrap}>
              {amenities.map((amenity) => (
                <View key={amenity} style={styles.chip}>
                  <Text style={styles.chipText}>{amenity}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {rules.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons
                name="shield-checkmark-outline"
                size={19}
                color={colors.accent}
              />
              <Text style={styles.cardTitle}>House Rules</Text>
            </View>
            {rules.map((rule) => (
              <View key={rule} style={styles.ruleRow}>
                <View style={styles.ruleDot} />
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        )}

        {hasLocation && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="map-outline" size={19} color={colors.accent} />
              <Text style={styles.cardTitle}>Location</Text>
            </View>
            <View style={styles.mapWrap}>
              <SafeMapView
                style={styles.map}
                latitude={room.latitude}
                longitude={room.longitude}
                title={room.name}
              />
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={galleryVisible}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setGalleryVisible(false)}
      >
        <View style={styles.galleryRoot}>
          <View style={styles.galleryHeader}>
            <TouchableOpacity
              style={styles.galleryClose}
              onPress={() => setGalleryVisible(false)}
            >
              <Ionicons name="close" size={23} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.galleryTitle} numberOfLines={1}>
              {room.name || "Room photos"}
            </Text>
            <Text style={styles.galleryCount}>
              {galleryIndex + 1}/{photos.length}
            </Text>
          </View>

          <ScrollView
            key={`gallery-${galleryVisible}-${galleryIndex}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: galleryIndex * SCREEN_WIDTH, y: 0 }}
            onScroll={(event) => {
              const idx = Math.round(
                event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
              );
              setGalleryIndex(idx);
            }}
            scrollEventThrottle={16}
          >
            {photos.map((photo, index) => (
              <View
                key={`gallery-${photo}-${index}`}
                style={styles.galleryPage}
              >
                <Image
                  source={{ uri: photo }}
                  style={styles.galleryImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          {photos.length > 1 && (
            <View style={styles.galleryDots}>
              {photos.map((_, index) => (
                <View
                  key={`gallery-dot-${index}`}
                  style={[
                    styles.galleryDot,
                    index === galleryIndex && styles.galleryDotActive,
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

const createStyles = (colors, insets) =>
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
      paddingHorizontal: 28,
    },
    loadingText: {
      marginTop: 12,
      color: colors.textTertiary,
      fontSize: 13,
      fontWeight: "600",
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
      marginTop: 12,
    },
    backCircle: {
      position: "absolute",
      top: insets.top + 12,
      left: 16,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    scrollContent: {
      paddingBottom: Math.max(28, insets.bottom + 24),
    },
    hero: {
      height: 360,
      backgroundColor: colors.headerBg || "#002b29",
    },
    heroPhoto: {
      width: SCREEN_WIDTH,
      height: 360,
    },
    heroPhotoImage: {
      width: "100%",
      height: "100%",
    },
    heroPlaceholder: {
      height: 360,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentLight || colors.inputBg,
    },
    backButton: {
      position: "absolute",
      top: insets.top + 12,
      left: 16,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "rgba(0,43,41,0.74)",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.16)",
      zIndex: 3,
    },
    galleryButton: {
      position: "absolute",
      top: insets.top + 12,
      right: 16,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "rgba(0,43,41,0.74)",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.16)",
      zIndex: 3,
    },
    heroShade: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 190,
      backgroundColor: "rgba(0,43,41,0.68)",
    },
    heroContent: {
      position: "absolute",
      left: 20,
      right: 20,
      bottom: 34,
    },
    pricePill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: colors.accent,
      marginBottom: 10,
    },
    priceText: {
      color: colors.textOnAccent,
      fontSize: 12,
      fontWeight: "900",
    },
    roomName: {
      color: "#fff",
      fontSize: 28,
      fontWeight: "900",
      lineHeight: 34,
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      marginTop: 8,
    },
    locationText: {
      flex: 1,
      color: "#d8efe8",
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "600",
    },
    dots: {
      position: "absolute",
      bottom: 12,
      alignSelf: "center",
      flexDirection: "row",
      gap: 5,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.42)",
    },
    dotActive: {
      width: 16,
      backgroundColor: "#fff",
    },
    metaGrid: {
      flexDirection: "row",
      gap: 12,
      marginHorizontal: 16,
      marginTop: 16,
    },
    metaCard: {
      flex: 1,
      minHeight: 92,
      borderRadius: 18,
      padding: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow || "#000",
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: 5 },
          shadowRadius: 13,
        },
        android: { elevation: 2 },
      }),
    },
    metaValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      marginTop: 10,
    },
    metaLabel: {
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 4,
    },
    card: {
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow || "#000",
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: 5 },
          shadowRadius: 13,
        },
        android: { elevation: 2 },
      }),
    },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    cardTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },
    bodyText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 14,
      backgroundColor: colors.accentLight || colors.inputBg,
    },
    chipText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "800",
    },
    ruleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 10,
    },
    ruleDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.accent,
      marginTop: 6,
    },
    ruleText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "600",
    },
    mapWrap: {
      height: 190,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    map: {
      flex: 1,
    },
    galleryRoot: {
      flex: 1,
      backgroundColor: "#000",
    },
    galleryHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 3,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingTop: insets.top + 10,
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: "rgba(0,0,0,0.42)",
    },
    galleryClose: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(255,255,255,0.14)",
      alignItems: "center",
      justifyContent: "center",
    },
    galleryTitle: {
      flex: 1,
      color: "#fff",
      fontSize: 15,
      fontWeight: "800",
    },
    galleryCount: {
      color: "rgba(255,255,255,0.72)",
      fontSize: 12,
      fontWeight: "800",
    },
    galleryPage: {
      width: SCREEN_WIDTH,
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    galleryImage: {
      width: SCREEN_WIDTH,
      height: "100%",
    },
    galleryDots: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: Math.max(24, insets.bottom + 14),
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
    },
    galleryDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.35)",
    },
    galleryDotActive: {
      width: 16,
      backgroundColor: "#fff",
    },
  });

export default ClientRoomViewScreen;
