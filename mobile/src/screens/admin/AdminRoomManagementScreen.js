import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Dimensions,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SafeMapView from "../../components/SafeMapView";
import MapPickerView from "../../components/MapPickerView";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Predefined amenity options hosts can pick from
const AMENITY_OPTIONS = [
  { key: "wifi", icon: "wifi", label: "WiFi" },
  { key: "kitchen", icon: "restaurant", label: "Kitchen" },
  { key: "bathroom", icon: "water", label: "Bathroom" },
  { key: "bedroom", icon: "bed", label: "Bedroom" },
  { key: "hotwater", icon: "flame", label: "Hot Water" },
  { key: "parking", icon: "car", label: "Parking" },
  { key: "aircon", icon: "snow", label: "Air-con" },
  { key: "laundry", icon: "shirt", label: "Laundry" },
  { key: "tv", icon: "tv", label: "TV" },
  { key: "cctv", icon: "videocam", label: "CCTV" },
  { key: "common", icon: "people", label: "Common Area" },
  { key: "gym", icon: "barbell", label: "Gym" },
];

const AdminRoomManagementScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets);

  const [rooms, setRooms] = useState([]);

  // Open create form when navigated here with params.openCreate
  useEffect(() => {
    if (route?.params?.openCreate) {
      resetForm();
      setShowCreateForm(true);
      navigation.setParams({ openCreate: false });
    }
  }, [route?.params?.openCreate]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [maxOccupancy, setMaxOccupancy] = useState("");
  const [roomLatitude, setRoomLatitude] = useState(null);
  const [roomLongitude, setRoomLongitude] = useState(null);
  const [roomAddress, setRoomAddress] = useState("");
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [locatingDevice, setLocatingDevice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roomAmenities, setRoomAmenities] = useState([]);
  const [roomHouseRules, setRoomHouseRules] = useState([]);
  const [newRule, setNewRule] = useState("");
  const [roomPhotos, setRoomPhotos] = useState([]);
  const mapRef = useRef(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await roomService.getRooms();
      setRooms(response.rooms || response.data?.rooms || []);
    } catch (error) {
      console.log("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      Alert.alert("Error", "Please enter room name");
      return;
    }

    try {
      setSaving(true);
      const data = {
        name: roomName.trim(),
        description: roomDescription.trim(),
        maxOccupancy: maxOccupancy ? Number(maxOccupancy) : undefined,
      };
      if (roomLatitude != null && roomLongitude != null) {
        data.latitude = roomLatitude;
        data.longitude = roomLongitude;
        data.address = roomAddress || "";
      }
      data.amenities = roomAmenities;
      data.house_rules = roomHouseRules;
      data.photos = roomPhotos;
      await roomService.createRoom(data);
      await fetchRooms();
      resetForm();
      setShowCreateForm(false);
      Alert.alert("Success", "Room created successfully");
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to create room",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRoom = async () => {
    if (!roomName.trim()) {
      Alert.alert("Error", "Please enter room name");
      return;
    }

    try {
      setSaving(true);
      const data = {
        name: roomName.trim(),
        description: roomDescription.trim(),
        maxOccupancy: maxOccupancy ? Number(maxOccupancy) : undefined,
      };
      if (roomLatitude != null && roomLongitude != null) {
        data.latitude = roomLatitude;
        data.longitude = roomLongitude;
        data.address = roomAddress || "";
      }
      data.amenities = roomAmenities;
      data.house_rules = roomHouseRules;
      data.photos = roomPhotos;
      await roomService.updateRoom(editingRoom.id || editingRoom._id, data);
      await fetchRooms();
      resetForm();
      setEditingRoom(null);
      setShowCreateForm(false);
      Alert.alert("Success", "Room updated successfully");
    } catch (error) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to update room",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    Alert.alert(
      "Delete Room",
      "Are you sure you want to delete this room? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await roomService.deleteRoom(roomId);
              await fetchRooms();
              Alert.alert("Success", "Room deleted successfully");
            } catch (error) {
              Alert.alert(
                "Error",
                error.response?.data?.message || "Failed to delete room",
              );
            }
          },
        },
      ],
    );
  };

  const resetForm = () => {
    setRoomName("");
    setRoomDescription("");
    setMaxOccupancy("");
    setRoomLatitude(null);
    setRoomLongitude(null);
    setRoomAddress("");
    setRoomAmenities([]);
    setRoomHouseRules([]);
    setNewRule("");
    setRoomPhotos([]);
    setEditingRoom(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateForm(true);
  };

  const openEditModal = (room) => {
    setEditingRoom(room);
    setRoomName(room.name || "");
    setRoomDescription(room.description || "");
    setMaxOccupancy(String(room.maxOccupancy || room.max_occupancy || ""));
    setRoomLatitude(room.latitude != null ? parseFloat(room.latitude) : null);
    setRoomLongitude(
      room.longitude != null ? parseFloat(room.longitude) : null,
    );
    setRoomAddress(room.address || "");
    setRoomAmenities(Array.isArray(room.amenities) ? room.amenities : []);
    setRoomHouseRules(
      Array.isArray(room.houseRules || room.house_rules)
        ? room.houseRules || room.house_rules
        : [],
    );
    setRoomPhotos(Array.isArray(room.photos) ? room.photos : []);
    setNewRule("");
    setShowCreateForm(true);
  };

  // ── Photo Helpers ──
  const pickRoomPhoto = async () => {
    if (roomPhotos.length >= 5) {
      Alert.alert("Limit Reached", "Maximum 5 photos per room.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = () => {
          setRoomPhotos((prev) => [...prev, reader.result]);
        };
        reader.readAsDataURL(blob);
      } catch {
        Alert.alert("Error", "Failed to process image");
      }
    }
  };

  const removeRoomPhoto = (index) => {
    setRoomPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Location Helpers ──
  const reverseGeocode = async (lat, lng) => {
    // Try Nominatim (OpenStreetMap) first — gives detailed PH addresses with barangay
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=en`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "ApartmentBillTracker/1.0" },
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data?.address) {
          const a = data.address;
          // Build street part
          const street =
            a.road ||
            a.pedestrian ||
            a.footway ||
            a.house_number ||
            a.building ||
            "";
          const houseNum = a.house_number && a.road ? `${a.house_number} ` : "";
          const fullStreet = houseNum ? `${houseNum}${a.road || ""}` : street;
          // Barangay (suburb or neighbourhood in PH)
          const barangay =
            a.suburb ||
            a.neighbourhood ||
            a.quarter ||
            a.village ||
            a.hamlet ||
            "";
          // City / municipality
          const city =
            a.city || a.town || a.municipality || a.city_district || "";
          // Province / region
          const province = a.state || a.province || a.county || a.region || "";
          // Country
          const country = a.country || "";

          // Format: Street, Barangay/Brgy., City, Province
          const parts = [];
          if (fullStreet) parts.push(fullStreet);
          if (barangay) parts.push(`Brgy. ${barangay}`);
          if (city) parts.push(city);
          if (province && province !== city) parts.push(province);
          if (!parts.length && country) parts.push(country);

          if (parts.length > 0) return parts.join(", ");
        }
      }
    } catch (e) {
      console.warn("Nominatim reverse geocode failed, trying fallback:", e);
    }

    // Fallback to expo-location
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });
      if (results && results.length > 0) {
        const r = results[0];
        const parts = [
          r.streetNumber
            ? `${r.streetNumber} ${r.street || ""}`.trim()
            : r.street,
          r.subregion || r.district,
          r.city,
          r.region,
        ].filter(Boolean);
        return parts.join(", ");
      }
    } catch (e) {
      console.warn("Expo reverse geocode also failed:", e);
    }
    return "";
  };

  const handleUseDeviceLocation = async () => {
    try {
      setLocatingDevice(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to pin the room on the map.",
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;
      setRoomLatitude(latitude);
      setRoomLongitude(longitude);
      const addr = await reverseGeocode(latitude, longitude);
      if (addr) setRoomAddress(addr);
      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500,
      );
    } catch (e) {
      Alert.alert("Error", "Could not get current location.");
      console.error(e);
    } finally {
      setLocatingDevice(false);
    }
  };

  const handleMapPress = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setRoomLatitude(latitude);
    setRoomLongitude(longitude);
    const addr = await reverseGeocode(latitude, longitude);
    if (addr) setRoomAddress(addr);
  };

  const defaultRegion = {
    latitude: roomLatitude || 10.3157, // Default to Cebu City, Philippines
    longitude: roomLongitude || 123.8854,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalMembers = rooms.reduce(
    (sum, r) => sum + (r.members?.length || 0),
    0,
  );

  const renderRoomCard = (room) => {
    const memberCount = room.members?.length || 0;
    const maxOcc = room.maxOccupancy || room.max_occupancy;
    const occupancyPercent = maxOcc
      ? Math.round((memberCount / maxOcc) * 100)
      : null;
    const roomCode = room.code || room.room_code;

    return (
      <TouchableOpacity
        key={room.id || room._id}
        style={styles.roomCard}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate("BillingStack", {
            screen: "AdminBilling",
            params: { roomId: room.id || room._id, roomName: room.name },
          })
        }
      >
        <View style={styles.roomCardTop}>
          <View style={styles.roomIconWrap}>
            <Ionicons name="home" size={20} color={colors.textOnAccent} />
          </View>
          <View style={styles.roomCardInfo}>
            <Text style={styles.roomName} numberOfLines={1}>
              {room.name}
            </Text>
            {roomCode ? (
              <View style={styles.codeBadge}>
                <Ionicons name="key-outline" size={10} color={colors.accent} />
                <Text style={styles.codeText}>{roomCode}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.roomCardActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => openEditModal(room)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={18} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleDeleteRoom(room.id || room._id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color="#c62828" />
            </TouchableOpacity>
          </View>
        </View>

        {room.description ? (
          <Text style={styles.roomDesc} numberOfLines={2}>
            {room.description}
          </Text>
        ) : null}

        <View style={styles.roomCardBottom}>
          <View style={styles.metaChip}>
            <Ionicons name="people" size={13} color={colors.info} />
            <Text style={styles.metaChipText}>
              {memberCount} member{memberCount !== 1 ? "s" : ""}
            </Text>
          </View>

          {maxOcc ? (
            <View style={styles.metaChip}>
              <Ionicons name="resize" size={13} color={colors.internetColor} />
              <Text style={styles.metaChipText}>Max {maxOcc}</Text>
            </View>
          ) : null}

          {occupancyPercent !== null ? (
            <View
              style={[
                styles.metaChip,
                {
                  backgroundColor:
                    occupancyPercent >= 90
                      ? "#fce4ec"
                      : occupancyPercent >= 70
                        ? "#fff8e1"
                        : colors.successBg,
                },
              ]}
            >
              <Ionicons
                name={occupancyPercent >= 90 ? "warning" : "pulse"}
                size={13}
                color={
                  occupancyPercent >= 90
                    ? "#c62828"
                    : occupancyPercent >= 70
                      ? colors.electricityColor
                      : colors.success
                }
              />
              <Text
                style={[
                  styles.metaChipText,
                  {
                    color:
                      occupancyPercent >= 90
                        ? "#c62828"
                        : occupancyPercent >= 70
                          ? colors.electricityColor
                          : colors.success,
                  },
                ]}
              >
                {occupancyPercent}% full
              </Text>
            </View>
          ) : null}

          {room.latitude != null && room.longitude != null && (
            <View style={styles.metaChip}>
              <Ionicons name="location" size={13} color={colors.accent} />
              <Text style={styles.metaChipText} numberOfLines={1}>
                {room.address
                  ? room.address.split(",").slice(0, 2).join(", ")
                  : "Pinned"}
              </Text>
            </View>
          )}
        </View>

        {/* Mini Map Preview */}
        {room.latitude != null && room.longitude != null && (
          <View style={styles.cardMapWrap}>
            <SafeMapView
              latitude={parseFloat(room.latitude)}
              longitude={parseFloat(room.longitude)}
              style={styles.cardMap}
            />
            {room.address ? (
              <Text style={styles.cardMapAddress} numberOfLines={2}>
                {room.address}
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.roomCardFooter}>
          <Text style={styles.viewDetailsText}>View billing & details</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Summary Strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <View
            style={[
              styles.summaryIconWrap,
              { backgroundColor: colors.accentSurface },
            ]}
          >
            <Ionicons name="home" size={16} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.summaryValue}>{rooms.length}</Text>
            <Text style={styles.summaryLabel}>Rooms</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <View
            style={[styles.summaryIconWrap, { backgroundColor: colors.infoBg }]}
          >
            <Ionicons name="people" size={16} color={colors.info} />
          </View>
          <View>
            <Text style={styles.summaryValue}>{totalMembers}</Text>
            <Text style={styles.summaryLabel}>Members</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <TouchableOpacity style={styles.addRoomBtn} onPress={openCreateModal}>
          <Ionicons name="add-circle" size={20} color={colors.textOnAccent} />
          <Text style={styles.addRoomBtnText}>Add Room</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search rooms..."
            placeholderTextColor={colors.textTertiary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Rooms List */}
      <ScrollView
        style={styles.listWrap}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintcolor={colors.accent}
            colors={["#b38604"]}
          />
        }
      >
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading rooms...</Text>
          </View>
        ) : filteredRooms.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="home-outline" size={44} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>
              {rooms.length === 0 ? "No rooms yet" : "No matches found"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {rooms.length === 0
                ? 'Tap "Add Room" to create your first room'
                : "Try a different search term"}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.listHeader}>
              {filteredRooms.length} room{filteredRooms.length !== 1 ? "s" : ""}
              {searchTerm ? ` matching "${searchTerm}"` : ""}
            </Text>
            {filteredRooms.map(renderRoomCard)}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateForm}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowCreateForm(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
            </View>
            <View style={styles.modalTitleRow}>
              <View style={styles.modalTitleIconWrap}>
                <Ionicons
                  name={editingRoom ? "create" : "add-circle"}
                  size={22}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.modalTitle}>
                {editingRoom ? "Edit Room" : "Create New Room"}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formFields}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Room Name *</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons
                      name="home-outline"
                      size={18}
                      color={colors.accent}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Room 101"
                      placeholderTextColor={colors.textTertiary}
                      value={roomName}
                      onChangeText={setRoomName}
                      editable={!saving}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Description</Text>
                  <View style={[styles.inputWrap, styles.textAreaWrap]}>
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color={colors.accent}
                      style={{ marginTop: 2 }}
                    />
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Room description (optional)"
                      placeholderTextColor={colors.textTertiary}
                      value={roomDescription}
                      onChangeText={setRoomDescription}
                      multiline
                      editable={!saving}
                    />
                  </View>
                </View>

                {/* ── Room Photos ── */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Photos ({roomPhotos.length}/5)
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.photoScrollRow}
                  >
                    {roomPhotos.map((uri, idx) => (
                      <View key={idx} style={styles.photoThumbWrap}>
                        <Image source={{ uri }} style={styles.photoThumb} />
                        <TouchableOpacity
                          style={styles.photoRemoveBtn}
                          onPress={() => removeRoomPhoto(idx)}
                        >
                          <Ionicons name="close" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {roomPhotos.length < 5 && (
                      <TouchableOpacity
                        style={styles.photoAddBtn}
                        onPress={pickRoomPhoto}
                        disabled={saving}
                      >
                        <Ionicons
                          name="camera-outline"
                          size={24}
                          color={colors.accent}
                        />
                        <Text style={styles.photoAddText}>Add Photo</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Max Occupancy</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons
                      name="people-outline"
                      size={18}
                      color={colors.accent}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 4"
                      placeholderTextColor={colors.textTertiary}
                      value={maxOccupancy}
                      onChangeText={setMaxOccupancy}
                      keyboardType="number-pad"
                      editable={!saving}
                    />
                  </View>
                </View>

                {/* ── Location Section ── */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Location</Text>
                  {roomLatitude != null && roomLongitude != null ? (
                    <View style={styles.locationPreview}>
                      <SafeMapView
                        latitude={roomLatitude}
                        longitude={roomLongitude}
                        style={styles.miniMap}
                      />
                      {roomAddress ? (
                        <Text style={styles.locationAddress} numberOfLines={2}>
                          {roomAddress}
                        </Text>
                      ) : null}
                      <View style={styles.locationActions}>
                        <TouchableOpacity
                          style={styles.locationActionBtn}
                          onPress={() => setMapModalVisible(true)}
                        >
                          <Ionicons
                            name="map-outline"
                            size={14}
                            color={colors.accent}
                          />
                          <Text style={styles.locationActionText}>Change</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.locationActionBtn}
                          onPress={() => {
                            setRoomLatitude(null);
                            setRoomLongitude(null);
                            setRoomAddress("");
                          }}
                        >
                          <Ionicons
                            name="close-circle-outline"
                            size={14}
                            color="#c62828"
                          />
                          <Text
                            style={[
                              styles.locationActionText,
                              { color: "#c62828" },
                            ]}
                          >
                            Remove
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.locationButtons}>
                      <TouchableOpacity
                        style={styles.locationPickBtn}
                        onPress={() => setMapModalVisible(true)}
                        disabled={saving}
                      >
                        <Ionicons
                          name="map-outline"
                          size={18}
                          color={colors.accent}
                        />
                        <Text style={styles.locationPickBtnText}>
                          Pick on Map
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.locationPickBtn}
                        onPress={handleUseDeviceLocation}
                        disabled={saving || locatingDevice}
                      >
                        {locatingDevice ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.accent}
                          />
                        ) : (
                          <Ionicons
                            name="locate-outline"
                            size={18}
                            color={colors.accent}
                          />
                        )}
                        <Text style={styles.locationPickBtnText}>
                          Use My Location
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* ── Amenities Section ── */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Amenities</Text>
                  <View style={styles.amenityGrid}>
                    {AMENITY_OPTIONS.map((a) => {
                      const selected = roomAmenities.includes(a.key);
                      return (
                        <TouchableOpacity
                          key={a.key}
                          style={[
                            styles.amenityChip,
                            selected && {
                              backgroundColor: colors.accentSurface,
                              borderColor: colors.accent,
                            },
                          ]}
                          onPress={() => {
                            if (selected) {
                              setRoomAmenities((prev) =>
                                prev.filter((k) => k !== a.key),
                              );
                            } else {
                              setRoomAmenities((prev) => [...prev, a.key]);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={a.icon}
                            size={16}
                            color={
                              selected ? colors.accent : colors.textTertiary
                            }
                          />
                          <Text
                            style={[
                              styles.amenityChipText,
                              selected && { color: colors.accent },
                            ]}
                          >
                            {a.label}
                          </Text>
                          {selected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color={colors.accent}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* ── House Rules Section ── */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>House Rules</Text>
                  {roomHouseRules.map((rule, idx) => (
                    <View key={idx} style={styles.ruleItem}>
                      <View style={styles.ruleBullet}>
                        <Text style={styles.ruleBulletText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.ruleText} numberOfLines={2}>
                        {rule}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          setRoomHouseRules((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color="#c62828"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={styles.addRuleRow}>
                    <View style={[styles.inputWrap, { flex: 1 }]}>
                      <Ionicons
                        name="clipboard-outline"
                        size={16}
                        color={colors.accent}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Add a house rule..."
                        placeholderTextColor={colors.textTertiary}
                        value={newRule}
                        onChangeText={setNewRule}
                        onSubmitEditing={() => {
                          if (newRule.trim()) {
                            setRoomHouseRules((prev) => [
                              ...prev,
                              newRule.trim(),
                            ]);
                            setNewRule("");
                          }
                        }}
                        returnKeyType="done"
                      />
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.addRuleBtn,
                        !newRule.trim() && { opacity: 0.4 },
                      ]}
                      onPress={() => {
                        if (newRule.trim()) {
                          setRoomHouseRules((prev) => [
                            ...prev,
                            newRule.trim(),
                          ]);
                          setNewRule("");
                        }
                      }}
                      disabled={!newRule.trim()}
                    >
                      <Ionicons
                        name="add"
                        size={20}
                        color={colors.textOnAccent}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Form Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.btnDisabled]}
                onPress={editingRoom ? handleUpdateRoom : handleCreateRoom}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textOnAccent} size="small" />
                ) : (
                  <>
                    <Ionicons
                      name={editingRoom ? "checkmark-circle" : "add-circle"}
                      size={18}
                      color={colors.textOnAccent}
                    />
                    <Text style={styles.submitBtnText}>
                      {editingRoom ? "Update Room" : "Create Room"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Map Picker Modal ── */}
      <Modal
        visible={mapModalVisible}
        animationType="slide"
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View style={styles.mapModalContainer}>
          <MapPickerView
            ref={mapRef}
            style={styles.fullMap}
            latitude={roomLatitude || defaultRegion.latitude}
            longitude={roomLongitude || defaultRegion.longitude}
            onLocationSelect={handleMapPress}
          />

          {/* Map Header */}
          <View style={styles.mapHeader}>
            <TouchableOpacity
              style={styles.mapHeaderBtn}
              onPress={() => setMapModalVisible(false)}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>Pin Room Location</Text>
            <TouchableOpacity
              style={[styles.mapHeaderBtn, { backgroundColor: colors.accent }]}
              onPress={() => setMapModalVisible(false)}
            >
              <Ionicons name="checkmark" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Map Controls */}
          <View style={styles.mapControls}>
            <TouchableOpacity
              style={styles.mapControlBtn}
              onPress={handleUseDeviceLocation}
              disabled={locatingDevice}
            >
              {locatingDevice ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="locate" size={22} color={colors.accent} />
              )}
            </TouchableOpacity>
          </View>

          {/* Address Bar */}
          {roomLatitude != null && (
            <View style={styles.mapAddressBar}>
              <Ionicons name="location" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.mapAddressText} numberOfLines={2}>
                  {roomAddress || "Location selected"}
                </Text>
                <Text style={styles.mapCoordsText}>
                  {roomLatitude.toFixed(6)}, {roomLongitude.toFixed(6)}
                </Text>
              </View>
            </View>
          )}

          {/* Instruction */}
          {roomLatitude == null && (
            <View style={styles.mapInstruction}>
              <Ionicons
                name="finger-print-outline"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={styles.mapInstructionText}>
                Tap on the map to pin the room location
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors, insets = { top: 0, bottom: 0 }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // Summary Strip
    summaryStrip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#e8e8e8",
      gap: 12,
    },
    summaryItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    summaryIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    summaryLabel: {
      fontSize: 10,
      fontWeight: "500",
      color: colors.textTertiary,
      marginTop: -1,
    },
    summaryDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.skeleton,
    },
    addRoomBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.accent,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      marginLeft: "auto",
    },
    addRoomBtnText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "600",
    },

    // Search
    searchWrap: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.card,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingHorizontal: 12,
      gap: 8,
      height: 40,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      paddingVertical: 0,
    },

    // List
    listWrap: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    listHeader: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
      marginBottom: 10,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    // Room Card
    roomCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 10,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
    roomCardTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    roomIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    roomCardInfo: {
      flex: 1,
    },
    roomName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    codeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.accentSurface,
      alignSelf: "flex-start",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 3,
    },
    codeText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.accent,
      letterSpacing: 0.5,
    },
    roomCardActions: {
      flexDirection: "row",
      gap: 6,
    },
    actionBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    roomDesc: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 10,
      lineHeight: 17,
      paddingLeft: 54,
    },
    roomCardBottom: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
      paddingLeft: 54,
    },
    metaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    metaChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    roomCardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
      gap: 4,
    },
    viewDetailsText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.accent,
    },

    // Loading & Empty
    centerWrap: {
      alignItems: "center",
      paddingTop: 60,
    },
    loadingText: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 12,
    },
    emptyWrap: {
      alignItems: "center",
      paddingTop: 48,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textSecondary,
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: "center",
      lineHeight: 18,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom:
        Platform.OS === "ios" ? 36 : Math.max(24, insets.bottom + 8),
      maxHeight: "85%",
    },
    modalHeader: {
      alignItems: "center",
      paddingTop: 10,
      paddingBottom: 4,
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.skeleton,
    },
    modalTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 10,
    },
    modalTitleIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
    },
    modalTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    modalCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },

    // Form
    formFields: {
      paddingHorizontal: 20,
      gap: 16,
    },
    fieldGroup: {},
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 6,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    textAreaWrap: {
      alignItems: "flex-start",
      paddingVertical: 12,
    },
    input: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      paddingVertical: 12,
    },
    textArea: {
      minHeight: 70,
      textAlignVertical: "top",
      paddingVertical: 0,
    },

    // Modal Buttons
    modalButtons: {
      flexDirection: "row",
      paddingHorizontal: 20,
      gap: 10,
      marginTop: 24,
    },
    cancelBtn: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    cancelBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    submitBtn: {
      flex: 2,
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    submitBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
    },
    btnDisabled: {
      opacity: 0.6,
    },

    // ── Location in Form ──
    locationPreview: {
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.divider,
      overflow: "hidden",
    },
    miniMap: {
      width: "100%",
      height: 140,
    },
    locationAddress: {
      fontSize: 12,
      color: colors.textSecondary,
      paddingHorizontal: 12,
      paddingTop: 8,
      lineHeight: 17,
    },
    locationActions: {
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 16,
    },
    locationActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    locationActionText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.accent,
    },
    locationButtons: {
      flexDirection: "row",
      gap: 10,
    },
    locationPickBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.divider,
      paddingVertical: 12,
    },
    locationPickBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },

    // ── Room Card Map ──
    cardMapWrap: {
      marginTop: 10,
      marginLeft: 54,
      borderRadius: 10,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.divider,
    },
    cardMap: {
      width: "100%",
      height: 100,
    },
    cardMapAddress: {
      fontSize: 11,
      color: colors.textTertiary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.background,
    },

    // ── Map Picker Modal ──
    mapModalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    fullMap: {
      flex: 1,
    },
    mapHeader: {
      position: "absolute",
      top: Math.max(16, insets.top + 6),
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    mapHeaderBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        },
        android: { elevation: 4 },
      }),
    },
    mapHeaderTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        },
        android: { elevation: 4 },
      }),
    },
    mapControls: {
      position: "absolute",
      right: 16,
      bottom: 160,
    },
    mapControlBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        },
        android: { elevation: 4 },
      }),
    },
    mapAddressBar: {
      position: "absolute",
      bottom: Platform.OS === "ios" ? 40 : 24,
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        },
        android: { elevation: 4 },
      }),
    },
    mapAddressText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      lineHeight: 18,
    },
    mapCoordsText: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    mapInstruction: {
      position: "absolute",
      bottom: Platform.OS === "ios" ? 40 : 24,
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        },
        android: { elevation: 4 },
      }),
    },
    mapInstructionText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },

    // ── Amenities Picker ──
    amenityGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    amenityChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    amenityChipText: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.textSecondary,
    },

    // ── House Rules ──
    ruleItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 8,
      backgroundColor: colors.inputBg,
      borderRadius: 8,
      marginBottom: 6,
    },
    ruleBullet: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    ruleBulletText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textOnAccent,
    },
    ruleText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    addRuleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    addRuleBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },

    /* Photos */
    photoScrollRow: {
      flexGrow: 0,
      marginTop: 6,
    },
    photoThumbWrap: {
      width: 100,
      height: 72,
      borderRadius: 10,
      marginRight: 8,
      overflow: "hidden",
    },
    photoThumb: {
      width: "100%",
      height: "100%",
      borderRadius: 10,
    },
    photoRemoveBtn: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    photoAddBtn: {
      width: 100,
      height: 72,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderStyle: "dashed",
      justifyContent: "center",
      alignItems: "center",
      gap: 4,
    },
    photoAddText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.accent,
    },
  });

export default AdminRoomManagementScreen;
