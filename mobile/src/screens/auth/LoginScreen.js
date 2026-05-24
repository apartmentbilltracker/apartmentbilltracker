import React, {
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as Notifications from "expo-notifications";
import { AuthContext } from "../../context/AuthContext";
import { apiService, authService } from "../../services/apiService";
import { getAPIBaseURL } from "../../config/config";
import { useTheme } from "../../theme/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import savedAccountsService from "../../services/savedAccountsService";
import { biometricAuth } from "../../utils/biometricAuth";
import AuthBubbles from "../../components/AuthBubbles";

// Detect if running in Expo Go vs custom dev build
const IS_EXPO_GO = Constants.appOwnership === "expo";

const FACEBOOK_APP_ID = "1296319515642952";
const FB_ENABLED = FACEBOOK_APP_ID !== "YOUR_FACEBOOK_APP_ID";

WebBrowser.maybeCompleteAuthSession();

const LoginScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [failedAvatars, setFailedAvatars] = useState(new Set());
  const [rememberMe, setRememberMe] = useState(true); // default ON
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricStoredEmail, setBiometricStoredEmail] = useState(null);
  const [accountsWithBiometric, setAccountsWithBiometric] = useState(new Set()); // Track which accounts have biometric
  const {
    signIn,
    signInWithGoogle,
    signInWithToken,
    signInWithBiometric,
    disableBiometric,
    state: authState,
    clearSessionExpired,
  } = useContext(AuthContext);
  const sessionExpired = authState?.sessionExpiredReason === "inactivity";

  // Load saved accounts on mount and fetch fresh avatars
  useEffect(() => {
    const loadAccounts = async () => {
      // Clean up all legacy biometric keys on app start (one-time cleanup)
      await biometricAuth.cleanupAllLegacyKeys();

      // Restore the user's last "keep me logged in" preference
      try {
        const saved = await AsyncStorage.getItem("@remember_me");
        if (saved !== null) setRememberMe(saved === "1");
      } catch {
        /* silent */
      }

      const accounts = await savedAccountsService.getAccounts();
      setSavedAccounts(accounts);

      // Check biometric availability
      const available = await biometricAuth.isAvailable();
      setBiometricAvailable(available);

      // Check which accounts have biometric enabled
      const bioAccounts = new Set();
      if (accounts.length > 0) {
        for (const account of accounts) {
          const hasBio = await biometricAuth.isBiometricEnabledFor(
            account.email,
          );
          if (hasBio) {
            bioAccounts.add(account.email.toLowerCase());
          }
        }
      }
      setAccountsWithBiometric(bioAccounts);
      setBiometricEnabled(bioAccounts.size > 0);

      // Get the first account with biometric (for legacy compatibility)
      const firstBioEmail =
        bioAccounts.size > 0 ? Array.from(bioAccounts)[0] : null;
      setBiometricStoredEmail(firstBioEmail);

      // Fetch fresh avatars from the API for all saved accounts
      if (accounts.length > 0) {
        try {
          const emails = accounts.map((a) => a.email);
          const res = await authService.getAvatars(emails);
          const avatarMap = res?.avatars || {};
          const baseUrl = getAPIBaseURL();
          const updated = accounts.map((a) => {
            let avatar = avatarMap[a.email.toLowerCase()] || a.avatar || null;
            // Convert relative server paths to full URLs
            if (avatar && avatar.startsWith("/api/")) {
              avatar = `${baseUrl}${avatar}`;
            }
            return { ...a, avatar };
          });
          setSavedAccounts(updated);
        } catch {
          // Silent fail — keep locally stored avatars
        }
      }
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
  // Uses native Android account picker (no browser/redirect URI needed).
  // auth.expo.io proxy is deprecated in SDK 53 and cannot redirect back to Expo Go.
  // Google OAuth only works in APK/dev-client builds — show a message in Expo Go.
  const GOOGLE_WEB_CLIENT_ID =
    "280450131002-ecknav2so7qhc0kd83t9644ap6hvaurh.apps.googleusercontent.com";
  const GOOGLE_ANDROID_CLIENT_ID =
    "280450131002-iv8nv3hnottf109ft2ruogaq4daqjpbh.apps.googleusercontent.com";

  // Explicit redirect URI using the reverse Android client ID scheme.
  // Must match the intent filter scheme in app.json AND the authorized URI in Google Cloud Console.
  const googleRedirectUri = makeRedirectUri({
    native: `com.googleusercontent.apps.280450131002-iv8nv3hnottf109ft2ruogaq4daqjpbh:/oauth2redirect/google`,
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri: googleRedirectUri,
  });

  const handleGooglePress = () => {
    if (IS_EXPO_GO) {
      Alert.alert(
        "Google Sign-In",
        "Google login is not available in Expo Go. Please use the installed app to sign in with Google.",
        [{ text: "OK" }],
      );
      return;
    }
    promptAsync();
  };

  // ── Facebook OAuth (server-side flow) ──
  // Facebook rejects custom URI schemes in its console, so we use a server-side
  // callback: the backend receives the code at an HTTPS URL, creates/finds the user,
  // then deep-links back with the JWT token via aptbilltracker://oauth?token=...
  const handleFacebookServerLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const baseUrl = getAPIBaseURL();
      const authUrl = `${baseUrl}/api/v2/user/auth/facebook`;
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        "aptbilltracker://",
      );

      if (result.type === "success" && result.url) {
        // Parse params from aptbilltracker://oauth?success=true&token=...&user=...
        const urlObj = new URL(result.url);
        const success = urlObj.searchParams.get("success") === "true";
        const fbError = urlObj.searchParams.get("error");
        const token = urlObj.searchParams.get("token");
        const userJson = urlObj.searchParams.get("user");

        if (!success || fbError) {
          setError(decodeURIComponent(fbError || "Facebook login failed"));
          return;
        }

        if (token && userJson) {
          const user = JSON.parse(decodeURIComponent(userJson));
          const loginResult = await signInWithToken(token, user, rememberMe);
          if (!loginResult.success) {
            setError(loginResult.error || "Facebook login failed");
          } else {
            await registerPushToken();
          }
        } else {
          setError("Facebook login failed: missing token");
        }
      } else if (result.type === "cancel" || result.type === "dismiss") {
        // User closed the browser — silent dismiss
      } else {
        setError("Facebook login was cancelled");
      }
    } catch (err) {
      console.error("Facebook server login error:", err);
      setError("Facebook login failed");
    } finally {
      setLoading(false);
    }
  };

  // Handle Google response
  // Native Android flow: response.authentication.accessToken
  // Web/implicit flow fallback: response.params.access_token
  React.useEffect(() => {
    if (response?.type === "success") {
      const accessToken =
        response.authentication?.accessToken || response.params?.access_token;
      if (accessToken) handleGoogleLogin(accessToken);
    }
  }, [response]);

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
      } else {
        await registerPushToken();
      }
    } catch (err) {
      console.error("Google login error:", err);
      setError("Google login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookPress = () => {
    if (IS_EXPO_GO) {
      Alert.alert(
        "Facebook Sign-In",
        "Facebook login is not available in Expo Go. Please use the installed app to sign in with Facebook.",
        [{ text: "OK" }],
      );
      return;
    }
    if (!FB_ENABLED) {
      Alert.alert(
        "Facebook Login",
        "Facebook login is not configured yet. Please use Google or email/password login.",
        [{ text: "OK" }],
      );
      return;
    }
    handleFacebookServerLogin();
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    const result = await signIn(email, password, rememberMe);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
    } else {
      // Login successful - biometric modal will be shown at root level if applicable
      await registerPushToken();
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    setError("");
    // If an account is selected, use its email; otherwise use the stored email
    const emailForBiometric = selectedAccount?.email || null;
    const result = await signInWithBiometric(rememberMe, emailForBiometric);
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

      // Android 8+ requires a notification channel for push to show
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#b38604",
          sound: "default",
        });
      }

      // projectId is required in Expo SDK 50+ for valid push tokens
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: "72a4be98-f7c2-4e5c-8d5a-5b7a8fd1a75c",
      });
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

      {/* ─── Session Expired Banner ─── */}
      {sessionExpired && (
        <View style={[styles.sessionBanner, { marginTop: insets.top + 8 }]}>
          <Ionicons name="time-outline" size={18} color="#92400e" />
          <Text style={styles.sessionBannerText}>
            Your session expired due to inactivity. Please log in again.
          </Text>
          <TouchableOpacity
            onPress={clearSessionExpired}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color="#92400e" />
          </TouchableOpacity>
        </View>
      )}

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
              name="shield-checkmark-outline"
              size={14}
              color={colors.accent}
            />
            <Text style={styles.brandPillText}>Secure apartment access</Text>
          </View>
          <Text style={styles.appName}>PropFlow</Text>
          <Text style={styles.subtitle}>
            {savedAccounts.length > 0 && !selectedAccount
              ? "Choose an account"
              : "Welcome back"}
          </Text>
          <Text style={styles.headerCaption}>
            {savedAccounts.length > 0 && !selectedAccount
              ? "Pick a saved profile or continue with another account."
              : "Sign in to manage bills, rooms, payments, and updates."}
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
            <View style={styles.sectionLead}>
              <Text style={styles.sectionEyebrow}>Saved Profiles</Text>
              <Text style={styles.sectionTitle}>
                Continue where you left off
              </Text>
            </View>
            {savedAccounts.map((account) => (
              <TouchableOpacity
                key={account.email}
                style={styles.savedAccountCard}
                onPress={() => handleSelectAccount(account)}
                activeOpacity={0.7}
                disabled={loading}
              >
                <View style={styles.savedAvatarWrap}>
                  {account.avatar &&
                  typeof account.avatar === "string" &&
                  !failedAvatars.has(account.email) ? (
                    <Image
                      source={{ uri: account.avatar }}
                      style={styles.savedAvatar}
                      onError={() =>
                        setFailedAvatars((prev) =>
                          new Set(prev).add(account.email),
                        )
                      }
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
                {accountsWithBiometric.has(account.email.toLowerCase()) && (
                  <View style={styles.biometricBadge}>
                    <Ionicons
                      name="finger-print"
                      size={14}
                      color={colors.accent}
                    />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.savedRemoveBtn}
                  onPress={() => handleRemoveAccount(account.email)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={colors.textSecondary}
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

            {/* ─── Selected account header (merged with biometric) ─── */}
            {selectedAccount && selectedAccount !== "manual" && (
              <View style={styles.accountCardContainer}>
                <View style={styles.accountCardContent}>
                  <View style={styles.selectedAvatarWrap}>
                    {selectedAccount.avatar &&
                    typeof selectedAccount.avatar === "string" &&
                    !failedAvatars.has(selectedAccount.email) ? (
                      <Image
                        source={{ uri: selectedAccount.avatar }}
                        style={styles.selectedAvatar}
                        onError={() =>
                          setFailedAvatars((prev) =>
                            new Set(prev).add(selectedAccount.email),
                          )
                        }
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
                  <View style={styles.accountInfo}>
                    <Text style={styles.selectedName} numberOfLines={1}>
                      {selectedAccount.name}
                    </Text>
                  </View>
                </View>
                {/* Biometric button on right */}
                {biometricAvailable &&
                  accountsWithBiometric.has(
                    selectedAccount?.email?.toLowerCase(),
                  ) && (
                    <TouchableOpacity
                      style={[
                        styles.biometricSmallBtn,
                        loading && { opacity: 0.5 },
                      ]}
                      onPress={handleBiometricLogin}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      {loading ? (
                        <ActivityIndicator color={colors.accent} size="small" />
                      ) : (
                        <Ionicons
                          name="finger-print"
                          size={24}
                          color={colors.accent}
                        />
                      )}
                    </TouchableOpacity>
                  )}
              </View>
            )}

            {/* ─── Form ─── */}
            <View style={styles.form}>
              {/* Biometric button ONLY for manual email entry (not selected account) */}
              {!selectedAccount &&
                biometricAvailable &&
                accountsWithBiometric.size > 0 && (
                  <View style={styles.biometricIconRow}>
                    <TouchableOpacity
                      style={[
                        styles.biometricIconBtn,
                        loading && { opacity: 0.5 },
                      ]}
                      onPress={handleBiometricLogin}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      {loading ? (
                        <ActivityIndicator color={colors.accent} size="small" />
                      ) : (
                        <Ionicons
                          name="finger-print"
                          size={32}
                          color={colors.accent}
                        />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.biometricIconLabel}>Quick Login</Text>
                  </View>
                )}

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
                      handleGooglePress();
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

                  {/* ─── Keep me logged in toggle ─── */}
                  <TouchableOpacity
                    style={styles.rememberRow}
                    onPress={() => setRememberMe((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.rememberCheckbox,
                        rememberMe && {
                          backgroundColor: colors.accent,
                          borderColor: colors.accent,
                        },
                      ]}
                    >
                      {rememberMe && (
                        <Ionicons name="checkmark" size={13} color="#fff" />
                      )}
                    </View>
                    <Text style={styles.rememberText}>Keep me logged in</Text>
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
            <View style={styles.sectionLead}>
              <Text style={styles.sectionEyebrow}>Other Options</Text>
              <Text style={styles.sectionTitle}>Use a connected provider</Text>
            </View>
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={[styles.socialBtn, loading && { opacity: 0.5 }]}
                onPress={handleGooglePress}
                disabled={loading}
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
    icon: {
      width: 72,
      height: 72,
      resizeMode: "contain",
    },
    appName: {
      fontSize: 26,
      fontWeight: "900",
      color: colors.text,
      letterSpacing: 0.2,
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
      maxWidth: 280,
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
    primaryBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },

    /* Divider */
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 20,
      gap: 12,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "500",
    },

    /* Biometric Primary Button (at top of form) - REMOVED */

    /* Biometric Icon Button */
    biometricIconRow: {
      flexDirection: "column",
      alignItems: "center",
      marginBottom: 20,
      gap: 8,
    },
    biometricIconBtn: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.accentLight,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#b38604",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    biometricIconLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.accent,
      textAlign: "center",
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
      backgroundColor: glassPanel,
      borderWidth: 1,
      borderColor: glassBorderSoft,
      borderRadius: 16,
      paddingVertical: 14,
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
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
    sectionLead: {
      marginBottom: 6,
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
      fontSize: 17,
      fontWeight: "800",
      color: colors.text,
    },
    savedAccountCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: glassPanelStrong,
      borderWidth: 1,
      borderColor: glassBorder,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 22,
      elevation: 5,
    },
    savedAvatarWrap: {
      position: "relative",
      backgroundColor: "transparent",
    },
    savedAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    savedAvatarFallback: {
      backgroundColor: glassAccentSurface,
      borderWidth: 1,
      borderColor: glassBorderSoft,
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
      backgroundColor: glassPanelStrong,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: glassBorder,
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
      color:
        colors.statusBarStyle === "light-content" ? colors.text : "#0b1c30",
      marginBottom: 2,
    },
    savedEmail: {
      fontSize: 13,
      color:
        colors.statusBarStyle === "light-content"
          ? colors.textSecondary
          : "#404848",
    },
    biometricBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: glassAccentSurface,
      borderWidth: 1,
      borderColor: glassBorderSoft,
      justifyContent: "center",
      alignItems: "center",
    },
    savedRemoveBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: glassAccentSurface,
      borderWidth: 1,
      borderColor: glassBorderSoft,
    },
    useAnotherBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 15,
      borderWidth: 1,
      borderColor: glassBorderSoft,
      borderRadius: 18,
      borderStyle: "dashed",
      backgroundColor: glassPanel,
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
    /* Account Card Container (integrated with biometric) */
    accountCardContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: glassPanelStrong,
      borderWidth: 1,
      borderColor: glassBorder,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 22,
      elevation: 5,
    },
    accountCardContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    accountInfo: {
      flex: 1,
      justifyContent: "center",
    },
    selectedEmail: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    biometricSmallBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: glassAccentSurface,
      borderWidth: 1,
      borderColor: glassBorderSoft,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 2,
      marginLeft: 8,
    },

    /* Selected Header - KEPT for backward compat but not used */
    selectedAvatarWrap: {
      marginBottom: 0,
    },
    selectedAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    selectedAvatarLetter: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.accent,
    },
    selectedName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    sessionBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#fef3c7",
      borderWidth: 1,
      borderColor: "#f59e0b",
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginHorizontal: 20,
      marginTop: 8,
      gap: 8,
      zIndex: 10,
    },
    sessionBannerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "500",
      color: "#92400e",
      lineHeight: 18,
    },
    rememberRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    rememberCheckbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    rememberText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });
};

export default LoginScreen;
