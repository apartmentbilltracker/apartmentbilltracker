#!/usr/bin/env node

/**
 * Icon Generator for Android
 * Generates all required Android icon sizes from a source image
 *
 * Usage: node generate-icons.js <source-image-path>
 * Example: node generate-icons.js ./new-icon.png
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// Define all required Android icon sizes (in dp)
const ICON_SIZES = {
  mdpi: 48, // 160 dpi
  hdpi: 72, // 240 dpi
  xhdpi: 96, // 320 dpi
  xxhdpi: 144, // 480 dpi
  xxxhdpi: 192, // 640 dpi
};

// Get source image from command line arguments
const sourceImage = process.argv[2] || "./src/assets/icon.png";

if (!fs.existsSync(sourceImage)) {
  console.error(`❌ Source image not found: ${sourceImage}`);
  console.error("Usage: node generate-icons.js <path-to-icon.png>");
  process.exit(1);
}

console.log("🎨 PropFlow - Icon Generator");
console.log("==========================================");
console.log(`📁 Source: ${sourceImage}`);
console.log("");

// Create output directory if it doesn't exist
const outputDir = "./src/assets/icons";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`✅ Created output directory: ${outputDir}`);
}

// Generate all sizes
async function generateIcons() {
  try {
    for (const [density, size] of Object.entries(ICON_SIZES)) {
      const outputPath = path.join(
        outputDir,
        `icon-${density}-${size}x${size}.png`,
      );

      console.log(`⏳ Generating ${density} (${size}×${size})...`);

      await sharp(sourceImage)
        .resize(size, size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 }, // White background
        })
        .png()
        .toFile(outputPath);

      console.log(`   ✅ Created: ${outputPath}`);
    }

    // Create a summary file
    const summaryPath = path.join(outputDir, "README.md");
    const summary = `# PropFlow - App Icons

Generated: ${new Date().toISOString()}

## Icon Sizes

| Density | Size (px) | File |
|---------|-----------|------|
${Object.entries(ICON_SIZES)
  .map(
    ([density, size]) =>
      `| ${density} | ${size}×${size} | icon-${density}-${size}x${size}.png |`,
  )
  .join("\n")}

## Usage

### For Expo Development
The main icon is configured in \`app.json\`:
\`\`\`json
"icon": "./src/assets/icon.png"
\`\`\`

### For Android APK Build
Place icons in your Android project:
\`\`\`
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
\`\`\`

## Test on Devices

After generating icons:
1. Clear app cache: \`npx expo start --clear\`
2. Test on devices with different screen densities
3. Verify clarity at small sizes (home screen, app drawer)

## Notes

- All icons have white background for universal compatibility
- For adaptive icons (Android 12+), consider making the background transparent
- Test at actual device sizes to ensure text clarity
`;

    fs.writeFileSync(summaryPath, summary);
    console.log(`\n📋 Summary: ${summaryPath}`);

    console.log("\n✨ Icon generation complete!");
    console.log("\n📱 Next steps:");
    console.log("1. Use the generated icons for your Android build");
    console.log("2. Run: npx expo start --clear");
    console.log("3. Test on Android devices");
  } catch (error) {
    console.error("❌ Error generating icons:", error.message);
    process.exit(1);
  }
}

// Check if sharp is installed
try {
  require.resolve("sharp");
  generateIcons();
} catch (e) {
  console.error('❌ Required package "sharp" is not installed');
  console.error("Install it with: npm install --save-dev sharp");
  process.exit(1);
}
