import React, { useState, useContext, useMemo } from "react";
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
import Constants from "expo-constants";
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
        Alert.alert("Success", "Account created successfully!");
        const loginResult = await signIn(email, password);
        if (!loginResult.success) {
          Alert.alert(
            "Info",
            "Account created! Please log in with your credentials.",
          );
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
          <Text style={styles.subtitle}>Set Your Password</Text>
        </View>

        {/* ─── Progress ─── */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "100%" }]} />
          </View>
          <Text style={styles.stepLabel}>Step 3 of 3</Text>
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
            v{Constants.expoConfig?.version || "1.0.0"}
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
      paddingTop: 48,
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
    progressRow: { marginBottom: 20, gap: 6 },
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
    form: { marginBottom: 28 },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      marginBottom: 12,
      paddingHorizontal: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
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

export default RegisterStep3Screen;
