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
import PaymentMethodScreen from "../screens/client/PaymentMethodScreen";
import GCashPaymentScreen from "../screens/client/GCashPaymentScreen";
import BankTransferPaymentScreen from "../screens/client/BankTransferPaymentScreen";
import CashPaymentScreen from "../screens/client/CashPaymentScreen";
import PaymentHistoryScreen from "../screens/client/PaymentHistoryScreen";
import NotificationsInboxScreen from "../screens/NotificationsInboxScreen";
import AnnouncementsScreen from "../screens/client/AnnouncementsScreen";
import {
  apiService,
  announcementService,
  roomService,
} from "../services/apiService";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

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
      name="AnnouncementsMain"
      component={AnnouncementsScreen}
      options={{ title: "Announcements" }}
    />
  </Stack.Navigator>
);

const NotificationsStack = ({ onNotificationsStatusChange }) => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
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

const ClientNavigator = () => {
  const { state } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [announcementCount, setAnnouncementCount] = React.useState(0);
  const userId = state?.user?._id;
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
        setAnnouncementCount(announcements.length);
        console.log("Announcement count updated:", announcements.length);
      } else {
        setAnnouncementCount(0);
      }
    } catch (error) {
      console.error("Error fetching announcement count:", error);
    }
  };

  React.useEffect(() => {
    // Fetch unread count when component mounts
    fetchUnreadCount();
    fetchAnnouncementCount();

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
        name="AnnouncementsStack"
        component={AnnouncementsStack}
        options={{
          title: "Announcements",
          tabBarBadge: announcementCount > 0 ? announcementCount : null,
          tabBarBadgeStyle: {
            backgroundColor: "#ff4444",
            fontSize: 10,
            minWidth: 18,
            height: 18,
          },
        }}
        listeners={({ navigation }) => ({
          focus: () => {
            // Clear badge when user views announcements
            setAnnouncementCount(0);
          },
        })}
      />
      <Tab.Screen
        name="NotificationsStack"
        component={NotificationsStackWrapper}
        options={{
          title: "Notifications",
          tabBarBadge: unreadCount > 0 ? unreadCount : null,
          tabBarBadgeStyle: {
            backgroundColor: "#ff4444",
            fontSize: 10,
            minWidth: 18,
            height: 18,
          },
        }}
        listeners={({ navigation }) => ({
          focus: () => {
            // Refresh count when focus returns to Notifications tab
            fetchUnreadCount();
          },
          blur: () => {
            // Also refresh when leaving Notifications tab
            fetchUnreadCount();
          },
        })}
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
