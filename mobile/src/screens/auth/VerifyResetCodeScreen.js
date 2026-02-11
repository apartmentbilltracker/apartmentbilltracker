import React, { useState, useEffect, useMemo } from "react";
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
            <Ionicons name="backspace-outline" size={22} color={colors.text} />
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
const createStyles = (colors) =>
  StyleSheet.create({
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
      borderRadius: 12,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 1,
    },

    header: { alignItems: "center", marginBottom: 24 },
    iconGlow: {
      width: 88,
      height: 88,
      borderRadius: 24,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#b38604",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 4,
      marginBottom: 18,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: 0.2,
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

    codeDisplay: {
      alignItems: "center",
      marginBottom: 20,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: "#b38604",
      borderRadius: 14,
      paddingVertical: 16,
      shadowColor: "#b38604",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    codeText: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.textTertiary,
      letterSpacing: 10,
    },
    codeTextFilled: { color: colors.accent },
    hint: { fontSize: 11, color: colors.textTertiary, marginTop: 6 },

    numberPad: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
      marginBottom: 20,
      paddingHorizontal: 8,
    },
    padBtn: {
      width: "28%",
      aspectRatio: 1.3,
      borderRadius: 14,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    padBtnText: { fontSize: 20, fontWeight: "700", color: colors.text },

    primaryBtn: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 15,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      marginBottom: 20,
      shadowColor: "#b38604",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 3,
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
      backgroundColor: colors.warningBg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    tipText: { flex: 1, fontSize: 12, color: colors.warning, lineHeight: 18 },
  });

export default VerifyResetCodeScreen;
