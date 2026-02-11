import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text, StyleSheet, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, AuthContext } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/auth/LoginScreen";
import RegisterScreen from "./src/screens/auth/RegisterScreen";
import RegisterStep1Screen from "./src/screens/auth/RegisterStep1Screen";
import RegisterStep2Screen from "./src/screens/auth/RegisterStep2Screen";
import RegisterStep3Screen from "./src/screens/auth/RegisterStep3Screen";
import ForgotPasswordScreen from "./src/screens/auth/ForgotPasswordScreen";
import VerifyResetCodeScreen from "./src/screens/auth/VerifyResetCodeScreen";
import ResetPasswordScreen from "./src/screens/auth/ResetPasswordScreen";
import ClientNavigator from "./src/navigation/ClientNavigator";
import AdminNavigator from "./src/navigation/AdminNavigator";
import SplashScreen from "./src/screens/SplashScreen";
import PaymentHistoryScreen from "./src/screens/client/PaymentHistoryScreen";
import SettlementScreen from "./src/screens/client/SettlementScreen";
import PaymentMethodScreen from "./src/screens/client/PaymentMethodScreen";
import GCashPaymentScreen from "./src/screens/client/GCashPaymentScreen";
import BankTransferPaymentScreen from "./src/screens/client/BankTransferPaymentScreen";
import CashPaymentScreen from "./src/screens/client/CashPaymentScreen";
import notificationService from "./src/services/notificationService";
import updateService from "./src/services/updateService";
import OnboardingScreen, {
  checkOnboardingComplete,
} from "./src/screens/OnboardingScreen";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const authContext = React.useContext(AuthContext);
  const [onboardingDone, setOnboardingDone] = React.useState(null);

  // Check onboarding status on mount
  React.useEffect(() => {
    checkOnboardingComplete().then((done) => setOnboardingDone(done));
  }, []);

  console.log("RootNavigator rendering...");
  console.log("authContext:", !!authContext);
  console.log("isLoading:", authContext?.isLoading);
  console.log("isSignedIn:", authContext?.state?.userToken);

  if (!authContext) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>ERROR</Text>
        <Text style={styles.subtitle}>No AuthContext!</Text>
      </View>
    );
  }

  // Show splash while auth is loading OR onboarding status is being checked
  if (authContext.isLoading || onboardingDone === null) {
    return <SplashScreen />;
  }

  // Show onboarding on first-ever launch
  if (!onboardingDone) {
    return <OnboardingScreen onComplete={() => setOnboardingDone(true)} />;
  }

  const isSignedIn = authContext.state?.userToken != null;
  const userRole = authContext.state?.user?.role;
  // Handle role as either array or string
  const isAdmin = Array.isArray(userRole)
    ? userRole.includes("admin")
    : typeof userRole === "string" && userRole.toLowerCase().includes("admin");
  const currentView = authContext.state?.currentView || "admin";
  console.log(
    "Final isSignedIn:",
    isSignedIn,
    "isAdmin:",
    isAdmin,
    "currentView:",
    currentView,
  );

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isSignedIn ? (
        <>
          {isAdmin && currentView === "admin" ? (
            <Stack.Screen name="Admin" component={AdminNavigator} />
          ) : (
            <Stack.Screen name="Client" component={ClientNavigator} />
          )}
          {/* Modal Stack for Payment and Settlement Screens */}
          <Stack.Group screenOptions={{ presentation: "modal" }}>
            <Stack.Screen
              name="PaymentHistory"
              component={PaymentHistoryScreen}
            />
            <Stack.Screen name="Settlement" component={SettlementScreen} />
            <Stack.Screen
              name="PaymentMethod"
              component={PaymentMethodScreen}
            />
            <Stack.Screen name="GCashPayment" component={GCashPaymentScreen} />
            <Stack.Screen
              name="BankTransferPayment"
              component={BankTransferPaymentScreen}
            />
            <Stack.Screen name="CashPayment" component={CashPaymentScreen} />
          </Stack.Group>
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="RegisterStep1" component={RegisterStep1Screen} />
          <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} />
          <Stack.Screen name="RegisterStep3" component={RegisterStep3Screen} />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
          />
          <Stack.Screen
            name="VerifyResetCode"
            component={VerifyResetCodeScreen}
          />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [updateStatus, setUpdateStatus] = React.useState(null);

  React.useEffect(() => {
    checkAppVersion();
  }, []);

  const checkAppVersion = async () => {
    // Get backend URL from environment or use default
    const backendURL =
      process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

    const status = await updateService.checkForUpdate(backendURL);
    setUpdateStatus(status);

    // Show alert if update is required
    if (status.requiresUpdate) {
      updateService.showUpdateAlert(status.isForced, status.updateUrl);
    }
  };

  // If forced update is required, show blocking screen
  if (updateStatus?.isForced) {
    return (
      <SafeAreaProvider>
        <View style={styles.container}>
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.subtitle}>
            A new version is available. Please update the app to continue.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ThemedNavigation />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Reads theme inside ThemeProvider and passes navTheme to NavigationContainer */
function ThemedNavigation() {
  const { isDark, colors } = useTheme();

  const navTheme = React.useMemo(
    () => ({
      dark: isDark,
      colors: {
        primary: colors.accent,
        background: colors.background,
        card: colors.headerBg,
        text: colors.text,
        border: colors.border,
        notification: colors.error,
      },
    }),
    [isDark, colors],
  );

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.headerBg}
      />
      <RootNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#d32f2f",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
