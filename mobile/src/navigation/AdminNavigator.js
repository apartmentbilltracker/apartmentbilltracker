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
import { supportService, badgeService } from "../services/apiService";
import SuperAdminDashboardScreen from "../screens/admin/SuperAdminDashboardScreen";
import AdminSupportTicketsScreen from "../screens/admin/AdminSupportTicketsScreen";
import AdminVersionControlScreen from "../screens/admin/AdminVersionControlScreen";
import AdminBroadcastScreen from "../screens/admin/AdminBroadcastScreen";
import AdminAnnouncementsScreen from "../screens/admin/AdminAnnouncementsScreen";
import AdminBugReportsScreen from "../screens/admin/AdminBugReportsScreen";
import AdminFAQScreen from "../screens/admin/AdminFAQScreen";
import AdminUserManagementScreen from "../screens/admin/AdminUserManagementScreen";
import AdminAllRoomsScreen from "../screens/admin/AdminAllRoomsScreen";
import AdminRoomDetailScreen from "../screens/admin/AdminRoomDetailScreen";
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
import AdminManageHubScreen from "../screens/admin/AdminManageHubScreen";
import AdminProfileScreen from "../screens/admin/AdminProfileScreen";
import { useTheme } from "../theme/ThemeContext";
import Svg, { Path } from "react-native-svg";

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
      if (routeName === "ManageStack")
        return focused ? "settings" : "settings-outline";
      if (routeName === "SupportStack") return "chatbubbles-outline";
      if (routeName === "AnnouncementsStack")
        return focused ? "megaphone" : "megaphone-outline";
      if (routeName === "ProfileStack")
        return focused ? "person" : "person-outline";
      return "ellipse-outline";
    };

    const labelFor = (routeName) => {
      const descriptor =
        descriptors[
          state.routes.find((route) => route.name === routeName)?.key
        ];
      return descriptor?.options?.title || routeName.replace("Stack", "");
    };

    const badgeFor = (routeName) => {
      const route = state.routes.find((r) => r.name === routeName);
      return descriptors[route?.key]?.options?.tabBarBadge;
    };

    const rootNameFor = (routeName) =>
      ({
        DashboardStack: "AdminDashboard",
        ManageStack: "ManageHub",
        SupportStack: "SupportTickets",
        AnnouncementsStack: "AdminAnnouncements",
        ProfileStack: "AdminProfile",
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
          borderColor={"#e0e0e0"}
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
          <Ionicons name="chatbubbles-outline" size={28} color="#fff" />
          {unreadSupportCount > 0 && <View style={styles.fabDotBadge} />}
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
    </View>
  );
};

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
  fabDotBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#e74c3c",
    borderWidth: 2,
    borderColor: "#fff",
  },
});

export { ScrollContext };
export default AdminNavigator;
