# Apartment Bill Tracker - Mobile App Guide

## Getting Started

### Installation & Running

1. **Install dependencies**:

   ```bash
   cd mobile
   npm install
   ```

2. **Start Expo dev server**:

   ```bash
   npx expo start
   ```

3. **Run on Android/iOS**:
   - **Android**: Press `a` in terminal or scan QR code with Expo Go app
   - **iOS**: Press `i` in terminal or scan QR code with Expo Go app

---

## 🔐 Authentication & Roles

### Login with Client Account

1. **Register** a new account through the Sign Up screen
   - Name, Email, Password
   - Auto-verified for mobile (no email confirmation needed)

2. **Login** with your credentials
   - Automatically routed to Client Dashboard

### 🔓 Login with Admin Account

**To access the Admin side:**

#### Option 1: Create Admin User (Via Backend)

Contact the admin or modify the backend to set `role: "admin"` in the database:

```javascript
// In MongoDB User collection
{
  email: "admin@example.com",
  role: "admin",  // Set this to "admin"
  ...
}
```

#### Option 2: Use Backend Console

1. Start the backend server
2. Login to the web version as an existing admin
3. Create an admin account there
4. Use those credentials in the mobile app

#### Admin Login Process:

1. **Sign Up Screen**: If your account has `role: "admin"` in database, you'll automatically be routed to Admin Dashboard
2. **Login Screen**: Enter admin credentials and you'll see the Admin interface

---

## 📱 App Navigation

### **CLIENT VIEW** (Regular Users)

#### Bottom Tabs:

1. **Home** (House Icon)
   - View joined rooms
   - Browse available rooms
   - Join new rooms
   - Quick stats

2. **Attendance** (Calendar Icon)
   - Mark daily presence
   - Interactive calendar
   - View marked dates
   - Attendance summary

3. **Bills** (Receipt Icon)
   - View billing period
   - See your share of bills
   - Member breakdown
   - Meter readings

4. **Profile** (User Icon)
   - View profile info
   - Account details
   - Logout

---

### **ADMIN VIEW** (Administrators Only)

#### Bottom Tabs:

1. **Dashboard** (Dashboard Icon)
   - Create rooms
   - Select active room
   - Room details
   - Member information

2. **Billing** (Receipt Icon)
   - Set billing periods
   - Configure amounts (rent, electricity)
   - Meter readings
   - Billing summary

3. **Members** (People Icon)
   - Manage room members
   - Assign payers
   - View member details
   - Add/remove members

4. **Profile** (User Icon)
   - Admin profile info
   - Logout

---

## 🎨 Design Features

### Color Scheme:

