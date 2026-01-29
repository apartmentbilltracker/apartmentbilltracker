# APK Build & Release - Complete Setup Summary

## What Was Fixed ✅

### 1. **EAS Configuration (`mobile/eas.json`)**

- Changed from `"credentialsSource": "local"` to `"credentialsSource": "eas"`
- This allows GitHub Actions to use EAS-managed keystore (no local credentials needed)
- Added `releaseChannel` for better release tracking

### 2. **GitHub Actions Workflow (`.github/workflows/build-apk.yml`)**

- ✅ Fixed APK download logic using `eas build:list` with curl
- ✅ Replaced deprecated `actions/create-release` with `softprops/action-gh-release`
- ✅ Fixed tag naming to avoid shell variable expansion errors
- ✅ Improved APK download error handling

### 3. **New Setup Guide**

- Created `mobile/GITHUB_APK_BUILD_SETUP.md` with step-by-step instructions

---

## What You Need To Do (3 Simple Steps)

### Step 1: Create EAS Keystore (5 minutes) 🔑

Run this locally once:

```bash
cd mobile
npx eas login
# Enter your Expo account credentials (create free account if needed)

eas credentials
# Select: android > com.apartmentbilltracker > keystore
# Select: Create new keystore
# Follow the prompts
```

This creates a **managed keystore in EAS cloud** that GitHub Actions can use automatically.

### Step 2: Add EXPO_TOKEN to GitHub (2 minutes) 🔐

1. Get your token:
   - Visit https://expo.dev/settings/tokens
   - Click "Create new token"
   - Copy the token

2. Add to GitHub:
   - Go to your repo → Settings → Secrets and variables → Actions
   - New repository secret
   - Name: `EXPO_TOKEN`
   - Value: Paste the token
   - Save

### Step 3: Push Changes & Test (5 minutes) 🚀

```bash
git add .
git commit -m "Configure GitHub Actions APK build with EAS keystore"
git push origin main
```

Then go to GitHub Actions and trigger the build manually!

---

## How to Build & Release APK

### Option A: Automatic Build on Push

1. Make any commit to `main` branch
2. Workflow triggers automatically
3. APK appears in Releases in ~15 minutes

### Option B: Manual Trigger from GitHub

1. Go to repo → Actions tab
2. Click "Build and Release APK"
3. Click "Run workflow"
4. Select `main` branch
5. Click "Run workflow"
6. Wait for build (~15 mins)
7. Download from Releases tab

### Option C: Manual Build Locally

```bash
cd mobile
npx eas login
eas build --platform android --profile preview
# Get APK download link when done
```

---

## File Changes Summary

| File                               | Change                                | Why                                                |
| ---------------------------------- | ------------------------------------- | -------------------------------------------------- |
| `.github/workflows/build-apk.yml`  | Updated build & release steps         | Use modern GitHub Actions API, fix EAS integration |
| `mobile/eas.json`                  | Changed to `credentialsSource: "eas"` | Use cloud keystore instead of local                |
| `mobile/GITHUB_APK_BUILD_SETUP.md` | Created new                           | Complete setup guide                               |

---

## Your Current Setup

✅ **Backend:** Render.com deployment (already configured)
✅ **Mobile App:** Expo managed workflow (ready to build)
✅ **API Base URL:** Points to deployed backend (no changes needed)
✅ **Keystore:** Will be created in EAS (Step 1 above)
✅ **Auth:** EXPO_TOKEN secret (Step 2 above)

---

## Quick FAQ

**Q: Do I need to install Java/Android SDK?**
A: No! EAS cloud build handles everything. No local setup needed.

**Q: How often can I build?**
A: Expo free tier: ~30 builds/month. More than enough for development.

**Q: Can my users install the APK?**
A: Yes! Download from GitHub Releases and share the APK file directly.

**Q: Is the keystore secure?**
A: Yes! EAS manages it securely. GitHub never sees your actual keys.

**Q: Will the app work offline?**
A: No, it needs the backend API. But that's expected for a bill tracking app.

---

## Next Commands to Run

```bash
# 1. Login to Expo
cd mobile
npx eas login

# 2. Create EAS Keystore
eas credentials

# 3. Commit changes
cd ..
git add .
git commit -m "Configure EAS keystore and GitHub Actions APK build"
git push origin main

# 4. Go to GitHub Actions and trigger build manually
# (Or just push a commit to main)
```

---

## Build Status

After setup, you can check build status with:

```bash
eas build:list --platform android
```

---

## Support Resources

- **Expo Docs:** https://docs.expo.dev/build/setup/
- **EAS Build:** https://docs.expo.dev/build/introduction/
- **GitHub Actions:** https://docs.github.com/en/actions

---

**You're all set!** Once you complete Step 1 and Step 2 above, your APK builds will be fully automated. 🎉
