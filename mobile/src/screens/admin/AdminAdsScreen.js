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
import { ScrollViewWithDetection, FlatListWithDetection } from "../../navigation/AdminNavigator";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  ); // 30 days from now
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

  // Image picker handler - Select image and upload to Cloudinary
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
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
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

  // Upload selected image to Cloudinary via backend
  const handleUploadImage = async () => {
    if (!selectedImageUri) {
      Alert.alert("Error", "No image selected");
      return;
    }

    try {
      setUploadingImage(true);
      console.log("[Upload] Starting upload from:", selectedImageUri);

      // Create FormData
      const formData = new FormData();
      formData.append("image", {
        uri: selectedImageUri,
        type: "image/jpeg",
        name: "ad-image.jpg",
      });

      console.log("[Upload] FormData created, sending to backend...");

      // Upload using adsService
      const result = await adsService.uploadImage(formData);

      console.log("[Upload] Response received:", result);

      // Handle response - could be { data, status } from uploadFormData
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
    // Check if image URL is provided (title is optional)
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

  const renderAdCard = ({ item: ad }) => (
    <View style={[styles.adCard, { borderColor: colors.inputBorder }]}>
      {/* Header with Status */}
      <View style={styles.cardHeader}>
        <View style={styles.titleSection}>
          <Text style={styles.adTitle}>{ad.title || "Untitled Ad"}</Text>
          <View style={styles.statusBadge}>
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
            <Text style={styles.statusText}>
              {ad.is_active ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>
        <Switch
          value={ad.is_active}
          onValueChange={() => handleToggleActive(ad)}
          trackColor={{ false: colors.inputBorder, true: colors.accent }}
          thumbColor={ad.is_active ? colors.accent : colors.inputBorder}
        />
      </View>

      {/* Professional Image Preview Container */}
      <View style={styles.imageContainer}>
        {ad.image_url ? (
          <>
            <Image
              source={{ uri: ad.image_url }}
              style={styles.previewImage}
              onError={(error) => console.log("Image load error:", error)}
            />
            {/* Gradient Overlay for better text contrast if needed */}
            <View style={styles.imageOverlay} />
          </>
        ) : (
          <View
            style={[
              styles.previewImage,
              {
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: colors.background,
              },
            ]}
          >
            <Ionicons
              name="image-outline"
              size={40}
              color={colors.textTertiary}
            />
          </View>
        )}
      </View>

      {/* Description Preview (if available) */}
      {ad.description && (
        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionText} numberOfLines={2}>
            {ad.description}
          </Text>
        </View>
      )}

      {/* Key Metrics - Professional Grid Layout */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Screen</Text>
            <Text style={styles.metricValue}>{ad.display_screen}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Priority</Text>
            <Text style={styles.metricValue}>{ad.priority}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Views</Text>
            <Text style={styles.metricValue}>{ad.total_impressions || 0}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Clicks</Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color:
                    ad.total_clicks > 0 ? colors.success : colors.textTertiary,
                },
              ]}
            >
              {ad.total_clicks || 0}
            </Text>
          </View>
        </View>
      </View>

      {/* Date Range */}
      <View style={styles.dateSection}>
        <Ionicons
          name="calendar-outline"
          size={14}
          color={colors.textTertiary}
        />
        <Text style={styles.dateText}>
          {new Date(ad.start_date).toLocaleDateString()}
          {ad.end_date && ` → ${new Date(ad.end_date).toLocaleDateString()}`}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.analyticsBtn]}
          onPress={() => handleViewAnalytics(ad)}
        >
          <Ionicons name="stats-chart" size={16} color={colors.accent} />
          <Text style={[styles.actionBtnText, { color: colors.accent }]}>
            Analytics
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.editBtn]}
          onPress={() => handleEditAd(ad)}
        >
          <Ionicons name="pencil" size={16} color={colors.accent} />
          <Text style={[styles.actionBtnText, { color: colors.accent }]}>
            Edit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteBtn]}
          onPress={() => handleDeleteAd(ad.id)}
        >
          <Ionicons name="trash" size={16} color={colors.error} />
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
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ads Management</Text>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowCreateModal(true);
          }}
        >
          <Ionicons name="add" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Ads List */}
      <FlatListWithDetection
        data={ads}
        renderItem={renderAdCard}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="image-outline"
              size={48}
              color={colors.textTertiary}
            />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              No ads yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
              Tap + to create your first ad
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        scrollEnabled
      />

      {/* Create/Edit Modal */}
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
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
            </View>

            {/* Modal Title Row */}
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
                  <Text style={styles.label}>Title *</Text>
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

                      {/* Paste URL Option */}
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
                          <Ionicons name="close" size={16} color="#999" />
                          <Text style={{ color: "#999", marginLeft: 6 }}>
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
                        onError={(error) =>
                          console.log("Image load error:", error)
                        }
                      />
                      <TouchableOpacity
                        style={styles.clearImageBtn}
                        onPress={clearImageUrl}
                      >
                        <Ionicons name="close-circle" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Button Text & Link */}
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

                {/* Display Settings */}
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

                {/* Dates */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Start Date</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      { borderColor: colors.inputBorder },
                    ]}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Ionicons name="calendar" size={18} color={colors.accent} />
                    <Text style={styles.dateText}>
                      {startDate.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>End Date</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      { borderColor: colors.inputBorder },
                    ]}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Ionicons name="calendar" size={18} color={colors.accent} />
                    <Text style={styles.dateText}>
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
                  <View style={styles.switchItem}>
                    <Text style={styles.switchLabel}>Active</Text>
                    <Switch
                      value={isActive}
                      onValueChange={setIsActive}
                      trackColor={{
                        false: colors.surfaceVariant,
                        true: colors.accent,
                      }}
                      thumbColor={
                        isActive ? colors.accent : colors.surfaceVariant
                      }
                    />
                  </View>
                  <View style={styles.switchItem}>
                    <Text style={styles.switchLabel}>Dismissible</Text>
                    <Switch
                      value={dismissible}
                      onValueChange={setDismissible}
                      trackColor={{
                        false: colors.surfaceVariant,
                        true: colors.accent,
                      }}
                      thumbColor={
                        dismissible ? colors.accent : colors.surfaceVariant
                      }
                    />
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: colors.accent,
                      },
                    ]}
                    onPress={handleCreateAd}
                  >
                    <Text
                      style={{ color: colors.textOnAccent, fontWeight: "600" }}
                    >
                      {editingAd ? "Update Ad" : "Create Ad"}
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

      {/* Analytics Modal */}
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
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
            </View>

            {/* Modal Title Row */}
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
                    <Text style={styles.analyticTitle}>
                      {selectedAdAnalytics.title}
                    </Text>

                    <View style={styles.statGrid}>
                      <View
                        style={[
                          styles.statCard,
                          { backgroundColor: colors.surfaceVariant },
                        ]}
                      >
                        <Text style={styles.statLabel}>Impressions</Text>
                        <Text style={styles.statValue}>
                          {selectedAdAnalytics.analytics?.totalImpressions || 0}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statCard,
                          { backgroundColor: colors.surfaceVariant },
                        ]}
                      >
                        <Text style={styles.statLabel}>Clicks</Text>
                        <Text style={styles.statValue}>
                          {selectedAdAnalytics.analytics?.totalClicks || 0}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statCard,
                          { backgroundColor: colors.surfaceVariant },
                        ]}
                      >
                        <Text style={styles.statLabel}>CTR</Text>
                        <Text style={styles.statValue}>
                          {selectedAdAnalytics.analytics?.ctr || "0"}%
                        </Text>
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
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceVariant,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    listContent: {
      padding: 12,
      paddingBottom: 24,
    },
    adCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
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
      letterSpacing: 0.2,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.accentSurface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      alignSelf: "flex-start",
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.accent,
    },
    imageContainer: {
      width: "100%",
      height: 280,
      backgroundColor: colors.background,
      position: "relative",
      overflow: "hidden",
    },
    previewImage: {
      width: "100%",
      height: "100%",
      backgroundColor: colors.background,
    },
    imageOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
      backgroundColor: "transparent",
    },
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
    metricsContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
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
      paddingVertical: 4,
    },
    metricLabel: {
      fontSize: 10,
      color: colors.textTertiary,
      marginBottom: 3,
      fontWeight: "500",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    metricValue: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.accent,
    },
    metricDivider: {
      width: 1,
      height: 20,
      backgroundColor: colors.divider,
      marginHorizontal: 8,
    },
    dateSection: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    dateText: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "500",
    },
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
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.inputBorder,
      gap: 5,
    },
    analyticsBtn: {
      backgroundColor: "transparent",
    },
    editBtn: {
      backgroundColor: "transparent",
    },
    deleteBtn: {
      borderColor: colors.error,
    },
    actionBtnText: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    emptyContainer: {
      alignItems: "center",
      paddingVertical: 48,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: "600",
      marginTop: 12,
    },
    emptySubtext: {
      fontSize: 13,
      marginTop: 4,
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
      paddingBottom: 12,
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
    formFields: {
      paddingHorizontal: 20,
      paddingBottom: 0,
      gap: 12,
    },
    formScroll: {
      maxHeight: "70%",
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
      color: colors.text,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderRadius: 8,
      backgroundColor: colors.background,
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
      fontWeight: "500",
    },
    imagePreviewContainer: {
      position: "relative",
      marginTop: 12,
    },
    imagePreview: {
      width: "100%",
      height: 150,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    clearImageBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "center",
      alignItems: "center",
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
      fontWeight: "500",
    },
    imagePreviewContainer: {
      position: "relative",
      marginTop: 12,
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
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
    },
    cancelBtn: {
      flexDirection: "row",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxGroup: {
      flexDirection: "row",
      gap: 12,
    },
    checkbox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 1,
      paddingVertical: 8,
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
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    pillActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    pillText: {
      fontSize: 12,
      color: colors.text,
    },
    pillTextActive: {
      color: colors.textOnAccent,
      fontWeight: "600",
    },
    dateButton: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      borderColor: colors.inputBorder,
    },
    switchGroup: {
      gap: 12,
      marginVertical: 12,
    },
    switchItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
    },
    switchLabel: {
      fontSize: 14,
      color: colors.text,
    },
    formActions: {
      marginVertical: 8,
      gap: 8,
    },
    actionBtn: {
      paddingVertical: 12,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    analyticTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 16,
    },
    statGrid: {
      flexDirection: "row",
      gap: 12,
      flexWrap: "wrap",
    },
    statCard: {
      flex: 1,
      minWidth: 100,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      alignItems: "center",
    },
    statLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.accent,
    },
  });

export default AdminAdsScreen;
