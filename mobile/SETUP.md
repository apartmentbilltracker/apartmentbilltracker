# Apartment Bill Tracker Mobile App Setup Guide

## Overview

This is a fully functional React Native + Expo Go mobile application for the apartment billing tracker system. The app works with the existing backend API and provides separate client and admin interfaces.

## Quick Start

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure API URL

Edit `src/config/config.js` and update the API base URL to match your backend server:

```javascript
const API_BASE_URL = "http://192.168.1.100:4000"; // Change to your server IP
```

### 3. Start the App

```bash
npm start
```

### 4. Run on Device

- **Android**: Download Expo Go from Play Store, scan the QR code
- **iOS**: Download Expo Go from App Store, scan the QR code

## Project Highlights

### Folder Structure

- `src/screens/auth/` - Login and Registration
- `src/screens/client/` - Client-side screens (Home, Presence, Bills, Profile)
- `src/screens/admin/` - Admin-side screens (Dashboard, Rooms, Billing, Members, Profile)
- `src/navigation/` - Navigation structure with role-based routing
- `src/services/` - API integration layer
- `src/context/` - Authentication context with secure token storage

### Key Features

1. **Secure Authentication** - JWT tokens stored in secure storage
2. **Role-Based Navigation** - Different UI for clients vs admins
3. **Real-Time Data** - Fetch updates from backend API
4. **Offline Support** - Fallback to cached data if network fails
5. **Responsive Design** - Works on all screen sizes

### Client Features

- View assigned rooms
- Mark daily presence
- View billing (water, electricity, rent)
- Manage profile

### Admin Features

- Dashboard with statistics
- Room creation and management
- Member management (add/remove/toggle payer status)
- Billing configuration (dates, rates, readings)
- Profile management

## API Integration Notes

The app uses axios with automatic token injection. All requests include the JWT token from secure storage.

### Backend Compatibility

- Works with existing backend API
- Requires all endpoints to accept and return JSON
- Supports CORS

## Development Tips

1. **Debugging**: Use Expo DevTools in the app menu
2. **Network**: Use local IP (192.168.x.x) not localhost
3. **Hot Reload**: Changes auto-reload in Expo Go
4. **Testing**: Test on actual Android device for best results

## Building APK

For production Android APK:

```bash
npm install -g eas-cli
eas build --platform android
```

## Troubleshooting

### "Can't reach API"

- Check backend is running
- Verify IP in config.js
- Check firewall settings

### "Login fails"

- Check credentials in backend
- Review API error messages
- Check network connectivity

### "App crashes"

- Check console logs in Expo Go
- Verify all dependencies installed
- Restart dev server

## Next Steps

1. Test with real backend server
2. Add splash/icon images to `src/assets/`
3. Customize colors and branding
4. Add error handling and validation
5. Build APK for distribution

For more info, see [README.md](./README.md)
