import React, { useContext, useState, useEffect, useRef } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
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

// IMPORTANT: Do not reuse the same Stack navigator for nested stacks.
// Each nested navigator must have its own stack instance.
const AuthStackNav = createNativeStackNavigator();
const UnauthedNav = createNativeStackNavigator();

import LandingScreen from "../screens/LandingScreen";

const { height: WINDOW_HEIGHT } = Dimensions.get("window");

// Auth Stack for login/register
const AuthStack = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <AuthStackNav.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          paddingTop: insets.top,
          backgroundColor: colors.background,
        },
      }}
    >
      <AuthStackNav.Screen
        name="Login"
        component={LoginScreen}
        options={{
          animationEnabled: false,
        }}
      />
      <AuthStackNav.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          animationEnabled: false,
        }}
      />
      <AuthStackNav.Screen name="RegisterStep1" component={RegisterStep1Screen} />
      <AuthStackNav.Screen name="RegisterStep2" component={RegisterStep2Screen} />
      <AuthStackNav.Screen name="RegisterStep3" component={RegisterStep3Screen} />
      <AuthStackNav.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStackNav.Screen name="VerifyResetCode" component={VerifyResetCodeScreen} />
      <AuthStackNav.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <AuthStackNav.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <AuthStackNav.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </AuthStackNav.Navigator>
  );
};

const AuthModalScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(WINDOW_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 65,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: WINDOW_HEIGHT,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => navigation.goBack());
  };

  return (
    <View style={unauthStyles.modalRoot}>
      <Animated.View
        style={[
          unauthStyles.backdrop,
          { opacity: backdropOpacity },
        ]}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
      </Animated.View>
      <Animated.View
        style={[
          unauthStyles.sheet,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom,
            height: Math.round(WINDOW_HEIGHT * 0.92),
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={unauthStyles.dragHandle} />
        <TouchableOpacity
          onPress={close}
          activeOpacity={0.75}
          style={unauthStyles.closeBtn}
        >
          <Text
            style={[
              unauthStyles.closeText,
              { color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)" },
            ]}
          >
            Close
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AuthStack />
        </View>
      </Animated.View>
    </View>
  );
};

const UnauthedStack = () => {
  return (
    <UnauthedNav.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <UnauthedNav.Screen name="Landing">
        {(props) => (
          <LandingScreen
            {...props}
            onGetStarted={() => props.navigation.navigate("AuthModal")}
          />
        )}
      </UnauthedNav.Screen>
      <UnauthedNav.Screen
        name="AuthModal"
        component={AuthModalScreen}
        options={{
          presentation: "transparentModal",
          animation: "none",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <UnauthedNav.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={{ headerShown: true, title: "Terms of Service" }}
      />
      <UnauthedNav.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ headerShown: true, title: "Privacy Policy" }}
      />
    </UnauthedNav.Navigator>
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
  console.log("RootNavigator: User not signed in, showing Landing/Auth modal");
  return <UnauthedStack />;
};

export default RootNavigator;

const unauthStyles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: "transparent",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // Allow overlays (Toast) to slide in without clipping.
    overflow: "visible",
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(127,127,127,0.25)",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    top: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    zIndex: 2,
  },
  closeText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