- **Primary**: Rusty-Gold (#b38604) - Buttons, highlights
- **Background**: White (#fff) - Main surfaces
- **Text**: Dark Gray (#333) - Primary text
- **Accents**: Multiple colors for different features

### Consistent Components:

- **Cards**: Round corners, subtle shadows, clear hierarchy
- **Buttons**: Gold primary, secondary with border
- **Icons**: Material & Ionicons library
- **Typography**: Bold headings, readable body text
- **Spacing**: Consistent 16px padding throughout

---

## 💡 Features Overview

### Client Features:

✅ **Room Management**

- Join available rooms
- View room details and members
- Track active room

✅ **Attendance Tracking**

- Calendar interface
- Mark daily presence
- View attendance summary
- Navigate between months

✅ **Billing Details**

- View total bills (rent, electricity)
- Calculate personal share (for payers)
- See member breakdown
- View meter readings

✅ **Profile Management**

- View account info
- See assigned role
- Logout option

### Admin Features:

✅ **Room Management**

- Create new rooms
- Edit room details
- View all members
- Select active room

✅ **Billing Setup**

- Configure billing periods
- Set rent amount
- Set electricity amount
- Input meter readings

✅ **Member Management**

- View all members
- Assign payer/member roles
- See member details

---

## 🔧 API Endpoints Used

### Authentication

- `POST /api/v2/user/login-user` - Login
- `POST /api/v2/user/register` - Register (simplified, no email verification)
- `GET /api/v2/user/getuser` - Get user profile
- `GET /api/v2/user/logout` - Logout

### Rooms

- `GET /api/v2/rooms` - Get all rooms
- `POST /api/v2/rooms` - Create room (Admin)
- `PUT /api/v2/rooms/:id` - Update room (Admin)
- `DELETE /api/v2/rooms/:id` - Delete room (Admin)

### Members

- `POST /api/v2/rooms/:roomId/members` - Add member
- `GET /api/v2/rooms/:roomId/members` - Get members
- `PUT /api/v2/rooms/:roomId/members/:memberId` - Update member
- `DELETE /api/v2/rooms/:roomId/members/:memberId` - Remove member

### Presence

- `POST /api/v2/rooms/:roomId/presence` - Mark presence
- `GET /api/v2/rooms/:roomId/presence` - Get presence records

### Billing

- `PUT /api/v2/rooms/:roomId/billing` - Update billing
- `GET /api/v2/rooms/:roomId/billing` - Get billing info

---

## 🚀 Developer Notes

### Project Structure:

```
mobile/
├── src/
│   ├── screens/
│   │   ├── auth/           # Login, Register screens
│   │   ├── client/         # Client feature screens
│   │   └── admin/          # Admin feature screens
│   ├── components/         # Reusable components
│   ├── navigation/         # Navigation setup
│   ├── context/            # Auth context
│   ├── services/           # API services
│   └── config/             # Configuration
├── App.js                  # Main app entry
└── index.js               # Index file
```

### Key Technologies:

- **React Native** - Cross-platform mobile UI
- **Expo** - Development & deployment platform
- **React Navigation** - App navigation
- **Axios** - HTTP requests
- **expo-secure-store** - Secure token storage
- **@expo/vector-icons** - Icons
- **react-native-safe-area-context** - Safe area handling

---

## 📝 Testing Checklist

### Client User:

- [ ] Can sign up and login
- [ ] Can browse and join rooms
- [ ] Can mark daily attendance
- [ ] Can view billing details
- [ ] Can see member breakdown
- [ ] Can view profile and logout

### Admin User:

- [ ] Can login as admin
- [ ] Can create rooms
- [ ] Can set billing details
- [ ] Can manage members
- [ ] Can view all room stats
- [ ] Can logout

---

## ⚙️ Configuration

### Backend URL:

Edit `src/config/config.js`:

```javascript
const API_BASE_URL = "http://10.18.100.4:8000";
```

Change to your backend server IP address. Make sure:

- Backend is running on the specified URL
- Phone is on same network as backend
- No firewall blocking the port

---

## 🐛 Troubleshooting

### White Screen

- Check Metro bundler for compilation errors
- Clear app cache: `npm start -- --clear`
- Reload: Press `r` in terminal

### API 404 Errors

- Verify backend is running
- Check API endpoint URLs in `apiService.js`
- Verify backend URL in `config.js`

### Can't Login

- Ensure user exists in backend database
- Check backend logs for errors
- Try creating new user via signup

### Billing Not Showing

- Admin must set billing for room first
- Reload the Bills screen
- Check admin has selected the room

---

## 📞 Support

For issues or questions:

1. Check console logs in Expo Go
2. Verify backend is running
3. Check network connectivity
4. Ensure correct API endpoints
5. Check database for user/room data

---

## 📸 Screenshots & Features Preview

### Client Home

- Greeting with time-based message
- My Room section with stats
- Available rooms to join
- Quick action buttons

### Attendance Calendar

- Interactive month calendar
- Mark/unmark dates
- Color-coded days (today, marked)
- Attendance summary

### Billing Details

- Total bills overview (Rent, Electricity, Total)
- Personal share calculation
- Member breakdown with roles
- Meter readings tracking

### Admin Dashboard

- Room selector
- Create room modal
- Billing setup
- Member management

---

**Happy Tracking! 🎉**
