import Constants from "expo-constants";
import { Alert, Linking, Platform } from "react-native";

/**
 * Check if app version meets minimum requirement
 * Returns update requirement status
 */
export const checkForUpdate = async (backendURL) => {
  try {
    // Get current app version from app.json
    const currentVersion = Constants.expoConfig?.version || "1.0.0";
    console.log("Current app version:", currentVersion);

    // Fetch minimum required version from backend
    const response = await fetch(`${backendURL}/api/app-version`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn("Failed to fetch version info:", response.status);
      return { requiresUpdate: false, isForced: false };
    }

    const data = await response.json();
    const minVersion = data.minVersion || "1.0.0";
    const latestVersion = data.latestVersion || minVersion;
    const isForced = data.isForced || false;
    const updateUrl = data.updateUrl || "";
    const updateMessage = data.updateMessage || "";

    console.log("Minimum required version:", minVersion);
    console.log("Latest version:", latestVersion);
    console.log("Update forced:", isForced);

    // Compare versions
    const requiresUpdate = compareVersions(currentVersion, minVersion) < 0;
    const hasNewVersion = compareVersions(currentVersion, latestVersion) < 0;

    return {
      requiresUpdate,
      hasNewVersion,
      isForced: requiresUpdate && isForced,
      currentVersion,
      minVersion,
      latestVersion,
      updateUrl,
      updateMessage,
    };
  } catch (error) {
    console.error("Error checking for updates:", error);
    return { requiresUpdate: false, isForced: false };
  }
};

/**
 * Compare two semantic versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
const compareVersions = (v1, v2) => {
  const v1parts = v1.split(".").map(Number);
  const v2parts = v2.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = v1parts[i] || 0;
    const p2 = v2parts[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
};

/**
 * Show update required alert
 */
export const showUpdateAlert = (isForced = false, updateUrl = "", updateMessage = "") => {
  const defaultMsg = isForced
    ? "A critical update is available. You must update the app to continue."
    : "A new version of Apartment Bill Tracker is available. Update now for the best experience.";

  const buttons = [
    {
      text: "Update Now",
      onPress: () => {
        if (updateUrl) {
          Linking.openURL(updateUrl);
        } else {
          // Default to GitHub releases page for this project
          const releaseUrl =
            "https://github.com/@apartmentbilltracker/apartment-bill-tracker/releases";
          Linking.openURL(releaseUrl);
        }
      },
    },
  ];

  if (!isForced) {
    buttons.push({
      text: "Later",
      onPress: () => {},
      style: "cancel",
    });
  }

  Alert.alert(
    isForced ? "Update Required" : "Update Available",
    updateMessage || defaultMsg,
    buttons,
    { cancelable: !isForced },
  );
};

export default {
  checkForUpdate,
  showUpdateAlert,
};
