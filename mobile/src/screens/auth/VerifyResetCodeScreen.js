import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
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

const VerifyResetCodeScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { email } = route.params;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError("Please enter the 6-digit code");
      return;
    }
    if (code.length !== 6) {
      setError("Code must be exactly 6 digits");
      return;
    }
    if (!/^\d+$/.test(code)) {
      setError("Code must contain only numbers");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await authService.verifyResetCode(email, code);
      if (response.success) {
        Alert.alert("Success", "Code verified! Now set your new password.", [
          {
            text: "OK",
            onPress: () =>
              navigation.navigate("ResetPassword", { email, resetCode: code }),
          },
        ]);
      } else {
        setError(response.message || "Invalid code");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.data?.message ||
        err.message ||
        "Failed to verify code. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      setCode("");
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
        {/* ─── Back ─── */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View style={styles.iconGlow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={42}
              color={colors.accent}
            />
          </View>
          <View style={styles.brandPill}>
            <Ionicons name="keypad-outline" size={14} color={colors.accent} />
            <Text style={styles.brandPillText}>Account recovery</Text>
          </View>
          <Text style={styles.title}>Verify Code</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{"\n"}
            <Text style={{ fontWeight: "700", color: colors.text }}>
              {email}
            </Text>
          </Text>
        </View>

        {/* ─── Error ─── */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ─── Code display ─── */}
        <View style={styles.form}>
          <Text style={styles.formEyebrow}>Verification</Text>
          <Text style={styles.formTitle}>Enter your reset code</Text>

          <View style={styles.codeDisplay}>
            <Text
              style={[
                styles.codeText,
                code.length === 6 && styles.codeTextFilled,
              ]}
            >
              {code || "------"}
            </Text>
            <Text style={styles.hint}>{code.length}/6 digits entered</Text>
          </View>

          {/* ─── Number pad ─── */}
          <View style={styles.numberPad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.padBtn, code.length >= 6 && { opacity: 0.4 }]}
                onPress={() => {
                  if (code.length < 6) {
                    setCode(code + num);
                    setError("");
                  }
                }}
                activeOpacity={0.7}
                disabled={code.length >= 6}
              >
                <Text style={styles.padBtnText}>{num}</Text>
              </TouchableOpacity>
            ))}
            {/* empty spacer */}
            <View style={styles.padBtn} />
            <TouchableOpacity
              style={[styles.padBtn, code.length >= 6 && { opacity: 0.4 }]}
              onPress={() => {
                if (code.length < 6) {
                  setCode(code + "0");
                  setError("");
                }
              }}
              activeOpacity={0.7}
              disabled={code.length >= 6}
            >
              <Text style={styles.padBtnText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.padBtn}
              onPress={() => setCode(code.slice(0, -1))}
              activeOpacity={0.7}
            >
              <Ionicons
                name="backspace-outline"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          {/* ─── CTA ─── */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (loading || code.length !== 6) && { opacity: 0.6 },
            ]}
            onPress={handleVerifyCode}
            disabled={loading || code.length !== 6}
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
                <Text style={styles.primaryBtnText}>Verify Code</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── Footer ─── */}
        <View style={styles.footerRow}>
          <Text style={styles.footerMuted}>Didn't receive the code? </Text>
          <TouchableOpacity
            onPress={() => {
              setCode("");
              navigation.goBack();
            }}
            disabled={loading}
          >
            <Text style={styles.footerLink}>Try Another Email</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Tip ─── */}
        <View style={styles.tipBox}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.accent}
          />
          <Text style={styles.tipText}>
            The code is valid for 15 minutes. Check your spam folder if you
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
      paddingBottom: 60,
    },

    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: glassPanel,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: glassBorder,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 14,
      elevation: 3,
    },

    header: { alignItems: "center", marginBottom: 24 },
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
      marginBottom: 22,
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
      letterSpacing: 0.7,
      marginBottom: 4,
    },
    formTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 14,
    },

    codeDisplay: {
      alignItems: "center",
      marginBottom: 20,
      backgroundColor: glassInput,
      borderWidth: 1,
      borderColor: glassBorderSoft,
      borderRadius: 18,
      paddingVertical: 16,
    },
    codeText: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.textTertiary,
    },
    codeTextFilled: { color: colors.accent },
    hint: { fontSize: 11, color: colors.textTertiary, marginTop: 6 },

    numberPad: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
      marginBottom: 20,
    },
    padBtn: {
      width: "28%",
      aspectRatio: 1.3,
      borderRadius: 16,
      backgroundColor: glassInput,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: glassBorderSoft,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    padBtnText: { fontSize: 20, fontWeight: "700", color: colors.text },

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
      marginBottom: 24,
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

export default VerifyResetCodeScreen;
