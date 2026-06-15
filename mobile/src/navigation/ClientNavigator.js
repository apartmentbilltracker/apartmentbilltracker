import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as NavigationBar from "expo-navigation-bar";

// Import scroll context from dedicated file
import { ScrollContext, useScrollToBottom } from "../context/ScrollContext";

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
import ClientRoomsScreen from "../screens/client/ClientRoomsScreen";
import ClientRoomViewScreen from "../screens/client/ClientRoomViewScreen";
import ClientRoomiesScreen from "../screens/client/ClientRoomiesScreen";
import ClientRoomieDetailsScreen from "../screens/client/ClientRoomieDetailsScreen";
import {
  apiService,
  announcementService,
  roomService,
  badgeService,
} from "../services/apiService";

// Import wrapper components from separate file to break circular dependency
import {
  ScrollViewWithDetection,
  FlatListWithDetection,
} from "../components/ScrollDetectionWrappers";
import Svg, { Path } from "react-native-svg";
import { useWindowDimensions } from "react-native";

import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { BlurView } from "expo-blur";

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
        name="NotificationsInbox"
        component={NotificationsInboxScreen}
        options={{ title: "Notifications" }}
      />
      <Stack.Screen
        name="Roomies"
        component={ClientRoomiesScreen}
        options={{ title: "Roomies" }}
      />
      <Stack.Screen
        name="RoomieDetails"
        component={ClientRoomieDetailsScreen}
        options={{ title: "Roomie Details" }}
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

const RoomsStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="RoomsMain"
        component={ClientRoomsScreen}
        options={{ title: "Properties" }}
      />
      <Stack.Screen
        name="RoomView"
        component={ClientRoomViewScreen}
        options={{ title: "Room Preview" }}
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

