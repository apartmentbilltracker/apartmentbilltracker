import React, { useContext } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthContext } from "../context/AuthContext";
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import ClientNavigator from "./ClientNavigator";
import AdminNavigator from "./AdminNavigator";
import SplashScreen from "../screens/SplashScreen";

const Stack = createNativeStackNavigator();

// Auth Stack for login/register
const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
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
  </Stack.Navigator>
);

const RootNavigator = () => {
  const authContext = useContext(AuthContext);

  // Handle undefined or null authContext
  if (!authContext) {
    console.log("RootNavigator: authContext is null/undefined");
    return <SplashScreen />;
  }

  console.log("RootNavigator: isLoading =", authContext.isLoading);
  console.log("RootNavigator: userToken =", authContext.state?.userToken);
  console.log("RootNavigator: user =", authContext.state?.user);

  if (authContext.isLoading) {
    console.log("RootNavigator: Still loading, showing splash");
    return <SplashScreen />;
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
