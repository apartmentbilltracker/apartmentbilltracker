import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { roommateService } from "../services/apiService";
import { useTheme } from "../theme/ThemeContext";
import ModalBottomSpacer from "./ModalBottomSpacer";

const emptyForm = {
  displayName: "",
  age: "",
  gender: "",
  work: "",
  preferredLocations: "",
  budget: "",
  moveInDate: "",
  facebookAccount: "",
  bio: "",
};

const RoommateProfileModal = ({
  visible,
  initialProfile,
  user,
  onClose,
  onSaved,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm({
      displayName: initialProfile?.name || user?.name || "",
      age: initialProfile?.age ? String(initialProfile.age) : "",
      gender: initialProfile?.gender || "",
      work: initialProfile?.work || "",
      preferredLocations: Array.isArray(initialProfile?.preferredLocations)
        ? initialProfile.preferredLocations.join(", ")
        : "",
      budget: initialProfile?.budget ? String(initialProfile.budget) : "",
      moveInDate: initialProfile?.moveInDate || "",
      facebookAccount: initialProfile?.facebookAccount || "",
      bio: initialProfile?.bio || "",
    });
  }, [initialProfile, user, visible]);

  const updateField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    if (!form.displayName.trim()) {
      return;
    }

    try {
      setSaving(true);
      const response = await roommateService.saveMyProfile({
        displayName: form.displayName.trim(),
        age: form.age.trim(),
        gender: form.gender.trim(),
        work: form.work.trim(),
        preferredLocations: form.preferredLocations,
        budget: form.budget.trim(),
        moveInDate: form.moveInDate.trim(),
        facebookAccount: form.facebookAccount.trim(),
        bio: form.bio.trim(),
      });
      onSaved?.(response?.profile || null);
      onClose?.();
    } catch (error) {
      console.error("Roommate profile save error:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !saving && onClose?.()}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="people-outline" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Roomies Profile</Text>
              <Text style={styles.subtitle}>
                Share the basics other verified renters need to know.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={saving}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Field
              label="Name"
              value={form.displayName}
              onChangeText={(value) => updateField("displayName", value)}
              placeholder="Your display name"
              styles={styles}
            />
            <View style={styles.twoCol}>
              <Field
                label="Age"
                value={form.age}
                onChangeText={(value) => updateField("age", value)}
                placeholder="25"
                keyboardType="number-pad"
                styles={styles}
              />
              <Field
                label="Gender"
                value={form.gender}
                onChangeText={(value) => updateField("gender", value)}
                placeholder="Male"
                styles={styles}
              />
            </View>
            <Field
              label="Work"
              value={form.work}
              onChangeText={(value) => updateField("work", value)}
              placeholder="IT, student, designer..."
              styles={styles}
            />
            <Field
              label="Preferred Locations"
              value={form.preferredLocations}
              onChangeText={(value) => updateField("preferredLocations", value)}
              placeholder="Carreta, Cebu City"
              styles={styles}
            />
            <View style={styles.twoCol}>
              <Field
                label="Budget"
                value={form.budget}
                onChangeText={(value) => updateField("budget", value)}
                placeholder="5000"
                keyboardType="number-pad"
                styles={styles}
              />
              <Field
                label="Move In"
                value={form.moveInDate}
                onChangeText={(value) => updateField("moveInDate", value)}
                placeholder="2026-06-01"
                styles={styles}
              />
            </View>
            <Field
              label="Facebook / Messenger"
              value={form.facebookAccount}
              onChangeText={(value) => updateField("facebookAccount", value)}
              placeholder="m.me/username or facebook.com/username"
              autoCapitalize="none"
              styles={styles}
            />
            <Field
              label="About"
              value={form.bio}
              onChangeText={(value) => updateField("bio", value)}
              placeholder="Lifestyle, schedule, roommate preferences..."
              multiline
              styles={styles}
            />
            <ModalBottomSpacer />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.secondaryText}>Maybe Later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!form.displayName.trim() || saving) && styles.disabledButton,
              ]}
              onPress={handleSave}
              disabled={!form.displayName.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.textOnAccent} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={colors.textOnAccent}
                  />
                  <Text style={styles.primaryText}>Save Profile</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  multiline,
  styles,
}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.textArea]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#8aa39d"
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
    />
  </View>
);

const createStyles = (colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0, 25, 22, 0.55)",
    },
    sheet: {
      maxHeight: "92%",
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: "hidden",
    },
    handle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 10,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: "#063F39",
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
      lineHeight: 17,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.inputBg,
      alignItems: "center",
      justifyContent: "center",
    },
    body: {
      maxHeight: 520,
    },
    bodyContent: {
      padding: 18,
      gap: 14,
    },
    twoCol: {
      flexDirection: "row",
      gap: 12,
    },
    field: {
      flex: 1,
      gap: 7,
    },
    label: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textSecondary,
    },
    input: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 14,
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    textArea: {
      minHeight: 96,
      paddingTop: 12,
      lineHeight: 20,
    },
    footer: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: Platform.OS === "ios" ? 26 : 18,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.card,
    },
    secondaryButton: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textSecondary,
    },
    primaryButton: {
      flex: 1.2,
      height: 48,
      borderRadius: 14,
      backgroundColor: "#063F39",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    disabledButton: {
      opacity: 0.55,
    },
    primaryText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textOnAccent,
    },
  });

export default RoommateProfileModal;
