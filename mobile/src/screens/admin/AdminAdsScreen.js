import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { AuthContext } from "../../context/AuthContext";
import { adsService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import {
  ScrollViewWithDetection,
  FlatListWithDetection,
} from "../../components/ScrollDetectionWrappers";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeSpaceLoader from "../../components/SpaceLoader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const AdminAdsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets);

  const { state } = useContext(AuthContext);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAd, setEditingAd] = useState(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [buttonText, setButtonText] = useState("Learn More");
  const [buttonLink, setButtonLink] = useState("");
  const [displayOn, setDisplayOn] = useState(["client"]);
  const [displayScreen, setDisplayScreen] = useState("home");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  );
  const [isActive, setIsActive] = useState(true);
  const [priority, setPriority] = useState(0);
  const [dismissible, setDismissible] = useState(true);

  // Date picker
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Analytics
  const [selectedAdAnalytics, setSelectedAdAnalytics] = useState(null);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  const userId = state?.user?.id || state?.user?._id;

  useFocusEffect(
    React.useCallback(() => {
      loadAds();
    }, []),
  );

  const loadAds = async () => {
    try {
      setLoading(true);
      const response = await adsService.getAllAds();
      setAds(response || []);
    } catch (error) {
      Alert.alert("Error", "Failed to load ads");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAds();
    setRefreshing(false);
  };

  const handleStartDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setStartDate(selectedDate);
    }
    setShowStartDatePicker(false);
  };

  const handleEndDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setEndDate(selectedDate);
    }
    setShowEndDatePicker(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setImageUrl("");
    setSelectedImageUri(null);
    setButtonText("Learn More");
    setButtonLink("");
    setDisplayOn(["client"]);
    setDisplayScreen("home");
    setStartDate(new Date());
    setEndDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    setIsActive(true);
    setPriority(0);
    setDismissible(true);
    setEditingAd(null);
  };

  const handlePickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library to upload an image.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        // allowsEditing opens the native crop screen so the admin can
        // adjust the image before upload. No fixed `aspect` is set, so
        // it opens with the full image selected — cropping is optional,
        // not forced.
        allowsEditing: true,
        quality: 1, // maximum quality; Cloudinary handles compression
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleUploadImage = async () => {
    if (!selectedImageUri) {
      Alert.alert("Error", "No image selected");
      return;
    }

    try {
      setUploadingImage(true);
      console.log("[Upload] Starting upload from:", selectedImageUri);

      const formData = new FormData();
      formData.append("image", {
        uri: selectedImageUri,
        type: "image/jpeg",
        name: "ad-image.jpg",
      });

      console.log("[Upload] FormData created, sending to backend...");

      const result = await adsService.uploadImage(formData);

      console.log("[Upload] Response received:", result);

      const imageUrl = result?.data?.imageUrl || result?.imageUrl;

      if (imageUrl) {
        setImageUrl(imageUrl);
        setSelectedImageUri(null);
        Alert.alert("Success", "Image uploaded to Cloudinary");
      } else {
        const responseStr = JSON.stringify(result).substring(0, 200);
        throw new Error(`Invalid response structure: ${responseStr}`);
      }
    } catch (error) {
      console.error("Upload error full:", error);
      const errorMsg =
        error.message ||
        "Network error - is the backend server running and accessible?";
      Alert.alert("Upload Failed", errorMsg);
    } finally {
      setUploadingImage(false);
    }
  };

  const clearImageUrl = () => {
    setImageUrl("");
    setSelectedImageUri(null);
  };

  const handleCreateAd = async () => {
    if (!imageUrl.trim()) {
      Alert.alert("Error", "Image URL is required");
      return;
    }

    try {
      const adData = {
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        buttonText,
        buttonLink: buttonLink.trim(),
        displayOn,
        displayScreen,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isActive,
        priority: parseInt(priority) || 0,
        dismissible,
      };

      if (editingAd) {
        await adsService.updateAd(editingAd.id, adData);
        Alert.alert("Success", "Ad updated successfully");
      } else {
        await adsService.createAd(adData);
        Alert.alert("Success", "Ad created successfully");
      }

      setShowCreateModal(false);
      resetForm();
      loadAds();
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to save ad");
      console.error(error);
    }
  };

  const handleEditAd = (ad) => {
    setTitle(ad.title);
    setDescription(ad.description || "");
    setImageUrl(ad.image_url);
    setButtonText(ad.button_text || "Learn More");
    setButtonLink(ad.button_link || "");
    setDisplayOn(ad.display_on || ["client"]);
    setDisplayScreen(ad.display_screen || "home");
    setStartDate(new Date(ad.start_date));
    setEndDate(ad.end_date ? new Date(ad.end_date) : new Date());
    setIsActive(ad.is_active);
    setPriority(String(ad.priority || 0));
    setDismissible(ad.dismissible !== false);
    setEditingAd(ad);
    setShowCreateModal(true);
  };

  const handleDeleteAd = async (adId) => {
    Alert.alert("Delete Ad?", "Are you sure you want to delete this ad?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await adsService.deleteAd(adId);
            Alert.alert("Success", "Ad deleted");
            loadAds();
          } catch (error) {
            Alert.alert("Error", "Failed to delete ad");
          }
        },
      },
    ]);
  };

  const handleToggleActive = async (ad) => {
    try {
      await adsService.updateAd(ad.id, { is_active: !ad.is_active });
      loadAds();
    } catch (error) {
      Alert.alert("Error", "Failed to update ad status");
    }
  };

  const handleViewAnalytics = async (ad) => {
    try {
      const analytics = await adsService.getAdAnalytics(ad.id);
      setSelectedAdAnalytics({ ...ad, analytics });
      setShowAnalyticsModal(true);
    } catch (error) {
      Alert.alert("Error", "Failed to load analytics");
    }
  };

  const toggleDisplayOn = (role) => {
    const updated = displayOn.includes(role)
      ? displayOn.filter((r) => r !== role)
      : [...displayOn, role];
    setDisplayOn(updated);
  };

  /**
   * AdImagePreview
   * ─────────────────────────────────────────────────────────────
   * Reads the native dimensions of the remote image via onLoad,
   * then sizes the container to exactly match that aspect ratio so
   * the full image is always visible — no cropping, no letterboxing.
   *
   * A floor of 160 and a ceiling of 65 % screen height keep cards
   * reasonable for both tiny icons and very tall portrait images.
   */
  const AdImagePreview = ({ uri }) => {
    const [containerHeight, setContainerHeight] = React.useState(200);

    const handleLoad = (e) => {
      const { width: srcW, height: srcH } = e.nativeEvent.source;
      if (srcW && srcH) {
        // Card inner width = screen − list padding (14 × 2) − card borders (1 × 2)
        const cardW = SCREEN_WIDTH - 30;
        const natural = (srcH / srcW) * cardW;
        setContainerHeight(
          Math.min(Math.max(natural, 160), SCREEN_HEIGHT * 0.65),
        );
      }
    };

    return (
      <View
        style={{
          width: "100%",
          height: containerHeight,
          backgroundColor: colors.inputBg,
          overflow: "hidden",
        }}
      >
        <Image
          source={{ uri }}
          // width/height fills the container; resizeMode="contain" guarantees
          // the whole image is visible — no pixel is ever cropped.
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
          onLoad={handleLoad}
          onError={(e) => console.log("Image load error:", e)}
        />
      </View>
    );
  };

  // Metric config with icons
  const metricConfig = [
    {
      label: "Screen",
      icon: "tv-outline",
      getValue: (ad) => ad.display_screen,
    },
    {
      label: "Priority",
      icon: "arrow-up-circle-outline",
      getValue: (ad) => ad.priority,
    },
    {
      label: "Views",
      icon: "eye-outline",
      getValue: (ad) => ad.total_impressions || 0,
    },
    {
      label: "Clicks",
      icon: "hand-left-outline",
      getValue: (ad) => ad.total_clicks || 0,
    },
  ];

  const renderAdCard = ({ item: ad }) => (
    <View style={styles.adCard}>
      {/* ── Status Accent Strip ── */}
      <View
        style={[
          styles.statusStrip,
          { backgroundColor: ad.is_active ? colors.success : colors.warning },
        ]}
      />

      {/* ── Card Header ── */}
      <View style={styles.cardHeader}>
        <View style={styles.titleSection}>
          <Text style={styles.adTitle}>{ad.title || "Untitled Ad"}</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: ad.is_active
                  ? colors.successBg
                  : colors.warningBg,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: ad.is_active
                    ? colors.success
                    : colors.warning,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: ad.is_active ? colors.success : colors.warning },
              ]}
            >
              {ad.is_active ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>
        <Switch
          value={ad.is_active}
          onValueChange={() => handleToggleActive(ad)}
          trackColor={{ false: colors.inputBorder, true: colors.accent }}
          thumbColor={ad.is_active ? "#ffffff" : colors.textTertiary}
        />
      </View>

      {/* ── Image — full native aspect ratio, nothing cropped ── */}
      {ad.image_url ? (
        <AdImagePreview uri={ad.image_url} />
      ) : (
        <View style={styles.imagePlaceholderContainer}>
          <View style={styles.imagePlaceholderIconWrap}>
            <Ionicons name="image-outline" size={32} color={colors.accent} />
          </View>
          <Text style={styles.imagePlaceholderText}>No image set</Text>
        </View>
      )}

      {/* ── Description ── */}
      {ad.description && (
        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionText} numberOfLines={2}>
            {ad.description}
          </Text>
        </View>
      )}

      {/* ── Metrics Grid ── */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricRow}>
          {metricConfig.map((metric, idx) => {
            const value = metric.getValue(ad);
            const isClickMetric = metric.label === "Clicks";
            const hasClicks = isClickMetric && value > 0;
            return (
              <React.Fragment key={metric.label}>
                {idx > 0 && <View style={styles.metricDivider} />}
                <View style={styles.metricItem}>
                  <View
                    style={[
                      styles.metricIconChip,
                      {
                        backgroundColor: hasClicks
                          ? colors.successBg
                          : colors.accentLight,
                      },
                    ]}
                  >
                    <Ionicons
                      name={metric.icon}
                      size={13}
                      color={hasClicks ? colors.success : colors.accent}
                    />
                  </View>
                  <Text
                    style={[
                      styles.metricValue,
                      hasClicks && { color: colors.success },
                    ]}
                  >
                    {value}
                  </Text>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>
      </View>

      {/* ── Date Range ── */}
      <View style={styles.dateSection}>
        <View style={styles.dateIconWrap}>
          <Ionicons name="calendar-outline" size={13} color={colors.accent} />
        </View>
        <Text style={styles.dateText}>
          {new Date(ad.start_date).toLocaleDateString()}
          {ad.end_date && ` → ${new Date(ad.end_date).toLocaleDateString()}`}
        </Text>
      </View>

      {/* ── Action Buttons ── */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.analyticsBtn]}
          onPress={() => handleViewAnalytics(ad)}
        >
          <Ionicons name="stats-chart" size={15} color={colors.accent} />
          <Text style={[styles.actionBtnText, { color: colors.accent }]}>
            Analytics
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.editBtn]}
          onPress={() => handleEditAd(ad)}
        >
          <Ionicons name="pencil" size={15} color={colors.accent} />
          <Text style={[styles.actionBtnText, { color: colors.accent }]}>
            Edit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteBtn]}
          onPress={() => handleDeleteAd(ad.id)}
        >
          <Ionicons name="trash" size={15} color={colors.error} />
          <Text style={[styles.actionBtnText, { color: colors.error }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <View style={styles.centerLoader}>
          <HomeSpaceLoader />
        </View>
      </View>
    );
  }

  // Computed summary stats
  const activeCount = ads.filter((a) => a.is_active).length;
  const totalImpressions = ads.reduce(
    (s, a) => s + (a.total_impressions || 0),
    0,
  );
  const totalClicks = ads.reduce((s, a) => s + (a.total_clicks || 0), 0);

  return (
    <View style={styles.container}>
      {/* ════════════════════════════════════
          Hero Header — forest green, matches
          client dashboard brand language
      ════════════════════════════════════ */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color={colors.headerText} />
          </TouchableOpacity>

          <View style={styles.headerTextBlock}>
            <Text style={styles.headerEyebrow}>PROPFLOW ADMIN</Text>
            <Text style={styles.headerTitle}>Ads Manager</Text>
          </View>

          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={() => {
              resetForm();
              setShowCreateModal(true);
            }}
          >
            <Ionicons name="add" size={22} color={colors.headerText} />
          </TouchableOpacity>
        </View>

        {/* Summary Stats Strip */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconWrap}>
              <Ionicons
                name="images-outline"
                size={15}
                color={colors.headerText}
              />
            </View>
            <Text style={styles.summaryNum}>{ads.length}</Text>
            <Text style={styles.summaryLbl}>Total</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconWrap}>
              <Ionicons name="radio-button-on" size={15} color="#78dc77" />
            </View>
            <Text style={styles.summaryNum}>{activeCount}</Text>
            <Text style={styles.summaryLbl}>Active</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconWrap}>
              <Ionicons
                name="eye-outline"
                size={15}
                color={colors.headerText}
              />
            </View>
            <Text style={styles.summaryNum}>{totalImpressions}</Text>
            <Text style={styles.summaryLbl}>Views</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <View style={styles.summaryIconWrap}>
              <Ionicons
                name="hand-left-outline"
                size={15}
                color={colors.headerText}
              />
            </View>
            <Text style={styles.summaryNum}>{totalClicks}</Text>
            <Text style={styles.summaryLbl}>Clicks</Text>
          </View>
        </View>
      </View>

      {/* ── Ads List ── */}
      <FlatListWithDetection
        data={ads}
        renderItem={renderAdCard}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="images-outline" size={36} color={colors.accent} />
            </View>
            <Text style={styles.emptyText}>No ads yet</Text>
            <Text style={styles.emptySubtext}>
              Tap + in the header to publish your first ad
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        contentContainerStyle={styles.listContent}
        scrollEnabled
      />

      {/* ════════════════════════════════════
          Create / Edit Modal
      ════════════════════════════════════ */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalSheet}>
            {/* Handle */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
            </View>

            {/* Title Row */}
            <View style={styles.modalTitleRow}>
              <View style={styles.modalTitleIconWrap}>
                <Ionicons
                  name={editingAd ? "create" : "image-outline"}
                  size={20}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.modalTitle}>
                {editingAd ? "Edit Ad" : "Create New Ad"}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollViewWithDetection
              style={styles.formScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formFields}>
                {/* Title */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.inputBorder }]}
                    placeholder="Ad title"
                    value={title}
                    onChangeText={setTitle}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                {/* Description */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.textArea,
                      { borderColor: colors.inputBorder },
                    ]}
                    placeholder="Ad description"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                {/* Image */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Image * (Upload or URL)</Text>

                  {!selectedImageUri && !imageUrl ? (
                    <>
                      {/* Pick Image Button */}
                      <TouchableOpacity
                        style={[
                          styles.uploadImageBtn,
                          { borderColor: colors.accent },
                        ]}
                        onPress={handlePickImage}
                      >
                        <Ionicons
                          name="cloud-upload-outline"
                          size={24}
                          color={colors.accent}
                        />
                        <Text
                          style={[
                            styles.uploadImageBtnText,
                            { color: colors.accent },
                          ]}
                        >
                          Select Image from Device
                        </Text>
                      </TouchableOpacity>

                      {/* Or Divider */}
                      <View style={styles.orDivider}>
                        <View
                          style={[
                            styles.dividerLine,
                            { backgroundColor: colors.divider },
                          ]}
                        />
                        <Text
                          style={[
                            styles.orText,
                            { color: colors.textTertiary },
                          ]}
                        >
                          OR
                        </Text>
                        <View
                          style={[
                            styles.dividerLine,
                            { backgroundColor: colors.divider },
                          ]}
                        />
                      </View>

                      {/* Paste URL */}
                      <Text style={[styles.label, { marginTop: 8 }]}>
                        Paste Image URL
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          { borderColor: colors.inputBorder },
                        ]}
                        placeholder="https://..."
                        value={imageUrl}
                        onChangeText={setImageUrl}
                        placeholderTextColor={colors.textTertiary}
                      />
                    </>
                  ) : null}

                  {/* Selected Image Preview (before upload) */}
                  {selectedImageUri && !imageUrl ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image
                        source={{ uri: selectedImageUri }}
                        style={styles.imagePreview}
                        resizeMode="contain"
                      />
                      <View style={styles.previewActions}>
                        <TouchableOpacity
                          style={[
                            styles.uploadConfirmBtn,
                            { backgroundColor: colors.accent },
                            uploadingImage && { opacity: 0.6 },
                          ]}
                          onPress={handleUploadImage}
                          disabled={uploadingImage}
                        >
                          {uploadingImage ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.textOnAccent}
                            />
                          ) : (
                            <>
                              <Ionicons
                                name="cloud-upload-outline"
                                size={16}
                                color={colors.textOnAccent}
                              />
                              <Text
                                style={{
                                  color: colors.textOnAccent,
                                  fontWeight: "600",
                                  marginLeft: 6,
                                }}
                              >
                                Upload to Cloudinary
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => setSelectedImageUri(null)}
                        >
                          <Ionicons
                            name="close"
                            size={16}
                            color={colors.textTertiary}
                          />
                          <Text
                            style={{
                              color: colors.textTertiary,
                              marginLeft: 6,
                            }}
                          >
                            Cancel
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}

                  {/* Final Image Preview (after upload) */}
                  {imageUrl && (
                    <View style={styles.imagePreviewContainer}>
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.imagePreview}
                        resizeMode="contain"
                        onError={(error) =>
                          console.log("Image load error:", error)
                        }
                      />
                      <TouchableOpacity
                        style={styles.clearImageBtn}
                        onPress={clearImageUrl}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={colors.textOnAccent}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Button Text */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Button Text</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.inputBorder }]}
                    placeholder="Learn More"
                    value={buttonText}
                    onChangeText={setButtonText}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                {/* Button Link */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Button Link</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.inputBorder }]}
                    placeholder="https://..."
                    value={buttonLink}
                    onChangeText={setButtonLink}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                {/* Display On */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Display On</Text>
                  <View style={styles.checkboxGroup}>
                    {["client", "host", "admin"].map((role) => (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.checkbox,
                          displayOn.includes(role) && styles.checkboxChecked,
                        ]}
                        onPress={() => toggleDisplayOn(role)}
                      >
                        <Ionicons
                          name={
                            displayOn.includes(role)
                              ? "checkbox"
                              : "checkbox-outline"
                          }
                          size={20}
                          color={colors.accent}
                        />
                        <Text style={styles.checkboxLabel}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Display Screen */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Display Screen</Text>
                  <View style={styles.pickerContainer}>
                    {["home", "payment", "history"].map((screen) => (
                      <TouchableOpacity
                        key={screen}
                        style={[
                          styles.pill,
                          displayScreen === screen && styles.pillActive,
                        ]}
                        onPress={() => setDisplayScreen(screen)}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            displayScreen === screen && styles.pillTextActive,
                          ]}
                        >
                          {screen}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Start Date */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Start Date</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Ionicons name="calendar" size={18} color={colors.accent} />
                    <Text
                      style={[styles.dateText, { color: colors.inputText }]}
                    >
                      {startDate.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* End Date */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>End Date</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Ionicons name="calendar" size={18} color={colors.accent} />
                    <Text
                      style={[styles.dateText, { color: colors.inputText }]}
                    >
                      {endDate.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Priority */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Priority</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.inputBorder }]}
                    placeholder="0"
                    value={String(priority)}
                    onChangeText={setPriority}
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                {/* Switches */}
                <View style={styles.switchGroup}>
                  <View
                    style={[
                      styles.switchItem,
                      {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.divider,
                      },
                    ]}
                  >
                    <Text style={styles.switchLabel}>Active</Text>
                    <Switch
                      value={isActive}
                      onValueChange={setIsActive}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor={isActive ? "#ffffff" : colors.border}
                    />
                  </View>
                  <View style={styles.switchItem}>
                    <Text style={styles.switchLabel}>Dismissable</Text>
                    <Switch
                      value={dismissible}
                      onValueChange={setDismissible}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor={dismissible ? "#ffffff" : colors.border}
                    />
                  </View>
                </View>

                {/* Submit */}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { backgroundColor: colors.accent },
                    ]}
                    onPress={handleCreateAd}
                  >
                    <Text
                      style={{
                        color: colors.textOnAccent,
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                    >
                      {editingAd ? "Update Ad" : "Publish Ad"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: insets.bottom + 8 }} />
              </View>
            </ScrollViewWithDetection>
          </View>
        </KeyboardAvoidingView>

        {showStartDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={handleStartDateChange}
          />
        )}

        {showEndDatePicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={handleEndDateChange}
          />
        )}
      </Modal>

      {/* ════════════════════════════════════
          Analytics Modal
      ════════════════════════════════════ */}
      <Modal
        visible={showAnalyticsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAnalyticsModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalSheet}>
            {/* Handle */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
            </View>

            {/* Title Row */}
            <View style={styles.modalTitleRow}>
              <View style={styles.modalTitleIconWrap}>
                <Ionicons
                  name="bar-chart-outline"
                  size={20}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.modalTitle}>Ad Analytics</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowAnalyticsModal(false)}
              >
                <Ionicons name="close" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollViewWithDetection
              style={styles.formScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formFields}>
                {selectedAdAnalytics && (
                  <>
                    {/* Ad preview row */}
                    <View style={styles.analyticsAdPreview}>
                      <View style={styles.analyticsAdIcon}>
                        <Ionicons
                          name="image-outline"
                          size={20}
                          color={colors.accent}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.analyticTitle}>
                          {selectedAdAnalytics.title || "Untitled Ad"}
                        </Text>
                        <Text style={styles.analyticSubtitle}>
                          {selectedAdAnalytics.display_screen} screen · Priority{" "}
                          {selectedAdAnalytics.priority}
                        </Text>
                      </View>
                    </View>

                    {/* Stat Cards */}
                    <View style={styles.statGrid}>
                      <View
                        style={[
                          styles.statCard,
                          { backgroundColor: colors.accentSurface },
                        ]}
                      >
                        <Ionicons
                          name="eye-outline"
                          size={22}
                          color={colors.accent}
                          style={{ marginBottom: 4 }}
                        />
                        <Text style={styles.statValue}>
                          {selectedAdAnalytics.analytics?.totalImpressions || 0}
                        </Text>
                        <Text style={styles.statLabel}>Impressions</Text>
                      </View>
                      <View
                        style={[
                          styles.statCard,
                          { backgroundColor: colors.accentSurface },
                        ]}
                      >
                        <Ionicons
                          name="hand-left-outline"
                          size={22}
                          color={colors.accent}
                          style={{ marginBottom: 4 }}
                        />
                        <Text style={styles.statValue}>
                          {selectedAdAnalytics.analytics?.totalClicks || 0}
                        </Text>
                        <Text style={styles.statLabel}>Clicks</Text>
                      </View>
                      <View
                        style={[
                          styles.statCard,
                          { backgroundColor: colors.accentSurface },
                        ]}
                      >
                        <Ionicons
                          name="trending-up-outline"
                          size={22}
                          color={colors.accent}
                          style={{ marginBottom: 4 }}
                        />
                        <Text style={styles.statValue}>
                          {selectedAdAnalytics.analytics?.ctr || "0"}%
                        </Text>
                        <Text style={styles.statLabel}>CTR</Text>
                      </View>
                    </View>
                  </>
                )}

                <View style={{ height: insets.bottom + 8 }} />
              </View>
            </ScrollViewWithDetection>
          </View>
        </KeyboardAvoidingView>
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
    centerContent: {
      justifyContent: "center",
      alignItems: "center",
    },
    centerLoader: {
      padding: 24,
    },

    // ── Hero Header ──────────────────────────
    header: {
      backgroundColor: colors.headerBg,
      paddingTop: insets.top + 8,
      paddingBottom: 0,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 12,
    },
    headerIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(255,255,255,0.12)",
      justifyContent: "center",
      alignItems: "center",
    },
    headerTextBlock: {
      flex: 1,
    },
    headerEyebrow: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1.5,
      color: "rgba(255,255,255,0.55)",
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.headerText,
      letterSpacing: 0.1,
    },
    headerAddBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },

    // ── Summary Stats Strip ──────────────────
    summaryStrip: {
      flexDirection: "row",
      backgroundColor: "rgba(0,0,0,0.22)",
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 4,
    },
    summaryItem: {
      flex: 1,
      alignItems: "center",
      gap: 3,
    },
    summaryIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor: "rgba(255,255,255,0.10)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 2,
    },
    summaryNum: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.headerText,
    },
    summaryLbl: {
      fontSize: 9,
      fontWeight: "600",
      color: "rgba(255,255,255,0.50)",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    summaryDivider: {
      width: 1,
      backgroundColor: "rgba(255,255,255,0.10)",
      alignSelf: "stretch",
      marginVertical: 4,
    },

    // ── List ────────────────────────────────
    listContent: {
      padding: 14,
      paddingBottom: 32,
    },

    // ── Ad Card ─────────────────────────────
    adCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    statusStrip: {
      height: 3,
      width: "100%",
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    titleSection: {
      flex: 1,
      marginRight: 8,
    },
    adTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
      letterSpacing: 0.1,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      alignSelf: "flex-start",
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "700",
    },

    // ── Image Container ──────────────────────
    imageContainer: {
      width: "100%",
      height: 220,
      backgroundColor: colors.background,
      position: "relative",
      overflow: "hidden",
    },
    previewImage: {
      width: "100%",
      height: "100%",
    },
    imageOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
      backgroundColor: "transparent",
    },
    imagePlaceholder: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.inputBg,
      gap: 8,
    },
    imagePlaceholderIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.accentLight,
      justifyContent: "center",
      alignItems: "center",
    },
    imagePlaceholderText: {
      fontSize: 13,
      color: colors.textTertiary,
      fontWeight: "500",
    },

    // ── Description ──────────────────────────
    descriptionSection: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    descriptionText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    // ── Metrics ──────────────────────────────
    metricsContainer: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    metricRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    metricItem: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },
    metricIconChip: {
      width: 28,
      height: 28,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 2,
    },
    metricLabel: {
      fontSize: 9,
      color: colors.textTertiary,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    metricValue: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.accent,
    },
    metricDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.divider,
    },

    // ── Date Section ─────────────────────────
    dateSection: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    dateIconWrap: {
      width: 24,
      height: 24,
      borderRadius: 7,
      backgroundColor: colors.accentLight,
      justifyContent: "center",
      alignItems: "center",
    },
    dateText: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "500",
    },

    // ── Action Buttons ───────────────────────
    actionButtons: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 10,
      gap: 5,
    },
    analyticsBtn: {
      backgroundColor: colors.accentLight,
    },
    editBtn: {
      backgroundColor: colors.accentLight,
    },
    deleteBtn: {
      backgroundColor: colors.errorBg,
    },
    actionBtnText: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.2,
    },

    // ── Empty State ──────────────────────────
    emptyContainer: {
      alignItems: "center",
      paddingVertical: 60,
      paddingHorizontal: 32,
      gap: 8,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: colors.accentLight,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    emptySubtext: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: "center",
      lineHeight: 18,
      marginTop: 2,
    },

    // ── Modal ────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: SCREEN_HEIGHT * 0.88,
      flexShrink: 1,
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

    // ── Form ─────────────────────────────────
    formFields: {
      paddingHorizontal: 20,
      paddingBottom: 0,
      gap: 12,
    },
    formScroll: {
      flexGrow: 0,
      flexShrink: 1,
    },
    formGroup: {
      gap: 6,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    input: {
      flex: 1,
      fontSize: 14,
      color: colors.inputText,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderRadius: 10,
      backgroundColor: colors.inputBg,
      borderColor: colors.divider,
    },
    textArea: {
      textAlignVertical: "top",
      minHeight: 100,
    },
    uploadImageBtn: {
      borderWidth: 2,
      borderStyle: "dashed",
      borderRadius: 12,
      paddingVertical: 24,
      paddingHorizontal: 16,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.inputBg,
    },
    uploadImageBtnText: {
      fontSize: 14,
      fontWeight: "600",
    },
    orDivider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 12,
      gap: 8,
    },
    dividerLine: {
      flex: 1,
      height: 1,
    },
    orText: {
      fontSize: 12,
      fontWeight: "600",
    },
    imagePreviewContainer: {
      position: "relative",
      marginTop: 12,
    },
    imagePreview: {
      width: "100%",
      height: 150,
      borderRadius: 10,
      backgroundColor: colors.background,
    },
    clearImageBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    previewActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    uploadConfirmBtn: {
      flex: 1,
      flexDirection: "row",
      paddingVertical: 12,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
    },
    cancelBtn: {
      flexDirection: "row",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxGroup: {
      flexDirection: "row",
      gap: 8,
    },
    checkbox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 8,
    },
    checkboxChecked: {
      backgroundColor: colors.accentLight,
    },
    checkboxLabel: {
      fontSize: 14,
      color: colors.text,
    },
    pickerContainer: {
      flexDirection: "row",
      gap: 8,
    },
    pill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    pillActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    pillText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "500",
    },
    pillTextActive: {
      color: colors.textOnAccent,
      fontWeight: "700",
    },
    dateButton: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 8,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
    },
    switchGroup: {
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      paddingHorizontal: 12,
      overflow: "hidden",
    },
    switchItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
    },
    switchLabel: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "500",
    },
    formActions: {
      marginVertical: 8,
      gap: 8,
    },
    actionBtn: {
      paddingVertical: 14,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },

    // ── Analytics Modal ──────────────────────
    analyticsAdPreview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.accentLight,
      borderRadius: 12,
      padding: 12,
      marginBottom: 4,
    },
    analyticsAdIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
    },
    analyticTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    analyticSubtitle: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    statGrid: {
      flexDirection: "row",
      gap: 12,
      flexWrap: "wrap",
    },
    statCard: {
      flex: 1,
      minWidth: 90,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    statLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
      fontWeight: "500",
    },
    statValue: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.accent,
    },
  });

export default AdminAdsScreen;
