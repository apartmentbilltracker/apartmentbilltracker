import React, { useState, useRef } from "react";
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

const RegisterStep2Screen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { email, name } = route.params || {};
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef(null);
  const [toast, setToast] = useState({
    visible: false,
    type: "success",
    message: "",
  });
  const showToast = (message, type = "success") =>
    setToast({ visible: true, type, message });
  const hideToast = () => setToast((t) => ({ ...t, visible: false }));

  React.useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(
        () => setResendTimer(resendTimer - 1),
        1000,
      );
    }
    return () => clearTimeout(timerRef.current);
  }, [resendTimer]);

  const handleVerify = async () => {
    setError("");
    if (!code.trim()) {
      setError("Please enter the verification code");
      return;
    }
    if (code.length < 6) {
      setError("Verification code must be 6 digits");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.verifyActivationCode({
        email,
        activationCode: code,
      });
      if (response.success) {
        showToast("Email verified successfully", "success");
        navigation.navigate("RegisterStep3", { email, name });
      } else {
        setError(response.message || "Invalid verification code");
      }
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setResending(true);
    try {
      const response = await authService.resendVerification(email);
      if (response.success) {
        showToast("New verification code sent to your email", "success");
        setResendTimer(60);
        setCode("");
      } else {
        setError(response.message || "Failed to resend code");
      }
    } catch (err) {
      setError("Failed to resend verification code");
    } finally {
      setResending(false);
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
          <Text style={styles.appName}>Verify your email</Text>
          <Text style={styles.subtitle}>Step 2 of 3</Text>
          <Text style={styles.headerCaption}>
            Enter the code from your inbox to confirm this address.
          </Text>
        </View>

        {/* ─── Progress ─── */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "66%" }]} />
          </View>
          <Text style={styles.stepLabel}>Step 2 of 3</Text>
        </View>

        {/* ─── Info banner ─── */}
        <View style={styles.infoBanner}>
          <Ionicons name="mail-open-outline" size={18} color={colors.accent} />
          <Text style={styles.infoBannerText}>
            We sent a 6-digit code to{" "}
            <Text style={{ fontWeight: "700" }}>{email}</Text>
          </Text>
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
          <Text style={styles.formEyebrow}>Verification Code</Text>
          <Text style={styles.formTitle}>Type the 6-digit code</Text>
          <View style={styles.inputWrap}>
            <Ionicons
              name="keypad-outline"
              size={18}
              color={colors.accent}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="000000"
              value={code}
              onChangeText={(t) => {
                setCode(t);
                setError("");
              }}
              keyboardType="number-pad"
              maxLength={6}
              editable={!loading}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={colors.textOnAccent}
                />
                <Text style={styles.primaryBtnText}>Verify & Continue</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive the code? </Text>
            <TouchableOpacity
              onPress={handleResendCode}
              disabled={resending || resendTimer > 0}
            >
              <Text
                style={[
                  styles.resendLink,
                  (resending || resendTimer > 0) && { color: "#94a3b8" },
                ]}
              >
                {resending
                  ? "Sending…"
                  : resendTimer > 0
                    ? `Resend in ${resendTimer}s`
                    : "Resend Code"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Footer ─── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="arrow-back"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.backBtnText}>Back</Text>
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
      maxWidth: 290,
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

    /* Info banner */
    infoBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: glassPanel,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: glassBorder,
    },
    infoBannerText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },

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
      marginBottom: 14,
      paddingHorizontal: 14,
    },
    inputIcon: { marginRight: 10 },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 18,
      color: colors.text,
      fontWeight: "700",
    },
    primaryBtn: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 4,
    },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

    /* Resend */
    resendRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 18,
    },
    resendLabel: { fontSize: 13, color: colors.textSecondary },
    resendLink: { fontSize: 13, color: colors.accent, fontWeight: "700" },

    /* Footer */
    footer: { alignItems: "center", marginBottom: 4 },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: glassPanel,
      borderWidth: 1,
      borderColor: glassBorder,
    },
    backBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
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

export default RegisterStep2Screen;
