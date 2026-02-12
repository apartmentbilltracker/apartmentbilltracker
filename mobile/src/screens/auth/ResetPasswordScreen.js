import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import AuthBubbles from "../../components/AuthBubbles";

const ResetPasswordScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  /* ── helper ── */
  const Requirement = ({ met, text }) => (
    <View style={styles.req}>
      <Ionicons
        name={met ? "checkmark-circle" : "ellipse-outline"}
        size={16}
        color={met ? "#22c55e" : "#cbd5e1"}
      />
      <Text style={[styles.reqText, met && styles.reqMet]}>{text}</Text>
    </View>
  );

  const { email, resetCode } = route.params;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validatePasswords = () => {
    const e = {};
    if (!password.trim()) e.password = "Password is required";
    else if (password.length < 8) e.password = "Must be at least 8 characters";
    else if (!/[A-Z]/.test(password))
      e.password = "Include an uppercase letter";
    else if (!/[0-9]/.test(password)) e.password = "Include a number";
    if (!confirmPassword.trim())
      e.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword)
      e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleResetPassword = async () => {
    if (!validatePasswords()) return;
    setLoading(true);
    setErrors({});
    try {
      const response = await authService.resetPassword(
        email,
        resetCode,
        password,
      );
      if (response.success) {
        Alert.alert(
          "Success",
          "Password reset successfully! Please login with your new password.",
          [{ text: "OK", onPress: () => navigation.navigate("Login") }],
        );
      } else {
        setErrors({ submit: response.message || "Failed to reset password" });
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.data?.message ||
        err.message ||
        "Failed to reset password.";
      setErrors({ submit: msg });
    } finally {
      setLoading(false);
    }
  };

  const getStrength = () => {
    if (!password) return null;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (s <= 1) return { label: "Weak", color: "#ef4444", w: "33%" };
    if (s <= 2) return { label: "Fair", color: "#f59e0b", w: "66%" };
    return { label: "Strong", color: "#22c55e", w: "100%" };
  };

  const strength = getStrength();

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirm(false);
      setErrors({});
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
            <Ionicons name="key-outline" size={42} color={colors.accent} />
          </View>
          <Text style={styles.title}>New Password</Text>
          <Text style={styles.subtitle}>
            Create a strong new password for your account
          </Text>
        </View>

        {/* ─── Submit error ─── */}
        {errors.submit ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorBoxText}>{errors.submit}</Text>
          </View>
        ) : null}

        {/* ─── Form ─── */}
        <View style={styles.form}>
          {/* New password */}
          <View
            style={[styles.inputWrap, errors.password && styles.inputWrapError]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={colors.accent}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (errors.password) setErrors({ ...errors, password: "" });
              }}
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.toggle}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {errors.password ? (
            <Text style={styles.fieldErr}>{errors.password}</Text>
          ) : null}

          {/* Strength */}
          {password ? (
            <View style={styles.strengthWrap}>
              <View style={styles.strengthBar}>
                <View
                  style={[
                    styles.strengthFill,
                    { backgroundColor: strength.color, width: strength.w },
                  ]}
                />
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          ) : null}

          {/* Requirements */}
          <View style={styles.reqBox}>
            <Text style={styles.reqTitle}>Password Requirements:</Text>
            <Requirement
              met={password.length >= 8}
              text="At least 8 characters"
            />
            <Requirement
              met={/[A-Z]/.test(password)}
              text="One uppercase letter"
            />
            <Requirement met={/[0-9]/.test(password)} text="One number" />
          </View>

          {/* Confirm password */}
          <View
            style={[
              styles.inputWrap,
              errors.confirmPassword && styles.inputWrapError,
            ]}
          >
            <Ionicons
              name="lock-closed"
              size={18}
              color={colors.accent}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                if (errors.confirmPassword)
                  setErrors({ ...errors, confirmPassword: "" });
              }}
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity
              onPress={() => setShowConfirm(!showConfirm)}
              style={styles.toggle}
            >
              <Ionicons
                name={showConfirm ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword ? (
            <Text style={styles.fieldErr}>{errors.confirmPassword}</Text>
          ) : null}

          {/* Match */}
          {confirmPassword && password === confirmPassword ? (
            <View style={styles.matchRow}>
              <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
              <Text
                style={{ fontSize: 12, fontWeight: "500", color: "#22c55e" }}
              >
                Passwords match
              </Text>
            </View>
          ) : null}

          {/* CTA */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (loading || !password || !confirmPassword) && { opacity: 0.6 },
            ]}
            onPress={handleResetPassword}
            disabled={loading || !password || !confirmPassword}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-done-outline"
                  size={18}
                  color={colors.textOnAccent}
                />
                <Text style={styles.primaryBtnText}>Reset Password</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── Footer ─── */}
        <View style={styles.footerRow}>
          <Text style={styles.footerMuted}>Remember your password? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Login")}
            disabled={loading}
          >
            <Text style={styles.footerLink}>Login Here</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Tip ─── */}
        <View style={styles.tipBox}>
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={colors.accent}
          />
          <Text style={styles.tipText}>
            Your password will be encrypted and securely stored. Never share
            your password with anyone.
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
    errorBoxText: {
      flex: 1,
      fontSize: 13,
      color: colors.error,
      fontWeight: "500",
    },

    form: { marginBottom: 28 },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      marginBottom: 4,
      paddingHorizontal: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    inputWrapError: { borderColor: colors.error },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, paddingVertical: 14, fontSize: 15, color: colors.text },
    toggle: { padding: 8 },
    fieldErr: {
      fontSize: 12,
      color: colors.error,
      marginBottom: 8,
      paddingHorizontal: 4,
      marginTop: 2,
    },

    strengthWrap: {
      marginBottom: 10,
      gap: 4,
      paddingHorizontal: 2,
      marginTop: 4,
    },
    strengthBar: {
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    strengthFill: { height: "100%", borderRadius: 3 },
    strengthLabel: { fontSize: 11, fontWeight: "700" },

    reqBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 14,
    },
    reqTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
    },
    req: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 5,
    },
    reqText: { fontSize: 12, color: colors.textTertiary },
    reqMet: { color: "#22c55e", fontWeight: "500" },

    matchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 14,
      marginTop: 4,
      paddingHorizontal: 4,
    },

    primaryBtn: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 15,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
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

export default ResetPasswordScreen;
