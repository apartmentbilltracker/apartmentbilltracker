import React, { useState, useMemo } from "react";
import Constants from "expo-constants";
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

const RegisterStep1Screen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        Alert.alert("Success", "Verification code sent to your email");
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
          <Text style={styles.subtitle}>Create Account</Text>
        </View>

        {/* ─── Progress ─── */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "33%" }]} />
          </View>
          <Text style={styles.stepLabel}>Step 1 of 3</Text>
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
          <Text style={styles.formTitle}>Personal Information</Text>

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
    formTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 14,
    },
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
    primaryBtn: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 15,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      marginTop: 6,
      shadowColor: "#b38604",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 3,
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

export default RegisterStep1Screen;
