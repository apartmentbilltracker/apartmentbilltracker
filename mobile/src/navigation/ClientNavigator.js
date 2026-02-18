import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ClientHomeScreen from "../screens/client/ClientHomeScreen";
import PresenceScreen from "../screens/client/PresenceScreen";
import BillingScreen from "../screens/client/BillingScreen";
import BillsScreen from "../screens/client/BillsScreen";
import BillingHistoryScreen from "../screens/client/BillingHistoryScreen";
import RoomDetailsScreen from "../screens/client/RoomDetailsScreen";
import ProfileScreen from "../screens/client/ProfileScreen";
import MyTicketsScreen from "../screens/client/MyTicketsScreen";
import MyBugReportsScreen from "../screens/client/MyBugReportsScreen";
import TermsOfServiceScreen from "../screens/legal/TermsOfServiceScreen";
import PrivacyPolicyScreen from "../screens/legal/PrivacyPolicyScreen";
import PaymentMethodScreen from "../screens/client/PaymentMethodScreen";
import GCashPaymentScreen from "../screens/client/GCashPaymentScreen";
import BankTransferPaymentScreen from "../screens/client/BankTransferPaymentScreen";
import CashPaymentScreen from "../screens/client/CashPaymentScreen";
import PaymentHistoryScreen from "../screens/client/PaymentHistoryScreen";
import SettlementScreen from "../screens/client/SettlementScreen";
import ChatRoomScreen from "../screens/chat/ChatRoomScreen";
import NotificationsInboxScreen from "../screens/NotificationsInboxScreen";
import AnnouncementsScreen from "../screens/client/AnnouncementsScreen";
import ChatNotificationBanner from "../components/ChatNotificationBanner";
import {
  apiService,
  announcementService,
  roomService,
  badgeService,
} from "../services/apiService";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
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

const ClientHomeStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
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
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

const PresenceStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
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
};

const BillsStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="BillsMain"
        component={BillsScreen}
        options={{ title: "Bills" }}
      />
      <Stack.Screen
        name="BillingHistory"
        component={BillingHistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Billing"
        component={BillingScreen}
        options={{ title: "Billing Details" }}
      />
      <Stack.Screen
        name="PaymentMethod"
        component={PaymentMethodScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GCashPayment"
        component={GCashPaymentScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BankTransferPayment"
        component={BankTransferPaymentScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CashPayment"
        component={CashPaymentScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PaymentHistory"
        component={PaymentHistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settlement"
        component={SettlementScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

const ProfileStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile" }}
      />
      <Stack.Screen
        name="MyTickets"
        component={MyTicketsScreen}
        options={{ title: "My Support Tickets" }}
      />
      <Stack.Screen
        name="MyBugReports"
        component={MyBugReportsScreen}
        options={{ title: "My Bug Reports" }}
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
    </Stack.Navigator>
  );
};

const AnnouncementsStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="AnnouncementsMain"
        component={AnnouncementsScreen}
        options={{ title: "Announcements" }}
      />
    </Stack.Navigator>
  );
};

const NotificationsStack = ({ onNotificationsStatusChange }) => {
  const headerOptions = useHeaderOptions();
  // Use a wrapper to pass the callback as a prop instead of navigation params
  const InboxScreen = React.useCallback(
    (props) => (
      <NotificationsInboxScreen
        {...props}
        onBadgeRefresh={onNotificationsStatusChange}
      />
    ),
    [onNotificationsStatusChange],
  );
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="NotificationsInbox"
        component={InboxScreen}
        options={{ title: "Notifications" }}
        listeners={() => ({
          beforeRemove: () => {
            onNotificationsStatusChange?.();
          },
        })}
      />
    </Stack.Navigator>
  );
};

const ClientNavigator = () => {
  const { state } = useContext(AuthContext);
  const { colors } = useTheme();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [announcementCount, setAnnouncementCount] = React.useState(0);
  const [unreadSupportCount, setUnreadSupportCount] = React.useState(0);
  const userId = state?.user?.id || state?.user?._id;
  const notificationRefreshRef = React.useRef(null);
  const announcementRefreshRef = React.useRef(null);
  const lastBadgeFetchRef = React.useRef(0);

  // Single consolidated badge fetch — replaces 3-6 separate API calls
  const fetchAllBadges = async (force = false) => {
    // Throttle: skip if called within the last 10 seconds (unless forced)
    const now = Date.now();
    if (!force && now - lastBadgeFetchRef.current < 10000) return;
    lastBadgeFetchRef.current = now;

    try {
      const counts = await badgeService.getCounts();
      setUnreadCount(counts.unreadNotifications);
      setAnnouncementCount(counts.unreadAnnouncements);
      setUnreadSupportCount(counts.unreadSupport > 0 ? 1 : 0);
    } catch (error) {
      console.error("Error fetching badge counts:", error);
    }
  };

  // Keep individual functions as thin wrappers for backward compatibility
  // Always force-refresh when called from user actions (mark-as-read etc.)
  const fetchUnreadCount = () => fetchAllBadges(true);
  const fetchAnnouncementCount = () => fetchAllBadges(true);
  const fetchUnreadSupportCount = () => fetchAllBadges(true);

  React.useEffect(() => {
    // Fetch all badge counts once on mount
    fetchAllBadges(true);

    // Store function reference to be called from other components
    notificationRefreshRef.current = fetchUnreadCount;
    announcementRefreshRef.current = fetchAnnouncementCount;
  }, [userId]);

  // Wrapper component to avoid inline function issue
  const NotificationsStackWrapper = React.useCallback(
    () => <NotificationsStack onNotificationsStatusChange={fetchUnreadCount} />,
    [],
  );

  return (
    <View style={{ flex: 1 }}>
      <ChatNotificationBanner role="client" />
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
            } else if (route.name === "AnnouncementsStack") {
              iconName = focused ? "megaphone" : "megaphone-outline";
            } else if (route.name === "NotificationsStack") {
              iconName = focused ? "notifications" : "notifications-outline";
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
          name="AnnouncementsStack"
          component={AnnouncementsStack}
          options={{
            title: "News",
            tabBarBadge: announcementCount > 0 ? announcementCount : null,
          }}
          listeners={({ navigation }) => ({
            focus: () => {
              fetchAnnouncementCount();
            },
          })}
        />
        <Tab.Screen
          name="NotificationsStack"
          component={NotificationsStackWrapper}
          options={{
            title: "Alerts",
            tabBarBadge: unreadCount > 0 ? unreadCount : null,
          }}
          listeners={({ navigation }) => ({
            focus: () => {
              fetchUnreadCount();
            },
            blur: () => {
              fetchUnreadCount();
            },
          })}
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
    </View>
  );
};

export default ClientNavigator;
