import React, { useState } from "react";
import Constants from "expo-constants";
import * as Application from "expo-application";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Toast, InlineAlert } from "../../components/CustomAlert";
import { authService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import AuthBubbles from "../../components/AuthBubbles";

const RegisterStep1Screen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({
    visible: false,
    type: "success",
    message: "",
  });
  const showToast = (message, type = "success") =>
    setToast({ visible: true, type, message });
  const hideToast = () => setToast((t) => ({ ...t, visible: false }));

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleNext = async () => {
    setError("");
    if (!fullName.trim()) {
      setError("Please enter your full name");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.createUser({ name: fullName, email });
      if (response.success) {
        showToast("Verification code sent to your email", "success");
        navigation.navigate("RegisterStep2", { email, name: fullName });
      } else {
        setError(response.message || "Failed to create user");
      }
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <AuthBubbles />
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onHide={hideToast}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Branding ─── */}
        <View style={styles.header}>
          <View style={styles.brandPill}>
            <Text style={styles.brandPillText}>Apartment Bill Tracker</Text>
          </View>
          <Text style={styles.appName}>Create account</Text>
          <Text style={styles.subtitle}>Step 1 of 3</Text>
          <Text style={styles.headerCaption}>
            Start with the basics so we can prepare your account.
          </Text>
        </View>

        {/* ─── Progress ─── */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "33%" }]} />
          </View>
          <Text style={styles.stepLabel}>Step 1 of 3</Text>
        </View>

        {/* ─── Error ─── */}
        <InlineAlert
          visible={!!error}
          type="error"
          message={error}
          onDismiss={() => setError("")}
          style={{ marginBottom: 16 }}
        />

        {/* ─── Form ─── */}
        <View style={styles.form}>
          <Text style={styles.formEyebrow}>Personal Details</Text>
          <Text style={styles.formTitle}>Tell us who you are</Text>

          <View style={styles.inputWrap}>
            <Ionicons
              name="person-outline"
              size={18}
              color={colors.accent}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={fullName}
              onChangeText={(t) => {
                setFullName(t);
                setError("");
              }}
              editable={!loading}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={colors.accent}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={handleNext}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={colors.textOnAccent}
                />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── Footer ─── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.creditRow}>
          <Text style={styles.creditText}>
            v{Constants.expoConfig?.version || "1.0.0"} (
            {Application.nativeBuildVersion || "42"})
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/* ═══════════════════════ STYLES ═══════════════════════ */
const createStyles = (colors) => {
  const isDarkMode = colors.statusBarStyle === "light-content";
  const glassPanel = isDarkMode
    ? "rgba(10,66,64,0.46)"
    : "rgba(196,232,226,0.92)";
  const glassInput = isDarkMode
    ? "rgba(255,255,255,0.07)"
    : "rgba(219,242,238,0.94)";
  const glassBorder = isDarkMode
    ? "rgba(158,208,205,0.20)"
    : "rgba(3,109,65,0.16)";
  const glassBorderSoft = isDarkMode
    ? "rgba(158,208,205,0.13)"
    : "rgba(3,109,65,0.11)";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 56,
      paddingBottom: 36,
    },

    /* Header */
    header: { alignItems: "center", marginBottom: 26 },
    brandPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.accentLight,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: 14,
    },
    brandPillText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.accent,
      textTransform: "uppercase",
    },
    appName: {
      fontSize: 24,
      fontWeight: "900",
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 6,
      fontWeight: "700",
    },
    headerCaption: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: "center",
      lineHeight: 19,
      maxWidth: 280,
    },

    /* Progress */
    progressRow: {
      marginBottom: 18,
      gap: 8,
      backgroundColor: glassPanel,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: glassBorder,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    stepLabel: { fontSize: 12, fontWeight: "600", color: colors.accent },

    /* Error */
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.errorBg,
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 16,
      gap: 8,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: colors.error,
      fontWeight: "500",
    },

    /* Form */
    form: {
      marginBottom: 28,
      backgroundColor: glassPanel,
      borderWidth: 1,
      borderColor: glassBorder,
      borderRadius: 22,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.13,
      shadowRadius: 24,
      elevation: 5,
    },
    formEyebrow: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textTertiary,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    formTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 14,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: glassInput,
      borderWidth: 1,
      borderColor: glassBorderSoft,
      borderRadius: 16,
      marginBottom: 12,
      paddingHorizontal: 14,
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, paddingVertical: 14, fontSize: 15, color: colors.text },
    primaryBtn: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      marginTop: 6,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 4,
    },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

    /* Footer */
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    footerText: { fontSize: 14, color: colors.textSecondary },
    footerLink: { fontSize: 14, color: colors.accent, fontWeight: "700" },
    creditRow: {
      marginTop: 28,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      alignItems: "center",
    },
    creditText: {
      fontSize: 11,
      color: colors.textTertiary,
      fontStyle: "italic",
    },
  });
};

export default RegisterStep1Screen;
