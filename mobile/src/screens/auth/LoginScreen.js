import React, {
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
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
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as Facebook from "expo-auth-session/providers/facebook";
import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AuthContext } from "../../context/AuthContext";
import { apiService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import savedAccountsService from "../../services/savedAccountsService";
import AuthBubbles from "../../components/AuthBubbles";

// Detect if running in Expo Go vs custom dev build
const IS_EXPO_GO = Constants.appOwnership === "expo";

// TODO: Replace with your Facebook App ID from https://developers.facebook.com
const FACEBOOK_APP_ID = "YOUR_FACEBOOK_APP_ID";
const FB_ENABLED = FACEBOOK_APP_ID !== "YOUR_FACEBOOK_APP_ID";

WebBrowser.maybeCompleteAuthSession();

const LoginScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const { signIn, signInWithGoogle, signInWithFacebook } =
    useContext(AuthContext);

  // Load saved accounts on mount
  useEffect(() => {
    const loadAccounts = async () => {
      const accounts = await savedAccountsService.getAccounts();
      setSavedAccounts(accounts);
    };
    loadAccounts();
  }, []);

  // Select a saved account to login with
  const handleSelectAccount = useCallback((account) => {
    setSelectedAccount(account);
    setEmail(account.email);
    setPassword("");
    setError("");
  }, []);

  // Go back to account picker
  const handleBackToAccounts = useCallback(() => {
    setSelectedAccount(null);
    setEmail("");
    setPassword("");
    setError("");
  }, []);

  // Remove a saved account
  const handleRemoveAccount = useCallback((accountEmail) => {
    Alert.alert(
      "Remove Account",
      "Remove this saved login? You can still log in manually.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await savedAccountsService.removeAccount(accountEmail);
            setSavedAccounts((prev) =>
              prev.filter(
                (a) => a.email.toLowerCase() !== accountEmail.toLowerCase(),
              ),
            );
          },
        },
      ],
    );
  }, []);

  // ── Google OAuth ──
  // In Expo Go the native Android flow can't work (wrong package name),
  // so we use the Expo auth proxy. In dev/standalone builds, the native flow works.
  const googleRedirectUri = IS_EXPO_GO
    ? "https://auth.expo.io/@apartmentbilltracker/apartment-bill-tracker"
    : makeRedirectUri({ scheme: "aptbilltracker", path: "redirect" });

  const GOOGLE_WEB_CLIENT_ID =
    "280450131002-ecknav2so7qhc0kd83t9644ap6hvaurh.apps.googleusercontent.com";

  const [request, response, promptAsync] = Google.useAuthRequest({
    // In Expo Go we must use the Web client ID (matches the registered redirect URI)
    ...(IS_EXPO_GO ? { clientId: GOOGLE_WEB_CLIENT_ID } : {}),
    androidClientId:
      "280450131002-iv8nv3hnottf109ft2ruogaq4daqjpbh.apps.googleusercontent.com",
    webClientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri: googleRedirectUri,
  });

  // ── Facebook OAuth ──
  const [fbRequest, fbResponse, fbPromptAsync] = Facebook.useAuthRequest(
    FB_ENABLED ? { clientId: FACEBOOK_APP_ID } : { clientId: "disabled" },
  );

  // Handle Google response
  React.useEffect(() => {
    if (response?.type === "success") {
      const { access_token } = response.params;
      handleGoogleLogin(access_token);
    }
  }, [response]);

  // Handle Facebook response
  React.useEffect(() => {
    if (fbResponse?.type === "success") {
      const { access_token } = fbResponse.params;
      handleFacebookLogin(access_token);
    }
  }, [fbResponse]);

  const handleGoogleLogin = async (accessToken) => {
    try {
      setLoading(true);
      setError("");
      // Fetch user info from Google
      const userResponse = await fetch(
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
      );
      const userData = await userResponse.json();
      // Send data + access token to backend for server-side verification
      const result = await signInWithGoogle({
        email: userData.email,
        name: userData.name,
        avatar: userData.picture,
        accessToken,
      });
      if (!result.success) {
        setError(result.error || "Google login failed");
      }
    } catch (err) {
      console.error("Google login error:", err);
      setError("Google login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async (accessToken) => {
    try {
      setLoading(true);
      setError("");
      // Fetch user info from Facebook Graph API
      const userResponse = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`,
      );
      const userData = await userResponse.json();

      if (!userData.email) {
        setError(
          "Facebook account does not have an email. Please use Google or email/password login.",
        );
        return;
      }

      const result = await signInWithFacebook({
        email: userData.email,
        name: userData.name,
        avatar: userData.picture?.data?.url,
        accessToken,
      });
      if (!result.success) {
        setError(result.error || "Facebook login failed");
      }
    } catch (err) {
      console.error("Facebook login error:", err);
      setError("Facebook login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookPress = () => {
    if (!FB_ENABLED) {
      Alert.alert(
        "Facebook Login",
        "Facebook login is not configured yet. Please use Google or email/password login.",
        [{ text: "OK" }],
      );
      return;
    }
    fbPromptAsync();
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    const result = await signIn(email, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
    } else {
      await registerPushToken();
    }
  };

  const registerPushToken = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;
      const token = await Notifications.getExpoPushTokenAsync();
      await apiService.post("/api/v2/notifications/register-token", {
        expoPushToken: token.data,
      });
    } catch (error) {
      console.error("Error registering push token:", error);
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
          <Text style={styles.subtitle}>
            {savedAccounts.length > 0 && !selectedAccount
              ? "Choose an account"
              : "Welcome back"}
          </Text>
        </View>

        {/* ─── Error ─── */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ─── Saved Accounts (shown when no account is selected) ─── */}
        {savedAccounts.length > 0 && !selectedAccount ? (
          <View style={styles.savedSection}>
            {savedAccounts.map((account) => (
              <TouchableOpacity
                key={account.email}
                style={styles.savedAccountCard}
                onPress={() => handleSelectAccount(account)}
                activeOpacity={0.7}
                disabled={loading}
              >
                <View style={styles.savedAvatarWrap}>
                  {account.avatar && typeof account.avatar === "string" ? (
                    <Image
                      source={{ uri: account.avatar }}
                      style={styles.savedAvatar}
                    />
                  ) : (
                    <View
                      style={[styles.savedAvatar, styles.savedAvatarFallback]}
                    >
                      <Text style={styles.savedAvatarLetter}>
                        {(account.name || account.email)[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {account.authProvider !== "email" && (
                    <View style={styles.providerBadge}>
                      {account.authProvider === "google" ? (
                        <Image
                          source={require("../../assets/google-icon.png")}
                          style={styles.providerBadgeIcon}
                        />
                      ) : (
                        <Ionicons
                          name="logo-facebook"
                          size={10}
                          color="#1877F2"
                        />
                      )}
                    </View>
                  )}
                </View>
                <View style={styles.savedInfo}>
                  <Text style={styles.savedName} numberOfLines={1}>
                    {account.name}
                  </Text>
                  <Text style={styles.savedEmail} numberOfLines={1}>
                    {account.email}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.savedRemoveBtn}
                  onPress={() => handleRemoveAccount(account.email)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

            {/* Use another account button */}
            <TouchableOpacity
              style={styles.useAnotherBtn}
              onPress={() => setSelectedAccount("manual")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="person-add-outline"
                size={18}
                color={colors.accent}
              />
              <Text style={styles.useAnotherText}>Use another account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ─── Back to saved accounts button ─── */}
            {savedAccounts.length > 0 && selectedAccount && (
              <TouchableOpacity
                style={styles.backToAccountsBtn}
                onPress={handleBackToAccounts}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={16} color={colors.accent} />
                <Text style={styles.backToAccountsText}>
                  Back to saved accounts
                </Text>
              </TouchableOpacity>
            )}

            {/* ─── Selected account header ─── */}
            {selectedAccount && selectedAccount !== "manual" && (
              <View style={styles.selectedHeader}>
                <View style={styles.selectedAvatarWrap}>
                  {selectedAccount.avatar &&
                  typeof selectedAccount.avatar === "string" ? (
                    <Image
                      source={{ uri: selectedAccount.avatar }}
                      style={styles.selectedAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.selectedAvatar,
                        styles.savedAvatarFallback,
                      ]}
                    >
                      <Text style={styles.selectedAvatarLetter}>
                        {(selectedAccount.name ||
                          selectedAccount.email)[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.selectedName}>{selectedAccount.name}</Text>
              </View>
            )}

            {/* ─── Form ─── */}
            <View style={styles.form}>
              {/* Hide email field if account is selected (not manual) */}
              {(!selectedAccount || selectedAccount === "manual") && (
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
              )}

              {/* For OAuth accounts, show a "continue with provider" button instead of password */}
              {selectedAccount &&
              selectedAccount !== "manual" &&
              selectedAccount.authProvider !== "email" ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                  onPress={() => {
                    if (selectedAccount.authProvider === "google") {
                      promptAsync();
                    } else if (selectedAccount.authProvider === "facebook") {
                      handleFacebookPress();
                    }
                  }}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textOnAccent} />
                  ) : (
                    <>
                      {selectedAccount.authProvider === "google" ? (
                        <Image
                          source={require("../../assets/google-icon.png")}
                          style={{ width: 18, height: 18 }}
                        />
                      ) : (
                        <Ionicons name="logo-facebook" size={18} color="#fff" />
                      )}
                      <Text style={styles.primaryBtnText}>
                        Continue with{" "}
                        {selectedAccount.authProvider === "google"
                          ? "Google"
                          : "Facebook"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.inputWrap}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={colors.accent}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        setError("");
                      }}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                      placeholderTextColor={colors.placeholder}
                      autoFocus={
                        selectedAccount && selectedAccount !== "manual"
                      }
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                      disabled={loading}
                    >
                      <Ionicons
                        name={showPassword ? "eye-outline" : "eye-off-outline"}
                        size={19}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={() => navigation.navigate("ForgotPassword")}
                    disabled={loading}
                    style={styles.forgotRow}
                  >
                    <Text style={styles.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.textOnAccent} />
                    ) : (
                      <>
                        <Ionicons
                          name="log-in-outline"
                          size={18}
                          color={colors.textOnAccent}
                        />
                        <Text style={styles.primaryBtnText}>Sign In</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* ─── Divider ─── */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ─── Social ─── */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={[styles.socialBtn, !request && { opacity: 0.5 }]}
                onPress={() => promptAsync()}
                disabled={!request || loading}
                activeOpacity={0.7}
              >
                <Image
                  source={require("../../assets/google-icon.png")}
                  style={styles.socialIcon}
                />
                <Text style={styles.socialBtnText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialBtn, !FB_ENABLED && { opacity: 0.5 }]}
                onPress={handleFacebookPress}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                <Text style={styles.socialBtnText}>Facebook</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ─── Footer ─── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("RegisterStep1")}
            disabled={loading}
          >
            <Text style={styles.footerLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.creditRow}>
          <Text style={styles.creditText}>Developed by: Rommel Belia</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/* ═══════════════════════ STYLES ═══════════════════════ */
const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 56,
      paddingBottom: 36,
    },

    /* Header */
    header: {
      alignItems: "center",
      marginBottom: 32,
    },
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
    icon: {
      width: 72,
      height: 72,
      resizeMode: "contain",
    },
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
      marginBottom: 20,
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
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.text,
    },
    eyeBtn: {
      padding: 6,
    },
    forgotRow: {
      alignItems: "flex-end",
      marginTop: 2,
      marginBottom: 18,
    },
    forgotText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "600",
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
    primaryBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },

    /* Divider */
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 22,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    dividerLabel: {
      fontSize: 12,
      color: colors.textTertiary,
      marginHorizontal: 14,
      fontWeight: "500",
    },

    /* Social */
    socialRow: {
      flexDirection: "column",
      gap: 12,
      marginBottom: 28,
    },
    socialIcon: {
      width: 20,
      height: 20,
      resizeMode: "contain",
    },
    socialBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 13,
      gap: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    socialBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },

    /* Footer */
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
    footerLink: {
      fontSize: 14,
      color: colors.accent,
      fontWeight: "700",
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

    /* ─── Saved Accounts ─── */
    savedSection: {
      marginBottom: 20,
      gap: 10,
    },
    savedAccountCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    savedAvatarWrap: {
      position: "relative",
    },
    savedAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    savedAvatarFallback: {
      backgroundColor: colors.accent + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    savedAvatarLetter: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.accent,
    },
    providerBadge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.background,
    },
    providerBadgeIcon: {
      width: 12,
      height: 12,
      resizeMode: "contain",
    },
    savedInfo: {
      flex: 1,
    },
    savedName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
    },
    savedEmail: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    savedRemoveBtn: {
      padding: 4,
    },
    useAnotherBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      borderStyle: "dashed",
    },
    useAnotherText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent,
    },
    backToAccountsBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 16,
      alignSelf: "flex-start",
    },
    backToAccountsText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
    },
    selectedHeader: {
      alignItems: "center",
      marginBottom: 20,
    },
    selectedAvatarWrap: {
      marginBottom: 8,
    },
    selectedAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    selectedAvatarLetter: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.accent,
    },
    selectedName: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
  });

export default LoginScreen;
