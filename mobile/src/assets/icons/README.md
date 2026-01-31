# Apartment Bill Tracker - App Icons

Generated: 2026-01-31T03:46:45.952Z

## Icon Sizes

| Density | Size (px) | File |
|---------|-----------|------|
| mdpi | 48×48 | icon-mdpi-48x48.png |
| hdpi | 72×72 | icon-hdpi-72x72.png |
| xhdpi | 96×96 | icon-xhdpi-96x96.png |
| xxhdpi | 144×144 | icon-xxhdpi-144x144.png |
| xxxhdpi | 192×192 | icon-xxxhdpi-192x192.png |

## Usage

### For Expo Development
The main icon is configured in `app.json`:
```json
"icon": "./src/assets/icon.png"
```

### For Android APK Build
Place icons in your Android project:
```
android/app/src/main/res/
├── mipmap-mdpi/
│   └── ic_launcher.png (48×48)
├── mipmap-hdpi/
│   └── ic_launcher.png (72×72)
├── mipmap-xhdpi/
│   └── ic_launcher.png (96×96)
├── mipmap-xxhdpi/
│   └── ic_launcher.png (144×144)
└── mipmap-xxxhdpi/
    └── ic_launcher.png (192×192)
```

## Test on Devices

After generating icons:
1. Clear app cache: `npx expo start --clear`
2. Test on devices with different screen densities
3. Verify clarity at small sizes (home screen, app drawer)

## Notes

- All icons have white background for universal compatibility
- For adaptive icons (Android 12+), consider making the background transparent
- Test at actual device sizes to ensure text clarity
