import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
  FlatList,
  useWindowDimensions,
} from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  roomService,
  memberService,
  paymentService,
} from "../services/apiService";

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
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 50; // 50px tolerance
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

// Reuse existing admin screens for host
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
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
import AdminBroadcastScreen from "../screens/admin/AdminBroadcastScreen";
import AdminAnnouncementsScreen from "../screens/admin/AdminAnnouncementsScreen";
import ChatRoomScreen from "../screens/chat/ChatRoomScreen";
import HostProfileScreen from "../screens/host/HostProfileScreen";
import TermsOfServiceScreen from "../screens/legal/TermsOfServiceScreen";
import PrivacyPolicyScreen from "../screens/legal/PrivacyPolicyScreen";
import { useTheme } from "../theme/ThemeContext";
import Svg, { Path } from "react-native-svg";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
        name="HostDashboard"
        component={AdminDashboardScreen}
        options={{ title: "Dashboard" }}
      />
      <Stack.Screen
        name="PaymentSettingsFromDash"
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
        name="HostBilling"
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
        name="HostAnnouncements"
        component={AdminAnnouncementsScreen}
        options={{ title: "Announcements" }}
      />
    </Stack.Navigator>
  );
};

const ProfileStack = () => {
  const headerOptions = useHeaderOptions();
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen
        name="HostProfile"
        component={HostProfileScreen}
        options={{ title: "Profile" }}
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

const HostTabNavigator = () => {
  const [pendingMemberCount, setPendingMemberCount] = React.useState(0);
  const [pendingVerifCount, setPendingVerifCount] = React.useState(0);
  const [isScrolledToBottom, setIsScrolledToBottom] = React.useState(false);
  const { colors } = useTheme();
  const colorScheme = useColorScheme();
  const tabInsets = useSafeAreaInsets();
  const lastPendingFetch = React.useRef(0);

  const fetchPendingMemberCount = async () => {
    // Debounce: skip if fetched within last 30 seconds
    if (Date.now() - lastPendingFetch.current < 30000) return;
    lastPendingFetch.current = Date.now();
    try {
      const response = await roomService.getRooms();
      const rooms = response.rooms || response.data?.rooms || [];
      // Fetch all rooms in parallel instead of sequentially
      const results = await Promise.allSettled(
        rooms.map((room) =>
          memberService.getPendingMembers(room.id || room._id),
        ),
      );
      const totalPending = results.reduce((sum, r) => {
        if (r.status === "fulfilled") {
          return sum + (r.value?.pendingMembers?.length || 0);
        }
        return sum;
      }, 0);
      setPendingMemberCount(totalPending);
    } catch (error) {
      console.error("Error fetching pending member count:", error);
    }
  };

  const fetchPendingVerifCount = async () => {
    try {
      const response = await roomService.getRooms();
      const rooms = response.rooms || response.data?.rooms || [];
      const results = await Promise.allSettled(
        rooms.map((room) =>
          paymentService.getPaymentHistory(room.id || room._id),
        ),
      );
      let total = 0;
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          const payments = r.value?.payments || r.value?.data || [];
          total += payments.filter(
            (p) => p.status === "pending" || p.status === "submitted",
          ).length;
        }
      });
      setPendingVerifCount(total);
    } catch (_) {}
  };

  // Fire and forget — don't block navigator mount
  // Poll every 30 s so the badge auto-clears after the host verifies payments
  // without requiring a tab press.
  React.useEffect(() => {
    fetchPendingMemberCount();
    fetchPendingVerifCount();
    const interval = setInterval(fetchPendingVerifCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const CustomTabBar = ({ state, descriptors, navigation }) => {
    const TAB_BAR_HEIGHT = 80;
    const FAB_SIZE = 64;
    const FAB_BOTTOM = 32;

    const leftTabs = state.routes.slice(0, 2);
    const centerTab = state.routes[2];
    const rightTabs = state.routes.slice(3);

    const iconFor = (routeName, focused) => {
      if (routeName === "DashboardStack")
        return focused ? "bar-chart" : "bar-chart-outline";
      if (routeName === "RoomStack") return focused ? "home" : "home-outline";
      if (routeName === "BillingStack") return "wallet-outline";
      if (routeName === "AnnouncementsStack")
        return focused ? "megaphone" : "megaphone-outline";
      if (routeName === "ProfileStack")
        return focused ? "person" : "person-outline";
      return "ellipse-outline";
    };

    const labelFor = (routeName) => {
      const descriptor =
        descriptors[state.routes.find((route) => route.name === routeName)?.key];
      return descriptor?.options?.title || routeName.replace("Stack", "");
    };

    const badgeFor = (routeName) => {
      const route = state.routes.find((r) => r.name === routeName);
      return descriptors[route?.key]?.options?.tabBarBadge;
    };

    const rootNameFor = (routeName) =>
      ({
        DashboardStack: "HostDashboard",
        RoomStack: "RoomManagement",
        BillingStack: "HostBilling",
        AnnouncementsStack: "HostAnnouncements",
        ProfileStack: "HostProfile",
      })[routeName] ?? routeName;

    const pressTab = (route) => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (event.defaultPrevented) return;

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: route.name,
              state: { routes: [{ name: rootNameFor(route.name) }] },
            },
          ],
        }),
      );
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
              color={focused ? "#036d41" : "#6A7880"}
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
        <NotchBackground
          color={colors.tabBarBg || "#ffffff"}
          height={TAB_BAR_HEIGHT + tabInsets.bottom}
          borderColor={colorScheme === "dark" ? "#333333" : "#e0e0e0"}
        />

        <View style={[styles.tabRow, { height: TAB_BAR_HEIGHT }]}>
          <View style={styles.tabSide}>
            {leftTabs.map((route) => (
              <TabItem key={route.key} route={route} />
            ))}
          </View>

          <View style={{ width: FAB_SIZE + 16 }} />

          <View style={styles.tabSide}>
            {rightTabs.map((route) => (
              <TabItem key={route.key} route={route} />
            ))}
          </View>
        </View>

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
              backgroundColor: colors.tabBarActive,
              shadowColor: colors.tabBarActive,
              borderWidth: 4,
              borderColor: colors.tabBarBg,
            },
          ]}
        >
          <Ionicons name="wallet-outline" size={28} color="#fff" />
          {pendingVerifCount > 0 && (
            <View style={styles.fabBadge}>
              <Text style={styles.tabBadgeText}>
                {pendingVerifCount > 99 ? "99+" : pendingVerifCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const NotchBackground = ({
    color = "#ffffff",
    height = 80,
    borderColor = "#e0e0e0",
  }) => {
    const { width } = useWindowDimensions();
    const center = width / 2;
    const notchWidth = 120;
    const startX = center - notchWidth / 2;

    const d = [
      "M 0,0",
      `L ${startX},0`,
      `L ${startX + 6},0`,
      `C ${startX + 12},0 ${startX + 18},8 ${startX + 18},16`,
      `A 42,42 0 0,0 ${startX + 102},16`,
      `C ${startX + 102},8 ${startX + 108},0 ${startX + 114},0`,
      `L ${startX + 120},0`,
      `L ${width},0`,
      `L ${width},${height}`,
      `L 0,${height}`,
      "Z",
    ].join(" ");

    const stroke = [
      "M 0,0",
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
          screenOptions={() => ({
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
                        state: { routes: [{ name: "HostDashboard" }] },
                      },
                    ],
                  }),
                ),
            })}
          />
          <Tab.Screen
            name="RoomStack"
            component={RoomManagementStack}
            options={{ title: "Rooms" }}
            listeners={({ navigation }) => ({
              tabPress: () =>
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: "RoomStack",
                        state: { routes: [{ name: "RoomManagement" }] },
                      },
                    ],
                  }),
                ),
            })}
          />
          <Tab.Screen
            name="BillingStack"
            component={BillingStack}
            options={{
              title: "Billing",
              tabBarBadge: pendingVerifCount > 0 ? pendingVerifCount : null,
            }}
            listeners={({ navigation }) => ({
              tabPress: () => {
                fetchPendingVerifCount();
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: "BillingStack",
                        state: { routes: [{ name: "HostBilling" }] },
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
                        state: { routes: [{ name: "HostAnnouncements" }] },
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
                        state: { routes: [{ name: "HostProfile" }] },
                      },
                    ],
                  }),
                ),
            })}
          />
        </Tab.Navigator>
      </ScrollContext.Provider>
    </View>
  );
};

// Root wrapper — ChatRoom lives here, ABOVE the Tab navigator.
const styles = StyleSheet.create({
  tabBarOuter: {
    position: "relative",
    width: "100%",
    borderTopWidth: 0,
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
    marginLeft: -32,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  fabBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#e74c3c",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});

const HostNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="HostTabs" component={HostTabNavigator} />
    <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
  </Stack.Navigator>
);

export { ScrollContext };
export default HostNavigator;
