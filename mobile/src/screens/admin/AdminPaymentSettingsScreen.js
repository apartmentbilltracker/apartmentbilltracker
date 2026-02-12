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
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { settingsService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const AdminPaymentSettingsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [gcashEnabled, setGcashEnabled] = useState(true);
  const [bankEnabled, setBankEnabled] = useState(true);
  const [gcashMessage, setGcashMessage] = useState("");
  const [bankMessage, setBankMessage] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsService.getPaymentMethods();
      const methods = response?.paymentMethods || response;
      if (methods?.gcash) {
        setGcashEnabled(methods.gcash.enabled !== false);
        setGcashMessage(methods.gcash.maintenanceMessage || "");
      }
      if (methods?.bank_transfer) {
        setBankEnabled(methods.bank_transfer.enabled !== false);
        setBankMessage(methods.bank_transfer.maintenanceMessage || "");
      }
    } catch (error) {
      console.error("Error fetching payment settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSettings();
    setRefreshing(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsService.updatePaymentMethods({
        gcash_enabled: gcashEnabled,
        bank_transfer_enabled: bankEnabled,
        gcash_maintenance_message: gcashMessage.trim(),
        bank_transfer_maintenance_message: bankMessage.trim(),
      });
      Alert.alert("Saved", "Payment method settings updated successfully.");
    } catch (error) {
      console.error("Error saving payment settings:", error);
      Alert.alert(
        "Error",
        error?.response?.data?.message ||
          error.message ||
          "Failed to save settings. Make sure the app_settings table exists in Supabase.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGcash = (value) => {
    setGcashEnabled(value);
    if (value) setGcashMessage("");
  };

  const handleToggleBank = (value) => {
    setBankEnabled(value);
    if (value) setBankMessage("");
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Payment Settings</Text>
          <Text style={styles.headerSub}>
            Manage payment method availability
          </Text>
        </View>
        <View style={styles.headerIconBg}>
          <Ionicons name="settings-outline" size={20} color={colors.accent} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons
            name="information-circle"
            size={18}
            color={colors.accent}
          />
          <Text style={styles.infoText}>
            Disabling a payment method will prevent clients from initiating new
            payments through that channel. Existing pending payments will not be
            affected.
          </Text>
        </View>

        {/* ─── GCash Card ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.methodIconWrap,
                { backgroundColor: "#0066FF15" },
              ]}
            >
              <Ionicons name="phone-portrait" size={22} color="#0066FF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodName}>GCash</Text>
              <Text style={styles.methodDesc}>Mobile wallet payment</Text>
            </View>
            <View style={styles.statusPill}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: gcashEnabled ? colors.success : "#ef5350" },
                ]}
              />
              <Text
                style={[
                  styles.statusLabel,
                  { color: gcashEnabled ? colors.success : "#ef5350" },
                ]}
              >
                {gcashEnabled ? "Active" : "Disabled"}
              </Text>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable GCash Payments</Text>
            <Switch
              value={gcashEnabled}
              onValueChange={handleToggleGcash}
              trackColor={{ false: colors.skeleton, true: colors.successBg }}
              thumbColor={gcashEnabled ? colors.success : colors.textTertiary}
            />
          </View>

          {!gcashEnabled && (
            <View style={styles.messageSection}>
              <Text style={styles.messageLabel}>
                Maintenance Notice (optional)
              </Text>
              <Text style={styles.messageHint}>
                Custom message shown to clients. Leave blank for default.
              </Text>
              <TextInput
                style={styles.textInput}
                value={gcashMessage}
                onChangeText={setGcashMessage}
                placeholder="e.g. GCash is under scheduled maintenance until 6:00 PM"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={2}
              />
            </View>
          )}
        </View>

        {/* ─── Bank Transfer Card ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.methodIconWrap,
                { backgroundColor: "#1e88e515" },
              ]}
            >
              <Ionicons name="business-outline" size={22} color="#1e88e5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodName}>Bank Transfer</Text>
              <Text style={styles.methodDesc}>
                BDO, BPI, Metrobank, etc.
              </Text>
            </View>
            <View style={styles.statusPill}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: bankEnabled ? colors.success : "#ef5350" },
                ]}
              />
              <Text
                style={[
                  styles.statusLabel,
                  { color: bankEnabled ? colors.success : "#ef5350" },
                ]}
              >
                {bankEnabled ? "Active" : "Disabled"}
              </Text>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable Bank Transfer Payments</Text>
            <Switch
              value={bankEnabled}
              onValueChange={handleToggleBank}
              trackColor={{ false: colors.skeleton, true: colors.successBg }}
              thumbColor={bankEnabled ? colors.success : colors.textTertiary}
            />
          </View>

          {!bankEnabled && (
            <View style={styles.messageSection}>
              <Text style={styles.messageLabel}>
                Maintenance Notice (optional)
              </Text>
              <Text style={styles.messageHint}>
                Custom message shown to clients. Leave blank for default.
              </Text>
              <TextInput
                style={styles.textInput}
                value={bankMessage}
                onChangeText={setBankMessage}
                placeholder="e.g. Bank transfers are temporarily unavailable"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={2}
              />
            </View>
          )}
        </View>

        {/* Cash note */}
        <View style={styles.cashNote}>
          <View
            style={[styles.methodIconWrap, { backgroundColor: "#43a04715" }]}
          >
            <Ionicons name="cash-outline" size={20} color="#43a047" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cashNoteTitle}>Cash Payments</Text>
            <Text style={styles.cashNoteSub}>
              Cash payments are always available and cannot be disabled.
            </Text>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size={18} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (colors) =>
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
    scroll: { flex: 1 },

    /* Header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      gap: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.inputBg,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
    headerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    headerIconBg: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.accentSurface || "#fdf6e3",
      justifyContent: "center",
      alignItems: "center",
    },

    /* Info banner */
    infoBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 14,
      backgroundColor: colors.accentSurface || "#fdf6e3",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.accentLight || "#f5e6b8",
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    /* Card */
    card: {
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 14,
    },
    methodIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    methodName: { fontSize: 16, fontWeight: "700", color: colors.text },
    methodDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    /* Status pill */
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: colors.inputBg,
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusLabel: { fontSize: 12, fontWeight: "600" },

    /* Toggle */
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 4,
      paddingBottom: 4,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    toggleLabel: { fontSize: 14, fontWeight: "500", color: colors.text },

    /* Message input */
    messageSection: { marginTop: 12 },
    messageLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 2,
    },
    messageHint: {
      fontSize: 11,
      color: colors.textTertiary,
      marginBottom: 8,
    },
    textInput: {
      backgroundColor: colors.inputBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      minHeight: 56,
      textAlignVertical: "top",
    },

    /* Cash note */
    cashNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 14,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      opacity: 0.7,
    },
    cashNoteTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
    cashNoteSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    /* Save */
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 24,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.accent,
    },
    saveBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
    },
  });

export default AdminPaymentSettingsScreen;
