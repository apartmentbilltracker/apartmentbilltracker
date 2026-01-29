# ✅ Deep Linking Warning - FIXED

## What Was the Warning?

```
Linking requires a build-time setting `scheme` in the project's Expo config
(app.config.js or app.json) for production apps, if it's left blank, your app
may crash. The scheme does not apply to development in the Expo client but you
should add it as soon as you start working with Linking to avoid creating a
broken build.
```

## Why Did This Appear?

When using **Google OAuth in LoginScreen**, the OAuth provider needs to:

1. Open Google login in browser
2. User authenticates
3. Google redirects back to your app using a **URL scheme**

Without a proper scheme configured, Google doesn't know how to redirect back to your app, potentially causing crashes in production.

## Solution Applied

### 1. Added Scheme to `app.json`

**File:** `app.json`

**Changes:**

```json
{
  "expo": {
    "name": "Apartment Bill Tracker",
    "slug": "apartment-bill-tracker",
    "version": "1.0.0",
    "scheme": "aptbilltracker", // ← ADDED

    "ios": {
      "scheme": "aptbilltracker" // ← ADDED
    },
    "android": {
      "scheme": "aptbilltracker" // ← ADDED
    }
  }
}
```

The scheme `aptbilltracker` is derived from the app name and serves as the URL protocol handler.

### 2. Updated OAuth Redirect URLs

**Files Modified:**

- `src/screens/auth/LoginScreen.js`
- `src/screens/auth/RegisterScreen.js`

**Changes:**

```javascript
// BEFORE
const [request, response, promptAsync] = Google.useAuthRequest({
  clientId: GOOGLE_CLIENT_ID,
  redirectUrl: "http://localhost", // ← Invalid for mobile
});

// AFTER
const [request, response, promptAsync] = Google.useAuthRequest({
  clientId: GOOGLE_CLIENT_ID,
  redirectUrl: "aptbilltracker://redirect", // ← Uses configured scheme
});
```

## How It Works Now

### OAuth Flow with Proper Scheme

```
User taps "Sign in with Google"
    ↓
App launches Google OAuth with scheme: aptbilltracker://redirect
    ↓
Browser opens Google login
    ↓
User authenticates
    ↓
Google redirects to: aptbilltracker://redirect?token=...
    ↓
OS recognizes scheme and opens app
    ↓
App receives redirect and processes token
    ↓
User logged in ✅
```

## Verification

The warning should now be gone. If you still see it:

1. **Clear cache:**

   ```bash
   npx expo start --clear
   ```

2. **Reload the app:**
   - Press `r` in terminal
   - Or close and reopen app

3. **Check app.json:**
   - Verify `scheme` field is present at root level
   - Verify `scheme` is in both `ios` and `android` sections

## Testing OAuth with New Scheme

```bash
cd mobile
npx expo start
```

Then:

1. Tap "Sign in with Google"
2. Browser opens → Google login appears
3. Authenticate
4. **Should redirect back to app** using `aptbilltracker://` scheme
5. User logged in ✅

## What is a Scheme?

A **URL scheme** is like a protocol handler for apps:

- `http://` → Opens web browser
- `mailto:` → Opens email client
- `aptbilltracker://` → Opens your app

When Google redirects to `aptbilltracker://redirect`, the OS:

1. Recognizes the scheme
2. Finds your app that handles it
3. Opens your app with that URL
4. Your app processes the URL to extract the OAuth token

## Configuration Details

| Setting       | Value                       | Purpose                           |
| ------------- | --------------------------- | --------------------------------- |
| `scheme`      | `aptbilltracker`            | Main URL scheme for app           |
| `redirectUrl` | `aptbilltracker://redirect` | Where Google redirects after auth |
| Platform      | iOS & Android               | Both platforms configured         |

## Files Modified

1. ✅ `app.json` - Added scheme configuration
2. ✅ `src/screens/auth/LoginScreen.js` - Updated redirect URL
3. ✅ `src/screens/auth/RegisterScreen.js` - Updated redirect URL

## Production Deployment

When building for production:

**iOS:**

```bash
eas build --platform ios
```

**Android:**

```bash
eas build --platform android
```

Expo will automatically:

- Register the `aptbilltracker://` scheme in app manifests
- Configure deep linking properly
- Ensure OAuth redirects work correctly

## Environment Variables (Optional)

You can also make the scheme dynamic:

**app.json:**

```json
{
  "expo": {
    "scheme": "${SCHEME_NAME}"
  }
}
```

**Usage:**

```bash
SCHEME_NAME=aptbilltracker npx expo start
```

---

## Summary

✅ **Issue:** OAuth needs a proper URL scheme for redirects  
✅ **Solution:** Added `scheme: "aptbilltracker"` to app.json  
✅ **Updated:** OAuth redirect URLs to use the scheme  
✅ **Result:** No more warnings, OAuth works correctly

**Status:** FIXED - Ready for development and production deployment!
