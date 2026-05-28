import React, { useState, useContext } from "react";
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
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Toast, InlineAlert } from "../../components/CustomAlert";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { AuthContext } from "../../context/AuthContext";
import { authService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import AuthBubbles from "../../components/AuthBubbles";

const RegisterStep3Screen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  /* ── helper component ── */
  const PasswordRequirement = ({ met, text }) => (
    <View style={styles.requirement}>
      <Ionicons
        name={met ? "checkmark-circle" : "ellipse-outline"}
        size={16}
        color={met ? "#27ae60" : "#cbd5e1"}
      />
      <Text style={[styles.requirementText, met && styles.requirementMet]}>
        {text}
      </Text>
    </View>
  );

  const { email, name } = route.params || {};
  const { signIn } = useContext(AuthContext);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ visible: false, type: "success", message: "" });
  const showToast = (message, type = "success") => setToast({ visible: true, type, message });
  const hideToast = () => setToast((t) => ({ ...t, visible: false }));

  const getPasswordStrength = () => {
    if (!password) return null;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[!@#$%^&*]/.test(password)) s++;
    if (s <= 1) return { level: "Weak", color: "#ef4444", width: "25%" };
    if (s <= 2) return { level: "Fair", color: "#f59e0b", width: "50%" };
    if (s <= 3) return { level: "Good", color: "#3b82f6", width: "75%" };
    return { level: "Strong", color: "#22c55e", width: "100%" };
  };

  const validatePassword = () => {
    if (!password.trim()) {
      setError("Password is required");
      return false;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Include at least one uppercase letter");
      return false;
    }
    if (!/[0-9]/.test(password)) {
      setError("Include at least one number");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleCompleteSignup = async () => {
    setError("");
    if (!validatePassword()) return;

    setLoading(true);
    try {
      const response = await authService.setPassword({ email, password });
      if (response.success) {
        showToast("Account created successfully!", "success");
        const loginResult = await signIn(email, password);
        if (!loginResult.success) {
          showToast("Account created! Please log in with your credentials.", "info");
          navigation.navigate("Login");
        }
      } else {
        setError(response.message || "Failed to create account");
      }
    } catch (err) {
      setError(err.message || "An error occurred during signup");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength();

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
          <View style={styles.iconGlow}>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.icon}
            />
          </View>
          <View style={styles.brandPill}>
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={colors.accent}
            />
            <Text style={styles.brandPillText}>Step 3 of 3</Text>
          </View>
          <Text style={styles.appName}>PropFlow</Text>
          <Text style={styles.subtitle}>Set Your Password</Text>
          <Text style={styles.headerCaption}>
            Finish with a secure password for future sign-ins.
          </Text>
        </View>

        {/* ─── Progress ─── */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "100%" }]} />
          </View>
          <Text style={styles.stepLabel}>Step 3 of 3</Text>
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
          <Text style={styles.formEyebrow}>Security Setup</Text>
          <Text style={styles.formTitle}>Create a strong password</Text>
          {/* Password */}
          <View style={styles.inputWrap}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={colors.accent}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError("");
              }}
              secureTextEntry={!showPassword}
              editable={!loading}
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

          {/* Strength meter */}
          {password ? (
            <View style={styles.strengthWrap}>
              <View style={styles.strengthBar}>
                <View
                  style={[
                    styles.strengthFill,
                    {
                      backgroundColor: passwordStrength.color,
                      width: passwordStrength.width,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.strengthLabel,
                  { color: passwordStrength.color },
                ]}
              >
                {passwordStrength.level}
              </Text>
            </View>
          ) : null}

          {/* Requirements checklist */}
          <View style={styles.reqBox}>
            <Text style={styles.reqTitle}>Password requirements:</Text>
            <PasswordRequirement
              met={password.length >= 8}
              text="At least 8 characters"
            />
            <PasswordRequirement
              met={/[A-Z]/.test(password)}
              text="One uppercase letter (A-Z)"
            />
            <PasswordRequirement
              met={/[0-9]/.test(password)}
              text="One number (0-9)"
            />
            <PasswordRequirement
              met={/[!@#$%^&*]/.test(password)}
              text="One special character (!@#$%^&*)"
            />
          </View>

          {/* Confirm Password */}
          <View style={[styles.inputWrap, { marginTop: 6 }]}>
            <Ionicons
              name="lock-closed"
              size={18}
              color={colors.accent}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                setError("");
              }}
              secureTextEntry={!showConfirm}
              editable={!loading}
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

          {/* Match indicator */}
          {confirmPassword ? (
            <View style={styles.matchRow}>
              <Ionicons
                name={
                  password === confirmPassword
                    ? "checkmark-circle"
                    : "close-circle"
                }
                size={14}
                color={password === confirmPassword ? "#22c55e" : "#ef4444"}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "500",
                  color: password === confirmPassword ? "#22c55e" : "#ef4444",
                }}
              >
                {password === confirmPassword
                  ? "Passwords match"
                  : "Passwords do not match"}
              </Text>
            </View>
          ) : null}

          {/* Terms Agreement */}
          <Text style={styles.termsText}>
            By creating an account, you agree to our{" "}
            <Text
              style={styles.termsLink}
              onPress={() => navigation.navigate("TermsOfService")}
            >
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text
              style={styles.termsLink}
              onPress={() => navigation.navigate("PrivacyPolicy")}
            >
              Privacy Policy
            </Text>
            .
          </Text>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={handleCompleteSignup}
            disabled={loading}
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
                <Text style={styles.primaryBtnText}>Create Account</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── Footer ─── */}
        <View style={styles.footerRow}>
          <Text style={styles.footerMuted}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.creditRow}>
          <Text style={styles.creditText}>
            v{Constants.expoConfig?.version || "1.0.0"} (
            {Application.nativeBuildVersion || "1"})
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
      paddingTop: 48,
      paddingBottom: 36,
    },

    /* Header */
    header: { alignItems: "center", marginBottom: 26 },
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
      width: 108,
      height: 108,
      borderRadius: 32,
      backgroundColor: glassPanel,
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
    icon: { width: 72, height: 72, resizeMode: "contain" },
    appName: {
      fontSize: 26,
      fontWeight: "900",
      color: colors.text,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textTertiary,
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
    toggle: { padding: 8 },

    /* Strength */
    strengthWrap: { marginBottom: 10, gap: 4, paddingHorizontal: 2 },
    strengthBar: {
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    strengthFill: { height: "100%", borderRadius: 3 },
    strengthLabel: { fontSize: 11, fontWeight: "700" },

    /* Requirements */
    reqBox: {
      backgroundColor: glassInput,
      borderWidth: 1,
      borderColor: glassBorderSoft,
      borderRadius: 16,
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
    requirement: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 5,
    },
    requirementText: { fontSize: 12, color: colors.textTertiary },
    requirementMet: { color: "#27ae60", fontWeight: "500" },

    /* Match */
    matchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 14,
      paddingHorizontal: 4,
    },

    /* CTA */
    primaryBtn: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 4,
    },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

    /* Terms */
    termsText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textTertiary,
      textAlign: "center",
      marginBottom: 16,
      marginTop: 4,
    },
    termsLink: {
      color: colors.accent,
      fontWeight: "600",
    },

    /* Footer */
    footerRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    footerMuted: { fontSize: 13, color: colors.textSecondary },
    footerLink: { fontSize: 13, color: colors.accent, fontWeight: "700" },
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

export default RegisterStep3Screen;
