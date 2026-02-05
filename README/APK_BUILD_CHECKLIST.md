# 🚀 APK Build Checklist

## Pre-Build Checklist (Do This Once)

- [ ] Have Expo account (https://expo.dev)
- [ ] Run: `npx eas login`
- [ ] Run: `eas credentials` (create keystore)
- [ ] Get EXPO_TOKEN from https://expo.dev/settings/tokens
- [ ] Add `EXPO_TOKEN` to GitHub Secrets (Settings → Secrets)
- [ ] Verify `mobile/eas.json` has `credentialsSource: "eas"`

## Build Checklist (Before Each Release)

- [ ] Test app locally: `npx expo start`
- [ ] Verify API connection works
- [ ] Commit changes: `git commit -am "..."`
- [ ] Push to main: `git push origin main`
- [ ] Go to Actions tab on GitHub
- [ ] Watch build progress
- [ ] Download APK from Releases

## Distribution Checklist

- [ ] Download APK from GitHub Releases
- [ ] Share APK with users (email, drive, etc)
- [ ] Create installation instructions
- [ ] Get feedback from testers

## Troubleshooting Quick Links

| Problem                 | Solution                           |
| ----------------------- | ---------------------------------- |
| Build fails immediately | Check EXPO_TOKEN in GitHub Secrets |
| "Keystore not found"    | Run `eas credentials` locally      |
| APK won't install       | Check Android version requirements |
| API not working         | Verify Render backend is running   |
| App won't start         | Check config.js API base URL       |

## Commands Reference

```bash
# Login
npx eas login

# Create/Update keystore
eas credentials

# Build locally
eas build --platform android --profile preview

# View builds
eas build:list --platform android

# Check account
npx eas whoami
```

## Status Check

Current Version: 1.0.0
API Backend: https://apartment-bill-tracker-backend.onrender.com
App ID: com.apartmentbilltracker
Bundle: com.apartmentbilltracker.android

## Notes

- EAS free tier: ~30 builds/month
- Build time: ~10-15 minutes
- APK size: ~50-80 MB
- Min Android: Check app.json
- Target Android: Latest
