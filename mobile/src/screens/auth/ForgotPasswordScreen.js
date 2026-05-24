import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import AuthBubbles from "../../components/AuthBubbles";

const ForgotPasswordScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await authService.requestPasswordReset(email);
      if (response.success) {
        Alert.alert(
          "Code Sent",
          response.message ||
            "A 6-digit verification code has been sent to your email.",
          [
            {
              text: "OK",
              onPress: () => navigation.navigate("VerifyResetCode", { email }),
            },
          ],
        );
      } else {
        setError(response.message || "Failed to send reset code");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.data?.message ||
        err.message ||
        "An error occurred. Please try again later.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      setEmail("");
      setError("");
    });
    return unsub;
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <AuthBubbles />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Back + Title ─── */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        {/* ─── Header icon ─── */}
        <View style={styles.header}>
          <View style={styles.iconGlow}>
            <Ionicons
              name="lock-open-outline"
              size={42}
              color={colors.accent}
            />
          </View>
          <View style={styles.brandPill}>
            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color={colors.accent}
            />
            <Text style={styles.brandPillText}>Account recovery</Text>
          </View>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you a 6-digit code to reset your
            password.
          </Text>
        </View>

        {/* ─── Error ─── */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ─── Form ─── */}
        <View style={styles.form}>
          <Text style={styles.formEyebrow}>Reset Access</Text>
          <Text style={styles.formTitle}>Where should we send the code?</Text>
          <View style={styles.inputWrap}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={colors.accent}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
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
            onPress={handleResetPassword}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <>
                <Ionicons
                  name="send-outline"
                  size={18}
                  color={colors.textOnAccent}
                />
                <Text style={styles.primaryBtnText}>Send Reset Code</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── Footer ─── */}
        <View style={styles.footerRow}>
          <Text style={styles.footerMuted}>Remember your password? </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Info tip ─── */}
        <View style={styles.tipBox}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.accent}
          />
          <Text style={styles.tipText}>
            The code will expire in 15 minutes. Check your spam folder if you
            don't see the email.
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
  const glassPanelStrong = isDarkMode
    ? "rgba(10,66,64,0.56)"
    : "rgba(184,224,218,0.95)";
  const glassInput = isDarkMode
    ? "rgba(255,255,255,0.07)"
    : "rgba(219,242,238,0.94)";
  const glassBorder = isDarkMode
    ? "rgba(158,208,205,0.20)"
    : "rgba(3,109,65,0.16)";
  const glassBorderSoft = isDarkMode
    ? "rgba(158,208,205,0.13)"
    : "rgba(3,109,65,0.11)";
  const glassAccentSurface = isDarkMode
    ? "rgba(129,216,163,0.14)"
    : "rgba(202,238,232,0.96)";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 52,
      paddingBottom: 36,
    },

    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: glassPanel,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
      borderWidth: 1,
      borderColor: glassBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 14,
      elevation: 3,
    },

    header: { alignItems: "center", marginBottom: 28 },
    brandPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
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
    iconGlow: {
      width: 96,
      height: 96,
      borderRadius: 30,
      backgroundColor: glassPanelStrong,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: glassBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      elevation: 5,
      marginBottom: 18,
    },
    title: {
      fontSize: 26,
      fontWeight: "900",
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },

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
      marginBottom: 16,
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
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 4,
    },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

    footerRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 28,
    },
    footerMuted: { fontSize: 13, color: colors.textSecondary },
    footerLink: { fontSize: 13, color: colors.accent, fontWeight: "700" },

    tipBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: glassAccentSurface,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: glassBorderSoft,
    },
    tipText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });
};

export default ForgotPasswordScreen;
