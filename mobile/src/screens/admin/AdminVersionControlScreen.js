import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  Platform,
} from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { settingsService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { ScrollViewWithDetection } from "../../components/ScrollDetectionWrappers";
import HomeSpaceLoader from "../../components/SpaceLoader";

const AdminVersionControlScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const currentAppVersion = Constants.expoConfig?.version || "1.0.0";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [minVersion, setMinVersion] = useState("1.0.0");
  const [latestVersion, setLatestVersion] = useState(currentAppVersion);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [updateUrl, setUpdateUrl] = useState(
    "https://github.com/@apartmentbilltracker/apartment-bill-tracker/releases",
  );
  const [updateMessage, setUpdateMessage] = useState("");

  const [original, setOriginal] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const changed =
      minVersion !== original.minVersion ||
      latestVersion !== original.latestVersion ||
      forceUpdate !== original.forceUpdate ||
      updateUrl !== original.updateUrl ||
      updateMessage !== original.updateMessage;
    setHasChanges(changed);
  }, [
    minVersion,
    latestVersion,
    forceUpdate,
    updateUrl,
    updateMessage,
    original,
  ]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsService.getVersionControl();
      const vc = response?.versionControl || response;
      if (vc) {
        const vals = {
          minVersion: vc.minAppVersion || "1.0.0",
          latestVersion: vc.latestAppVersion || currentAppVersion,
          forceUpdate: vc.forceUpdate || false,
          updateUrl:
            vc.updateUrl ||
            "https://github.com/@apartmentbilltracker/apartment-bill-tracker/releases",
          updateMessage: vc.updateMessage || "",
        };
        setMinVersion(vals.minVersion);
        setLatestVersion(vals.latestVersion);
        setForceUpdate(vals.forceUpdate);
        setUpdateUrl(vals.updateUrl);
        setUpdateMessage(vals.updateMessage);
        setOriginal(vals);
      }
    } catch (error) {
      console.error("Error fetching version settings:", error);
      Alert.alert("Error", "Failed to load version settings.");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSettings();
    setRefreshing(false);
  };

  const validateVersion = (v) => /^\d+\.\d+\.\d+$/.test(v.trim());

  const handleSave = async () => {
    if (!validateVersion(minVersion)) {
      Alert.alert(
        "Invalid Version",
        "Minimum App Version must be in format X.Y.Z (e.g., 1.0.0)",
      );
      return;
    }
    if (!validateVersion(latestVersion)) {
      Alert.alert(
        "Invalid Version",
        "Latest App Version must be in format X.Y.Z (e.g., 1.1.2)",
      );
      return;
    }
    if (forceUpdate) {
      Alert.alert(
        "Confirm Force Update",
        `Enabling force update will block ALL users running a version below ${minVersion} from using the app until they update.\n\nAre you sure?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Yes, Enable", style: "destructive", onPress: doSave },
        ],
      );
    } else {
      doSave();
    }
  };

  const doSave = async () => {
    try {
      setSaving(true);
      await settingsService.updateVersionControl({
        min_app_version: minVersion.trim(),
        latest_app_version: latestVersion.trim(),
        force_update: forceUpdate,
        update_url: updateUrl.trim(),
        update_message: updateMessage.trim(),
      });
      Alert.alert("Saved", "Version control settings updated successfully.");
      setOriginal({
        minVersion: minVersion.trim(),
        latestVersion: latestVersion.trim(),
        forceUpdate,
        updateUrl: updateUrl.trim(),
        updateMessage: updateMessage.trim(),
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving version settings:", error);
      Alert.alert(
        "Error",
        "Failed to save settings. Make sure the app_settings table has the version columns.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openGitHubReleases = () => {
    if (updateUrl) Linking.openURL(updateUrl);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <HomeSpaceLoader />
      </View>
    );
  }

  return (
    <ScrollViewWithDetection
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      {/* ── Hero Header Banner ── */}
      <View style={styles.heroBanner}>
        <View style={styles.heroBannerInner}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="git-branch" size={26} color={colors.headerText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>ADMIN PANEL</Text>
            <Text style={styles.heroTitle}>Version Control</Text>
            <Text style={styles.heroSubtitle}>
              Manage app versions and update policies
            </Text>
          </View>
        </View>

        {/* Running version pill inside banner */}
        <View style={styles.heroPill}>
          <Ionicons
            name="phone-portrait-outline"
            size={13}
            color={colors.accentSurface}
          />
          <Text style={styles.heroPillText}>Running v{currentAppVersion}</Text>
          <View style={styles.heroPillDot} />
          <Text style={styles.heroPillLive}>Live</Text>
        </View>
      </View>

      {/* ── How It Works card ── */}
      <View style={styles.infoCard}>
        <View style={styles.infoIconWrap}>
          <Ionicons name="information-circle" size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>How Version Control Works</Text>
          <Text style={styles.infoDesc}>
            Set the minimum required version to force users to update. Users
            below this version will see an update prompt. If "Force Update" is
            enabled, they cannot use the app until they update.
          </Text>
        </View>
      </View>

      {/* ── Section: Version Settings ── */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionAccentBar} />
        <Text style={styles.sectionTitle}>Version Settings</Text>
      </View>

      {/* Minimum Required Version */}
      <View style={styles.fieldCard}>
        <View style={styles.fieldHeader}>
          <View
            style={[
              styles.fieldIconWrap,
              { backgroundColor: colors.accentSurface },
            ]}
          >
            <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Minimum Required Version</Text>
            <Text style={styles.fieldHint}>
              Users below this version will be prompted to update
            </Text>
          </View>
        </View>
        <TextInput
          style={styles.versionInput}
          value={minVersion}
          onChangeText={setMinVersion}
          placeholder="1.0.0"
          placeholderTextColor={colors.placeholder}
          keyboardType="numeric"
          autoCapitalize="none"
        />
      </View>

      {/* Latest App Version */}
      <View style={styles.fieldCard}>
        <View style={styles.fieldHeader}>
          <View
            style={[
              styles.fieldIconWrap,
              { backgroundColor: colors.successBg },
            ]}
          >
            <Ionicons name="rocket" size={18} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Latest App Version</Text>
            <Text style={styles.fieldHint}>
              The newest version available for download
            </Text>
          </View>
        </View>
        <TextInput
          style={styles.versionInput}
          value={latestVersion}
          onChangeText={setLatestVersion}
          placeholder="1.1.2"
          placeholderTextColor={colors.placeholder}
          keyboardType="numeric"
          autoCapitalize="none"
        />
      </View>

      {/* Force Update Toggle */}
      <View style={[styles.fieldCard, forceUpdate && styles.fieldCardDanger]}>
        <View style={styles.toggleRow}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View
              style={[
                styles.fieldIconWrap,
                {
                  marginRight: 12,
                  backgroundColor: forceUpdate
                    ? colors.errorBg
                    : colors.inputBg,
                },
              ]}
            >
              <Ionicons
                name={forceUpdate ? "lock-closed" : "lock-open"}
                size={18}
                color={forceUpdate ? colors.error : colors.textTertiary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Force Update</Text>
              <Text style={styles.fieldHint}>
                Block app usage until user updates
              </Text>
            </View>
          </View>
          <Switch
            value={forceUpdate}
            onValueChange={setForceUpdate}
            trackColor={{ false: colors.border, true: colors.errorBg }}
            thumbColor={forceUpdate ? colors.error : colors.textTertiary}
          />
        </View>
        {forceUpdate && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={16} color={colors.error} />
            <Text style={styles.warningText}>
              Users below v{minVersion} will be completely blocked from using
              the app.
            </Text>
          </View>
        )}
      </View>

      {/* ── Section: Download Settings ── */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionAccentBar} />
        <Text style={styles.sectionTitle}>Download Settings</Text>
      </View>

      {/* GitHub Releases URL */}
      <View style={styles.fieldCard}>
        <View style={styles.fieldHeader}>
          <View
            style={[styles.fieldIconWrap, { backgroundColor: colors.infoBg }]}
          >
            <Ionicons name="logo-github" size={18} color={colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>GitHub Releases URL</Text>
            <Text style={styles.fieldHint}>
              Where users will be sent to download the APK
            </Text>
          </View>
        </View>
        <TextInput
          style={[styles.versionInput, { fontSize: 13 }]}
          value={updateUrl}
          onChangeText={setUpdateUrl}
          placeholder="https://github.com/user/repo/releases"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TouchableOpacity
          style={styles.testLinkBtn}
          onPress={openGitHubReleases}
          activeOpacity={0.7}
        >
          <Ionicons name="open-outline" size={14} color={colors.accent} />
          <Text style={styles.testLinkText}>Test Link</Text>
        </TouchableOpacity>
      </View>

      {/* Custom Update Message */}
      <View style={styles.fieldCard}>
        <View style={styles.fieldHeader}>
          <View
            style={[
              styles.fieldIconWrap,
              { backgroundColor: colors.accentSurface },
            ]}
          >
            <Ionicons
              name="chatbubble-ellipses"
              size={18}
              color={colors.accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Custom Update Message</Text>
            <Text style={styles.fieldHint}>
              Optional message shown to users (leave empty for default)
            </Text>
          </View>
        </View>
        <TextInput
          style={[styles.versionInput, styles.multilineInput]}
          value={updateMessage}
          onChangeText={setUpdateMessage}
          placeholder='e.g., "New features! Update now for billing improvements."'
          placeholderTextColor={colors.placeholder}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* ── Save Button ── */}
      <TouchableOpacity
        style={[
          styles.saveButton,
          (!hasChanges || saving) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={!hasChanges || saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="save" size={18} color="#fff" />
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </>
        )}
      </TouchableOpacity>

      {/* ── SQL Setup Guide ── */}
      <View style={styles.sqlCard}>
        <View style={styles.sqlCardHeader}>
          <View style={styles.sqlIconWrap}>
            <Ionicons name="code-slash" size={15} color={colors.accent} />
          </View>
          <Text style={styles.sqlTitle}>
            Supabase Setup — Add columns to app_settings
          </Text>
        </View>
        <Text style={styles.sqlCode}>
          {`ALTER TABLE app_settings\nADD COLUMN IF NOT EXISTS min_app_version TEXT DEFAULT '1.0.0',\nADD COLUMN IF NOT EXISTS latest_app_version TEXT DEFAULT '1.1.2',\nADD COLUMN IF NOT EXISTS force_update BOOLEAN DEFAULT false,\nADD COLUMN IF NOT EXISTS update_url TEXT DEFAULT '',\nADD COLUMN IF NOT EXISTS update_message TEXT DEFAULT '';`}
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollViewWithDetection>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      paddingBottom: 32,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },

    // ── Hero Banner ──
    heroBanner: {
      backgroundColor: colors.headerBg,
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 20,
      marginBottom: 16,
    },
    heroBannerInner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
      marginBottom: 14,
    },
    heroIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.10)",
      justifyContent: "center",
      alignItems: "center",
    },
    heroEyebrow: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.accentSurface,
      letterSpacing: 1.5,
      marginBottom: 4,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.headerText,
      marginBottom: 4,
    },
    heroSubtitle: {
      fontSize: 12,
      color: "rgba(255,255,255,0.55)",
      lineHeight: 17,
    },
    heroPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(255,255,255,0.08)",
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
    },
    heroPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.accentSurface,
    },
    heroPillDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.success,
    },
    heroPillLive: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.success,
    },

    // ── Info Card ──
    infoCard: {
      flexDirection: "row",
      backgroundColor: colors.accentSurface,
      borderRadius: 14,
      padding: 14,
      marginHorizontal: 16,
      marginBottom: 20,
      alignItems: "flex-start",
      gap: 10,
    },
    infoIconWrap: {
      marginTop: 1,
    },
    infoTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
      marginBottom: 4,
    },
    infoDesc: {
      fontSize: 12,
      color: colors.accent,
      lineHeight: 18,
      opacity: 0.85,
    },

    // ── Section Header ──
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 10,
      marginTop: 4,
    },
    sectionAccentBar: {
      width: 3,
      height: 16,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },

    // ── Field Cards ──
    fieldCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
    fieldCardDanger: {
      borderColor: colors.error,
      borderWidth: 1,
    },
    fieldHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 12,
    },
    fieldIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 1,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    fieldHint: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
      lineHeight: 16,
    },
    versionInput: {
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 12 : 10,
      fontSize: 15,
      fontWeight: "600",
      color: colors.inputText,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    multilineInput: {
      minHeight: 72,
      fontSize: 13,
      fontWeight: "400",
      lineHeight: 20,
    },

    // ── Toggle Row ──
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    // ── Warning Banner ──
    warningBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.errorBg,
      borderRadius: 10,
      padding: 10,
      marginTop: 12,
    },
    warningText: {
      fontSize: 12,
      color: colors.error,
      flex: 1,
      lineHeight: 17,
    },

    // ── Test Link Button ──
    testLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-end",
      marginTop: 8,
      paddingVertical: 4,
    },
    testLinkText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.accent,
    },

    // ── Save Button ──
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: 14,
      marginHorizontal: 16,
      marginTop: 8,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
        },
        android: { elevation: 4 },
      }),
    },
    saveButtonDisabled: {
      opacity: 0.45,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textOnAccent,
    },

    // ── SQL Guide Card ──
    sqlCard: {
      backgroundColor: colors.cardAlt,
      borderRadius: 14,
      padding: 14,
      marginTop: 20,
      marginHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
    },
    sqlCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    sqlIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 7,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
    },
    sqlTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      flex: 1,
    },
    sqlCode: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 10,
      color: colors.textSecondary,
      lineHeight: 17,
    },
  });

export default AdminVersionControlScreen;
