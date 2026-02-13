import React, { useContext, useState, useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
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

const RootNavigator = () => {
  const authContext = useContext(AuthContext);
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    checkOnboardingComplete().then((done) => setOnboardingDone(done));
  }, []);

  // Handle undefined or null authContext
  if (!authContext) {
    console.log("RootNavigator: authContext is null/undefined");
    return <SplashScreen />;
  }

  console.log("RootNavigator: isLoading =", authContext.isLoading);
  console.log("RootNavigator: userToken =", authContext.state?.userToken);
  console.log("RootNavigator: user =", authContext.state?.user);

  if (authContext.isLoading || onboardingDone === null) {
    console.log("RootNavigator: Still loading, showing splash");
    return <SplashScreen />;
  }

  // Show onboarding on first-ever launch
  if (!onboardingDone) {
    return <OnboardingScreen onComplete={() => setOnboardingDone(true)} />;
  }

  const isSignedIn = authContext.state?.userToken != null;
  const userRole = authContext.state?.user?.role;
  console.log("RootNavigator: userRole =", userRole);
  console.log("RootNavigator: userRole type =", typeof userRole);
  console.log("RootNavigator: isArray(userRole) =", Array.isArray(userRole));
  // Handle role as either array or string
  const isAdmin = Array.isArray(userRole)
    ? userRole.includes("admin")
    : typeof userRole === "string" && userRole.toLowerCase().includes("admin");

  console.log("RootNavigator: isSignedIn =", isSignedIn, "isAdmin =", isAdmin);

  if (isSignedIn) {
    console.log(
      "RootNavigator: User is signed in, showing",
      isAdmin ? "AdminNavigator" : "ClientNavigator",
    );
    return isAdmin ? <AdminNavigator /> : <ClientNavigator />;
  }

  // Not signed in - show auth screens
  console.log("RootNavigator: User not signed in, showing AuthStack");
  return <AuthStack />;
};

export default RootNavigator;
