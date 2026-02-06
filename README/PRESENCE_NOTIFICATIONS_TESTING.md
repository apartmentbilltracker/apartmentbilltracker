# Presence Reminder Push Notifications - Testing Guide

## What Was Fixed

**Problem:** Presence reminder push notifications only worked in Expo Go, not in production builds (APK/iOS).

**Root Cause:** Missing `expo-notifications` plugin configuration in `app.json`

**Solution:** Added plugin configuration to `mobile/app.json`

## What You Need To Know

### For Testing Push Notifications (Development)

1. **Using Expo Go** - Works automatically, no rebuild needed
   - Install Expo Go app on phone
   - Scan QR code from `npx expo start`
   - Login and test presence reminders
   - Notifications should appear

2. **Using Built APK** - Requires rebuild after plugin addition
   - Old APK: Notifications won't work ❌
   - New APK (after fix): Notifications should work ✅

### Push Notification Flow

```
Admin sends reminder
      ↓
Backend checks if user has expoPushToken ✅
      ↓
Backend calls Expo Push Service via sendPushNotification() ✅
      ↓
Expo delivers to device token ✅
      ↓
Device receives notification ✅
      ↓
Notification handler displays notification (now works in production!) ✅
```

## Step-by-Step Testing Guide

### Phase 1: Setup & Verification (Before Build)

**Goal:** Verify the fix is in place

- [ ] Check `mobile/app.json` contains `expo-notifications` plugin

  ```bash
  grep -A 5 "expo-notifications" mobile/app.json
  ```

  Should show:

  ```json
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
  ```

