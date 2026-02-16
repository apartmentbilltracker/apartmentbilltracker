# Mobile App - Quick Reference

## Installation (30 seconds)

```bash
cd mobile
npm install
```

## Configuration (1 minute)

Edit `mobile/src/config/config.js`:

```javascript
const API_BASE_URL = "http://192.168.1.100:4000"; // Your backend IP
```

## Start App (5 seconds)

```bash
npm start
```

## Run on Phone

1. Download Expo Go app
2. Scan QR code
3. App appears on your phone

---

## File Structure at a Glance

```
mobile/
├── App.js                      # Entry point
├── package.json               # Dependencies
├── src/
│   ├── screens/              # All screen components
│   │   ├── auth/            # Login, Register
│   │   ├── client/          # Client screens (4)
│   │   └── admin/           # Admin screens (5)
│   ├── navigation/           # Navigation setup
│   ├── services/             # API calls
│   ├── context/              # Auth logic
│   ├── config/               # Configuration
│   └── utils/                # Helper functions
```

---

## Key Files to Know

| File                              | Purpose               |
| --------------------------------- | --------------------- |
| `src/config/config.js`            | API URL configuration |
| `src/context/AuthContext.js`      | Login/logout logic    |
| `src/services/apiService.js`      | All API endpoints     |
| `src/screens/auth/LoginScreen.js` | Login interface       |
| `src/screens/client/*`            | Client features       |
| `src/screens/admin/*`             | Admin features        |

---

## Common Commands

```bash
# Install dependencies
npm install

# Start development server
npm start

# Start and run on Android
npm run android

# Start and run on iOS
npm run ios

# Start and run on web (for testing)
npm run web
```

---

## Screens Summary

### Client (4 screens)

1. **Home** - View rooms
2. **Presence** - Mark attendance
3. **Bills** - See water/electricity/rent
4. **Profile** - Account settings

### Admin (5 screens)

1. **Dashboard** - Statistics overview
2. **Rooms** - Create/manage rooms
3. **Billing** - Set billing dates & amounts
4. **Members** - Add/remove members
5. **Profile** - Account settings

---

## API Endpoints (All Integrated)

```
Authentication:
  POST /user/register
  POST /user/login
  GET /user/profile
  POST /user/logout

Rooms:
  GET /rooms
  POST /rooms
  GET /rooms/:id
  PUT /rooms/:id
  DELETE /rooms/:id

Presence:
  POST /rooms/:id/presence
  GET /rooms/:id/presence

Billing:
  PUT /rooms/:id/billing
  GET /rooms/:id/billing

Members:
  POST /rooms/:id/members
  PUT /rooms/:id/members/:memberId
  DELETE /rooms/:id/members/:memberId
```

---

## Troubleshooting Quick Fixes

| Problem              | Fix                                      |
| -------------------- | ---------------------------------------- |
| Can't connect to API | Change IP in `src/config/config.js`      |
| Login fails          | Check backend is running                 |
| QR code won't scan   | Try typing connection string manually    |
| Dependency error     | Delete `node_modules`, run `npm install` |
| Port 8081 taken      | Run `npm start -- --port 8082`           |

---

## Next Steps

1. ✅ Dependencies installed
2. ✅ API configured
3. ✅ App running
4. → Test login
5. → Try all features
6. → Build APK for distribution

---

**Need Help?** See [README.md](./mobile/README.md) or [SETUP.md](./mobile/SETUP.md)
