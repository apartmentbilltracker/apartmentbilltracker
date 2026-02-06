const NotificationLog = require("../model/notificationLog");
const User = require("../model/user");
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

    // Create notification log in database
    const notification = new NotificationLog({
      recipient: recipientId,
      notificationType: type,
      title,
      message,
      relatedData,
    });

    await notification.save();
    console.log(`✅ Notification created for user ${recipientId}:`, title);

    // Try to send push notification if user has a push token
    try {
      const user = await User.findById(recipientId);
      if (user && user.twofactortoken) {
        // User's push token is stored in twofactortoken field
        // (or you may need to check where push tokens are stored in your User model)
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
                notificationId: notification._id.toString(),
              },
            });

            if (pushResult) {
              notification.pushNotificationSent = true;
              await notification.save();
              console.log(`📱 Push notification sent for ${title}`);
            }
          }
        }
      }
    } catch (pushError) {
      console.log("⚠️  Push notification failed (non-critical):", pushError.message);
      // Don't fail the whole process if push fails
    }

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

module.exports = createNotification;
