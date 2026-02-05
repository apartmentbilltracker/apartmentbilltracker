# 🚀 GitHub Actions - Automatic APK Build Setup

## Step-by-Step Setup (5 minutes)

### Step 1: Generate EAS Token

1. Go to: https://expo.dev/settings/tokens
2. Click "Create Token"
3. Name it: `github-actions-build`
4. Copy the token (save it somewhere safe!)

### Step 2: Add Token to GitHub Secrets

1. Go to your GitHub repo: https://github.com/demo122500/AparmentBillTracker
2. Click **Settings** (top right)
3. Left menu: **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Name: `EAS_TOKEN`
6. Value: Paste the token you copied
7. Click **Add secret**

### Step 3: Trigger the Build

**Option A (Automatic):**

- Just push code to `main` branch
- GitHub Actions will automatically build

**Option B (Manual):**

1. Go to **Actions** tab
2. Select **Build and Release APK**
3. Click **Run workflow**
4. Choose `main` branch
5. Click **Run workflow**

### Step 4: Download APK

1. After ~15-20 minutes, go to **Releases** page
2. Download the `.apk` file
3. Share the link with your siblings!

---

## 📥 What Your Siblings Need To Do

### To Install the APK:

1. Download `ApartmentBillTracker-X.apk` from releases
2. Transfer to Android phone (via email, messaging app, etc.)
3. Open **Files** app on phone
4. Find the APK file
5. Tap it → **Install**
6. If prompted: Allow unknown sources (in Settings)
7. Done! App is ready to use

---

## ✅ Automated Workflow

After setup, here's what happens automatically:

```
Push to GitHub (main branch)
        ↓
GitHub Actions triggered
        ↓
Install dependencies
        ↓
Build APK with EAS Cloud
        ↓
Download built APK
        ↓
Create GitHub Release
        ↓
Upload APK to Release
        ↓
✅ Ready for download!
```

**Time:** Usually 15-20 minutes

---

## 🔗 Useful Links

- **Repository:** https://github.com/demo122500/AparmentBillTracker
- **Releases:** https://github.com/demo122500/AparmentBillTracker/releases
- **Actions:** https://github.com/demo122500/AparmentBillTracker/actions
- **EAS Dashboard:** https://expo.dev/accounts/demoacct/projects/apartment-bill-tracker

---

## ⚠️ Troubleshooting

**Build Failed?**

- Check EAS token is correct in GitHub Secrets
- Check your phone has internet connection
- Check backend API URL is correct in `mobile/src/config/config.js`

**APK Won't Install?**

- Allow installation from unknown sources in Android Settings
- Try clearing cache: Settings → Apps → Files → Storage → Clear Cache

**Need Help?**

- Check GitHub Actions logs: Go to **Actions** tab, click the failed workflow

---

**Next Step:** Follow the 5-minute setup above! 🚀
