const SupabaseService = require("../db/SupabaseService");
const { sendPushNotification } = require("./sendPushNotification");

/**
 * Create a notification for a user
 * @param {string} recipientId - User ID to send notification to
 * @param {object} notificationData - { type, title, message, relatedData }
 * @returns {Promise<object>} Created notification
 */
const createNotification = async (recipientId, notificationData) => {
  try {
    const {
      type = "general",
      title,
      message,
      relatedData = {},
    } = notificationData;

    const notification = await SupabaseService.insert("notifications", {
      recipient_id: recipientId,
      notification_type: type,
      title,
      message,
      related_data: relatedData,
      is_read: false,
    });

    console.log(`✅ Notification created for user ${recipientId}:`, title);

    // Try to send push notification if user has a push token
    try {
      const user = await SupabaseService.findUserById(recipientId);
      const pushSource = user?.expo_push_token || user?.twofactortoken;
      if (pushSource) {
        const pushTokens = Array.isArray(pushSource) ? pushSource : [pushSource];

        for (const token of pushTokens) {
          if (token) {
            const pushResult = await sendPushNotification(token, {
              title,
              body: message,
              data: {
                notificationType: type,
                notificationId: notification?.id?.toString(),
                ...relatedData,
              },
            });

            if (pushResult && notification?.id) {
              await SupabaseService.update(
                "notifications",
                notification.id,
                {
                  push_sent: true,
                },
              );
              console.log(`📱 Push notification sent for ${title}`);
            }
          }
        }
      }
    } catch (pushError) {
      console.log(
        "⚠️  Push notification failed (non-critical):",
        pushError.message,
      );
    }

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

module.exports = createNotification;