- [ ] Verify backend notification code exists
  - [backend/controller/adminReminders.js](backend/controller/adminReminders.js#L524) line 524 checks `user.expoPushToken`
  - [backend/utils/sendPushNotification.js](backend/utils/sendPushNotification.js) sends to Expo service

- [ ] Verify frontend token registration
  - [mobile/src/screens/auth/LoginScreen.js](mobile/src/screens/auth/LoginScreen.js#L123) has `registerPushToken()` function
  - Runs after successful login
  - Sends token to `POST /api/v2/notifications/register-token`

### Phase 2: Development Testing (Expo Go)

**Prerequisites:**

- Expo Go app installed on device
- Backend running (Render or local)
- Two accounts: one admin, one member

**Test Steps:**

1. **On Member's Device:**

   ```bash
   cd mobile
   npx expo start
   # Scan QR code with Expo Go
   ```

2. **When prompted for notification permissions:**
   - Allow notifications
   - Check console logs: `expo push token: ExponentPushToken[...]`

3. **Verify token registered:**
   - Wait for push token log message
   - Token should appear in backend database:

   ```bash
   # Check backend logs or database
   db.users.findOne({_id: memberId}) # Should have expoPushToken field
   ```

4. **Send presence reminder:**
   - Admin logs in from another device
   - Navigate to Presence Reminders
   - Find the member
   - Click "Send Reminder"
   - Select "Single Member"

5. **Verify notification received:**
   - Notification should appear in device notification center
   - Should show title: "📍 Mark Your Presence"
   - Should include custom message (if admin provided one)
   - Push notification should appear even if app is closed

6. **Test notification interaction:**
   - Tap notification
   - App should open
   - If deep linking configured, should navigate to Presence screen
   - Mark presence
   - Verify it logs successfully

### Phase 3: Production APK Testing

**Prerequisites:**

- Latest changes committed and pushed to GitHub
- EAS credentials configured (`eas credentials`)
- Expo token in GitHub Secrets
- Admin access to GitHub Actions

**Build Steps:**

Option A: **GitHub Actions (Recommended)**

```bash
# Push changes
git push origin main

# Go to GitHub → Actions → Mobile APK Build
# Watch build complete
# Download APK from Releases
```

Option B: **Local Build**

```bash
cd mobile
eas build --platform android --profile production --clear-cache
# Wait 10-15 minutes
# Download APK from EAS dashboard
```

**Installation:**

1. Enable developer options and USB debugging on Android device
   - Settings → About phone → Tap "Build number" 7 times
   - Settings → Developer options → Enable "USB Debugging"

2. Install APK

   ```bash
   adb install path/to/apartment-bill-tracker.apk
   ```

   Or transfer APK file and install directly

3. Launch app and login

**Test Steps (Same as Phase 2):**

1. Allow notification permissions when prompted
2. Verify token gets registered (check backend logs)
3. Send presence reminder from another account
4. Verify notification appears WITH APP CLOSED ✅
5. Tap notification to open app
6. Mark presence
7. Verify no errors in logs

### Phase 4: iOS Testing (If Available)

Similar to Android, but build iOS app:

```bash
eas build --platform ios --profile production --clear-cache
```

Follow same testing steps with iOS device.

## Verification Checklist

### ✅ All Tests Must Pass

**Login & Token Registration:**

- [ ] After login, console shows "Expo push token: ExponentPushToken[...]"
- [ ] No permission request errors in logs
- [ ] Token successfully sends to backend (`POST /api/v2/notifications/register-token`)

**Backend Setup:**

- [ ] Backend receives token update request
- [ ] Token stored in database: `user.expoPushToken`
- [ ] No errors in backend logs

**Presence Reminder Sending:**

- [ ] Admin can send reminder without errors
- [ ] Backend logs show presence reminder endpoint called
- [ ] Backend logs show `sendPushNotification()` called
- [ ] Backend logs show Expo Push Service response (success)

**Notification Delivery:**

- [ ] Notification appears in device notification center
- [ ] Notification shows with app closed ✅ (This is the key test!)
- [ ] Notification shows correct title: "📍 Mark Your Presence"
- [ ] Notification shows correct message (admin message or default)
- [ ] Sound/vibration works (if device settings allow)

**Notification Interaction:**

- [ ] Tapping notification opens app
- [ ] App brings user to Presence or Home screen
- [ ] No crashes when handling notification
- [ ] Member can mark presence after tapping notification

## Expected Results

### ✅ With Plugin Configured (Current Fix)

- Expo Go: Notifications work ✅
- Production APK: Notifications work ✅
- Production iOS: Notifications work ✅

### ❌ Without Plugin (Previous State)

- Expo Go: Notifications work ✅
- Production APK: Notifications don't work ❌
- Production iOS: Notifications don't work ❌

## Debugging Issues

### Issue: "Expo push token: undefined"

**Causes:**

- Notification permissions not granted
- Device doesn't have internet connection
- Expo service temporarily down

**Fix:**

- Check notification permissions in device settings
- Ensure internet connected
- Restart Expo Go app
- Check [notificationService.js](mobile/src/services/notificationService.js#L20) code

### Issue: Notification not received after sending

**Causes:**

- Token not successfully registered in database
- Admin sending to wrong member
- Device offline when notification sent
- Token invalidated

**Fix:**

- Verify token in backend: Check `user.expoPushToken` field
- Check backend logs for sendPushNotification() call
- Verify Expo API response in logs
- Try re-registering token (re-login)

### Issue: Notification appears but doesn't do anything when tapped

**Causes:**

- Deep linking not configured
- App notification handler not set up
- Navigation stack issue

**Fix:**

- Verify [notificationService.js](mobile/src/services/notificationService.js#L8) is properly configured
- Check notification handler setup in App.js
- Ensure App.js and navigation are properly initialized

### Issue: App crashes when receiving notification

**Causes:**

- Notification payload malformed
- Navigation issue when handling deep link
- Memory issue

**Fix:**

- Check backend notification payload structure in adminReminders.js
- Verify app doesn't crash on launch
- Check device logs: `adb logcat | grep ReactNativeJS`

## Success Indicators

1. ✅ Admin can send presence reminders
2. ✅ Member receives notification with correct content
3. ✅ Notification appears even when app is closed
4. ✅ Tapping notification opens app
5. ✅ Member can mark presence after receiving notification
6. ✅ No errors in logs (console or backend)

## Related Documentation

- [PUSH_NOTIFICATION_FIX.md](PUSH_NOTIFICATION_FIX.md) - Detailed fix explanation
- [NOTIFICATIONS_IMPLEMENTATION.md](README/NOTIFICATIONS_IMPLEMENTATION.md) - Full notification system
- [APK_BUILD_CHECKLIST.md](README/APK_BUILD_CHECKLIST.md) - Build process
- [BUILD_APK_GUIDE.md](README/BUILD_APK_GUIDE.md) - Build instructions

---

**Status:** Ready for testing after APK rebuild

**Last Updated:** 2024
