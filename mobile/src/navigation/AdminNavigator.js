import React from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  ScrollView,
  FlatList,
} from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supportService, badgeService } from "../services/apiService";
import SuperAdminDashboardScreen from "../screens/admin/SuperAdminDashboardScreen";
import AdminProfileScreen from "../screens/admin/AdminProfileScreen";
import AdminVersionControlScreen from "../screens/admin/AdminVersionControlScreen";
import AdminBroadcastScreen from "../screens/admin/AdminBroadcastScreen";
import AdminAnnouncementsScreen from "../screens/admin/AdminAnnouncementsScreen";
import AdminSupportTicketsScreen from "../screens/admin/AdminSupportTicketsScreen";
import AdminBugReportsScreen from "../screens/admin/AdminBugReportsScreen";
import AdminFAQScreen from "../screens/admin/AdminFAQScreen";
import AdminUserManagementScreen from "../screens/admin/AdminUserManagementScreen";
import AdminAllRoomsScreen from "../screens/admin/AdminAllRoomsScreen";
import AdminRoomDetailScreen from "../screens/admin/AdminRoomDetailScreen";
import AdminManageHubScreen from "../screens/admin/AdminManageHubScreen";
import AdminRoomManagementScreen from "../screens/admin/AdminRoomManagementScreen";
import AdminBillingScreen from "../screens/admin/AdminBillingScreen";
import AdminBillingCycleScreen from "../screens/admin/AdminBillingCycleScreen";
import AdminMembersScreen from "../screens/admin/AdminMembersScreen";
import AdminPaymentVerificationScreen from "../screens/admin/AdminPaymentVerificationScreen";
import AdminFinancialDashboardScreen from "../screens/admin/AdminFinancialDashboardScreen";
import AdminBillingDetailsScreen from "../screens/admin/AdminBillingDetailsScreen";
import AdminAdjustmentsScreen from "../screens/admin/AdminAdjustmentsScreen";
import AdminRemindersScreen from "../screens/admin/AdminRemindersScreen";
import AdminPresenceRemindersScreen from "../screens/admin/AdminPresenceRemindersScreen";
import AdminPaymentSettingsScreen from "../screens/admin/AdminPaymentSettingsScreen";
import AdminAdsScreen from "../screens/admin/AdminAdsScreen";
import TermsOfServiceScreen from "../screens/legal/TermsOfServiceScreen";
import PrivacyPolicyScreen from "../screens/legal/PrivacyPolicyScreen";
import { useTheme } from "../theme/ThemeContext";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Context for tracking scroll position
const ScrollContext = React.createContext({
  isScrolledToBottom: true,
  setIsScrolledToBottom: () => {},
});

// Hook for screens to use to track scroll position
export const useScrollToBottom = () => {
  const context = React.useContext(ScrollContext);
  if (!context) {
    console.warn(
      "useScrollToBottom must be used within ScrollContext.Provider",
    );
    return { isScrolledToBottom: true, setIsScrolledToBottom: () => {} };
  }
  return context;
};

// Wrapper component for ScrollView to automatically track scroll position
export const ScrollViewWithDetection = ({ children, ...props }) => {
  const context = useScrollToBottom();

  const handleScroll = (event) => {
    if (!event?.nativeEvent) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
    context.setIsScrolledToBottom(isAtBottom);
  };

  return (
    <ScrollView {...props} onScroll={handleScroll} scrollEventThrottle={16}>
      {children}
    </ScrollView>
  );
};

// Wrapper component for FlatList to automatically track scroll position
export const FlatListWithDetection = (props) => {
  const context = useScrollToBottom();

  const handleScroll = (event) => {
    if (!event?.nativeEvent) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
    context.setIsScrolledToBottom(isAtBottom);
  };

  return (
    <FlatList {...props} onScroll={handleScroll} scrollEventThrottle={16} />
  );
};

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
        component={SuperAdminDashboardScreen}
        options={{ title: "Dashboard" }}
      />
      <Stack.Screen
        name="AdminAds"
        component={AdminAdsScreen}
        options={{ title: "Ads Management" }}
      />
    </Stack.Navigator>
  );
};

const SupportStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
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
        name="ProfileSupportTickets"
        component={AdminSupportTicketsScreen}
        options={{ title: "Support Tickets" }}
      />
      <Stack.Screen
        name="ProfileBugReports"
        component={AdminBugReportsScreen}
        options={{ title: "Bug Reports" }}
      />
      <Stack.Screen
        name="ProfileManageFAQs"
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

const ManageStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="ManageHub"
        component={AdminManageHubScreen}
        options={{ title: "Management" }}
      />
      <Stack.Screen
        name="UserManagement"
        component={AdminUserManagementScreen}
        options={{ title: "User Management" }}
      />
      <Stack.Screen
        name="AllRooms"
        component={AdminAllRoomsScreen}
        options={{ title: "All Rooms" }}
      />
      <Stack.Screen
        name="RoomDetail"
        component={AdminRoomDetailScreen}
        options={{ title: "Room Details" }}
      />
      <Stack.Screen
        name="RoomManagement"
        component={AdminRoomManagementScreen}
        options={{ title: "Room Management" }}
      />
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
      <Stack.Screen
        name="Members"
        component={AdminMembersScreen}
        options={{ title: "Members" }}
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
  const [isScrolledToBottom, setIsScrolledToBottom] = React.useState(false);
  const { colors } = useTheme();
  const colorScheme = useColorScheme();
  const tabInsets = useSafeAreaInsets();

  const fetchUnreadSupportCount = async () => {
    try {
      const counts = await badgeService.getCounts();
      setUnreadSupportCount(counts.unreadSupport > 0 ? 1 : 0);
    } catch (error) {
      console.error("Error fetching admin support unread count:", error);
    }
  };

  React.useEffect(() => {
    fetchUnreadSupportCount();
  }, []);

  return (
    <View style={{ flex: 1, overflow: "visible" }}>
      <ScrollContext.Provider
        value={{ isScrolledToBottom, setIsScrolledToBottom }}
      >
        <Tab.Navigator
          sceneContainerStyle={{
            overflow: "visible",
            backgroundColor: colors.background,
            paddingBottom: isScrolledToBottom ? 60 : 0,
          }}
          safeAreaInsets={{ bottom: 0 }}
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarShowLabel: false,

            tabBarIcon: ({ focused, color, size }) => {
              let iconName;
              if (route.name === "DashboardStack") {
                iconName = focused ? "bar-chart" : "bar-chart-outline";
              } else if (route.name === "ManageStack") {
                iconName = focused ? "settings" : "settings-outline";
              } else if (route.name === "SupportStack") {
                iconName = focused ? "chatbubbles" : "chatbubbles-outline";
              } else if (route.name === "AnnouncementsStack") {
                iconName = focused ? "megaphone" : "megaphone-outline";
              } else if (route.name === "ProfileStack") {
                iconName = focused ? "person" : "person-outline";
              }
              return (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                    borderRadius: 50,
                    backgroundColor: focused ? colors.accent : "transparent",
                  }}
                >
                  <Ionicons
                    name={iconName}
                    size={22}
                    color={focused ? "white" : color}
                  />
                </View>
              );
            },
            tabBarActiveTintColor: colors.tabBarActive,
            tabBarInactiveTintColor: colors.tabBarInactive,
            tabBarStyle: {
              position: "absolute",
              bottom: 20,
              left: 20,
              right: 20,
              backgroundColor: colors.tabBarBg,
              borderRadius: 50,
              elevation: 30,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -10 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
              paddingVertical: 4,
              paddingBottom: 4,
              paddingHorizontal: 4,
              height: 60,
            },
            tabBarBadgeStyle: {
              backgroundColor: "#e74c3c",
              fontSize: 10,
              fontWeight: "700",
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              lineHeight: 17,
              top: 6,
            },
          })}
        >
          <Tab.Screen
            name="DashboardStack"
            component={DashboardStack}
            options={{ title: "Dashboard" }}
            listeners={({ navigation }) => ({
              tabPress: () =>
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: "DashboardStack",
                        state: { routes: [{ name: "AdminDashboard" }] },
                      },
                    ],
                  }),
                ),
            })}
          />
          <Tab.Screen
            name="ManageStack"
            component={ManageStack}
            options={{ title: "Manage" }}
            listeners={({ navigation }) => ({
              tabPress: () =>
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: "ManageStack",
                        state: { routes: [{ name: "ManageHub" }] },
                      },
                    ],
                  }),
                ),
            })}
          />
          <Tab.Screen
            name="SupportStack"
            component={SupportStack}
            options={{
              title: "Support",
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
              tabPress: () => {
                fetchUnreadSupportCount();
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: "SupportStack",
                        state: { routes: [{ name: "SupportTickets" }] },
                      },
                    ],
                  }),
                );
              },
            })}
          />
          <Tab.Screen
            name="AnnouncementsStack"
            component={AnnouncementsStack}
            options={{ title: "News" }}
            listeners={({ navigation }) => ({
              tabPress: () =>
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: "AnnouncementsStack",
                        state: { routes: [{ name: "AdminAnnouncements" }] },
                      },
                    ],
                  }),
                ),
            })}
          />
          <Tab.Screen
            name="ProfileStack"
            component={ProfileStack}
            options={{ title: "Profile" }}
            listeners={({ navigation }) => ({
              tabPress: () =>
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: "ProfileStack",
                        state: { routes: [{ name: "AdminProfile" }] },
                      },
                    ],
                  }),
                ),
            })}
          />
        </Tab.Navigator>
      </ScrollContext.Provider>

      <View
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          right: 20,
          height: 60,
          borderRadius: 50,
          borderColor: colorScheme === "dark" ? "#666666" : "#E0E0E0",
          borderWidth: 0.3,
          pointerEvents: "none",
        }}
      />
    </View>
  );
};
export { ScrollContext };
export default AdminNavigator;
