# Apartment Bill Tracker - Mobile App Setup Guide for Testing

## Quick Setup for Your Siblings

Since building the APK requires additional setup, here are the EASIEST ways to test the app:

### **Option 1: EASIEST - Use Expo Go (Recommended for Quick Testing)**

1. **On each phone:**
   - Download "Expo Go" app from Google Play Store (free)
   - Open it

2. **To share your app:**
   - On your computer, in the mobile folder, run:
   ```bash
   npx expo start
   ```

   - You'll see a QR code in the terminal
   - Your siblings scan the QR code with Expo Go
   - The app loads instantly!

**Pros:** Instant, no installation needed, hot reload
**Cons:** Requires Expo Go app, only works while dev server is running

---

### **Option 2: Build APK Locally (More Complex)**

If you want to build a standalone APK:

```bash
# Install build tools
npm install -g eas-cli

# From mobile folder, run:
eas build --platform android --local
```

**Requirements:**

- Java Development Kit (JDK)
- Android SDK
- ~30 minutes build time

---

### **Option 3: Use Web Version First**

Before building APK, test the web version:

```bash
# From frontend folder
npm run dev
```

Share the web link with your siblings to test features first.

---

## Testing Checklist

### Admin Account Testing:

- [ ] Login/Signup with email
- [ ] View Dashboard with room stats
- [ ] View, create, edit, delete Rooms
- [ ] View, add, delete Members
- [ ] View and manage Billing
- [ ] Check water bill calculations (₱5/day × presence days)
- [ ] View attendance calendar
- [ ] View reports and export

### Client Account Testing:

- [ ] Login/Signup
- [ ] View room details
- [ ] Check presence marking
- [ ] View bills
- [ ] Update profile

---

## Current Status

✅ **Backend:** Deployed on Render.com
✅ **API Endpoints:** All working
✅ **Frontend:** Web version complete
✅ **Mobile:** All screens ready
✅ **Developer Footer:** Added to auth screens

**API Base URL:** Your Render.com URL (configured in config.js)

---

## Feedback for Improvement

When testing, please note:

- Any crashes or errors
- UI/UX suggestions
- Missing features
- Performance issues

---

## Contact

Developed by: **Rommel Belia**
