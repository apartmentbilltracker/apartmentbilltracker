/**
 * Send push notification via Expo Push Service
 * @param {string} expoPushToken - User's Expo push token
 * @param {object} notification - Notification object with title, body, data
 * @returns {Promise<object>} Response from Expo
 */
const sendPushNotification = async (expoPushToken, notification) => {
  if (!expoPushToken) {
    console.log("No expo push token available");
    return null;
  }

  try {
    const message = {
      to: expoPushToken,
      sound: "default",
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: 1,
      priority: "high",
      channelId: "default", // Required for Android 8+ to display notifications
    };

    console.log("Sending push notification:", message);

    // Use native fetch (available in Node.js 18+)
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const responseData = await response.json();
    console.log("Push notification response:", responseData);

    if (responseData.errors) {
      console.error("Expo push notification error:", responseData.errors);
      return null;
    }

    return responseData.data;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return null;
  }
};

/**
 * Send batch push notifications
 * @param {array} expoPushTokens - Array of user push tokens
 * @param {object} notification - Notification to send to all
 * @returns {Promise<array>} Array of responses
 */
const sendBatchPushNotifications = async (expoPushTokens, notification) => {
  const results = [];

  for (const token of expoPushTokens) {
    if (token) {
      const result = await sendPushNotification(token, notification);
      results.push({ token, result });
    }
  }

  return results;
};

module.exports = {
  sendPushNotification,
  sendBatchPushNotifications,
};
