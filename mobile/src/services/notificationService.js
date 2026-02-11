import * as Notifications from "expo-notifications";

/**
 * Notification Service for Daily Presence Reminders
 * Sends daily push notifications to remind users to mark their presence
 */

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions from user
 */
export const requestNotificationPermissions = async () => {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Notification permissions not granted");
      return false;
    }

    console.log("Notification permissions granted");
    return true;
  } catch (error) {
    console.error("Error requesting notification permissions:", error);
    return false;
  }
};

/**
 * Schedule daily presence reminder notification
 * @param {number} hour - Hour (0-23) to send notification
 * @param {number} minute - Minute (0-59) to send notification
 * @returns {string} Notification ID for later cancellation
 */
export const scheduleDailyPresenceReminder = async (hour = 9, minute = 0) => {
  try {
    // First request permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn("Cannot schedule notification without permissions");
      return null;
    }

    // Cancel any existing reminders first
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Calculate next trigger time
    const now = new Date();
    const triggerTime = new Date(now);
    triggerTime.setHours(hour, minute, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (triggerTime <= now) {
      triggerTime.setDate(triggerTime.getDate() + 1);
    }

    // Calculate seconds until trigger time
    const secondsUntil = Math.floor((triggerTime - now) / 1000);

    // For daily recurring notifications on Android and iOS
    // Use seconds trigger that repeats daily
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🗓️ Mark Your Presence",
        body: "Hello, Ayaw kalimot ug mark sa imo presence para karong adlawa! Apartment Bill Tracker nagpa-remind nimo. Salamat!💗",
        data: {
          type: "presence_reminder",
          screen: "Bills",
        },
        badge: 1,
        sound: "default",
        vibrate: [0, 250, 250, 250],
        priority: "high",
      },
      trigger: {
        type: "timeInterval",
        seconds: secondsUntil,
        repeats: true,
      },
    });

    const triggerTimeStr = triggerTime.toLocaleTimeString();
    console.log(
      `Daily presence reminder scheduled for ${triggerTimeStr} (in ${secondsUntil} seconds) - ID: ${notificationId}`,
    );
    return notificationId;
  } catch (error) {
    console.error("Error scheduling daily reminder:", error);
    return null;
  }
};

/**
 * Schedule one-time presence reminder (for testing)
 * @param {number} delaySeconds - Delay in seconds before showing notification
 */
export const scheduleTestNotification = async (delaySeconds = 5) => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🧪 Test Notification",
        body: "This is a test presence reminder notification.",
        data: {
          type: "test",
        },
      },
      trigger: {
        type: "timeInterval",
        seconds: delaySeconds,
        repeats: false,
      },
    });

    console.log(`Test notification scheduled - ID: ${notificationId}`);
    return notificationId;
  } catch (error) {
    console.error("Error scheduling test notification:", error);
  }
};

/**
 * Cancel a specific notification
 * @param {string} notificationId - ID of notification to cancel
 */
export const cancelNotification = async (notificationId) => {
  try {
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log(`Notification cancelled: ${notificationId}`);
    }
  } catch (error) {
    console.error("Error cancelling notification:", error);
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("All notifications cancelled");
  } catch (error) {
    console.error("Error cancelling all notifications:", error);
  }
};

/**
 * Set up notification event listeners
 * @param {function} onNotificationReceived - Callback when notification is received
 * @param {function} onNotificationResponse - Callback when user taps notification
 */
export const setupNotificationListeners = (
  onNotificationReceived,
  onNotificationResponse,
) => {
  try {
    // Handle notification received while app is open
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received:", notification);
        if (onNotificationReceived) {
          onNotificationReceived(notification);
        }
      },
    );

    // Handle notification when user taps it
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification response:", response);
        if (onNotificationResponse) {
          onNotificationResponse(response);
        }
      });

    // Return cleanup function
    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  } catch (error) {
    console.error("Error setting up notification listeners:", error);
    return () => {};
  }
};

/**
 * Get all scheduled notifications
 */
export const getScheduledNotifications = async () => {
  try {
    const notifications =
      await Notifications.getAllScheduledNotificationsAsync();
    console.log("Scheduled notifications:", notifications);
    return notifications;
  } catch (error) {
    console.error("Error getting scheduled notifications:", error);
    return [];
  }
};

export default {
  requestNotificationPermissions,
  scheduleDailyPresenceReminder,
  scheduleTestNotification,
  cancelNotification,
  cancelAllNotifications,
  setupNotificationListeners,
  getScheduledNotifications,
};
