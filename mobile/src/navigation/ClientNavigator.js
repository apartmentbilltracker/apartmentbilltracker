import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import ClientHomeScreen from "../screens/client/ClientHomeScreen";
import PresenceScreen from "../screens/client/PresenceScreen";
import BillingScreen from "../screens/client/BillingScreen";
import BillsScreen from "../screens/client/BillsScreen";
import BillingHistoryScreen from "../screens/client/BillingHistoryScreen";
import RoomDetailsScreen from "../screens/client/RoomDetailsScreen";
import ProfileScreen from "../screens/client/ProfileScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ClientHomeStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: "#f8f9fa",
      },
      headerTitleStyle: {
        fontWeight: "600",
      },
    }}
  >
    <Stack.Screen
      name="ClientHome"
      component={ClientHomeScreen}
      options={{ title: "Home" }}
    />
    <Stack.Screen
      name="RoomDetails"
      component={RoomDetailsScreen}
      options={{ title: "Room Details" }}
    />
    <Stack.Screen
      name="Billing"
      component={BillingScreen}
      options={{ title: "Billing Details" }}
    />
    <Stack.Screen
      name="Presence"
      component={PresenceScreen}
      options={{ title: "Mark Presence" }}
    />
  </Stack.Navigator>
);

const PresenceStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: "#f8f9fa",
      },
      headerTitleStyle: {
        fontWeight: "600",
      },
    }}
  >
    <Stack.Screen
      name="PresenceMain"
      component={PresenceScreen}
      options={{ title: "Mark Presence" }}
    />
    <Stack.Screen
      name="Billing"
      component={BillingScreen}
      options={{ title: "Billing Details" }}
    />
  </Stack.Navigator>
);

const BillsStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: "#f8f9fa",
      },
      headerTitleStyle: {
        fontWeight: "600",
      },
    }}
  >
    <Stack.Screen
      name="BillsMain"
      component={BillsScreen}
      options={{ title: "Bills" }}
    />
    <Stack.Screen
      name="BillingHistory"
      component={BillingHistoryScreen}
      options={({ route }) => ({
        title: `History - ${route.params?.roomName || "Room"}`,
      })}
    />
    <Stack.Screen
      name="Billing"
      component={BillingScreen}
      options={{ title: "Billing Details" }}
    />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: "#f8f9fa",
      },
      headerTitleStyle: {
        fontWeight: "600",
      },
    }}
  >
    <Stack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ title: "Profile" }}
    />
  </Stack.Navigator>
);

const ClientNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === "HomeStack") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "PresenceStack") {
            iconName = focused ? "checkbox" : "checkbox-outline";
          } else if (route.name === "BillsStack") {
            iconName = focused ? "document-text" : "document-text-outline";
          } else if (route.name === "ProfileStack") {
            iconName = focused ? "person" : "person-outline";
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#b38604",
        tabBarInactiveTintColor: "gray",
      })}
    >
      <Tab.Screen
        name="HomeStack"
        component={ClientHomeStack}
        options={{ title: "Home" }}
      />
      <Tab.Screen
        name="PresenceStack"
        component={PresenceStack}
        options={{ title: "Presence" }}
      />
      <Tab.Screen
        name="BillsStack"
        component={BillsStack}
        options={{ title: "Bills" }}
      />
      <Tab.Screen
        name="ProfileStack"
        component={ProfileStack}
        options={{ title: "Profile" }}
      />
    </Tab.Navigator>
  );
};

export default ClientNavigator;
