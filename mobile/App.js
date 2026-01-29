import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, AuthContext } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/auth/LoginScreen";
import RegisterScreen from "./src/screens/auth/RegisterScreen";
import ClientNavigator from "./src/navigation/ClientNavigator";
import AdminNavigator from "./src/navigation/AdminNavigator";
import SplashScreen from "./src/screens/SplashScreen";

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const authContext = React.useContext(AuthContext);

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

  if (authContext.isLoading) {
    return <SplashScreen />;
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
        isAdmin && currentView === "admin" ? (
          <Stack.Screen name="Admin" component={AdminNavigator} />
        ) : (
          <Stack.Screen name="Client" component={ClientNavigator} />
        )
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
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
