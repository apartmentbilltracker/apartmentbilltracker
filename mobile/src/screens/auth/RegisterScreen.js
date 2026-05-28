import React, { useContext, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Toast, InlineAlert } from "../../components/CustomAlert";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { AuthContext } from "../../context/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AuthBubbles from "../../components/AuthBubbles";

WebBrowser.maybeCompleteAuthSession();

// Use Expo's built-in Google setup - no Client ID needed
const RegisterScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signUp, signInWithGoogle } = useContext(AuthContext);
  const [toast, setToast] = useState({ visible: false, type: "info", message: "" });
  const showToast = (message, type = "info") => setToast({ visible: true, type, message });
  const hideToast = () => setToast((t) => ({ ...t, visible: false }));

  // Google Auth Request - Using Expo's configuration
  // Only enable on iOS/Web, Android needs androidClientId from Google Console
  const [request, response, promptAsync] = Google.useAuthRequest(
    Platform.OS === "android"
      ? {
          androidClientId:
            "280450131002-iv8nv3hnottf109ft2ruogaq4daqjpbh.apps.googleusercontent.com",
          webClientId:
            "280450131002-ecknav2so7qhc0kd83t9644ap6hvaurh.apps.googleusercontent.com",
        }
      : {
          webClientId:
            "280450131002-ecknav2so7qhc0kd83t9644ap6hvaurh.apps.googleusercontent.com",
        },
  );

  // Handle Google Response
  React.useEffect(() => {
    if (response?.type === "success") {
      const { access_token } = response.params;
      handleGoogleSignup(access_token);
    }
  }, [response]);

  const handleGoogleSignup = async (accessToken) => {
    try {
      setLoading(true);
      setError("");

      // Get user info from Google
      const userResponse = await fetch(
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
      );
      const userData = await userResponse.json();

      // Call backend endpoint
      const result = await signInWithGoogle({
        email: userData.email,
        name: userData.name,
        avatar: userData.picture,
      });

      if (!result.success) {
        setError(result.error || "Google signup failed");
      }
    } catch (err) {
      console.error("Google signup error:", err);
      setError("Google signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");
    const result = await signUp(name, email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
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
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top + 22, 40) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconGlow}>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.icon}
            />
          </View>
          <View style={styles.brandPill}>
            <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
            <Text style={styles.brandPillText}>Start your account</Text>
          </View>
          <Text style={styles.title}>PropFlow</Text>
          <Text style={styles.subtitle}>Create Account</Text>
          <Text style={styles.headerCaption}>
            Set up your space to manage rooms, bills, payments, and updates in
            one place.
          </Text>
        </View>

        <InlineAlert
          visible={!!error}
          type="error"
          message={error}
          onDismiss={() => setError("")}
          style={{ marginBottom: 16 }}
        />

        {/* Email & Password Section */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Email Registration</Text>
          <Text style={styles.sectionTitle}>Create your login details</Text>
          <Text style={styles.sectionHint}>
            Use an email address you can access for future sign-ins and account
            recovery.
          </Text>

          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color={colors.accent} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={name}
              onChangeText={(t) => { setName(t); setError(""); }}
              editable={!loading}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.accent} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(""); }}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.accent} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(""); }}
              secureTextEntry={!showPassword}
              editable={!loading}
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}
              disabled={loading}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed" size={18} color={colors.accent} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setError(""); }}
              secureTextEntry={!showConfirmPassword}
              editable={!loading}
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeBtn}
              disabled={loading}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Create Account</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Social Login Section */}
        <View style={styles.dividerSection}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>Or sign up with</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.socialSection}>
          <TouchableOpacity
            style={[styles.socialButton, (!request || loading) && { opacity: 0.5 }]}
            onPress={() => promptAsync()}
            disabled={!request || loading}
            activeOpacity={0.7}
          >
            <Image
              source={require("../../assets/google-icon.png")}
              style={{ width: 18, height: 18 }}
            />
            <Text style={styles.socialButtonText}>Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, { opacity: 0.45 }]}
            onPress={() => showToast("Facebook sign-up is coming soon.", "info")}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-facebook" size={18} color="#1877F2" />
            <Text style={styles.socialButtonText}>Facebook</Text>
          </TouchableOpacity>
        </View>

        {/* Sign In Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Login")}
            disabled={loading}
          >
            <Text style={styles.linkText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Developer Credit Footer */}
        <View style={styles.developerFooter}>
          <Text style={styles.developerText}>
            v{Constants.expoConfig?.version || "1.0.0"} (
            {Application.nativeBuildVersion || "1"})
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

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
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    header: {
      alignItems: "center",
      marginBottom: 32,
    },
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
      letterSpacing: 0.7,
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
    title: {
      fontSize: 26,
      fontWeight: "900",
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
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
    section: {
      marginBottom: 24,
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
    sectionEyebrow: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.7,
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 6,
    },
    sectionHint: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 14,
    },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.text,
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
    eyeBtn: { padding: 8 },
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
    /* legacy — kept so nothing crashes if referenced elsewhere */
    passwordContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: glassBorderSoft,
      borderRadius: 16,
      marginBottom: 12,
      backgroundColor: glassInput,
    },
    passwordInput: {
      flex: 1,
      padding: 14,
      fontSize: 15,
      color: colors.text,
    },
    passwordToggle: {
      padding: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    button: {
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 52,
    },
    primaryButton: {
      backgroundColor: colors.accent,
      marginTop: 6,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
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
      color: colors.error,
      fontSize: 13,
      fontWeight: "500",
    },
    dividerSection: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 24,
    },
    divider: {
      flex: 1,
      height: 1,
      backgroundColor: colors.skeleton,
    },
    dividerText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginHorizontal: 12,
      fontWeight: "600",
    },
    socialSection: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 24,
    },
    socialButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: glassBorderSoft,
      borderRadius: 16,
      padding: 14,
      backgroundColor: glassPanel,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
    socialButtonText: {
      marginLeft: 8,
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    footerText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    linkText: {
      fontSize: 14,
      color: colors.accent,
      fontWeight: "600",
    },
    developerFooter: {
      marginTop: 32,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      alignItems: "center",
    },
    developerText: {
      fontSize: 12,
      color: colors.textTertiary,
      fontStyle: "italic",
    },
    icon: {
      width: 76,
      height: 76,
      resizeMode: "contain",
    },
  });
};

export default RegisterScreen;
