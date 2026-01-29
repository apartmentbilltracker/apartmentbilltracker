# Mobile App - Troubleshooting Guide

## Common Issues & Solutions

### Issue 1: Port 8081 Already in Use

**Error Message**:

```
› Port 8081 is being used by another process
```

**Solutions**:

1. **Accept using port 8082** (recommended)
   - Press `y` when asked
   - The app will use port 8082 instead

2. **Find and kill the process using 8081**

   ```bash
   # On Windows (PowerShell)
   netstat -ano | findstr :8081
   taskkill /PID <PID> /F

   # On Mac/Linux
   lsof -i :8081
   kill -9 <PID>
   ```

3. **Restart npm start**
   ```bash
   npm start
   ```

---

### Issue 2: Can't Connect to Backend API

**Error Message**:

```
Network Error: Network request failed
Failed to fetch from API
```

**Solutions**:

1. **Update API URL** in `src/config/config.js`

   ```javascript
   const API_BASE_URL = "http://10.18.100.4:8000"; // Your backend IP
   ```

   - Use your actual backend server IP
   - Not localhost (use actual IP address)

2. **Check backend is running**

   ```bash
   # In backend folder
   npm start
   ```

3. **Check network connectivity**
   - Ensure phone and computer are on same network
   - Ping the backend IP from terminal

---

### Issue 3: Expo Go App Won't Load

**Error Message**:

```
QR Code not scanning or app crashes
```

**Solutions**:

1. **Reinstall Expo Go app**
   - Uninstall from phone
   - Reinstall from Play Store/App Store

2. **Try manual connection**
   - In Expo Go, tap "Scan QR code"
   - If camera doesn't work, use connection URL
   - Look for "Connection details" in terminal

3. **Check Metro bundler**

   ```bash
   # Restart metro
   npm start
   ```

4. **Clear cache**
   ```bash
   npm start -- --clear
   ```

---

### Issue 4: Login Not Working

**Error Message**:

```
Login failed
Invalid credentials
```

**Solutions**:

1. **Check backend is running**
   - Backend must be running for auth
   - Check backend logs for errors

2. **Verify API URL is correct**
   - In `src/config/config.js`
   - Should match your backend server

3. **Check backend API endpoint**
   - `/user/login` endpoint must exist
   - Must accept email and password

4. **Check user exists in database**
   - Register a test user first
   - Use that email/password to login

---

### Issue 5: Dependencies Error

**Error Message**:

```
Cannot find module...
Module not found: ...
```

**Solutions**:

1. **Reinstall dependencies**

   ```bash
   rm -rf node_modules
   npm install
   ```

2. **Clear npm cache**

   ```bash
   npm cache clean --force
   npm install
   ```

3. **Delete Expo cache**
   ```bash
   rm -rf .expo
   npm start -- --clear
   ```

---

### Issue 6: App Keeps Crashing

**Error Message**:

```
App keeps closing
Red screen of death
```

**Solutions**:

1. **Check console logs**
   - Open Expo Go menu (shake phone or 3-finger tap)
   - Look for error messages

2. **Clear app data**
   - Uninstall Expo Go
   - Reinstall from store
   - Scan QR code again

3. **Restart bundler**

   ```bash
   # In mobile folder
   npm start
   # Press 'r' to reload
   ```

4. **Check for syntax errors**
   - Look at terminal output for errors
   - Fix any JavaScript errors

---

### Issue 7: Token/Authentication Issues

**Error Message**:

```
Unauthorized (401)
Token expired
Access denied
```

**Solutions**:

1. **Clear app storage**
   - Log out first
   - Uninstall and reinstall app
   - Log in again

2. **Check token storage**
   - Ensure expo-secure-store is working
   - Try clearing and relogging

3. **Verify backend token endpoint**
   - Backend must return valid JWT
   - Token must be in response.data.token

---

### Issue 8: Slow Performance

**Error Message**:

```
App is slow
Buttons lag
Navigation is sluggish
```

**Solutions**:

1. **Clear cache and restart**

   ```bash
   npm start -- --clear
   ```

2. **Close other apps**
   - Free up device memory
   - Close browser tabs

3. **Check network**
   - Slow API calls slow the app
   - Check backend is responding quickly

4. **Check device specs**
   - App works better on newer phones
   - Older phones may be slow

---

## Debugging Tips

### 1. **View Console Logs**

```bash
# In Expo Go app on phone:
- Shake device (or 3-finger tap)
- Select "View logs"
- See real-time console output
```

### 2. **Check Terminal Output**

```bash
# Terminal shows:
- Bundler status
- Module loading
- Error messages
- API calls (if logged)
```

### 3. **Use React Native Debugger**

```bash
# Optional: Install React Native Debugger
# Then inspect app state and props
```

### 4. **Test API Manually**

```bash
# Use Postman or curl
curl http://10.18.100.4:8000/rooms

# Should return:
{"rooms": [...]}
```

---

## Quick Reference

### Common Commands

```bash
# Start development server
npm start

# Force reload app
npm start -- --clear

# Reinstall dependencies
npm install

# Check for errors
npm test
```

### File Locations

```
- API Config: src/config/config.js
- API Service: src/services/apiService.js
- Auth Logic: src/context/AuthContext.js
- Main App: App.js
- Entry Point: index.js
```

### Important Ports

- **8081**: Metro bundler default port
- **8000**: Default backend API port (example)
- **19000**: Expo tunnel port (if used)

---

## Getting Help

If you're still stuck:

1. **Check the console logs** (Shake device)
2. **Review terminal output** (npm start terminal)
3. **Check all URLs** (backend IP in config.js)
4. **Restart everything** (npm start, clear cache, reinstall)
5. **Check backend** (Make sure it's running)

---

## Prevention Tips

✅ **Best Practices**:

- Always restart bundler when changing files
- Keep dependencies updated
- Clear cache regularly
- Use actual IP (not localhost)
- Keep backend running during testing
- Save API responses for debugging

---

**Remember**: Most issues are solved by:

1. Restarting Metro bundler (`npm start`)
2. Clearing cache (`npm start -- --clear`)
3. Reinstalling dependencies (`npm install`)
4. Checking API configuration (`src/config/config.js`)

Good luck! 🚀
