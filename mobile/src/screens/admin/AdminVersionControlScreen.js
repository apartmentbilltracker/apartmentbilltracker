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

  // Track original values to detect changes
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

    // Warn if force update is enabled
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
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading version settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={["#b38604"]}
        />
      }
    >
      {/* Header Info */}
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

      {/* Current Running Version */}
      <View style={styles.currentVersionCard}>
        <Ionicons
          name="phone-portrait-outline"
          size={22}
          color={colors.accent}
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.currentVersionLabel}>This App Version</Text>
          <Text style={styles.currentVersionValue}>v{currentAppVersion}</Text>
        </View>
        <View style={styles.versionBadge}>
          <Text style={styles.versionBadgeText}>Running</Text>
        </View>
      </View>

      {/* Version Settings Section */}
      <Text style={styles.sectionTitle}>Version Settings</Text>

      {/* Minimum Version */}
      <View style={styles.fieldCard}>
        <View style={styles.fieldHeader}>
          <View style={[styles.fieldIconWrap, { backgroundColor: "#FFF3E0" }]}>
            <Ionicons name="shield-checkmark" size={18} color="#e65100" />
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
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          autoCapitalize="none"
        />
      </View>

      {/* Latest Version */}
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
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          autoCapitalize="none"
        />
      </View>

      {/* Force Update Toggle */}
      <View style={styles.fieldCard}>
        <View style={styles.toggleRow}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flex: 1,
            }}
          >
            <View
              style={[
                styles.fieldIconWrap,
                {
                  marginRight: 12,
                  backgroundColor: forceUpdate ? "#FFEBEE" : colors.inputBg,
                },
              ]}
            >
              <Ionicons
                name={forceUpdate ? "lock-closed" : "lock-open"}
                size={18}
                color={forceUpdate ? "#d32f2f" : colors.textTertiary}
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
            trackColor={{ false: "#ddd", true: "#FFCDD2" }}
            thumbColor={forceUpdate ? "#d32f2f" : "#f4f3f4"}
          />
        </View>
        {forceUpdate && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={16} color="#e65100" />
            <Text style={styles.warningText}>
              Users below v{minVersion} will be completely blocked from using
              the app.
            </Text>
          </View>
        )}
      </View>

      {/* Update URL */}
      <Text style={styles.sectionTitle}>Download Settings</Text>

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
          placeholderTextColor={colors.textTertiary}
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
          <View style={[styles.fieldIconWrap, { backgroundColor: "#F3E5F5" }]}>
            <Ionicons name="chatbubble-ellipses" size={18} color="#7B1FA2" />
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
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Save Button */}
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

      {/* SQL Guide */}
      <View style={styles.sqlCard}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <Ionicons name="code-slash" size={16} color={colors.textTertiary} />
          <Text style={styles.sqlTitle}>
            Supabase Setup — Add columns to app_settings
          </Text>
        </View>
        <Text style={styles.sqlCode}>
          {`ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS min_app_version TEXT DEFAULT '1.0.0',
ADD COLUMN IF NOT EXISTS latest_app_version TEXT DEFAULT '1.1.2',
ADD COLUMN IF NOT EXISTS force_update BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS update_url TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS update_message TEXT DEFAULT '';`}
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      padding: 16,
      paddingBottom: 32,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textSecondary,
    },

    // Info card
    infoCard: {
      flexDirection: "row",
      backgroundColor: colors.accentSurface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      alignItems: "flex-start",
      gap: 10,
    },
    infoIconWrap: {
      marginTop: 2,
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

    // Current version card
    currentVersionCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        android: { elevation: 2 },
      }),
    },
    currentVersionLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: "500",
    },
    currentVersionValue: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      marginTop: 2,
    },
    versionBadge: {
      backgroundColor: colors.successBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    versionBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.success,
    },

    // Section
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 10,
      marginTop: 4,
    },

    // Field card
    fieldCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    fieldHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 12,
    },
    fieldIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 9,
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
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 12 : 10,
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    multilineInput: {
      minHeight: 70,
      fontSize: 13,
      fontWeight: "400",
      lineHeight: 20,
    },

    // Toggle
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    // Warning
    warningBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#FFF3E0",
      borderRadius: 8,
      padding: 10,
      marginTop: 12,
    },
    warningText: {
      fontSize: 12,
      color: "#e65100",
      flex: 1,
      lineHeight: 17,
    },

    // Test link
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

    // Save button
    saveButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "#b38604",
      paddingVertical: 15,
      borderRadius: 12,
      marginTop: 8,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
    },

    // SQL Guide
    sqlCard: {
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      padding: 14,
      marginTop: 20,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
    },
    sqlTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    sqlCode: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 10,
      color: colors.textSecondary,
      lineHeight: 16,
    },
  });

export default AdminVersionControlScreen;
