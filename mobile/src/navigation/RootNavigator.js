import React, { useContext, useState, useEffect, useRef } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";
import { AuthContext } from "../context/AuthContext";
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import RegisterStep1Screen from "../screens/auth/RegisterStep1Screen";
import RegisterStep2Screen from "../screens/auth/RegisterStep2Screen";
import RegisterStep3Screen from "../screens/auth/RegisterStep3Screen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import VerifyResetCodeScreen from "../screens/auth/VerifyResetCodeScreen";
import ResetPasswordScreen from "../screens/auth/ResetPasswordScreen";
import TermsOfServiceScreen from "../screens/legal/TermsOfServiceScreen";
import PrivacyPolicyScreen from "../screens/legal/PrivacyPolicyScreen";
import ClientNavigator from "./ClientNavigator";
import AdminNavigator from "./AdminNavigator";
import HostNavigator from "./HostNavigator";
import SplashScreen from "../screens/SplashScreen";
import OnboardingScreen, {
  checkOnboardingComplete,
} from "../screens/OnboardingScreen";

const Stack = createNativeStackNavigator();

// Auth Stack for login/register
const AuthStack = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          paddingTop: insets.top,
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          animationEnabled: false,
        }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          animationEnabled: false,
        }}
      />
      <Stack.Screen name="RegisterStep1" component={RegisterStep1Screen} />
      <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} />
      <Stack.Screen name="RegisterStep3" component={RegisterStep3Screen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyResetCode" component={VerifyResetCodeScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
};

const ViewTransition = ({ colors }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator size="large" color={colors.accent} />
      <Animated.Text
        style={{
          marginTop: 14,
          fontSize: 14,
          fontWeight: "600",
          color: colors.textTertiary,
          opacity: fadeAnim,
        }}
      >
        Switching view...
      </Animated.Text>
    </View>
  );
};

const MINIMUM_SPLASH_MS = 4500; // Show splash long enough for full animation sequence

const RootNavigator = () => {
  const authContext = useContext(AuthContext);
  const { colors } = useTheme();
  const [onboardingDone, setOnboardingDone] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [splashReady, setSplashReady] = useState(false);
  const prevViewRef = useRef(null);

  const currentView = authContext?.state?.currentView;

  useEffect(() => {
    checkOnboardingComplete().then((done) => setOnboardingDone(done));
  }, []);

  // Guarantee minimum splash display time
  useEffect(() => {
    const timer = setTimeout(() => setSplashReady(true), MINIMUM_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  // Show brief transition animation when switching views
  useEffect(() => {
    if (prevViewRef.current !== null && prevViewRef.current !== currentView) {
      setTransitioning(true);
      const timer = setTimeout(() => setTransitioning(false), 350);
      prevViewRef.current = currentView;
      return () => clearTimeout(timer);
    }
    prevViewRef.current = currentView;
  }, [currentView]);

  // Handle undefined or null authContext
  if (!authContext) {
    console.log("RootNavigator: authContext is null/undefined");
    return <SplashScreen />;
  }

  if (!splashReady || authContext.isLoading || onboardingDone === null) {
    return <SplashScreen />;
  }

  // Show onboarding on first-ever launch
  if (!onboardingDone) {
    return <OnboardingScreen onComplete={() => setOnboardingDone(true)} />;
  }

  if (transitioning) {
    return <ViewTransition colors={colors} />;
  }

  const isSignedIn = authContext.state?.userToken != null;
  const userRole = authContext.state?.user?.role;

  // Handle role as either array or string
  const isAdmin = Array.isArray(userRole)
    ? userRole.includes("admin")
    : typeof userRole === "string" && userRole.toLowerCase().includes("admin");

  const isHost = Array.isArray(userRole)
    ? userRole.includes("host")
    : typeof userRole === "string" && userRole.toLowerCase() === "host";

  console.log(
    "RootNavigator: role =",
    userRole,
    "view =",
    currentView,
    "admin =",
    isAdmin,
    "host =",
    isHost,
  );

  if (isSignedIn) {
    // Admin can switch to client view
    if (isAdmin && currentView === "client") {
      console.log("RootNavigator: Admin viewing as Client");
      return <ClientNavigator key="client-as-admin" />;
    }
    if (isAdmin) {
      console.log("RootNavigator: Showing AdminNavigator");
      return <AdminNavigator key="admin" />;
    }
    // Host can switch to client view
    if (isHost && currentView === "client") {
      console.log("RootNavigator: Host viewing as Client");
      return <ClientNavigator key="client-as-host" />;
    }
    if (isHost) {
      console.log("RootNavigator: Showing HostNavigator");
      return <HostNavigator key="host" />;
    }
    console.log("RootNavigator: Showing ClientNavigator");
    return <ClientNavigator key="client" />;
  }

  // Not signed in - show auth screens
  console.log("RootNavigator: User not signed in, showing AuthStack");
  return <AuthStack />;
};

export default RootNavigator;