const ClientTabNavigator = () => {
  const { state } = useContext(AuthContext);
  const { colors } = useTheme();
  const colorScheme = useColorScheme();
  const tabInsets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [announcementCount, setAnnouncementCount] = React.useState(0);
  const [unreadSupportCount, setUnreadSupportCount] = React.useState(0);
  const [isScrolledToBottom, setIsScrolledToBottom] = React.useState(false);
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

  // Configure immersive/fullscreen experience on Android - Hide navigation bar
  useEffect(() => {
    const hideNavBar = async () => {
      try {
        // Hide the Android navigation bar for full-screen immersive experience
        await NavigationBar.setVisibilityAsync("hidden");
      } catch (e) {
        console.log("Navigation bar customization not available:", e);
      }
    };
    hideNavBar();
  }, []);

  React.useEffect(() => {
    // Fetch all badge counts once on mount
    fetchAllBadges(true);

    // Store function reference to be called from other components
    notificationRefreshRef.current = fetchUnreadCount;
    announcementRefreshRef.current = fetchAnnouncementCount;

    // Poll every 30 seconds so changes made on web (mark-as-read etc.) sync to mobile
    const pollInterval = setInterval(() => fetchAllBadges(true), 30000);
    return () => clearInterval(pollInterval);
  }, [userId]);

  // Wrapper component to avoid inline function issue
  const NotificationsStackWrapper = React.useCallback(
    () => <NotificationsStack onNotificationsStatusChange={fetchUnreadCount} />,
    [],
  );

  // ── Custom tab bar with center notch + raised FAB ──────────────────────
  const CustomTabBar = ({ state, descriptors, navigation }) => {
    const TAB_BAR_HEIGHT = 80;
    const FAB_SIZE = 64;
    const FAB_BOTTOM = 32; // FAB rises 38px above bar — sits high in the wide shallow notch

    const leftTabs = state.routes.slice(0, 2); // Home, Presence
    const centerTab = state.routes[2]; // Bills (FAB)
    const rightTabs = state.routes.slice(3); // Rooms, Profile

    const iconFor = (routeName, focused) => {
      if (routeName === "HomeStack") return focused ? "home" : "home-outline";
      if (routeName === "PresenceStack")
        return focused ? "checkbox" : "checkbox-outline";
      if (routeName === "BillsStack") return "receipt-outline";
      if (routeName === "RoomsStack")
        return focused ? "business" : "business-outline";
      if (routeName === "NotificationsStack")
        return focused ? "notifications" : "notifications-outline";
      if (routeName === "ProfileStack")
        return focused ? "person" : "person-outline";
    };

    const labelFor = (routeName) => {
      const d =
        descriptors[state.routes.find((r) => r.name === routeName)?.key];
      return d?.options?.title || routeName.replace("Stack", "");
    };

    const badgeFor = (routeName) => {
      const route = state.routes.find((r) => r.name === routeName);
      return descriptors[route?.key]?.options?.tabBarBadge;
    };

    const pressTab = (route) => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        const rootName =
          {
            BillsStack: "BillsMain",
            HomeStack: "ClientHome",
            PresenceStack: "PresenceMain",
            RoomsStack: "RoomsMain",
            NotificationsStack: "NotificationsInbox",
            ProfileStack: "Profile",
          }[route.name] ?? route.name;

        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              { name: route.name, state: { routes: [{ name: rootName }] } },
            ],
          }),
        );
      }
    };

    const TabItem = ({ route }) => {
      const focused = state.routes[state.index].key === route.key;
      const badge = badgeFor(route.name);
      return (
        <TouchableOpacity
          onPress={() => pressTab(route)}
          style={styles.tabItem}
          activeOpacity={0.7}
        >
          <View style={styles.tabIconWrap}>
            <Ionicons
              name={iconFor(route.name, focused)}
              size={24}
              color={focused ? "#036d41" : "#6A7880"} // Theme colors applied
            />
            {badge != null && badge !== false && (
              <View style={styles.tabBadge}>
                {typeof badge === "number" ? (
                  <Text style={styles.tabBadgeText}>
                    {badge > 99 ? "99+" : badge}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              {
                color: focused ? "#036d41" : "#6A7880",
                fontWeight: focused ? "700" : "600",
              },
            ]}
          >
            {labelFor(route.name)}
          </Text>
        </TouchableOpacity>
      );
    };

    const isFabActive = state.routes[state.index].key === centerTab.key;

    return (
      <View
        style={[
          styles.tabBarOuter,
          {
            height: TAB_BAR_HEIGHT + tabInsets.bottom,
            backgroundColor: "#f1f3f5",
          },
        ]}
      >
        {/* SVG notch background */}
        <NotchBackground
          color={colors.tabBarBg || "#ffffff"}
          height={TAB_BAR_HEIGHT + tabInsets.bottom}
          borderColor={"#e0e0e0"}
        />

        {/* Tab row — matches HTML's flex justify-between with w-1/3 groups */}
        <View style={[styles.tabRow, { height: TAB_BAR_HEIGHT }]}>
          {/* Left group */}
          <View style={styles.tabSide}>
            {leftTabs.map((r) => (
              <TabItem key={r.key} route={r} />
            ))}
          </View>

          {/* Centre spacer — keeps symmetry around the FAB */}
          <View style={{ width: FAB_SIZE + 16 }} />

          {/* Right group */}
          <View style={styles.tabSide}>
            {rightTabs.map((r) => (
              <TabItem key={r.key} route={r} />
            ))}
          </View>
        </View>

        {/* Raised FAB — matches HTML's absolute left-1/2 -top-6 */}
        <TouchableOpacity
          onPress={() => pressTab(centerTab)}
          activeOpacity={0.85}
          style={[
            styles.fabBtn,
            {
              width: FAB_SIZE,
              height: FAB_SIZE,
              borderRadius: FAB_SIZE / 2,
              bottom: tabInsets.bottom + FAB_BOTTOM,
              backgroundColor: isFabActive
                ? colors.tabBarActive
                : colors.tabBarActive,
              shadowColor: colors.tabBarActive,
              // White border ring — matches `border-4 border-white` in HTML
              borderWidth: 4,
              borderColor: colors.tabBarBg,
            },
          ]}
        >
          <Ionicons name="receipt-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  // SVG notch — BPI-style: wide gradual shoulders starting far from centre,
  const NotchBackground = ({
    color = "#ffffff",
    height = 80,
    borderColor = "#e0e0e0",
  }) => {
    const { width } = useWindowDimensions();

    const center = width / 2;
    const notchWidth = 120;
    const startX = center - notchWidth / 2;

    // NEW ONE
    const d = [
      `M 0,0`,
      `L ${startX},0`,
      `L ${startX + 6},0`,
      `C ${startX + 12},0 ${startX + 18},8 ${startX + 18},16`,
      `A 42,42 0 0,0 ${startX + 102},16`,
      `C ${startX + 102},8 ${startX + 108},0 ${startX + 114},0`,
      `L ${startX + 120},0`,
      `L ${width},0`,
      `L ${width},${height}`,
      `L 0,${height}`,
      `Z`,
    ].join(" ");

    const stroke = [
      `M 0,0`,
      `L ${startX},0`,
      `L ${startX + 6},0`,
      `C ${startX + 12},0 ${startX + 18},8 ${startX + 18},16`,
      `A 42,42 0 0,0 ${startX + 102},16`,
      `C ${startX + 102},8 ${startX + 108},0 ${startX + 114},0`,
      `L ${startX + 120},0`,
      `L ${width},0`,
    ].join(" ");

    return (
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <Path d={d} fill={color} />
        <Path d={stroke} fill="none" stroke={borderColor} strokeWidth={1} />
      </Svg>
    );
  };

  return (
    <View style={{ flex: 1, overflow: "visible" }}>
      <ScrollContext.Provider
        value={{ isScrolledToBottom, setIsScrolledToBottom }}
      >
        <Tab.Navigator
          tabBar={(props) => <CustomTabBar {...props} />}
          sceneContainerStyle={{
            overflow: "visible",
            backgroundColor: colors.background,
          }}
          safeAreaInsets={{ bottom: 0 }}
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarShowLabel: false,
            tabBarActiveTintColor: colors.tabBarActive,
            tabBarInactiveTintColor: colors.tabBarInactive,
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
            name="HomeStack"
            component={ClientHomeStack}
            options={{ title: "Home" }}
            listeners={({ navigation }) => ({
              tabPress: () =>
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: "HomeStack",
                        state: { routes: [{ name: "ClientHome" }] },
                      },
                    ],
                  }),
                ),
            })}
          />
          <Tab.Screen
            name="PresenceStack"
            component={PresenceStack}
            options={{ title: "Presence" }}
            listeners={({ navigation }) => ({
              tabPress: () =>
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: "PresenceStack",
                        state: { routes: [{ name: "PresenceMain" }] },
                      },
                    ],
                  }),
                ),
            })}
          />
          <Tab.Screen
            name="BillsStack"
            component={BillsStack}
            options={{ title: "Bills" }}
            listeners={({ navigation }) => ({
              tabPress: () =>
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: "BillsStack",
                        state: { routes: [{ name: "BillsMain" }] },
                      },
                    ],
                  }),
                ),
            })}
          />
          <Tab.Screen
            name="RoomsStack"
            component={RoomsStack}
            options={{
              title: "Properties",
            }}
            listeners={({ navigation }) => ({
              tabPress: () => {
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: "RoomsStack",
                        state: { routes: [{ name: "RoomsMain" }] },
                      },
                    ],
                  }),
                );
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
              tabPress: () => {
                fetchUnreadSupportCount();
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: "ProfileStack",
                        state: { routes: [{ name: "Profile" }] },
                      },
                    ],
                  }),
                );
              },
            })}
          />
        </Tab.Navigator>
      </ScrollContext.Provider>
    </View>
  );
};

const styles = StyleSheet.create({
  // ── Notch tab bar ──
  tabBarOuter: {
    position: "relative",
    width: "100%",
    borderTopWidth: 0, // border handled per-segment in NotchBackground
    backgroundColor: "transparent",
    elevation: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
  },
  tabSide: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 4,
    position: "relative",
  },
  tabIconWrap: {
    position: "relative",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
    letterSpacing: 0.2,
  },
  tabActiveLine: {
    position: "absolute",
    bottom: -4,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  tabBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#e74c3c",
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  tabBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 11,
  },
  fabBtn: {
    position: "absolute",
    alignSelf: "center",
    left: "50%",
    marginLeft: -32, // half of FAB_SIZE
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
});

// Root wrapper — ChatRoom lives here, ABOVE the Tab navigator.
// This means it has no tab bar in its ancestry at all: no hiding/restoring
// needed, no double inset padding, no keyboard layout interference.
const ClientNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ClientTabs" component={ClientTabNavigator} />
    <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
  </Stack.Navigator>
);

export { ScrollContext, ScrollViewWithDetection, FlatListWithDetection };
export default ClientNavigator;
