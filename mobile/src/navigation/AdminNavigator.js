import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { supportService } from "../services/apiService";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import AdminRoomManagementScreen from "../screens/admin/AdminRoomManagementScreen";
import AdminBillingScreen from "../screens/admin/AdminBillingScreen";
import AdminBillingCycleScreen from "../screens/admin/AdminBillingCycleScreen";
import AdminMembersScreen from "../screens/admin/AdminMembersScreen";
import AdminProfileScreen from "../screens/admin/AdminProfileScreen";
import AdminPaymentVerificationScreen from "../screens/admin/AdminPaymentVerificationScreen";
import AdminFinancialDashboardScreen from "../screens/admin/AdminFinancialDashboardScreen";
import AdminBillingDetailsScreen from "../screens/admin/AdminBillingDetailsScreen";
import AdminAdjustmentsScreen from "../screens/admin/AdminAdjustmentsScreen";
import AdminRemindersScreen from "../screens/admin/AdminRemindersScreen";
import AdminPresenceRemindersScreen from "../screens/admin/AdminPresenceRemindersScreen";
import AdminAnnouncementsScreen from "../screens/admin/AdminAnnouncementsScreen";
import AdminSupportTicketsScreen from "../screens/admin/AdminSupportTicketsScreen";
import AdminBugReportsScreen from "../screens/admin/AdminBugReportsScreen";
import AdminFAQScreen from "../screens/admin/AdminFAQScreen";

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
    <Stack.Screen
      name="PaymentVerification"
      component={AdminPaymentVerificationScreen}
      options={{ title: "Payment Verification" }}
    />
    <Stack.Screen
      name="FinancialDashboard"
      component={AdminFinancialDashboardScreen}
      options={{ title: "Financial Dashboard" }}
    />
    <Stack.Screen
      name="BillingDetails"
      component={AdminBillingDetailsScreen}
      options={{ title: "Billing Details" }}
    />
    <Stack.Screen
      name="Adjustments"
      component={AdminAdjustmentsScreen}
      options={{ title: "Charge Adjustments" }}
    />
    <Stack.Screen
      name="Reminders"
      component={AdminRemindersScreen}
      options={{ title: "Payment Reminders" }}
    />
    <Stack.Screen
      name="PresenceReminders"
      component={AdminPresenceRemindersScreen}
      options={{ title: "Presence Reminders" }}
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
    <Stack.Screen
      name="SupportTickets"
      component={AdminSupportTicketsScreen}
      options={{ title: "Support Tickets" }}
    />
    <Stack.Screen
      name="BugReports"
      component={AdminBugReportsScreen}
      options={{ title: "Bug Reports" }}
    />
    <Stack.Screen
      name="ManageFAQs"
      component={AdminFAQScreen}
      options={{ title: "Manage FAQs" }}
    />
  </Stack.Navigator>
);

const AnnouncementsStack = () => (
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
      name="AdminAnnouncements"
      component={AdminAnnouncementsScreen}
      options={{ title: "Announcements" }}
    />
  </Stack.Navigator>
);

const AdminNavigator = () => {
  const [unreadSupportCount, setUnreadSupportCount] = React.useState(0);

  const fetchUnreadSupportCount = async () => {
    try {
      const ticketsResponse = await supportService.getAllTickets();
      const tickets = Array.isArray(ticketsResponse) ? ticketsResponse : ticketsResponse?.data || [];
      const unreadTickets = tickets.filter(t => !t.isReadByAdmin && t.replies && t.replies.length > 0).length;

      const bugsResponse = await supportService.getAllBugReports();
      const bugs = Array.isArray(bugsResponse) ? bugsResponse : bugsResponse?.data || [];
      const unreadBugs = bugs.filter(b => !b.isReadByAdmin && b.responses && b.responses.length > 0).length;

      const totalUnread = unreadTickets + unreadBugs;
      setUnreadSupportCount(totalUnread > 0 ? 1 : 0);
      console.log("Admin support unread count updated:", totalUnread);
    } catch (error) {
      console.error("Error fetching admin support unread count:", error);
    }
  };

  React.useEffect(() => {
    fetchUnreadSupportCount();
  }, []);

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
          } else if (route.name === "AnnouncementsStack") {
            iconName = focused ? "megaphone" : "megaphone-outline";
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
        name="AnnouncementsStack"
        component={AnnouncementsStack}
        options={{ title: "Announcements" }}
      />
      <Tab.Screen
        name="ProfileStack"
        component={ProfileStack}
        options={{
          title: "Profile",
          tabBarBadge: unreadSupportCount > 0 ? "●" : null,
          tabBarBadgeStyle: {
            backgroundColor: "transparent",
            fontSize: 16,
            color: "#e74c3c",
          },
        }}
        listeners={({ navigation }) => ({
          focus: () => {
            fetchUnreadSupportCount();
          },
        })}
      />
    </Tab.Navigator>
  );
};

export default AdminNavigator;
