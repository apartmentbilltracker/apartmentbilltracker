import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  supportService,
  roomService,
  memberService,
} from "../services/apiService";
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
import AdminPaymentSettingsScreen from "../screens/admin/AdminPaymentSettingsScreen";
import AdminVersionControlScreen from "../screens/admin/AdminVersionControlScreen";
import AdminBroadcastScreen from "../screens/admin/AdminBroadcastScreen";
import AdminAnnouncementsScreen from "../screens/admin/AdminAnnouncementsScreen";
import AdminSupportTicketsScreen from "../screens/admin/AdminSupportTicketsScreen";
import AdminBugReportsScreen from "../screens/admin/AdminBugReportsScreen";
import AdminFAQScreen from "../screens/admin/AdminFAQScreen";
import TermsOfServiceScreen from "../screens/legal/TermsOfServiceScreen";
import PrivacyPolicyScreen from "../screens/legal/PrivacyPolicyScreen";
import { useTheme } from "../theme/ThemeContext";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/** Hook – returns themed stack header options */
const useHeaderOptions = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    contentStyle: {
      paddingTop: insets.top,
      backgroundColor: colors.background,
    },
    headerStyle: {
      backgroundColor: colors.headerBg,
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitleStyle: {
      fontWeight: "700",
      fontSize: 17,
      color: colors.headerText,
    },
    headerTintColor: colors.accent,
    headerBackTitleVisible: false,
  };
};

const DashboardStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: "Dashboard" }}
      />
    </Stack.Navigator>
  );
};

const RoomManagementStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="RoomManagement"
        component={AdminRoomManagementScreen}
        options={{ title: "Rooms" }}
      />
    </Stack.Navigator>
  );
};

const BillingStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
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
      <Stack.Screen
        name="PaymentSettings"
        component={AdminPaymentSettingsScreen}
        options={{ title: "Payment Settings" }}
      />
    </Stack.Navigator>
  );
};

const MembersStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="Members"
        component={AdminMembersScreen}
        options={{ title: "Members" }}
      />
    </Stack.Navigator>
  );
};

const ProfileStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
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
      <Stack.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VersionControl"
        component={AdminVersionControlScreen}
        options={{ title: "Version Control" }}
      />
      <Stack.Screen
        name="Broadcast"
        component={AdminBroadcastScreen}
        options={{ title: "Send Notification" }}
      />
    </Stack.Navigator>
  );
};

const AnnouncementsStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="AdminAnnouncements"
        component={AdminAnnouncementsScreen}
        options={{ title: "Announcements" }}
      />
    </Stack.Navigator>
  );
};

const AdminNavigator = () => {
  const [unreadSupportCount, setUnreadSupportCount] = React.useState(0);
  const [pendingMemberCount, setPendingMemberCount] = React.useState(0);
  const { colors } = useTheme();

  const fetchPendingMemberCount = async () => {
    try {
      const response = await roomService.getRooms();
      const rooms = response.rooms || response.data?.rooms || [];
      let totalPending = 0;
      for (const room of rooms) {
        try {
          const pendingRes = await memberService.getPendingMembers(
            room.id || room._id,
          );
          const pending = pendingRes?.pendingMembers || [];
          totalPending += pending.length;
        } catch {
          // skip room on error
        }
      }
      setPendingMemberCount(totalPending);
    } catch (error) {
      console.error("Error fetching pending member count:", error);
    }
  };

  const fetchUnreadSupportCount = async () => {
    try {
      const ticketsResponse = await supportService.getAllTickets();
      const tickets = Array.isArray(ticketsResponse)
        ? ticketsResponse
        : ticketsResponse?.data || [];
      const unreadTickets = tickets.filter(
        (t) => !t.isReadByAdmin && t.replies && t.replies.length > 0,
      ).length;

      const bugsResponse = await supportService.getAllBugReports();
      const bugs = Array.isArray(bugsResponse)
        ? bugsResponse
        : bugsResponse?.data || [];
      const unreadBugs = bugs.filter(
        (b) => !b.isReadByAdmin && b.responses && b.responses.length > 0,
      ).length;

      const totalUnread = unreadTickets + unreadBugs;
      setUnreadSupportCount(totalUnread > 0 ? 1 : 0);
      console.log("Admin support unread count updated:", totalUnread);
    } catch (error) {
      console.error("Error fetching admin support unread count:", error);
    }
  };

  React.useEffect(() => {
    fetchUnreadSupportCount();
    fetchPendingMemberCount();
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
          return (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              {focused && (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    width: 48,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.accentLight,
                  }}
                />
              )}
              <Ionicons name={iconName} size={22} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          paddingTop: 4,
        },
        tabBarBadgeStyle: {
          backgroundColor: "#e74c3c",
          fontSize: 10,
          fontWeight: "700",
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          lineHeight: 17,
          top: -2,
        },
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
        options={{
          title: "Members",
          tabBarBadge: pendingMemberCount > 0 ? pendingMemberCount : null,
        }}
        listeners={{
          focus: () => {
            fetchPendingMemberCount();
          },
        }}
      />
      <Tab.Screen
        name="AnnouncementsStack"
        component={AnnouncementsStack}
        options={{ title: "News" }}
      />
      <Tab.Screen
        name="ProfileStack"
        component={ProfileStack}
        options={{
          title: "Profile",
          tabBarBadge: unreadSupportCount > 0 ? "" : null,
          tabBarBadgeStyle: {
            backgroundColor: "#e74c3c",
            minWidth: 8,
            height: 8,
            borderRadius: 4,
            top: 0,
            right: 2,
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
