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
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import SafeMapView from "../../components/SafeMapView";
import { roomService, billingCycleService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
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
  const [activeCycle, setActiveCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFullMap, setShowFullMap] = useState(false);
  const [photoViewVisible, setPhotoViewVisible] = useState(false);
  const [photoViewIdx, setPhotoViewIdx] = useState(0);
  const [userJoinedRoom, setUserJoinedRoom] = useState(null);

  const openInMaps = (r) => {
    const lat = r.latitude;
    const lng = r.longitude;
    const label = encodeURIComponent(r.name || "Location");
    const url =
      Platform.OS === "ios"
        ? `maps:0,0?q=${label}@${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`),
    );
  };

  const getCustomChargeIcon = (chargeName) => {
    const name = chargeName?.toLowerCase() || "";
    if (name.includes("maintenance")) return "home-repair-service";
    if (name.includes("groceries") || name.includes("grocery"))
      return "local-grocery-store";
    if (name.includes("cleaning")) return "cleaning-services";
    if (name.includes("parking")) return "local-parking";
    if (name.includes("pet") || name.includes("pets")) return "pets";
    if (name.includes("laundry")) return "local-laundry-service";
    return "pricetag"; // fallback
  };

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
      const [roomResponse, clientRoomsResponse] = await Promise.all([
        roomService.getRoomById(roomId),
        roomService.getClientRooms().catch((error) => {
          console.error("Error fetching client rooms:", error.message);
          return null;
        }),
      ]);
      const roomData = roomResponse.data || roomResponse;

      // Extract the room object (it might be wrapped)
      const detailedRoom = roomData.room || roomData;
      setRoom(detailedRoom);

      const clientRoomsData = clientRoomsResponse?.data || clientRoomsResponse;
      const clientRooms = clientRoomsData?.rooms || clientRoomsData || [];
      const joinedRoomMatch =
        clientRooms.find(
          (clientRoom) =>
            String(clientRoom.id || clientRoom._id) === String(roomId),
        ) || null;

      setUserJoinedRoom(
        joinedRoomMatch
          ? {
              ...detailedRoom,
              ...joinedRoomMatch,
              members: joinedRoomMatch.members || detailedRoom.members,
              billing: joinedRoomMatch.billing || detailedRoom.billing,
              memberPayments:
                joinedRoomMatch.memberPayments || detailedRoom.memberPayments,
            }
          : detailedRoom,
      );

      // Fetch active billing cycle for custom charges
      try {
        const activeCycleData =
          await billingCycleService.getActiveCycle(roomId);
        if (activeCycleData) {
          // Extract billingCycle from response
          const cycle = activeCycleData.billingCycle || activeCycleData;
          if (cycle) {
            setActiveCycle(cycle);
            if (Array.isArray(cycle.memberPayments)) {
              setUserJoinedRoom((prev) =>
                prev
                  ? {
                      ...prev,
                      memberPayments: cycle.memberPayments,
                    }
                  : prev,
              );
            }
          }
        }
      } catch (cycleError) {
        console.error("Error fetching billing cycle:", cycleError.message);
      }
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

  const formatShortDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (value) =>
    "\u20B1" +
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const calculateTotalWaterBill = () => {
    if (!room) return 0;

    // If fixed_monthly mode, calculate from room settings
    const isFixed =
      room.waterBillingMode === "fixed_monthly" ||
      room.water_billing_mode === "fixed_monthly";
    if (isFixed) {
      const fixedAmt =
        parseFloat(room.waterFixedAmount || room.water_fixed_amount || 0) || 0;
      const isPerPerson =
        (room.waterFixedType || room.water_fixed_type) === "per_person";
      if (isPerPerson) {
        const allMembersCount = Math.max(1, (room.members || []).length);
        return fixedAmt * allMembersCount;
      }
      return fixedAmt;
    }

    // Presence-based fallback
    if (!room.members) return 0;
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

  const payorsPaymentStatus = useMemo(() => {
    if (!userJoinedRoom?.members || !userJoinedRoom?.billing) return [];

    const payors = userJoinedRoom.members.filter((m) => m.isPayer);

    return payors.map((payor) => {
      const payment = userJoinedRoom.memberPayments?.find(
        (mp) =>
          String(mp.member?.id || mp.member?._id || mp.member) ===
          String(payor.user?.id || payor.user?._id || payor.user),
      );

      // Extract avatar URL - handle both string and object formats
      let avatarUrl = null;
      if (payor.user?.avatar) {
        if (typeof payor.user.avatar === "string") {
          avatarUrl = payor.user.avatar;
        } else if (
          typeof payor.user.avatar === "object" &&
          payor.user.avatar.url
        ) {
          avatarUrl = payor.user.avatar.url;
        }
      }

      const paymentData = payment || {
        rentStatus: "unpaid",
        electricityStatus: "unpaid",
        waterStatus: "unpaid",
        internetStatus: "unpaid",
      };

      return {
        name: payor.user?.name || "Unknown",
        userId: String(payor.user?.id || payor.user?._id || payor.user),
        avatar: avatarUrl,
        payment: {
          rent: paymentData.rentStatus || "unpaid",
          electricity: paymentData.electricityStatus || "unpaid",
          water: paymentData.waterStatus || "unpaid",
          internet: paymentData.internetStatus || "unpaid",
        },
        allPaid:
          paymentData.rentStatus === "paid" &&
          paymentData.electricityStatus === "paid" &&
          paymentData.waterStatus === "paid" &&
          (paymentData.internetStatus === "paid" ||
            !userJoinedRoom.billing?.internet),
      };
    });
  }, [userJoinedRoom]);

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
  const members = Array.isArray(room.members) ? room.members : [];
  const photos = Array.isArray(room.photos) ? room.photos : [];
  const amenities = Array.isArray(room.amenities) ? room.amenities : [];
  const payorCount = members.filter((member) => member.isPayer).length;
  const roomRent = parseFloat(room.rent || room.price || room.monthlyRent || 0);
  const waterTotal = calculateTotalWaterBill();
  const customChargesTotal =
    activeCycle?.customCharges?.reduce(
      (sum, charge) => sum + parseFloat(charge.amount || 0),
      0,
    ) || 0;
  const billingTotal =
    parseFloat(billing.billing?.rent || 0) +
    parseFloat(billing.billing?.electricity || 0) +
    waterTotal +
    parseFloat(billing.billing?.internet || 0) +
    customChargesTotal;
  const hasBillingCycle = Boolean(
    billing?.billing?.start && billing?.billing?.end,
  );

  return (
    <>
      <ScrollViewWithDetection
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
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
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShareRoom}
              activeOpacity={0.75}
            >
              <Ionicons name="share-outline" size={18} color={colors.accent} />
            </TouchableOpacity>
          </View>
          <Text style={styles.roomName} numberOfLines={2}>
            {room.name}
          </Text>
          {room.address ? (
            <View style={styles.headerAddressRow}>
              <Ionicons
                name="location-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.headerAddressText} numberOfLines={2}>
                {room.address}
              </Text>
            </View>
          ) : null}
          <View style={styles.headerMetaRow}>
            <View style={styles.codePill}>
              <Ionicons name="key-outline" size={13} color={colors.accent} />
              <Text style={styles.codeText}>Code: {room.code || "N/A"}</Text>
            </View>
            <View style={styles.statusPill}>
              <Ionicons
                name={hasBillingCycle ? "pulse-outline" : "time-outline"}
                size={13}
                color={hasBillingCycle ? colors.success : colors.textSecondary}
              />
              <Text
                style={[
                  styles.statusPillText,
                  hasBillingCycle && { color: colors.success },
                ]}
              >
                {hasBillingCycle ? "Active cycle" : "No cycle"}
              </Text>
            </View>
            {roomRent > 0 ? (
              <View style={styles.pricePill}>
                <Ionicons name="pricetag" size={13} color={colors.accent} />
                <Text style={styles.pricePillText}>
                  {formatCurrency(roomRent)} / month
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.heroStatsRow}>
            {[
              {
                label: "Members",
                value: members.length || 0,
                icon: "people-outline",
              },
              {
                label: "Payors",
                value: payorCount || 0,
                icon: "checkmark-circle-outline",
              },
              {
                label: "Total",
                value: hasBillingCycle ? formatCurrency(billingTotal) : "--",
                icon: "receipt-outline",
              },
            ].map((stat) => (
              <View key={stat.label} style={styles.heroStatCard}>
                <Ionicons name={stat.icon} size={15} color={colors.accent} />
                <Text style={styles.heroStatValue} numberOfLines={1}>
                  {stat.value}
                </Text>
                <Text style={styles.heroStatLabel}>{stat.label}</Text>
              </View>
            ))}
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
                <ScrollViewWithDetection
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
                </ScrollViewWithDetection>
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
              <SafeMapView
                style={styles.mapPreview}
                latitude={room.latitude}
                longitude={room.longitude}
                title={room.name}
              />
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
                value: waterTotal,
              },
              {
                label: "Internet",
                icon: "wifi",
                color: colors.internetColor,
                value: billing.billing.internet,
              },
              ...(activeCycle?.customCharges &&
              activeCycle.customCharges.length > 0
                ? activeCycle.customCharges.map((charge) => ({
                    label: charge.name || "Charge",
                    icon: "pricetag",
                    color: colors.accent,
                    value: parseFloat(charge.amount || 0),
                  }))
                : []),
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
                {(() => {
                  let customTotal = 0;
                  if (
                    activeCycle?.customCharges &&
                    activeCycle.customCharges.length > 0
                  ) {
                    customTotal = activeCycle.customCharges.reduce(
                      (sum, c) => sum + parseFloat(c.amount || 0),
                      0,
                    );
                  }
                  return (
                    parseFloat(billing.billing.rent || 0) +
                    parseFloat(billing.billing.electricity || 0) +
                    calculateTotalWaterBill() +
                    parseFloat(billing.billing.internet || 0) +
                    customTotal
                  ).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });
                })()}
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

        {/* ─── PAYORS PAYMENT STATUS ─── */}
        {payorsPaymentStatus.length > 0 && (
          <View style={styles.payorsCard}>
            <View style={styles.payorsHeader}>
              <Ionicons name="people" size={18} color={colors.accent} />
              <Text style={styles.payorsTitle}>Payors Payment Status</Text>
            </View>

            {userJoinedRoom?.billing?.start && userJoinedRoom?.billing?.end && (
              <View style={styles.payorsPeriod}>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={colors.info}
                />
                <Text style={styles.payorsPeriodText}>
                  {formatShortDate(userJoinedRoom.billing.start)} {"\u2014"}{" "}
                  {formatShortDate(userJoinedRoom.billing.end)}
                </Text>
              </View>
            )}

            {payorsPaymentStatus.map((payor, index) => (
              <View key={payor.userId}>
                <View style={styles.payorRow}>
                  {payor.avatar ? (
                    <Image
                      source={{ uri: payor.avatar }}
                      style={styles.payorAvatarImg}
                      onError={() => {
                        // Avatar failed to load, fallback will be shown
                      }}
                    />
                  ) : (
                    <View style={styles.payorAvatar}>
                      <Text style={styles.payorAvatarText}>
                        {(payor.name || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={styles.payorNameRow}>
                      <Text style={styles.payorName}>{payor.name}</Text>
                      {payor.allPaid && (
                        <View style={styles.paidChip}>
                          <Ionicons
                            name="checkmark"
                            size={10}
                            color={colors.textOnAccent}
                          />
                          <Text style={styles.paidChipText}>Paid</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.payorBillsRow}>
                      {[
                        { key: "R", status: payor.payment.rent },
                        {
                          key: "E",
                          status: payor.payment.electricity,
                        },
                        { key: "W", status: payor.payment.water },
                        ...(userJoinedRoom.billing?.internet
                          ? [
                              {
                                key: "I",
                                status: payor.payment.internet,
                              },
                            ]
                          : []),
                      ].map((bill, bi) => (
                        <View
                          key={bi}
                          style={[
                            styles.payorBillChip,
                            {
                              backgroundColor:
                                bill.status === "paid"
                                  ? colors.successBg
                                  : "#fbe9e7",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.payorBillChipText,
                              {
                                color:
                                  bill.status === "paid"
                                    ? colors.success
                                    : "#c62828",
                              },
                            ]}
                          >
                            {bill.key}
                          </Text>
                          <Ionicons
                            name={
                              bill.status === "paid" ? "checkmark" : "close"
                            }
                            size={10}
                            color={
                              bill.status === "paid"
                                ? colors.success
                                : "#c62828"
                            }
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
                {index < payorsPaymentStatus.length - 1 && (
                  <View style={styles.payorDivider} />
                )}
              </View>
            ))}

            <View style={styles.legendRow}>
              <Text style={styles.legendText}>
                R = Rent {"\u2022"} E = Electricity {"\u2022"} W = Water
                {userJoinedRoom.billing?.internet ? " \u2022 I = Internet" : ""}
              </Text>
            </View>
          </View>
        )}

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
      </ScrollViewWithDetection>

      {/* ─── FULL-SCREEN MAP MODAL ─── */}
      {room.latitude != null && room.longitude != null && (
        <Modal
          visible={showFullMap}
          animationType="slide"
          onRequestClose={() => setShowFullMap(false)}
        >
          <View style={{ flex: 1 }}>
            <SafeMapView
              style={{ flex: 1 }}
              latitude={room.latitude}
              longitude={room.longitude}
              title={room.name}
              interactive
              hideOpenBtn
            />
            {/* Floating Header */}
            <View style={styles.fullMapHeader}>
              <TouchableOpacity
                style={styles.fullMapBackBtn}
                onPress={() => setShowFullMap(false)}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={styles.fullMapTitleWrap}>
                <Text style={styles.fullMapTitle} numberOfLines={1}>
                  {room.name}
                </Text>
                <Text style={styles.fullMapSubtitle}>
                  Tap & drag to explore
                </Text>
              </View>
            </View>
            {/* Floating Address */}
            {room.address ? (
              <View style={styles.fullMapAddressBar}>
                <Ionicons name="location" size={17} color={colors.accent} />
                <Text style={styles.fullMapAddressText} numberOfLines={2}>
                  {room.address}
                </Text>
                <TouchableOpacity
                  style={styles.fullMapOpenBtn}
                  onPress={() => openInMaps(room)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="navigate" size={14} color="#fff" />
                  <Text style={styles.fullMapOpenBtnText}>Maps</Text>
                </TouchableOpacity>
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
          <ScrollViewWithDetection
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
          </ScrollViewWithDetection>
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

const createStyles = (colors, insets = { top: 0, bottom: 0 }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: Math.max(28, insets.bottom + 24),
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
      // paddingTop: insets.top + 18,
      paddingTop: 20,
      paddingBottom: 22,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight || colors.border,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow || "#000",
          shadowOpacity: 0.08,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 18,
        },
        android: { elevation: 4 },
      }),
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    headerIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    shareBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    roomName: {
      fontSize: 27,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 8,
      lineHeight: 33,
    },
    headerAddressRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      marginBottom: 12,
      paddingRight: 10,
    },
    headerAddressText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    headerMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    codePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    codeText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.accent,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    pricePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    pricePillText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.accent,
    },
    heroStatsRow: {
      flexDirection: "row",
      gap: 10,
    },
    heroStatCard: {
      flex: 1,
      minHeight: 86,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      justifyContent: "space-between",
    },
    heroStatValue: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
      marginTop: 8,
    },
    heroStatLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textTertiary,
      textTransform: "uppercase",
    },

    /* ─── Cards ─── */
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
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 14,
        },
        android: { elevation: 2 },
      }),
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
      borderRadius: 12,
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
      borderRadius: 14,
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
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
      flexShrink: 1,
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
      width: "31%",
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
      marginBottom: Math.max(10, insets.bottom + 4),
    },
    actionPrimary: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 16,
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
      borderRadius: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
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

    /* ─── Payors Status ─── */
    payorsCard: {
      marginHorizontal: 16,
      marginTop: 14,
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      overflow: "hidden",
    },
    payorsHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    payorsTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    payorsPeriod: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      backgroundColor: colors.cardAlt,
      borderRadius: 8,
    },
    payorsPeriodText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    payorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    payorAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    payorAvatarImg: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
    },
    payorAvatarText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.accent,
    },
    payorNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    payorName: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    paidChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: colors.success,
    },
    paidChipText: {
      fontSize: 9,
      fontWeight: "700",
      color: "#fff",
    },
    payorBillsRow: {
      flexDirection: "row",
      gap: 6,
    },
    payorBillChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    payorBillChipText: {
      fontSize: 10,
      fontWeight: "700",
    },
    payorDivider: {
      height: 1,
      backgroundColor: colors.inputBg,
      marginHorizontal: 16,
    },
    legendRow: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: "center",
    },
    legendText: {
      fontSize: 10,
      color: colors.textTertiary,
      fontStyle: "italic",
    },

    /* ─── Map ─── */
    mapPreviewWrap: {
      borderRadius: 16,
      overflow: "hidden",
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    mapPreview: {
      width: "100%",
      height: 190,
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
      top: Math.max(16, insets.top + 8),
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "rgba(15,15,15,0.85)",
      borderRadius: 20,
      paddingVertical: 8,
      paddingLeft: 8,
      paddingRight: 14,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 12,
        },
        android: { elevation: 14 },
      }),
    },
    fullMapBackBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(255,255,255,0.12)",
      justifyContent: "center",
      alignItems: "center",
    },
    fullMapTitleWrap: {
      flex: 1,
    },
    fullMapTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: "#fff",
      letterSpacing: 0.1,
    },
    fullMapSubtitle: {
      fontSize: 11,
      color: "rgba(255,255,255,0.5)",
      marginTop: 1,
    },
    fullMapAddressBar: {
      position: "absolute",
      bottom: Math.max(24, insets.bottom + 16),
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: "rgba(15,15,15,0.85)",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 12,
        },
        android: { elevation: 14 },
      }),
    },
    fullMapAddressText: {
      flex: 1,
      fontSize: 13,
      color: "rgba(255,255,255,0.88)",
      fontWeight: "500",
      lineHeight: 19,
    },
    fullMapOpenBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.accent,
      borderRadius: 12,
    },
    fullMapOpenBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#fff",
    },

    /* ─── Photo Gallery ─── */
    galScroll: {
      borderRadius: 16,
      overflow: "hidden",
    },
    galPhoto: {
      height: 220,
      borderRadius: 16,
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
      paddingTop: insets.top + 10,
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
      backgroundColor: colors.card,
      width: 14,
    },
  });

export default RoomDetailsScreen;
