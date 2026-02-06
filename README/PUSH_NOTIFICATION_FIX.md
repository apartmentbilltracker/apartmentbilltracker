# Push Notifications Fix - Presence Reminders

## Problem
Push notifications for presence check reminders were only working in Expo Go development app, not in production builds (APK/iOS apps).

## Root Cause Analysis
The issue was discovered through systematic investigation:

### Backend Implementation ✅ 
- Token registration endpoint exists: `POST /api/v2/notifications/register-token`
- Presence reminder endpoint exists: `POST /api/v2/admin/reminders/send-presence/:roomId/:memberId`
- Both endpoints properly call `sendPushNotification()` with user's `expoPushToken`
- Notification logging to database works correctly

### Frontend Implementation ✅
- LoginScreen properly registers push tokens after login using `Notifications.getExpoPushTokenAsync()`
- Tokens are sent to backend for storage
- NotificationService properly configures notification handler with `Notifications.setNotificationHandler()`
- Notification permissions are requested correctly using `Notifications.requestPermissionsAsync()`

### **Missing Configuration ❌**
**The actual problem**: `app.json` was missing the `expo-notifications` plugin configuration.

In Expo managed workflow:
- **Expo Go**: All native modules are pre-built, so notifications work automatically
- **Production builds (APK/iOS)**: Native modules must be compiled into the app at build time
- **Missing plugin**: Without `expo-notifications` plugin in `app.json`, the native notification infrastructure isn't included in production builds

## Solution Implemented

### 1. Updated `mobile/app.json`
Added the `expo-notifications` plugin configuration:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./src/assets/icon.png",
          "colors": ["#b38604"],
          "modes": ["production"]
        }
      ]
    ]
  }
}
```

**Configuration Details:**
- `icon`: App notification icon (uses app icon)
- `colors`: Notification accent colors (brand color #b38604)
- `modes`: Specifies plugin should be used in production builds

### 2. Background Information

**How it works:**
1. User logs in → LoginScreen calls `registerPushToken()`
2. App gets Expo push token via `Notifications.getExpoPushTokenAsync()`
3. Token sent to backend: `POST /api/v2/notifications/register-token`
4. Backend stores in `user.expoPushToken`
5. Admin sends presence reminder → Backend calls `sendPushNotification(user.expoPushToken, notification)`
6. Expo Push Service delivers notification
7. App notification handler (configured via `Notification.setNotificationHandler()`) displays notification

**Android Permissions:**
The `expo-notifications` plugin automatically handles:
- `android.permission.POST_NOTIFICATIONS` (Android 12+) for posting notifications
- Other required notification permissions

## Testing Steps

### For Development (Expo Go)
1. Notifications should still work as before
2. No additional changes needed

### For Production Build (EAS Build)

**Prerequisites:**
- Ensure `eas` CLI is up to date: `npm install -g eas-cli`
- Ensure Expo credentials are set up

**Steps:**
1. Clean build (to ensure plugin is compiled):
   ```bash
   cd mobile
   eas build --platform android --profile production --clear-cache
   ```

2. Or for development preview:
   ```bash
   eas build --platform android --profile preview
   ```

3. After building:
   - Install APK on device
   - Login to app
   - Admin sends presence reminder from another account
   - Verify notification appears even with app closed

**For iOS:**
```bash
eas build --platform ios --profile production --clear-cache
```

### Verification Checklist
- [ ] Push token is successfully registered after login
- [ ] Notification is received when admin sends presence reminder
- [ ] Notification appears with app closed (not just in foreground)
- [ ] Notification sound/vibration works as configured
- [ ] Tapping notification navigates to Presence screen (if deep linking configured)
- [ ] Member status change notifications still work
- [ ] No background crashes or permission errors in logs

## Related Code References

### Frontend Files
- [mobile/App.js](mobile/App.js) - App initialization
- [mobile/src/screens/auth/LoginScreen.js](mobile/src/screens/auth/LoginScreen.js#L118) - Token registration
- [mobile/src/services/notificationService.js](mobile/src/services/notificationService.js#L8) - Notification handler setup
- [mobile/app.json](mobile/app.json) - **Now includes expo-notifications plugin**

### Backend Files
- [backend/controller/notifications.js](backend/controller/notifications.js#L193) - Token registration endpoint
- [backend/controller/adminReminders.js](backend/controller/adminReminders.js#L524) - Presence reminder with push notification
- [backend/utils/sendPushNotification.js](backend/utils/sendPushNotification.js) - Service to send notifications

### Documentation
- [Expo Notifications Plugin Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [EAS Build Configuration](https://docs.expo.dev/build/setup/)

## Environment Variables
No additional environment variables needed. All configuration is in:
- `app.json` - Frontend notification plugin configuration
- `.env` or backend config - Expo Push Service credentials (handled by Expo automatically)

## Rollback Instructions
If needed, revert changes to `app.json`:
```bash
git checkout mobile/app.json
```

---

## Summary of Changes
| File | Change | Impact |
|------|--------|--------|
| `mobile/app.json` | Added `expo-notifications` plugin configuration | Enables native notification support in production builds |

**Status**: ✅ Ready for rebuild and testing
