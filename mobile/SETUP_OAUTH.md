# Social Login Setup Guide

This guide explains how to set up Google and Facebook login on the mobile app.

## ✅ What's Already Done

1. **Backend Endpoints**: Both `/api/v2/user/google-login` and `/api/v2/user/facebook-login` are already implemented
2. **LoginScreen & RegisterScreen**: Updated with Google login UI and handlers
3. **AuthContext**: Added `signInWithGoogle` and `signInWithFacebook` methods
4. **package.json**: Dependencies updated with OAuth packages
5. **API Service**: Added `googleLogin()` and `facebookLogin()` methods

## 📦 Install Dependencies

Run these commands in the `mobile` folder:

```bash
npm install
```

This will install:

- `expo-auth-session` - For OAuth authentication flows
- `expo-web-browser` - For opening OAuth provider websites
- `@react-native-async-storage/async-storage` - For secure storage

## 🔧 Configuration

### Google OAuth ID

The Google Client ID is already configured in both screens:

```
GOOGLE_CLIENT_ID: 606324852974-j342727qvkfesqtn0d9o7n71c42ntunr.apps.googleusercontent.com
```

This is the same ID used in the web project.

## 🚀 How Social Login Works

### Google Login Flow

1. User taps **"Sign in with Google"** button
2. Expo opens Google's OAuth provider in web browser
3. User authenticates with Google account
4. Google redirects back to app with access token
5. App fetches user info (email, name, avatar) from Google API
6. App sends user data to backend's `/api/v2/user/google-login` endpoint
7. Backend creates/updates user and returns token
8. User is logged in and navigated to home

### Facebook Login Flow

Facebook login is currently marked as "Coming Soon" because it requires:

- Facebook App ID configuration
- Deep linking setup for native redirect
- React Native Facebook SDK native modules

To implement Facebook login:

1. Create Facebook App at https://developers.facebook.com
2. Install `react-native-facebook-sdk`
3. Configure native modules in `app.json`
4. Update `RegisterScreen.js` and `LoginScreen.js` with Facebook login handler

## 🔌 API Endpoints

### Google Login

```
POST /api/v2/user/google-login
Body: {
  email: string,
  name: string,
  avatar: string (URL)
}
Response: {
  success: boolean,
  token: string,
  user: { _id, email, name, avatar, ... }
}
```

### Facebook Login

```
POST /api/v2/user/facebook-login
Body: {
  email: string,
  name: string,
  avatar: string (URL),
  facebookId: string,
  accessToken: string
}
Response: {
  success: boolean,
  token: string,
  user: { _id, email, name, avatar, ... }
}
```

## ✨ Features

### Google Login

- ✅ Works with Expo
- ✅ Uses Google OAuth 2.0 implicit flow
- ✅ Fetches user profile automatically
- ✅ Creates user if doesn't exist
- ✅ Returns auth token for subsequent requests

### Email/Password Login

- ✅ Traditional email and password login
- ✅ Account registration with email verification
- ✅ Secure token storage in Expo Secure Store
- ✅ Auto-login on app restart

### Facebook Login

- ⏳ Coming Soon (requires native SDK setup)
- Will use Facebook OAuth 2.0 flow
- Will fetch user profile from Facebook API
- Will create user if doesn't exist

## 🧪 Testing

### Test Google Login

1. Start the mobile app:

   ```bash
   npx expo start
   ```

2. On login screen, tap **"Sign in with Google"**

3. Browser opens and shows Google login

4. Sign in with your Google account

5. Authorize the app

6. Should be redirected back to app and logged in

### Test Email/Password Login

1. Click **Sign Up** on login screen

2. Create an account with email and password

3. Go back to Sign In

4. Login with your credentials

5. Should navigate to home screen

## 🐛 Troubleshooting

### "Google login button disabled"

- Make sure `expo-auth-session` is installed: `npm install expo-auth-session`
- Restart the app: `npx expo start --c`

### "Cannot get access token"

- Make sure you're using the correct Google Client ID
- Check that Google OAuth provider is accessible
- Try logging in on web first to verify backend endpoints work

### "Login successful but not navigated"

- Check that backend endpoint is returning `{ success: true, token, user }`
- Verify token is being saved to secure store
- Check AuthContext is dispatching SIGN_IN action

### "User created but password/avatar not saving"

- Check backend user controller has all fields
- Verify MongoDB connection is working
- Check user model schema includes avatar field

## 📱 Mobile App Flow

```
App Start
  ↓
Check if token exists
  ↓
  ├─ Token found → Restore user & go to Home
  │
  └─ No token → Show Auth Navigator
       ↓
    Login Screen
       ↓
    ├─ Email/Password → /api/v2/user/login-user
    ├─ Google → /api/v2/user/google-login
    └─ Facebook → /api/v2/user/facebook-login (coming soon)
       ↓
    Get token & user
       ↓
    Save token to Secure Store
       ↓
    Navigate to Home
       ↓
    ├─ Home Screen (room browsing)
    ├─ Attendance Screen (mark presence)
    ├─ Bills Screen (view bills)
    └─ Profile Screen (logout)
```

## 🔐 Security Notes

1. **Tokens are stored securely** in Expo Secure Store (encrypted on device)
2. **OAuth never exposes passwords** - uses token-based auth
3. **Backend validates tokens** on each API request
4. **User data is cached locally** but synced with backend
5. **Logout clears token** from secure store and redux state

## 📞 Support

If you encounter issues:

1. Check backend logs: `npm start` in `backend` folder
2. Check mobile logs: `npx expo start` shows logs in terminal
3. Verify API endpoint is accessible: Open in browser
4. Test backend endpoint with Postman
5. Check MongoDB connection is working

## 🎉 Next Steps

1. Install dependencies: `npm install`
2. Test Google login flow
3. Verify backend endpoints work
4. Test with multiple accounts
5. (Optional) Add Facebook login by installing Facebook SDK
