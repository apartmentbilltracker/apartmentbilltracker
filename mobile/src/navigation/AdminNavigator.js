import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import AdminRoomManagementScreen from "../screens/admin/AdminRoomManagementScreen";
import AdminBillingScreen from "../screens/admin/AdminBillingScreen";
import AdminBillingCycleScreen from "../screens/admin/AdminBillingCycleScreen";
import AdminMembersScreen from "../screens/admin/AdminMembersScreen";
import AdminProfileScreen from "../screens/admin/AdminProfileScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const DashboardStack = () => (
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
      name="AdminDashboard"
      component={AdminDashboardScreen}
      options={{ title: "Dashboard" }}
    />
  </Stack.Navigator>
);

const RoomManagementStack = () => (
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
      name="RoomManagement"
      component={AdminRoomManagementScreen}
      options={{ title: "Rooms" }}
    />
  </Stack.Navigator>
);

const BillingStack = () => (
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
      name="AdminBilling"
      component={AdminBillingScreen}
      options={{ title: "Billing" }}
    />
    <Stack.Screen
      name="BillingCycles"
      component={AdminBillingCycleScreen}
      options={({ route }) => ({
        title: `Billing Cycles - ${route.params?.roomName || "Room"}`,
      })}
    />
  </Stack.Navigator>
);

const MembersStack = () => (
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
      name="Members"
      component={AdminMembersScreen}
      options={{ title: "Members" }}
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
      name="AdminProfile"
      component={AdminProfileScreen}
      options={{ title: "Profile" }}
    />
  </Stack.Navigator>
);

const AdminNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === "DashboardStack") {
            iconName = focused ? "bar-chart" : "bar-chart-outline";
          } else if (route.name === "RoomStack") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "BillingStack") {
            iconName = focused ? "wallet" : "wallet-outline";
          } else if (route.name === "MembersStack") {
            iconName = focused ? "people" : "people-outline";
          } else if (route.name === "ProfileStack") {
            iconName = focused ? "person" : "person-outline";
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#bdb246",
        tabBarInactiveTintColor: "gray",
      })}
    >
      <Tab.Screen
        name="DashboardStack"
        component={DashboardStack}
        options={{ title: "Dashboard" }}
      />
      <Tab.Screen
        name="RoomStack"
        component={RoomManagementStack}
        options={{ title: "Rooms" }}
      />
      <Tab.Screen
        name="BillingStack"
        component={BillingStack}
        options={{ title: "Billing" }}
      />
      <Tab.Screen
        name="MembersStack"
        component={MembersStack}
        options={{ title: "Members" }}
      />
      <Tab.Screen
        name="ProfileStack"
        component={ProfileStack}
        options={{ title: "Profile" }}
      />
    </Tab.Navigator>
  );
};

export default AdminNavigator;
