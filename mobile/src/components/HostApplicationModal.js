import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import { InlineAlert } from "./CustomAlert";
import ModalBottomSpacer from "./ModalBottomSpacer";
import { useTheme } from "../theme/ThemeContext";
import {
  PHILIPPINE_ID_TYPES,
  getIdTypeMeta,
  validatePhilippineIdNumber,
} from "../utils/philippineIdValidation";

const emptyForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  birthDate: "",
  phoneNumber: "",
  addressLine: "",
  city: "",
  province: "",
  postalCode: "",
  idType: "philsys",
  idNumber: "",
  notes: "",
};

const fileFromAsset = (asset, name) => {
  if (!asset?.uri) return null;
  const extension = asset.uri.split(".").pop()?.split("?")[0] || "jpg";
  const safeExt = extension.length <= 5 ? extension : "jpg";
  return {
    uri: asset.uri,
    name: `${name}.${safeExt}`,
    type: asset.mimeType || `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
  };
};

const HostApplicationModal = ({
  visible,
  onClose,
  onSubmit,
  submitting,
  initialName = "",
  initialEmail = "",
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [form, setForm] = useState(() => {
    const parts = String(initialName || "").trim().split(/\s+/);
    return {
      ...emptyForm,
      firstName: parts[0] || "",
      lastName: parts.length > 1 ? parts[parts.length - 1] : "",
    };
  });
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [alert, setAlert] = useState({ visible: false, message: "" });

  const idMeta = useMemo(() => getIdTypeMeta(form.idType), [form.idType]);
  const idNumberValid = useMemo(
    () => validatePhilippineIdNumber(form.idType, form.idNumber),
    [form.idType, form.idNumber],
  );

  const updateField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pickImage = async (kind, source = "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setAlert({
        visible: true,
        message: "Permission is required to attach verification images.",
      });
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: kind === "selfie" ? [1, 1] : [4, 3],
            quality: 0.78,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.78,
          });

    if (result.canceled || !result.assets?.[0]) return;

    if (kind === "idFront") setIdFront(result.assets[0]);
    if (kind === "idBack") setIdBack(result.assets[0]);
    if (kind === "selfie") setSelfie(result.assets[0]);
  };

  const validate = () => {
    const required = [
      ["firstName", "First name is required."],
      ["lastName", "Last name is required."],
      ["birthDate", "Birth date is required."],
      ["phoneNumber", "Phone number is required."],
      ["addressLine", "Home address is required."],
      ["city", "City or municipality is required."],
      ["province", "Province is required."],
      ["postalCode", "Postal code is required."],
      ["idNumber", "Government ID number is required."],
    ];

    for (const [key, message] of required) {
      if (!String(form[key] || "").trim()) return message;
    }

    const birthDate = new Date(form.birthDate);
    if (Number.isNaN(birthDate.getTime())) {
      return "Enter birth date in YYYY-MM-DD format.";
    }

    const age =
      (Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 18) return "Host applicants must be at least 18 years old.";

    if (!idNumberValid) {
      return `${idMeta.label} number format is not valid.`;
    }

    if (!idFront) return "Attach the front image of your government ID.";
    if (!selfie) return "Take a live selfie for facial verification review.";
    if (!accepted) return "Please accept the verification consent.";

    return null;
  };

  const submit = async () => {
    const message = validate();
    if (message) {
      setAlert({ visible: true, message });
      return;
    }

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, String(value || "").trim());
    });
    formData.append("email", initialEmail || "");
    formData.append("verificationConsent", "true");
    formData.append("idFront", fileFromAsset(idFront, "id-front"));
    if (idBack) formData.append("idBack", fileFromAsset(idBack, "id-back"));
    formData.append("selfie", fileFromAsset(selfie, "selfie"));

    await onSubmit(formData);
  };

  const renderImageTile = ({ label, asset, icon, onCamera, onLibrary }) => (
    <View style={styles.uploadTile}>
      <View style={styles.uploadPreview}>
        {asset?.uri ? (
          <Image source={{ uri: asset.uri }} style={styles.uploadImage} />
        ) : (
          <Ionicons name={icon} size={28} color={colors.textTertiary} />
        )}
      </View>
      <Text style={styles.uploadLabel}>{label}</Text>
      <View style={styles.uploadActions}>
        {onCamera && (
          <TouchableOpacity style={styles.smallButton} onPress={onCamera}>
            <Ionicons name="camera" size={14} color={colors.accent} />
            <Text style={styles.smallButtonText}>Camera</Text>
          </TouchableOpacity>
        )}
        {onLibrary && (
          <TouchableOpacity style={styles.smallButton} onPress={onLibrary}>
            <Ionicons name="image" size={14} color={colors.accent} />
            <Text style={styles.smallButtonText}>Upload</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={() => !submitting && onClose()}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons
                name="shield-checkmark"
                size={20}
                color={colors.textOnAccent}
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Room Host Application</Text>
              <Text style={styles.subtitle}>
                Submit personal details, valid ID, and selfie review.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={submitting}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>Personal Details</Text>
            <View style={styles.twoCol}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={form.firstName}
                  onChangeText={(text) => updateField("firstName", text)}
                  placeholder="Juan"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={form.lastName}
                  onChangeText={(text) => updateField("lastName", text)}
                  placeholder="Dela Cruz"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <Text style={styles.label}>Middle Name</Text>
            <TextInput
              style={styles.input}
              value={form.middleName}
              onChangeText={(text) => updateField("middleName", text)}
              placeholder="Optional"
              placeholderTextColor={colors.textTertiary}
            />

            <View style={styles.twoCol}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Birth Date</Text>
                <TextInput
                  style={styles.input}
                  value={form.birthDate}
                  onChangeText={(text) => updateField("birthDate", text)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  value={form.phoneNumber}
                  onChangeText={(text) => updateField("phoneNumber", text)}
                  placeholder="09XXXXXXXXX"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <Text style={styles.label}>Home Address</Text>
            <TextInput
              style={styles.input}
              value={form.addressLine}
              onChangeText={(text) => updateField("addressLine", text)}
              placeholder="Street, barangay, building"
              placeholderTextColor={colors.textTertiary}
            />

            <View style={styles.twoCol}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>City / Municipality</Text>
                <TextInput
                  style={styles.input}
                  value={form.city}
                  onChangeText={(text) => updateField("city", text)}
                  placeholder="Cebu City"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Province</Text>
                <TextInput
                  style={styles.input}
                  value={form.province}
                  onChangeText={(text) => updateField("province", text)}
                  placeholder="Cebu"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <Text style={styles.label}>Postal Code</Text>
            <TextInput
              style={styles.input}
              value={form.postalCode}
              onChangeText={(text) => updateField("postalCode", text)}
              placeholder="6000"
              keyboardType="number-pad"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.sectionLabel}>Government ID</Text>
            <View style={styles.idTypeGrid}>
              {PHILIPPINE_ID_TYPES.map((type) => {
                const active = form.idType === type.value;
                return (
                  <TouchableOpacity
                    key={type.value}
                    style={[styles.idTypeChip, active && styles.idTypeActive]}
                    onPress={() => updateField("idType", type.value)}
                  >
                    <Text
                      style={[
                        styles.idTypeText,
                        active && styles.idTypeTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>ID Number</Text>
            <TextInput
              style={[
                styles.input,
                form.idNumber &&
                  (idNumberValid ? styles.validInput : styles.invalidInput),
              ]}
              value={form.idNumber}
              onChangeText={(text) => updateField("idNumber", text)}
              placeholder={idMeta.placeholder}
              autoCapitalize="characters"
              placeholderTextColor={colors.textTertiary}
            />
            <Text
              style={[
                styles.hint,
                form.idNumber && {
                  color: idNumberValid ? colors.success : colors.error,
                },
              ]}
            >
              {form.idNumber
                ? idNumberValid
                  ? "ID number format looks valid."
                  : "ID number format does not match this ID type."
                : idMeta.hint}
            </Text>

            <Text style={styles.sectionLabel}>Verification Images</Text>
            <View style={styles.uploadGrid}>
              {renderImageTile({
                label: "ID Front",
                asset: idFront,
                icon: "card-outline",
                onCamera: () => pickImage("idFront", "camera"),
                onLibrary: () => pickImage("idFront", "library"),
              })}
              {renderImageTile({
                label: "ID Back",
                asset: idBack,
                icon: "albums-outline",
                onCamera: () => pickImage("idBack", "camera"),
                onLibrary: () => pickImage("idBack", "library"),
              })}
              {renderImageTile({
                label: "Live Selfie",
                asset: selfie,
                icon: "person-circle-outline",
                onCamera: () => pickImage("selfie", "camera"),
              })}
            </View>

            <Text style={styles.label}>Notes for Reviewer</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.notes}
              onChangeText={(text) => updateField("notes", text)}
              placeholder="Optional context for your host application"
              multiline
              placeholderTextColor={colors.textTertiary}
            />

            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setAccepted((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
                {accepted && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={colors.textOnAccent}
                  />
                )}
              </View>
              <Text style={styles.consentText}>
                I confirm these details are accurate and consent to PropFlow
                storing my ID images and selfie for host approval review.
              </Text>
            </TouchableOpacity>

            <InlineAlert
              visible={alert.visible}
              type="error"
              message={alert.message}
              onDismiss={() => setAlert({ visible: false, message: "" })}
            />

            <TouchableOpacity
              style={[styles.submitButton, submitting && { opacity: 0.6 }]}
              onPress={submit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textOnAccent} />
              ) : (
                <>
                  <Ionicons
                    name="send"
                    size={18}
                    color={colors.textOnAccent}
                  />
                  <Text style={styles.submitText}>Submit for Review</Text>
                </>
              )}
            </TouchableOpacity>
            <ModalBottomSpacer />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      maxHeight: "92%",
    },
    handle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.skeleton,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 14,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textSecondary,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    sectionLabel: {
      marginTop: 8,
      marginBottom: 10,
      fontSize: 12,
      fontWeight: "800",
      color: colors.textTertiary,
      textTransform: "uppercase",
    },
    twoCol: {
      flexDirection: "row",
      gap: 10,
    },
    fieldHalf: {
      flex: 1,
      minWidth: 0,
    },
    label: {
      marginBottom: 7,
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    input: {
      minHeight: 46,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      color: colors.inputText,
      fontSize: 14,
    },
    textArea: {
      minHeight: 86,
      textAlignVertical: "top",
    },
    validInput: {
      borderColor: colors.success,
    },
    invalidInput: {
      borderColor: colors.error,
    },
    hint: {
      marginTop: -6,
      marginBottom: 12,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textTertiary,
    },
    idTypeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    idTypeChip: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    idTypeActive: {
      backgroundColor: colors.accentSurface,
      borderColor: colors.accent,
    },
    idTypeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    idTypeTextActive: {
      color: colors.accent,
    },
    uploadGrid: {
      gap: 10,
      marginBottom: 12,
    },
    uploadTile: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.background,
      padding: 12,
    },
    uploadPreview: {
      height: 130,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.inputBg,
      overflow: "hidden",
      marginBottom: 10,
    },
    uploadImage: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    uploadLabel: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 8,
    },
    uploadActions: {
      flexDirection: "row",
      gap: 8,
    },
    smallButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 11,
      backgroundColor: colors.accentSurface,
    },
    smallButtonText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.accent,
    },
    consentRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.inputBg,
      marginBottom: 12,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    checkboxOn: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    consentText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    submitButton: {
      minHeight: 50,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      backgroundColor: colors.accent,
      marginTop: 4,
    },
    submitText: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.textOnAccent,
    },
  });

export default HostApplicationModal;
