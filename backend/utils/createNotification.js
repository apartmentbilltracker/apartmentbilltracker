const SupabaseService = require("../db/SupabaseService");
const sendPushNotification = require("./sendPushNotification");

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

    // Create notification log in Supabase
    const notification = await SupabaseService.createNotification({
      user_id: recipientId,
      notification_type: type,
      title,
      message,
      data: relatedData,
      is_read: false,
    });

    console.log(`✅ Notification created for user ${recipientId}:`, title);

    // Try to send push notification if user has a push token
    try {
      const user = await SupabaseService.findUserById(recipientId);
      if (user && user.twofactortoken) {
        const pushTokens = Array.isArray(user.twofactortoken)
          ? user.twofactortoken
          : [user.twofactortoken];

        for (const token of pushTokens) {
          if (token) {
            const pushResult = await sendPushNotification(token, {
              title,
              body: message,
              data: {
                notificationType: type,
                notificationId: notification?.id?.toString(),
              },
            });

            if (pushResult && notification?.id) {
              await SupabaseService.update(
                "notification_logs",
                notification.id,
                {
                  push_notification_sent: true,
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
