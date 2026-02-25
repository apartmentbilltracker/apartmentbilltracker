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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { settingsService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

// Common Philippine bank names for quick selection
const BANK_OPTIONS = [
  "BPI",
  "BDO",
  "Metrobank",
  "UnionBank",
  "PNB",
  "RCBC",
  "Landbank",
  "DBP",
  "GCash",
  "Maya",
  "Other",
];

const AdminPaymentSettingsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // GCash
  const [gcashEnabled, setGcashEnabled] = useState(true);
  const [gcashMessage, setGcashMessage] = useState("");
  const [gcashQrUri, setGcashQrUri] = useState(null); // url or base64 data URI
  const [gcashQrDirty, setGcashQrDirty] = useState(false); // user picked new image

  // Bank Transfer
  const [bankEnabled, setBankEnabled] = useState(true);
  const [bankMessage, setBankMessage] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);

  // Add-bank modal
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null); // null = add, obj = edit
  const [newBankName, setNewBankName] = useState("BPI");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newBankQrUri, setNewBankQrUri] = useState(null); // optional QR per bank
  const [showBankPicker, setShowBankPicker] = useState(false);

  // Focus tracking for inputs
  const [gcashMsgFocused, setGcashMsgFocused] = useState(false);
  const [bankMsgFocused, setBankMsgFocused] = useState(false);
  const [accNameFocused, setAccNameFocused] = useState(false);
  const [accNumFocused, setAccNumFocused] = useState(false);
  const [customBankFocused, setCustomBankFocused] = useState(false);
  const [modalSubmitted, setModalSubmitted] = useState(false);

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
        if (methods.gcash.qrUrl) setGcashQrUri(methods.gcash.qrUrl);
      }
      if (methods?.bank_transfer) {
        setBankEnabled(methods.bank_transfer.enabled !== false);
        setBankMessage(methods.bank_transfer.maintenanceMessage || "");
        if (Array.isArray(methods.bank_transfer.accounts)) {
          setBankAccounts(methods.bank_transfer.accounts);
        }
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
      const payload = {
        gcash_enabled: gcashEnabled,
        bank_transfer_enabled: bankEnabled,
        gcash_maintenance_message: gcashMessage.trim(),
        bank_transfer_maintenance_message: bankMessage.trim(),
        bank_accounts: JSON.stringify(bankAccounts),
      };
      if (gcashQrDirty && gcashQrUri) {
        payload.gcash_qr_url = gcashQrUri;
      }
      await settingsService.updatePaymentMethods(payload);
      setGcashQrDirty(false);
      Alert.alert("Saved", "Payment settings updated successfully.");
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

  // ─── QR Upload ───
  const handlePickQr = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to upload a QR code.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      const { base64, mimeType } = result.assets[0];
      const mime = mimeType || "image/jpeg";
      setGcashQrUri(`data:${mime};base64,${base64}`);
      setGcashQrDirty(true);
    }
  };

  const handleRemoveQr = () => {
    Alert.alert("Remove QR Code", "Remove the uploaded GCash QR code?", [
      { text: "Cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setGcashQrUri(null);
          setGcashQrDirty(true);
        },
      },
    ]);
  };

  // ─── Bank Accounts ───
  const openAddBank = () => {
    setEditingAccount(null);
    setNewBankName("BPI");
    setNewAccountName("");
    setNewAccountNumber("");
    setNewBankQrUri(null);
    setModalSubmitted(false);
    setShowAddBankModal(true);
  };

  const openEditBank = (acc) => {
    setEditingAccount(acc);
    setNewBankName(acc.bankName);
    setNewAccountName(acc.accountName);
    setNewAccountNumber(acc.accountNumber);
    setNewBankQrUri(acc.qrUrl || null);
    setModalSubmitted(false);
    setShowAddBankModal(true);
  };

  const handlePickBankQr = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to upload a QR code.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      const { base64, mimeType } = result.assets[0];
      const mime = mimeType || "image/jpeg";
      setNewBankQrUri(`data:${mime};base64,${base64}`);
    }
  };

  const handleConfirmBankModal = () => {
    setModalSubmitted(true);
    const bankName = newBankName.trim();
    const accountName = newAccountName.trim();
    const accountNumber = newAccountNumber.trim();
    if (!bankName || !accountName || !accountNumber) {
      Alert.alert("Required", "Please fill in all bank account fields.");
      return;
    }
    if (editingAccount) {
      setBankAccounts((prev) =>
        prev.map((a) =>
          a.id === editingAccount.id
            ? {
                ...a,
                bankName,
                accountName,
                accountNumber,
                qrUrl: newBankQrUri || a.qrUrl || null,
              }
            : a,
        ),
      );
    } else {
      setBankAccounts((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          bankName,
          accountName,
          accountNumber,
          qrUrl: newBankQrUri || null,
          enabled: true,
        },
      ]);
    }
    setShowAddBankModal(false);
  };

  const handleToggleBankAccount = (id, value) => {
    setBankAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: value } : a)),
    );
  };

  const handleDeleteBankAccount = (id) => {
    Alert.alert("Remove Bank Account", "Remove this bank account?", [
      { text: "Cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          setBankAccounts((prev) => prev.filter((a) => a.id !== id)),
      },
    ]);
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
          <Ionicons name="information-circle" size={18} color={colors.accent} />
          <Text style={styles.infoText}>
            Disabling a payment method will prevent clients from initiating new
            payments through that channel. Changes sync to all rooms instantly.
          </Text>
        </View>

        {/* ─── GCash Card ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[styles.methodIconWrap, { backgroundColor: "#0066FF15" }]}
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
                  {
                    backgroundColor: gcashEnabled ? colors.success : "#ef5350",
                  },
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
                style={[
                  styles.textInput,
                  gcashMsgFocused && styles.textInputFocused,
                ]}
                value={gcashMessage}
                onChangeText={setGcashMessage}
                onFocus={() => setGcashMsgFocused(true)}
                onBlur={() => setGcashMsgFocused(false)}
                placeholder="e.g. GCash is under scheduled maintenance until 6:00 PM"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={2}
              />
            </View>
          )}

          {/* ─── QR Code Section ─── */}
          <View style={styles.qrSection}>
            <View style={styles.qrSectionHeader}>
              <Ionicons
                name="qr-code-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.qrSectionTitle}>GCash QR Code</Text>
            </View>
            <Text style={styles.qrSectionHint}>
              Upload your GCash QR code so clients can scan and pay directly.
              Displayed synchronously to all rooms.
            </Text>
            {gcashQrUri ? (
              <View style={styles.qrPreviewWrap}>
                <Image
                  source={{ uri: gcashQrUri }}
                  style={styles.qrPreview}
                  resizeMode="contain"
                />
                <View style={styles.qrPreviewActions}>
                  <TouchableOpacity
                    style={styles.qrActionBtn}
                    onPress={handlePickQr}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={16}
                      color={colors.accent}
                    />
                    <Text
                      style={[styles.qrActionBtnText, { color: colors.accent }]}
                    >
                      Replace
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.qrActionBtn, styles.qrRemoveBtn]}
                    onPress={handleRemoveQr}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ef5350" />
                    <Text
                      style={[styles.qrActionBtnText, { color: "#ef5350" }]}
                    >
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
                {gcashQrDirty && (
                  <View style={styles.dirtyBadge}>
                    <Ionicons name="ellipse" size={8} color={colors.accent} />
                    <Text style={styles.dirtyBadgeText}>Unsaved</Text>
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.qrUploadBtn}
                onPress={handlePickQr}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={28}
                  color={colors.accent}
                />
                <Text style={styles.qrUploadBtnTitle}>Upload QR Code</Text>
                <Text style={styles.qrUploadBtnHint}>
                  Tap to select from your photo library
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── Bank Transfer Card ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[styles.methodIconWrap, { backgroundColor: "#1e88e515" }]}
            >
              <Ionicons name="business-outline" size={22} color="#1e88e5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodName}>Bank Transfer</Text>
              <Text style={styles.methodDesc}>
                Multiple bank accounts supported
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
            <Text style={styles.toggleLabel}>Enable Bank Transfer</Text>
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
                style={[
                  styles.textInput,
                  bankMsgFocused && styles.textInputFocused,
                ]}
                value={bankMessage}
                onChangeText={setBankMessage}
                onFocus={() => setBankMsgFocused(true)}
                onBlur={() => setBankMsgFocused(false)}
                placeholder="e.g. Bank transfers are temporarily unavailable"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={2}
              />
            </View>
          )}

          {/* ─── Bank Accounts List ─── */}
          <View style={styles.bankSection}>
            <View style={styles.bankSectionHeader}>
              <Ionicons
                name="card-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.bankSectionTitle}>Bank Accounts</Text>
              <Text style={styles.bankSectionCount}>{bankAccounts.length}</Text>
            </View>

            {bankAccounts.length === 0 ? (
              <View style={styles.bankEmptyState}>
                <Ionicons
                  name="add-circle-outline"
                  size={32}
                  color={colors.skeleton}
                />
                <Text style={styles.bankEmptyText}>
                  No bank accounts added yet
                </Text>
                <Text style={styles.bankEmptyHint}>
                  Add accounts for clients to transfer to
                </Text>
              </View>
            ) : (
              bankAccounts.map((acc) => (
                <View key={acc.id} style={styles.bankAccountRow}>
                  <View
                    style={[
                      styles.bankAccountIcon,
                      { opacity: acc.enabled ? 1 : 0.4 },
                    ]}
                  >
                    <Ionicons
                      name="business-outline"
                      size={18}
                      color="#1e88e5"
                    />
                  </View>
                  <View
                    style={[
                      styles.bankAccountInfo,
                      { opacity: acc.enabled ? 1 : 0.5 },
                    ]}
                  >
                    <Text style={styles.bankAccountName}>{acc.bankName}</Text>
                    <Text style={styles.bankAccountHolder}>
                      {acc.accountName}
                    </Text>
                    <Text style={styles.bankAccountNumber}>
                      {acc.accountNumber}
                    </Text>
                  </View>
                  <View style={styles.bankAccountActions}>
                    <Switch
                      value={acc.enabled}
                      onValueChange={(v) => handleToggleBankAccount(acc.id, v)}
                      trackColor={{
                        false: colors.skeleton,
                        true: colors.successBg,
                      }}
                      thumbColor={
                        acc.enabled ? colors.success : colors.textTertiary
                      }
                    />
                    <View style={styles.bankAccountBtns}>
                      <TouchableOpacity
                        onPress={() => openEditBank(acc)}
                        style={styles.bankAccountEditBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="pencil-outline"
                          size={16}
                          color={colors.accent}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteBankAccount(acc.id)}
                        style={styles.bankAccountDeleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#ef5350"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity
              style={styles.addBankBtn}
              onPress={openAddBank}
              activeOpacity={0.7}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={colors.accent}
              />
              <Text style={styles.addBankBtnText}>Add Bank Account</Text>
            </TouchableOpacity>
          </View>
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

      {/* ─── Add / Edit Bank Account Modal ─── */}
      <Modal
        visible={showAddBankModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddBankModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAccount ? "Edit Bank Account" : "Add Bank Account"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddBankModal(false);
                  setModalSubmitted(false);
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Bank Name Selector */}
            <Text style={styles.fieldLabel}>Bank / Provider</Text>
            <TouchableOpacity
              style={styles.bankPickerBtn}
              onPress={() => setShowBankPicker((p) => !p)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.bankPickerBtnText,
                  { color: newBankName ? colors.text : colors.textTertiary },
                ]}
              >
                {newBankName || "Select bank…"}
              </Text>
              <Ionicons
                name={showBankPicker ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            {showBankPicker && (
              <View style={styles.bankPickerDropdown}>
                {BANK_OPTIONS.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[
                      styles.bankPickerOption,
                      newBankName === b && styles.bankPickerOptionSelected,
                    ]}
                    onPress={() => {
                      setNewBankName(b);
                      setShowBankPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.bankPickerOptionText,
                        newBankName === b && {
                          color: colors.accent,
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {b}
                    </Text>
                    {newBankName === b && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={colors.accent}
                      />
                    )}
                  </TouchableOpacity>
                ))}
                {/* Custom entry */}
                <TextInput
                  style={[
                    styles.textInput,
                    { marginTop: 6 },
                    customBankFocused && styles.textInputFocused,
                  ]}
                  value={!BANK_OPTIONS.includes(newBankName) ? newBankName : ""}
                  onChangeText={setNewBankName}
                  onFocus={() => setCustomBankFocused(true)}
                  onBlur={() => setCustomBankFocused(false)}
                  placeholder="Or type a custom bank name…"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            )}

            {/* Account Name */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
              Account Holder Name
            </Text>
            <TextInput
              style={[
                styles.textInput,
                accNameFocused && styles.textInputFocused,
                modalSubmitted &&
                  !newAccountName.trim() &&
                  styles.textInputError,
              ]}
              value={newAccountName}
              onChangeText={setNewAccountName}
              onFocus={() => setAccNameFocused(true)}
              onBlur={() => setAccNameFocused(false)}
              placeholder="e.g. Juan Dela Cruz"
              placeholderTextColor={colors.textTertiary}
            />

            {/* Account Number */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
              Account Number
            </Text>
            <TextInput
              style={[
                styles.textInput,
                accNumFocused && styles.textInputFocused,
                modalSubmitted &&
                  !newAccountNumber.trim() &&
                  styles.textInputError,
              ]}
              value={newAccountNumber}
              onChangeText={setNewAccountNumber}
              onFocus={() => setAccNumFocused(true)}
              onBlur={() => setAccNumFocused(false)}
              placeholder="e.g. 9079376194"
              placeholderTextColor={colors.textTertiary}
              keyboardType="default"
            />

            {/* QR Code Upload (optional) */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
              QR Code {"(optional)"}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginBottom: 8,
              }}
            >
              Upload a QR code for this bank account so clients can scan and
              transfer directly.
            </Text>
            {newBankQrUri ? (
              <View style={{ alignItems: "center", marginBottom: 4 }}>
                <Image
                  source={{ uri: newBankQrUri }}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginBottom: 8,
                  }}
                  resizeMode="contain"
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={handlePickBankQr}
                    style={[
                      styles.qrActionBtn,
                      { paddingHorizontal: 14, paddingVertical: 7 },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={15}
                      color={colors.accent}
                    />
                    <Text
                      style={[styles.qrActionBtnText, { color: colors.accent }]}
                    >
                      Replace
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setNewBankQrUri(null)}
                    style={[
                      styles.qrActionBtn,
                      styles.qrRemoveBtn,
                      { paddingHorizontal: 14, paddingVertical: 7 },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={15} color="#ef5350" />
                    <Text
                      style={[styles.qrActionBtnText, { color: "#ef5350" }]}
                    >
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.qrUploadBtn}
                onPress={handlePickBankQr}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={22}
                  color={colors.accent}
                />
                <Text style={styles.qrUploadBtnText}>Upload QR Code</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowAddBankModal(false);
                  setModalSubmitted(false);
                }}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmBankModal}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={17}
                  color="#fff"
                />
                <Text style={styles.modalConfirmBtnText}>
                  {editingAccount ? "Save Changes" : "Add Account"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
    messageHint: { fontSize: 11, color: colors.textTertiary, marginBottom: 8 },
    textInput: {
      backgroundColor: colors.inputBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      minHeight: 44,
      textAlignVertical: "top",
    },

    /* QR Section */
    qrSection: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    qrSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    qrSectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    qrSectionHint: {
      fontSize: 12,
      color: colors.textTertiary,
      lineHeight: 17,
      marginBottom: 12,
    },
    qrPreviewWrap: { alignItems: "center" },
    qrPreview: {
      width: 180,
      height: 180,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    qrPreviewActions: { flexDirection: "row", gap: 8, marginTop: 12 },
    qrActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
    },
    qrRemoveBtn: { borderColor: "#ef535030" },
    qrActionBtnText: { fontSize: 13, fontWeight: "600" },
    textInputFocused: {
      borderColor: colors.accent,
      borderWidth: 1.5,
    },
    textInputError: {
      borderColor: colors.error,
      borderWidth: 1.5,
      backgroundColor: colors.errorBg,
    },
    dirtyBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.accentSurface,
      borderRadius: 20,
    },
    dirtyBadgeText: { fontSize: 11, color: colors.accent, fontWeight: "600" },
    qrUploadBtn: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: "dashed",
      backgroundColor: colors.inputBg,
      gap: 4,
    },
    qrUploadBtnTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent,
      marginTop: 4,
    },
    qrUploadBtnHint: { fontSize: 12, color: colors.textTertiary },
    qrUploadBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
      marginTop: 4,
    },

    /* Bank Accounts */
    bankSection: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    bankSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 12,
    },
    bankSectionTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    bankSectionCount: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.accent,
      backgroundColor: colors.accentSurface,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    bankEmptyState: {
      alignItems: "center",
      paddingVertical: 20,
      gap: 4,
    },
    bankEmptyText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    bankEmptyHint: { fontSize: 12, color: colors.textTertiary },
    bankAccountRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bankAccountIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "#1e88e515",
      justifyContent: "center",
      alignItems: "center",
    },
    bankAccountInfo: { flex: 1 },
    bankAccountName: { fontSize: 13, fontWeight: "700", color: colors.text },
    bankAccountHolder: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    bankAccountNumber: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 1,
      letterSpacing: 0.5,
    },
    bankAccountActions: { alignItems: "center", gap: 8 },
    bankAccountBtns: { flexDirection: "row", gap: 10 },
    bankAccountEditBtn: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    bankAccountDeleteBtn: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: "#ef535010",
      borderWidth: 1,
      borderColor: "#ef535030",
      justifyContent: "center",
      alignItems: "center",
    },
    addBankBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.accent,
      borderStyle: "dashed",
      marginTop: 4,
    },
    addBankBtnText: { fontSize: 14, fontWeight: "600", color: colors.accent },

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
    saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },

    /* Modal */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      paddingBottom: 32,
      maxHeight: "92%",
    },
    dragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.skeleton,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 6,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    modalTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 6,
    },
    bankPickerBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.inputBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    bankPickerBtnText: { fontSize: 14, fontWeight: "500" },
    bankPickerDropdown: {
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
      overflow: "hidden",
    },
    bankPickerOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    bankPickerOptionSelected: { backgroundColor: colors.accentSurface },
    bankPickerOptionText: { fontSize: 14, color: colors.text },
    modalActions: { flexDirection: "row", gap: 12, marginTop: 24 },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    modalCancelBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    modalConfirmBtn: {
      flex: 1,
      flexDirection: "row",
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    modalConfirmBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  });

export default AdminPaymentSettingsScreen;
