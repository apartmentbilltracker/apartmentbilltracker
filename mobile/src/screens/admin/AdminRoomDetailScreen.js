import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import { roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const AMENITY_MAP = {
  wifi: { icon: "wifi", label: "WiFi", color: "#1976d2" },
  kitchen: { icon: "restaurant", label: "Kitchen", color: "#e65100" },
  bathroom: { icon: "water", label: "Bathroom", color: "#0288d1" },
  bedroom: { icon: "bed", label: "Bedroom", color: "#c62828" },
  hotwater: { icon: "flame", label: "Hot Water", color: "#ef6c00" },
  parking: { icon: "car", label: "Parking", color: "#2e7d32" },
  aircon: { icon: "snow", label: "Air-con", color: "#0277bd" },
  laundry: { icon: "shirt", label: "Laundry", color: "#6a1b9a" },
  tv: { icon: "tv", label: "TV", color: "#37474f" },
  cctv: { icon: "videocam", label: "CCTV", color: "#455a64" },
  common: { icon: "people", label: "Common Area", color: "#388e3c" },
  gym: { icon: "barbell", label: "Gym", color: "#d84315" },
};

const AdminRoomDetailScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();

  const [room, setRoom] = useState(route.params?.room || null);
  const [refreshing, setRefreshing] = useState(false);
  const [processingMemberId, setProcessingMemberId] = useState(null);
  const [fullMapRoom, setFullMapRoom] = useState(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const refreshRoom = async () => {
    try {
      const response = await roomService.getAdminAllRooms();
      const rooms = response?.rooms || [];
      const updated = rooms.find((r) => r.id === room?.id);
      if (updated) {
        setRoom(updated);
      }
    } catch (error) {
      console.error("Error refreshing room:", error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshRoom();
    setRefreshing(false);
  }, [room?.id]);

  const handleDeleteRoom = () => {
    Alert.alert(
      "Delete Room",
      `Are you sure you want to delete "${room.name}"?\n\nThis will remove all members, billing cycles, and data permanently.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await roomService.adminDeleteRoom(room.id);
              Alert.alert("Deleted", `Room "${room.name}" has been deleted.`);
              navigation.goBack();
            } catch (error) {
              Alert.alert("Error", "Failed to delete room");
            }
          },
        },
      ],
    );
  };

  const handleRemoveMember = (member) => {
    Alert.alert("Remove Member", `Remove "${member.name}" from this room?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            setProcessingMemberId(member.id);
            await roomService.adminRemoveMember(room.id, member.id);
            Alert.alert("Done", `${member.name} has been removed.`);
            await refreshRoom();
          } catch (error) {
            Alert.alert("Error", "Failed to remove member");
          } finally {
            setProcessingMemberId(null);
          }
        },
      },
    ]);
  };

  const handleTogglePayer = async (member) => {
    const newStatus = member.is_payer ? "non-payer" : "payer";
    try {
      setProcessingMemberId(member.id);
      await roomService.adminTogglePayer(room.id, member.id);
      Alert.alert("Updated", `${member.name} is now a ${newStatus}.`);
      await refreshRoom();
    } catch (error) {
      Alert.alert("Error", "Failed to update payer status");
    } finally {
      setProcessingMemberId(null);
    }
  };

  if (!room) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerWrap}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.textTertiary}
          />
          <Text style={styles.emptyText}>Room not found</Text>
        </View>
      </View>
    );
  }

  const billing = room.billingCycle;
  const members = room.members || [];
  const payers = members.filter((m) => m.is_payer);
  const nonPayers = members.filter((m) => !m.is_payer);
  const hasLocation = room.latitude != null && room.longitude != null;
  const amenities = Array.isArray(room.amenities) ? room.amenities : [];
  const houseRules = Array.isArray(room.houseRules || room.house_rules)
    ? room.houseRules || room.house_rules
    : [];
  const photos = Array.isArray(room.photos) ? room.photos : [];

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return "N/A";
    return `₱${Number(val).toLocaleString()}`;
  };

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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {room.name}
        </Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteRoom}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Room Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="home" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.roomName}>{room.name}</Text>
              <Text style={styles.roomCode}>{room.code}</Text>
            </View>
          </View>

          {room.description ? (
            <Text style={styles.description}>{room.description}</Text>
          ) : null}

          {/* Room Meta */}
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.textTertiary}
              />
              <Text style={styles.metaLabel}>Created</Text>
              <Text style={styles.metaValue}>
                {room.created_at
                  ? new Date(room.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "N/A"}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons
                name="people-outline"
                size={16}
                color={colors.textTertiary}
              />
              <Text style={styles.metaLabel}>Members</Text>
              <Text style={styles.metaValue}>
                {room.memberCount || members.length}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons
                name="wallet-outline"
                size={16}
                color={colors.textTertiary}
              />
              <Text style={styles.metaLabel}>Payers</Text>
              <Text style={styles.metaValue}>
                {room.payerCount || payers.length}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons
                name="person-outline"
                size={16}
                color={colors.textTertiary}
              />
              <Text style={styles.metaLabel}>Non-Payers</Text>
              <Text style={styles.metaValue}>{nonPayers.length}</Text>
            </View>
          </View>

          {/* Creator */}
          {room.creator && (
            <View style={styles.creatorSection}>
              <Ionicons name="person-circle" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.creatorName}>{room.creator.name}</Text>
                <Text style={styles.creatorEmail}>{room.creator.email}</Text>
              </View>
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerBadgeText}>Owner</Text>
              </View>
            </View>
          )}
        </View>

        {/* Photos Card */}
        {photos.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons
                  name="images-outline"
                  size={16}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.sectionTitle}>Photos</Text>
              <View style={styles.statusBadge}>
                <Text
                  style={[styles.statusBadgeText, { color: colors.accent }]}
                >
                  {photos.length}
                </Text>
              </View>
            </View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.photoGalleryScroll}
              onScroll={(e) => {
                const imgW = SCREEN_WIDTH - 84 + 8;
                const idx = Math.round(e.nativeEvent.contentOffset.x / imgW);
                setActivePhotoIdx(idx);
              }}
              scrollEventThrottle={16}
            >
              {photos.map((uri, idx) => (
                <Image
                  key={idx}
                  source={{ uri }}
                  style={styles.photoGalleryImg}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            {photos.length > 1 && (
              <View style={styles.photoDotRow}>
                {photos.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.photoDot,
                      idx === activePhotoIdx && styles.photoDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Location Card */}
        {hasLocation && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.sectionTitle}>Location</Text>
            </View>
            <TouchableOpacity
              style={styles.mapWrap}
              activeOpacity={0.8}
              onPress={() => setFullMapRoom(room)}
            >
              <MapView
                style={styles.mapView}
                initialRegion={{
                  latitude: room.latitude,
                  longitude: room.longitude,
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
                    latitude: room.latitude,
                    longitude: room.longitude,
                  }}
                />
              </MapView>
              <View style={styles.mapExpandHint}>
                <Ionicons
                  name="expand-outline"
                  size={14}
                  color={colors.accent}
                />
                <Text style={styles.mapExpandText}>Tap to expand</Text>
              </View>
            </TouchableOpacity>
            {room.address ? (
              <View style={styles.addressRow}>
                <Ionicons name="location" size={14} color={colors.accent} />
                <Text style={styles.addressText} numberOfLines={2}>
                  {room.address}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Amenities Card */}
        {amenities.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="sparkles" size={16} color={colors.accent} />
              </View>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.statusBadge}>
                <Text
                  style={[styles.statusBadgeText, { color: colors.accent }]}
                >
                  {amenities.length}
                </Text>
              </View>
            </View>
            <View style={styles.amenitiesGrid}>
              {amenities.map((key, i) => {
                const a = AMENITY_MAP[key] || {
                  icon: "ellipse",
                  label: key,
                  color: colors.textTertiary,
                };
                return (
                  <View key={i} style={styles.amenityChip}>
                    <Ionicons name={a.icon} size={16} color={a.color} />
                    <Text style={styles.amenityText}>{a.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* House Rules Card */}
        {houseRules.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons
                  name="clipboard-outline"
                  size={16}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.sectionTitle}>House Rules</Text>
              <View style={styles.statusBadge}>
                <Text
                  style={[styles.statusBadgeText, { color: colors.accent }]}
                >
                  {houseRules.length}
                </Text>
              </View>
            </View>
            {houseRules.map((rule, idx) => (
              <View key={idx} style={styles.ruleRow}>
                <View style={styles.ruleCheck}>
                  <Ionicons name="checkmark" size={11} color="#fff" />
                </View>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Billing Cycle Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons
                name="receipt-outline"
                size={16}
                color={colors.accent}
              />
            </View>
            <Text style={styles.sectionTitle}>Billing Cycle</Text>
            {billing && (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: colors.successBg },
                ]}
              >
                <Text
                  style={[styles.statusBadgeText, { color: colors.success }]}
                >
                  Active
                </Text>
              </View>
            )}
          </View>

          {billing ? (
            <View>
              <View style={styles.billingDateRow}>
                <View style={styles.billingDate}>
                  <Text style={styles.billingDateLabel}>Start</Text>
                  <Text style={styles.billingDateValue}>
                    {new Date(billing.startDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={colors.textTertiary}
                />
                <View style={styles.billingDate}>
                  <Text style={styles.billingDateLabel}>End</Text>
                  <Text style={styles.billingDateValue}>
                    {new Date(billing.endDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              </View>

              <View style={styles.billGrid}>
                <View
                  style={[
                    styles.billItem,
                    { backgroundColor: colors.warningBg },
                  ]}
                >
                  <Ionicons
                    name="home-outline"
                    size={16}
                    color={colors.warning}
                  />
                  <Text style={[styles.billLabel, { color: colors.warning }]}>
                    Rent
                  </Text>
                  <Text style={[styles.billAmount, { color: colors.warning }]}>
                    {formatCurrency(billing.rent)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.billItem,
                    { backgroundColor: colors.warningBg },
                  ]}
                >
                  <Ionicons
                    name="flash-outline"
                    size={16}
                    color={colors.electricityColor}
                  />
                  <Text
                    style={[
                      styles.billLabel,
                      { color: colors.electricityColor },
                    ]}
                  >
                    Electricity
                  </Text>
                  <Text
                    style={[
                      styles.billAmount,
                      { color: colors.electricityColor },
                    ]}
                  >
                    {formatCurrency(billing.electricity)}
                  </Text>
                </View>
                <View
                  style={[styles.billItem, { backgroundColor: colors.infoBg }]}
                >
                  <Ionicons
                    name="water-outline"
                    size={16}
                    color={colors.waterColor}
                  />
                  <Text
                    style={[styles.billLabel, { color: colors.waterColor }]}
                  >
                    Water
                  </Text>
                  <Text
                    style={[styles.billAmount, { color: colors.waterColor }]}
                  >
                    {formatCurrency(billing.water)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.billItem,
                    { backgroundColor: colors.purpleBg },
                  ]}
                >
                  <Ionicons
                    name="wifi-outline"
                    size={16}
                    color={colors.internetColor}
                  />
                  <Text
                    style={[styles.billLabel, { color: colors.internetColor }]}
                  >
                    Internet
                  </Text>
                  <Text
                    style={[styles.billAmount, { color: colors.internetColor }]}
                  >
                    {formatCurrency(billing.internet)}
                  </Text>
                </View>
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Bills</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(
                    (billing.rent || 0) +
                      (billing.electricity || 0) +
                      (billing.water || 0) +
                      (billing.internet || 0),
                  )}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptySection}>
              <Ionicons
                name="document-outline"
                size={28}
                color={colors.textTertiary}
              />
              <Text style={styles.emptySectionText}>
                No active billing cycle
              </Text>
            </View>
          )}
        </View>

        {/* Members Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="people-outline" size={16} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>Members ({members.length})</Text>
          </View>

          {members.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons
                name="people-outline"
                size={28}
                color={colors.textTertiary}
              />
              <Text style={styles.emptySectionText}>No members</Text>
            </View>
          ) : (
            members.map((member, index) => {
              const isProcessing = processingMemberId === member.id;
              return (
                <View
                  key={member.id}
                  style={[
                    styles.memberCard,
                    index === members.length - 1 && {
                      marginBottom: 0,
                      borderBottomWidth: 0,
                    },
                  ]}
                >
                  <View style={styles.memberTop}>
                    <View
                      style={[
                        styles.memberAvatar,
                        {
                          backgroundColor: member.is_payer
                            ? colors.info
                            : colors.textTertiary,
                        },
                      ]}
                    >
                      <Text style={styles.memberAvatarText}>
                        {(member.name || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      {member.email && (
                        <Text style={styles.memberEmail}>{member.email}</Text>
                      )}
                      <View style={styles.memberBadges}>
                        <View
                          style={[
                            styles.memberBadge,
                            {
                              backgroundColor: member.is_payer
                                ? colors.infoBg
                                : colors.badgeBg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.memberBadgeText,
                              {
                                color: member.is_payer
                                  ? colors.info
                                  : colors.textTertiary,
                              },
                            ]}
                          >
                            {member.is_payer ? "Payer" : "Non-Payer"}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.memberBadge,
                            {
                              backgroundColor:
                                member.status === "approved"
                                  ? colors.successBg
                                  : colors.warningBg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.memberBadgeText,
                              {
                                color:
                                  member.status === "approved"
                                    ? colors.success
                                    : colors.warning,
                              },
                            ]}
                          >
                            {member.status === "approved"
                              ? "Active"
                              : member.status || "Pending"}
                          </Text>
                        </View>
                        {member.joined_at && (
                          <Text style={styles.memberJoined}>
                            Joined{" "}
                            {new Date(member.joined_at).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" },
                            )}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Member Actions */}
                  <View style={styles.memberActions}>
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.memberActionBtn,
                            {
                              backgroundColor: member.is_payer
                                ? colors.warningBg
                                : colors.infoBg,
                            },
                          ]}
                          onPress={() => handleTogglePayer(member)}
                        >
                          <Ionicons
                            name={member.is_payer ? "wallet-outline" : "wallet"}
                            size={14}
                            color={
                              member.is_payer ? colors.warning : colors.info
                            }
                          />
                          <Text
                            style={[
                              styles.memberActionText,
                              {
                                color: member.is_payer
                                  ? colors.warning
                                  : colors.info,
                              },
                            ]}
                          >
                            {member.is_payer ? "Set Non-Payer" : "Set Payer"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.memberActionBtn,
                            { backgroundColor: colors.errorBg },
                          ]}
                          onPress={() => handleRemoveMember(member)}
                        >
                          <Ionicons
                            name="person-remove-outline"
                            size={14}
                            color={colors.error}
                          />
                          <Text
                            style={[
                              styles.memberActionText,
                              { color: colors.error },
                            ]}
                          >
                            Remove
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Room Actions Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons
                name="settings-outline"
                size={16}
                color={colors.accent}
              />
            </View>
            <Text style={styles.sectionTitle}>Room Actions</Text>
          </View>

          <TouchableOpacity
            style={styles.dangerAction}
            onPress={handleDeleteRoom}
          >
            <View style={styles.dangerIconWrap}>
              <Ionicons name="trash" size={18} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerActionTitle}>Delete Room</Text>
              <Text style={styles.dangerActionSubtitle}>
                Permanently remove this room and all its data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full-Screen Map Modal */}
      {fullMapRoom &&
        fullMapRoom.latitude != null &&
        fullMapRoom.longitude != null && (
          <Modal
            visible={!!fullMapRoom}
            animationType="slide"
            onRequestClose={() => setFullMapRoom(null)}
          >
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: fullMapRoom.latitude,
                  longitude: fullMapRoom.longitude,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
                showsUserLocation
                showsMyLocationButton
              >
                <Marker
                  coordinate={{
                    latitude: fullMapRoom.latitude,
                    longitude: fullMapRoom.longitude,
                  }}
                  title={fullMapRoom.name}
                  description={fullMapRoom.address || "Room location"}
                />
              </MapView>
              {/* Floating header */}
              <View style={styles.fullMapHeader}>
                <TouchableOpacity
                  style={styles.fullMapBackBtn}
                  onPress={() => setFullMapRoom(null)}
                >
                  <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.fullMapTitle} numberOfLines={1}>
                  {fullMapRoom.name}
                </Text>
              </View>
              {/* Floating address bar */}
              {fullMapRoom.address ? (
                <View style={styles.fullMapAddressBar}>
                  <Ionicons name="location" size={16} color={colors.accent} />
                  <Text style={styles.fullMapAddressText} numberOfLines={2}>
                    {fullMapRoom.address}
                  </Text>
                </View>
              ) : null}
            </View>
          </Modal>
        )}
    </View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
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
      flex: 1,
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    deleteBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.errorBg,
      justifyContent: "center",
      alignItems: "center",
    },
    scrollContent: {
      paddingHorizontal: 12,
      paddingTop: 4,
    },

    /* Info Card */
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      marginBottom: 12,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
    },
    infoCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 12,
    },
    infoIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.accentLight,
      justifyContent: "center",
      alignItems: "center",
    },
    roomName: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    roomCode: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    description: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
      marginBottom: 14,
    },
    metaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 14,
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.cardAlt || colors.background,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    metaLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    metaValue: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    creatorSection: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.cardAlt || colors.background,
      borderRadius: 12,
      padding: 12,
    },
    creatorName: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    creatorEmail: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 1,
    },
    ownerBadge: {
      backgroundColor: colors.accentLight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    ownerBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.accent,
    },

    /* Section Card */
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      marginBottom: 12,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
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
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    emptySection: {
      alignItems: "center",
      paddingVertical: 20,
      gap: 8,
    },
    emptySectionText: {
      fontSize: 13,
      color: colors.textTertiary,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textTertiary,
    },

    /* Billing */
    billingDateRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      marginBottom: 14,
    },
    billingDate: {
      alignItems: "center",
      backgroundColor: colors.cardAlt || colors.background,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
    },
    billingDateLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
      marginBottom: 2,
    },
    billingDateValue: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    billGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    billItem: {
      width: "48%",
      borderRadius: 12,
      padding: 12,
      alignItems: "center",
      gap: 4,
    },
    billLabel: {
      fontSize: 10,
      fontWeight: "600",
    },
    billAmount: {
      fontSize: 16,
      fontWeight: "800",
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    totalLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    totalValue: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.accent,
    },

    /* Members */
    memberCard: {
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight || colors.border,
    },
    memberTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    memberAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: "center",
      alignItems: "center",
    },
    memberAvatarText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    memberEmail: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 1,
    },
    memberBadges: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
    },
    memberBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    memberBadgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    memberJoined: {
      fontSize: 10,
      color: colors.textTertiary,
    },
    memberActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
      paddingLeft: 54,
    },
    memberActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
    },
    memberActionText: {
      fontSize: 11,
      fontWeight: "600",
    },

    /* Danger Actions */
    dangerAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.errorBg,
      borderRadius: 12,
      padding: 14,
    },
    dangerIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "rgba(231,76,60,0.15)",
      justifyContent: "center",
      alignItems: "center",
    },
    dangerActionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.error,
    },
    dangerActionSubtitle: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },

    /* Location */
    mapWrap: {
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 10,
    },
    mapView: {
      width: "100%",
      height: 160,
    },
    addressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
    },
    addressText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
    },

    /* Amenities */
    amenitiesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    amenityChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.cardAlt || colors.background,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    amenityText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.text,
    },

    /* House Rules */
    ruleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 8,
    },
    ruleCheck: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 1,
    },
    ruleText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 19,
    },

    /* Photos */
    photoGalleryScroll: {
      borderRadius: 12,
      overflow: "hidden",
      maxHeight: 180,
    },
    photoGalleryImg: {
      width: SCREEN_WIDTH - 84,
      height: 180,
      borderRadius: 12,
      marginRight: 8,
    },
    photoDotRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 10,
      gap: 6,
    },
    photoDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    photoDotActive: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: colors.accent,
    },

    /* Map expand */
    mapExpandHint: {
      position: "absolute",
      bottom: 8,
      right: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(255,255,255,0.9)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    mapExpandText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.accent,
    },

    /* Full Map Modal */
    fullMapHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 50,
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: "rgba(255,255,255,0.92)",
      gap: 12,
    },
    fullMapBackBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
        },
        android: { elevation: 3 },
      }),
    },
    fullMapTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    fullMapAddressBar: {
      position: "absolute",
      bottom: 24,
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "rgba(255,255,255,0.95)",
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
        },
        android: { elevation: 4 },
      }),
    },
    fullMapAddressText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
  });

export default AdminRoomDetailScreen;
