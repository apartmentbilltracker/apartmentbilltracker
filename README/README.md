# Apartment Bill Tracker - Mobile App

A React Native Expo application for tracking apartment bills, presence, and member management.

## Features

### For Clients

- **Login/Registration**: Secure authentication
- **Presence Tracking**: Mark daily presence
- **View Bills**: Water, electricity, and rent bill tracking
- **Profile Management**: View and manage account

### For Admins

- **Dashboard**: Overview of all rooms and members
- **Room Management**: Create and manage rooms
- **Billing Management**: Set billing periods and amounts
- **Member Management**: Add/remove members, toggle payer status
- **Profile Management**: Account settings

## Project Structure

```
mobile/
├── App.js                          # Entry point
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── babel.config.js                 # Babel configuration
├── src/
│   ├── assets/                     # Images and icons
│   ├── components/                 # Reusable components
│   ├── config/
│   │   └── config.js              # API configuration
│   ├── context/
│   │   └── AuthContext.js         # Authentication context
│   ├── navigation/
│   │   ├── RootNavigator.js       # Root navigation
│   │   ├── ClientNavigator.js     # Client bottom tabs
│   │   └── AdminNavigator.js      # Admin bottom tabs
│   ├── screens/
│   │   ├── SplashScreen.js        # Loading screen
│   │   ├── auth/
│   │   │   ├── LoginScreen.js
│   │   │   └── RegisterScreen.js
│   │   ├── client/
│   │   │   ├── ClientHomeScreen.js
│   │   │   ├── PresenceScreen.js
│   │   │   ├── BillsScreen.js
│   │   │   └── ProfileScreen.js
│   │   └── admin/
│   │       ├── AdminDashboardScreen.js
│   │       ├── AdminRoomManagementScreen.js
│   │       ├── AdminBillingScreen.js
│   │       ├── AdminMembersScreen.js
│   │       └── AdminProfileScreen.js
│   ├── services/
│   │   ├── api.js                 # Axios instance
│   │   └── apiService.js          # API endpoints
│   └── utils/                     # Utility functions
```

## Installation

1. **Navigate to mobile folder**

   ```bash
   cd mobile
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Update API Configuration**
   - Open `src/config/config.js`
   - Update `API_BASE_URL` with your backend server URL
   ```javascript
   const API_BASE_URL = "http://YOUR_IP:4000";
   ```

## Running the App

### Start Expo Development Server

```bash
npm start
```

### Run on Android (via Expo Go)

1. Download Expo Go from Google Play Store
2. Scan the QR code from the terminal
3. App will load on your Android device

### Run on iOS (via Expo Go)

1. Download Expo Go from Apple App Store
2. Scan the QR code from the terminal
3. App will load on your iOS device

### Build Android APK (Advanced)

```bash
npm install -g eas-cli
eas build --platform android
```

## API Integration

The app connects to the existing backend server. Ensure:

- Backend server is running on the configured URL
- All API endpoints are accessible
- CORS is properly configured on backend

### Available API Endpoints

**Authentication**

- `POST /user/register` - Register new user
- `POST /user/login` - Login user
- `GET /user/profile` - Get user profile
- `POST /user/logout` - Logout user

**Rooms**

- `GET /rooms` - Get all rooms
- `POST /rooms` - Create new room
- `GET /rooms/:id` - Get room details
- `PUT /rooms/:id` - Update room
- `DELETE /rooms/:id` - Delete room

**Presence**

- `POST /rooms/:id/presence` - Mark presence
- `GET /rooms/:id/presence` - Get presence data

**Billing**

- `PUT /rooms/:id/billing` - Save billing information
- `GET /rooms/:id/billing` - Get billing data

**Members**

- `POST /rooms/:id/members` - Add member
- `PUT /rooms/:id/members/:memberId` - Update member
- `DELETE /rooms/:id/members/:memberId` - Delete member

## Configuration

### API Base URL

Update the API base URL in `src/config/config.js`:

```javascript
const API_BASE_URL = "http://192.168.1.100:4000"; // Your backend URL
```

### Authentication Token

Tokens are stored securely using `expo-secure-store`. Token is automatically included in all API requests via axios interceptors.

## Dependencies

- **react-navigation**: Navigation between screens
- **axios**: HTTP client for API requests
- **expo-secure-store**: Secure token storage
- **react-native-toast-notifications**: Toast notifications
- **expo**: Expo framework and tools

## Troubleshooting

### Can't connect to API

- Check backend server is running
- Verify IP address in config matches backend server
- Check network connectivity
- Ensure backend CORS is configured

### Login fails

- Verify user credentials in backend
- Check API endpoint responses
- Review backend logs for errors

### Expo Go QR code not scanning

- Ensure good lighting
- Check camera permissions
- Try typing connection string manually

## Features To-Do

- [ ] Offline support with local storage
- [ ] Push notifications for billing
- [ ] Photo attachments for bills
- [ ] Monthly analytics charts
- [ ] Export bill reports as PDF
- [ ] Dark mode theme
- [ ] Multi-language support

## Development Notes

- Use React Native instead of web APIs
- Test on both iOS and Android devices
- Check console logs in Expo Go for debugging
- Use Expo Go for development, build APK/IPA for production

## License

Private Project

## Support

For issues and support, contact the development team.
