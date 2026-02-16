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
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="NotificationsInbox"
        component={NotificationsInboxScreen}
        options={{ title: "Notifications" }}
        listeners={({ navigation }) => ({
          beforeRemove: () => {
            // Refresh count when leaving NotificationsStack
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

  const fetchUnreadCount = async () => {
    try {
      const response = await apiService.get("/api/v2/notifications");
      const newCount = response.unreadCount || 0;
      setUnreadCount(newCount);
      console.log("Unread count updated:", newCount);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  const fetchAnnouncementCount = async () => {
    try {
      const roomsResponse = await roomService.getClientRooms();
      let rooms = [];
      if (Array.isArray(roomsResponse)) {
        rooms = roomsResponse;
      } else if (roomsResponse?.data) {
        rooms = Array.isArray(roomsResponse.data)
          ? roomsResponse.data
          : [roomsResponse.data];
      } else if (roomsResponse?.rooms) {
        rooms = Array.isArray(roomsResponse.rooms)
          ? roomsResponse.rooms
          : [roomsResponse.rooms];
      }

      // Find user's joined room
      const joinedRoom = rooms.find((r) =>
        r.members?.some(
          (m) => String(m.user?._id || m.user) === String(userId),
        ),
      );

      if (joinedRoom) {
        // Get announcements for the room
        const announcementsResponse =
          await announcementService.getRoomAnnouncements(joinedRoom._id);
        const announcements = Array.isArray(announcementsResponse)
          ? announcementsResponse
          : announcementsResponse?.data || [];

        // Count only unread announcements (where current user is not in readBy array)
        const unreadCount = announcements.filter(
          (announcement) =>
            !announcement.readBy ||
            !announcement.readBy.some(
              (readUserId) => String(readUserId) === String(userId),
            ),
        ).length;

        setAnnouncementCount(unreadCount);
        console.log("Announcement unread count updated:", unreadCount);
      } else {
        setAnnouncementCount(0);
      }
    } catch (error) {
      console.error("Error fetching announcement count:", error);
    }
  };

  const fetchUnreadSupportCount = async () => {
    try {
      const { supportService } = require("../services/apiService");
      const ticketsResponse = await supportService.getUserTickets();
      const tickets = Array.isArray(ticketsResponse)
        ? ticketsResponse
        : ticketsResponse?.data || [];
      const unreadTickets = tickets.filter(
        (t) => !t.isReadByUser && t.replies && t.replies.length > 0,
      ).length;

      const bugsResponse = await supportService.getUserBugReports();
      const bugs = Array.isArray(bugsResponse)
        ? bugsResponse
        : bugsResponse?.data || [];
      const unreadBugs = bugs.filter(
        (b) => !b.isReadByUser && b.responses && b.responses.length > 0,
      ).length;

      const totalUnread = unreadTickets + unreadBugs;
      setUnreadSupportCount(totalUnread > 0 ? 1 : 0); // Show dot if any unread
      console.log("Support unread count updated:", totalUnread);
    } catch (error) {
      console.error("Error fetching support unread count:", error);
    }
  };

  React.useEffect(() => {
    // Fetch unread count when component mounts
    fetchUnreadCount();
    fetchAnnouncementCount();
    fetchUnreadSupportCount();

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
