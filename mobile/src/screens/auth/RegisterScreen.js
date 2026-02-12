import React, { useContext, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
import { AuthContext } from "../../context/AuthContext";
import { useTheme } from "../../theme/ThemeContext";

WebBrowser.maybeCompleteAuthSession();

// Use Expo's built-in Google setup - no Client ID needed
const RegisterScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signUp, signInWithGoogle } = useContext(AuthContext);

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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <View style={styles.header}>
          {/* <MaterialIcons name="apartment" size={48} color={colors.accent} /> */}
          <Image
            source={require("../../assets/icon.png")}
            style={styles.icon}
          />
          <Text style={styles.title}>Apartment Bill Tracker</Text>
          <Text style={styles.subtitle}>Create Account</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Email & Password Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sign Up with Email</Text>

          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            editable={!loading}
            placeholderTextColor={colors.placeholder}
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
            placeholderTextColor={colors.placeholder}
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.passwordToggle}
              disabled={loading}
            >
              <Ionicons
                name={showPassword ? "eye" : "eye-off"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              editable={!loading}
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.passwordToggle}
              disabled={loading}
            >
              <Ionicons
                name={showConfirmPassword ? "eye" : "eye-off"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
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
            style={[styles.socialButton, !request && styles.buttonDisabled]}
            onPress={() => promptAsync()}
            disabled={!request || loading}
          >
            <Ionicons name="logo-google" size={20} color="#4285F4" />
            <Text style={styles.socialButtonText}>Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, styles.buttonDisabled]}
            onPress={() =>
              Alert.alert(
                "Coming Soon",
                "Facebook login support will be added soon",
              )
            }
            disabled={true}
          >
            <Ionicons name="logo-facebook" size={20} color="#1877F2" />
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
          <Text style={styles.developerText}>v1.1.2</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.card,
    },
    content: {
      padding: 20,
      paddingTop: 40,
      paddingBottom: 40,
    },
    header: {
      alignItems: "center",
      marginBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.text,
      marginTop: 12,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      fontSize: 15,
      backgroundColor: colors.inputBg,
      color: colors.text,
    },
    passwordContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      marginBottom: 12,
      backgroundColor: colors.inputBg,
    },
    passwordInput: {
      flex: 1,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    passwordToggle: {
      padding: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    button: {
      borderRadius: 8,
      padding: 14,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    primaryButton: {
      backgroundColor: colors.accent,
      marginTop: 6,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
      marginBottom: 16,
      textAlign: "center",
      paddingHorizontal: 10,
      paddingVertical: 10,
      backgroundColor: colors.errorBg,
      borderRadius: 6,
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
      fontWeight: "500",
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
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      backgroundColor: colors.inputBg,
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
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: "center",
    },
    developerText: {
      fontSize: 12,
      color: colors.textTertiary,
      fontStyle: "italic",
    },
    icon: {
      width: 90,
      height: 90,
      resizeMode: "contain",
    },
  });

export default RegisterScreen;
