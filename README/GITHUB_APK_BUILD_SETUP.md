# GitHub Actions APK Build & Release Setup

## Overview

This guide explains how to set up and run automated APK builds on GitHub using EAS (Expo Application Services).

---

## Step 1: Create EAS Keystore (One-time setup)

The keystore is needed to sign your APK. You need to set it up in EAS.

### Option A: Let EAS Create It Automatically (EASIEST)

```bash
cd mobile
npx eas login
# Enter your Expo credentials

eas credentials
# Select: android > com.apartmentbilltracker > keystore
# Select: Create new keystore
# Follow the prompts to generate a new one
```

This creates a managed keystore in EAS that GitHub Actions can use automatically.

### Option B: Create Manually

```bash
eas credentials
# Follow the prompts to configure Android credentials
```

---

## Step 2: Get Your Expo Token

GitHub Actions needs an **EXPO_TOKEN** to authenticate with Expo.

1. **Generate token on Expo website:**
   - Go to https://expo.dev/settings/tokens
   - Click "Create new token"
   - Copy the token

2. **Add token to GitHub:**
   - Go to your GitHub repo
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `EXPO_TOKEN`
   - Value: Paste your token
   - Click "Add secret"

---

## Step 3: Verify Configuration Files

### ✅ Check `mobile/eas.json` (Already Updated)

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk",
        "credentialsSource": "eas" // Uses EAS-managed keystore
      }
    }
  }
}
```

### ✅ Check `.github/workflows/build-apk.yml` (Already Updated)

The workflow:

- Checks out code
- Sets up Node.js 18 & Java 17
- Installs dependencies
- Builds APK using EAS
- Downloads the APK
- Creates GitHub Release
- Uploads APK to release

---

## Step 4: Verify GitHub Secrets

✅ Required Secret:

- `EXPO_TOKEN` - Your Expo authentication token

✅ Optional Secrets (already available):

- `GITHUB_TOKEN` - Automatically provided by GitHub

---

## Step 5: Test the Build

### Option A: Trigger from GitHub UI

1. Go to your GitHub repo
2. Click "Actions" tab
3. Click "Build and Release APK" workflow
4. Click "Run workflow"
5. Select branch: `main`
6. Click "Run workflow"

### Option B: Push to Main Branch

```bash
git add .
git commit -m "Build APK"
git push origin main
```

The workflow will trigger automatically!

---

## Step 6: Monitor the Build

1. Go to GitHub repo → Actions tab
2. Click on the running workflow
3. Watch the logs in real-time
4. Once complete, check "Releases" tab for the APK

---

## Troubleshooting

### Error: "EXPO_TOKEN not found"

**Fix:** Add the token to GitHub Secrets (see Step 2)

### Error: "EAS keystore not found"

**Fix:** Run `eas credentials` locally to create/configure keystore:

```bash
cd mobile
npx eas login
eas credentials
# Configure Android credentials
```

### Error: "Build failed: android.keystore"

**Fix:** Your EAS keystore might be misconfigured

```bash
cd mobile
eas credentials
# Select android > Delete credentials
# Then recreate new credentials
```

### APK Not Downloading

**Fix:** The download script might need adjustment. Check workflow logs for the actual build URL.

---

## Build Artifacts

After successful build:

- **Release page:** https://github.com/YourUser/YourRepo/releases
- **APK file:** `app.apk` in the release assets
- **Installation:** Download APK → Send to phone → Install

---

## API Configuration

Your app already uses the deployed Render backend:

- Backend is configured in [mobile/src/config/config.js](../src/config/config.js)
- API calls automatically use production endpoints
- No additional setup needed for releases

---

## Next Steps

1. ✅ Commit these changes
2. ✅ Push to GitHub
3. ✅ Go to Actions tab
4. ✅ Run the workflow manually
5. ✅ Download APK from Releases when done!

---

## Useful Commands

**Check current Expo account:**

```bash
npx eas whoami
```

**View available builds:**

```bash
eas build:list --platform android
```

**Download specific build:**

```bash
eas build:download --platform android --latest
```

**View EAS credentials:**

```bash
eas credentials --scope android
```

---

## Support

If you encounter issues:

1. Check the GitHub Actions logs (Actions tab)
2. Run `npx eas credentials` to verify keystore
3. Ensure EXPO_TOKEN is correctly added to secrets
4. Check that your Expo account has the correct ownership

Good luck! 🚀
