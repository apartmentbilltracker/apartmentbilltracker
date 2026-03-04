import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { AuthProvider, AuthContext } from "./src/context/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
import notificationService from "./src/services/notificationService";
import updateService from "./src/services/updateService";
import { getAPIBaseURL } from "./src/config/config";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { navigationRef } from "./src/navigation/navigationRef";
import ChatNotificationBanner from "./src/components/ChatNotificationBanner";

export { navigationRef };

export default function App() {
  const [updateStatus, setUpdateStatus] = React.useState(null);

  React.useEffect(() => {
    checkAppVersion();
    // Android 8+ requires a notification channel for push notifications to display
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#b38604",
        sound: "default",
      });
    }
  }, []);

  const checkAppVersion = async () => {
    const backendURL = getAPIBaseURL();
    const status = await updateService.checkForUpdate(backendURL);
    setUpdateStatus(status);

    // Show alert if update is required (or optional new version)
    if (status.requiresUpdate) {
      updateService.showUpdateAlert(
        status.isForced,
        status.updateUrl,
        status.updateMessage,
      );
    } else if (status.hasNewVersion) {
      updateService.showUpdateAlert(
        false,
        status.updateUrl,
        status.updateMessage,
      );
    }
  };

  // If forced update is required, show blocking screen
  if (updateStatus?.isForced) {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={styles.container}>
          <View style={styles.updateIconWrap}>
            <Ionicons name="cloud-download-outline" size={64} color="#b38604" />
          </View>
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.subtitle}>
            {updateStatus.updateMessage ||
              "A new version is available. Please update the app to continue."}
          </Text>
          <Text style={styles.versionInfo}>
            Current: v{updateStatus.currentVersion}
            {"  →  "}Latest: v
            {updateStatus.latestVersion || updateStatus.minVersion}
          </Text>
          <TouchableOpacity
            style={styles.updateButton}
            activeOpacity={0.8}
            onPress={() => {
              const url =
                updateStatus.updateUrl ||
                "https://github.com/@apartmentbilltracker/apartment-bill-tracker/releases";
              Linking.openURL(url);
            }}
          >
            <Ionicons name="download-outline" size={20} color="#fff" />
            <Text style={styles.updateButtonText}>Download Update</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.retryButton}
            activeOpacity={0.7}
            onPress={checkAppVersion}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <AuthProvider>
          <ThemedNavigation />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Resets inactivity timer on navigation state changes. The previous approach
 *  used onStartShouldSetResponderCapture which, even with return false, intercepts
 *  Android native MotionEvents during the capture phase and prevents TextInput
 *  from establishing its IME connection in production APK builds. */
function ActivityTracker({ children }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}

/** Reads theme inside ThemeProvider and passes navTheme to NavigationContainer */
function ThemedNavigation() {
  const { isDark, colors } = useTheme();
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  // Handle push notification taps (works even when app was killed)
  React.useEffect(() => {
    if (lastNotificationResponse) {
      const data =
        lastNotificationResponse.notification?.request?.content?.data;
      if (data?.type === "chat_message" && data?.roomId) {
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          const nav = navigationRef.current;
          if (nav?.isReady()) {
            const chatParams = {
              roomId: data.roomId,
              roomName: data.roomName || "Chat",
              isHost: false,
            };
            // ChatRoom is at the root of each role navigator — navigate directly
            try {
              nav.navigate("ChatRoom", chatParams);
            } catch {
              // Silent — user may be on auth screen
            }
          }
        }, 500);
      }
    }
  }, [lastNotificationResponse]);

  const navTheme = React.useMemo(
    () => ({
      dark: isDark,
      colors: {
        primary: colors.accent,
        background: colors.background,
        card: colors.headerBg,
        text: colors.text,
        border: colors.border,
        notification: colors.error,
      },
    }),
    [isDark, colors],
  );

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.headerBg}
      />
      <ActivityTracker>
        <RootNavigator />
      </ActivityTracker>
      {/* Rendered above all navigator native surfaces so position:absolute
          zIndex works correctly in production APK native stack builds */}
      <ChatNotificationBanner />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFDF5",
    paddingHorizontal: 32,
  },
  updateIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFF8E1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#333",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  versionInfo: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
    marginBottom: 28,
  },
  updateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#b38604",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  updateButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: {
    color: "#b38604",
    fontSize: 14,
    fontWeight: "600",
  },
});
