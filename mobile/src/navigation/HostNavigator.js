import React from "react";
import { View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { roomService, memberService } from "../services/apiService";

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
import ChatNotificationBanner from "../components/ChatNotificationBanner";
import { useTheme } from "../theme/ThemeContext";

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
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{ headerShown: false }}
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

const HostNavigator = () => {
  const [pendingMemberCount, setPendingMemberCount] = React.useState(0);
  const { colors } = useTheme();
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

  // Fire and forget — don't block navigator mount
  React.useEffect(() => {
    fetchPendingMemberCount();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <ChatNotificationBanner role="host" />
      <Tab.Navigator
        sceneContainerStyle={{ backgroundColor: colors.background }}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color }) => {
            let iconName;
            if (route.name === "DashboardStack") {
              iconName = focused ? "bar-chart" : "bar-chart-outline";
            } else if (route.name === "RoomStack") {
              iconName = focused ? "home" : "home-outline";
            } else if (route.name === "BillingStack") {
              iconName = focused ? "wallet" : "wallet-outline";
            } else if (route.name === "AnnouncementsStack") {
              iconName = focused ? "megaphone" : "megaphone-outline";
            } else if (route.name === "MembersStack") {
              iconName = focused ? "people" : "people-outline";
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
            marginTop: 0,
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
            paddingBottom: Math.max(tabInsets.bottom, 8),
            height: 56 + Math.max(tabInsets.bottom, 8),
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
          options={{ title: "Billing" }}
          listeners={({ navigation }) => ({
            tabPress: () =>
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
              ),
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
          name="MembersStack"
          component={MembersStack}
          options={{
            title: "Members",
            tabBarBadge: pendingMemberCount > 0 ? pendingMemberCount : null,
          }}
          listeners={({ navigation }) => ({
            tabPress: () => {
              fetchPendingMemberCount();
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    {
                      name: "MembersStack",
                      state: { routes: [{ name: "Members" }] },
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
    </View>
  );
};

export default HostNavigator;
