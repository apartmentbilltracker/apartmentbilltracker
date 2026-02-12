import React, { useState, useRef, useMemo } from "react";
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
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
        Alert.alert("Success", "Email verified successfully");
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
        Alert.alert("Success", "New verification code sent to your email");
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Branding ─── */}
        <View style={styles.header}>
          <View style={styles.iconGlow}>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.icon}
            />
          </View>
          <Text style={styles.appName}>Apartment Bill Tracker</Text>
          <Text style={styles.subtitle}>Verify Your Email</Text>
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
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ─── Form ─── */}
        <View style={styles.form}>
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
          <Text style={styles.creditText}>v.1.1.2</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/* ═══════════════════════ STYLES ═══════════════════════ */
const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 56,
      paddingBottom: 36,
    },

    /* Header */
    header: { alignItems: "center", marginBottom: 24 },
    iconGlow: {
      width: 100,
      height: 100,
      borderRadius: 28,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#b38604",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 4,
      marginBottom: 16,
    },
    icon: { width: 72, height: 72, resizeMode: "contain" },
    appName: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: 0.2,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textTertiary,
      marginTop: 4,
      fontWeight: "500",
    },

    /* Progress */
    progressRow: { marginBottom: 22, gap: 6 },
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
      backgroundColor: colors.warningBg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
      gap: 10,
    },
    infoBannerText: {
      flex: 1,
      fontSize: 13,
      color: colors.warning,
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
    form: { marginBottom: 28 },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      marginBottom: 14,
      paddingHorizontal: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    inputIcon: { marginRight: 10 },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 18,
      color: colors.text,
      letterSpacing: 8,
      fontWeight: "700",
    },
    primaryBtn: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 15,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      shadowColor: "#b38604",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 3,
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
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
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

export default RegisterStep2Screen;
