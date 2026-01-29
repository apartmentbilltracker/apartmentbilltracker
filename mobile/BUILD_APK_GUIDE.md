# How to Build & Share APK for Testing

Your app is almost ready! Here are **2 EASIEST ways** to get the APK:

---

## **Option 1: USE EXPO CLOUD BUILD (EASIEST - 10 minutes)**

### Prerequisites:
- Expo account (free at https://expo.dev)
- That's it!

### Steps:

1. **Sign up for Expo (if you don't have an account)**
   - Go to https://expo.dev/signup
   - Create FREE account

2. **Login to Expo in your terminal**
   ```bash
   cd mobile
   npx eas login
   # Enter your email and password
   ```

3. **Build the APK on Expo Cloud (FREE)**
   ```bash
   eas build --platform android --profile preview
   ```

4. **Wait for build to complete** (~10-15 minutes)
   - You'll get a link to download the APK
   - Download it to your computer

5. **Share the APK with friends**
   - Email the file
   - Use Google Drive/Dropbox
   - Use WeTransfer
   - Or upload to GitHub Releases

---

## **Option 2: BUILD LOCALLY (Requires Java & Android SDK)**

### Prerequisites (If not installed):
1. **Install Java JDK 11 or higher**
   - Download from: https://www.oracle.com/java/technologies/javase-jdk11-downloads.html
   - Set `JAVA_HOME` environment variable

2. **Install Android SDK**
   - Download Android Studio from: https://developer.android.com/studio
   - Or install just Android SDK tools

### Steps:
```bash
cd mobile/android
./gradlew assembleDebug
```

The APK will be at:
```
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## **RECOMMENDED: Option 1 (Expo Cloud)**

**Why?**
- ✅ No Java/SDK installation needed
- ✅ Works on any computer
- ✅ Takes ~10 minutes
- ✅ FREE for up to 30 builds/month
- ✅ Cloud builds are more reliable

---

## **How to Share APK with Friends**

### Option A: Email
- Attach the APK file
- Send to your friends

### Option B: Google Drive
1. Upload APK to Google Drive
2. Share the link with friends
3. Friends download and open

### Option C: GitHub Releases (Professional)
1. Go to your GitHub repo
2. Click "Releases" 
3. Create new release
4. Upload APK file
5. Share release link

### Option D: Direct Download
Upload to any file hosting:
- Dropbox
- OneDrive
- WeTransfer
- Mega
- SendSpace

---

## **How Friends Install the APK**

1. **Download the APK file**
2. **Open file manager** on their Android phone
3. **Find the APK file** (usually in Downloads)
4. **Tap the APK**
5. **Allow installation** from unknown sources (if prompted)
6. **Install**
7. **Open app** from home screen or app drawer

---

## **Recommended for You RIGHT NOW:**

**Run this command:**
```bash
cd mobile
npx eas login
eas build --platform android --profile preview
```

Then wait ~10-15 minutes for the build to complete. You'll get a download link!

---

## **Troubleshooting**

### If `eas` command not found:
```bash
npm install -g eas-cli
```

### If build fails:
- Check your app.json is valid
- Ensure all code is committed to git
- Check internet connection
- Try again

### If friends can't install:
- Make sure they allow "Unknown Sources" in Settings → Security
- Try sharing via Google Drive instead
- Check APK is not corrupted (compare file size)

---

## **Next Steps After Testing**

Once friends test and approve:
1. Create GitHub Release with APK
2. Share the release link publicly
3. Friends can download anytime
4. Update APK when you have new features
5. Eventually: Publish to Google Play Store

---

**Questions?** Check Expo docs: https://docs.expo.dev/build/
