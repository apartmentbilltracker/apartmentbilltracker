/**
 * Theme conversion script — converts all screen files to use dynamic theme colors.
 *
 * For each screen file:
 *  1. Adds `import { useTheme } from "...theme/ThemeContext";`
 *  2. Converts `const styles = StyleSheet.create({` → `const createStyles = (colors) => StyleSheet.create({`
 *  3. Adds `const { colors } = useTheme();` and `const styles = createStyles(colors);` inside component
 *  4. Replaces hardcoded color values inside the stylesheet with `colors.xxx` tokens
 *  5. Replaces inline `placeholderTextColor="..."` with `{colors.placeholder}`
 *
 * Run: node scripts/convert-theme.js
 */
const fs = require("fs");
const path = require("path");

const SCREENS_DIR = path.join(__dirname, "..", "src", "screens");

// ── Color mapping: property → value → token ──
// bg = backgroundColor context, fg = color context, border = border context
const BG_MAP = {
  '"#f5f6fa"': "colors.background",
  '"#f5f5f5"': "colors.background",
  '"#fff"': "colors.card",
  '"#ffffff"': "colors.card",
  '"white"': "colors.card",
  '"#f8f8f8"': "colors.inputBg",
  '"#f9f9f9"': "colors.inputBg",
  '"#fef2f2"': "colors.errorBg",
  '"#ffebee"': "colors.errorBg",
  '"#e8f5e9"': "colors.successBg",
  '"#fdf8ec"': "colors.warningBg",
  '"#fff3e0"': "colors.warningBg",
  '"#e3f2fd"': "colors.infoBg",
  '"#e5e7eb"': "colors.border", // progressTrack etc.
  '"#e8e8e8"': "colors.badgeBg",
};

const FG_MAP = {
  '"#1a1a2e"': "colors.text",
  '"#333"': "colors.text",
  '"#333333"': "colors.text",
  '"#222"': "colors.text",
  '"#111"': "colors.text",
  '"#666"': "colors.textSecondary",
  '"#666666"': "colors.textSecondary",
  '"#64748b"': "colors.textSecondary",
  '"#555"': "colors.textSecondary",
  '"#777"': "colors.textSecondary",
  '"#999"': "colors.textTertiary",
  '"#999999"': "colors.textTertiary",
  '"#94a3b8"': "colors.textTertiary",
  '"#aaa"': "colors.textTertiary",
  '"#888"': "colors.textTertiary",
  '"#cbd5e1"': "colors.textTertiary",
  '"#92710a"': "colors.warning",
  '"#ef4444"': "colors.error",
  '"#d32f2f"': "colors.error",
};

const BORDER_MAP = {
  '"#e5e7eb"': "colors.border",
  '"#e0e0e0"': "colors.border",
  '"#ddd"': "colors.border",
  '"#ccc"': "colors.border",
  '"#d1d5db"': "colors.border",
  '"#eee"': "colors.divider",
  '"#eeeeee"': "colors.divider",
  '"#f0f0f0"': "colors.borderLight",
  '"#fecaca"': "colors.error",
  '"#fca5a5"': "colors.error",
};

// Files/patterns to SKIP
const SKIP_FILES = ["OnboardingScreen.js", "SplashScreen.js"];

// ── Helpers ──
function getAllScreenFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllScreenFiles(full));
    } else if (entry.name.endsWith(".js") && !SKIP_FILES.includes(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function getThemeImportPath(filePath) {
  const rel = path.relative(
    path.dirname(filePath),
    path.join(__dirname, "..", "src", "theme", "ThemeContext"),
  );
  return rel.replace(/\\/g, "/");
}

function replaceStylesheetColors(styleBlock) {
  let out = styleBlock;

  // backgroundColor replacements
  for (const [val, token] of Object.entries(BG_MAP)) {
    // Match backgroundColor: "#xxx" or backgroundColor: '#xxx'
    const re = new RegExp(`(backgroundColor:\\s*)${escapeRegex(val)}`, "g");
    out = out.replace(re, `$1${token}`);
    // Also single quotes
    const sqVal = val.replace(/"/g, "'");
    const reSq = new RegExp(`(backgroundColor:\\s*)${escapeRegex(sqVal)}`, "g");
    out = out.replace(reSq, `$1${token}`);
  }

  // color replacements (but NOT on buttons where color is #fff — handle separately)
  for (const [val, token] of Object.entries(FG_MAP)) {
    const re = new RegExp(
      `((?<!background)color:\\s*)${escapeRegex(val)}`,
      "gi",
    );
    out = out.replace(re, `$1${token}`);
    const sqVal = val.replace(/"/g, "'");
    const reSq = new RegExp(
      `((?<!background)color:\\s*)${escapeRegex(sqVal)}`,
      "gi",
    );
    out = out.replace(reSq, `$1${token}`);
  }

  // borderColor, borderTopColor, borderBottomColor, borderLeftColor, borderRightColor
  for (const [val, token] of Object.entries(BORDER_MAP)) {
    const re = new RegExp(
      `(border(?:Top|Bottom|Left|Right)?Color:\\s*)${escapeRegex(val)}`,
      "g",
    );
    out = out.replace(re, `$1${token}`);
    const sqVal = val.replace(/"/g, "'");
    const reSq = new RegExp(
      `(border(?:Top|Bottom|Left|Right)?Color:\\s*)${escapeRegex(sqVal)}`,
      "g",
    );
    out = out.replace(reSq, `$1${token}`);
  }

  return out;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findComponentName(content) {
  // Look for `const XxxScreen = ({` or `const XxxScreen = () => {` or `function XxxScreen(`
  const match = content.match(/(?:const|function)\s+(\w+Screen|\w+)\s*=?\s*\(/);
  return match ? match[1] : null;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  const fileName = path.basename(filePath);

  // Skip if already converted
  if (content.includes("useTheme") && content.includes("createStyles")) {
    console.log(`  SKIP (already converted): ${fileName}`);
    return { skipped: true };
  }

  const changes = [];
  const importPath = getThemeImportPath(filePath);

  // ── 1. Add useTheme import ──
  if (!content.includes("useTheme")) {
    // Find last import line
    const importLines = content.match(/^import\s.+$/gm);
    if (importLines && importLines.length > 0) {
      const lastImport = importLines[importLines.length - 1];
      const lastImportIdx = content.lastIndexOf(lastImport);
      const insertPos = lastImportIdx + lastImport.length;
      content =
        content.slice(0, insertPos) +
        `\nimport { useTheme } from "${importPath}";` +
        content.slice(insertPos);
      changes.push("Added useTheme import");
    }
  }

  // ── 2. Add useMemo import if not present ──
  if (!content.includes("useMemo")) {
    // Add useMemo to existing React import
    const reactImportMatch = content.match(
      /import\s+React\s*,?\s*\{([^}]*)\}\s*from\s*["']react["']/,
    );
    if (reactImportMatch) {
      const existingImports = reactImportMatch[1];
      if (!existingImports.includes("useMemo")) {
        content = content.replace(
          reactImportMatch[0],
          reactImportMatch[0].replace(
            reactImportMatch[1],
            existingImports.trimEnd() + ", useMemo",
          ),
        );
        changes.push("Added useMemo to React import");
      }
    } else {
      // Try: import React from "react"
      const simpleReactImport = content.match(
        /import\s+React\s+from\s*["']react["']/,
      );
      if (simpleReactImport) {
        content = content.replace(
          simpleReactImport[0],
          `import React, { useMemo } from "react"`,
        );
        changes.push("Added useMemo to React import");
      }
    }
  }

  // ── 3. Convert StyleSheet.create to createStyles factory ──
  // Handle: const styles = StyleSheet.create({
  // Handle one-liner and multi-line patterns
  const stylesheetPattern = /const\s+styles\s*=\s*StyleSheet\.create\(\{/;
  const ssMatch = content.match(stylesheetPattern);
  if (ssMatch) {
    content = content.replace(
      stylesheetPattern,
      "const createStyles = (colors) => StyleSheet.create({",
    );
    changes.push("Converted StyleSheet.create to createStyles factory");
  }

  // ── 4. Replace colors within the createStyles block ──
  // Find the createStyles block (from "const createStyles" to the matching "});")
  const createStylesStart = content.indexOf("const createStyles");
  if (createStylesStart !== -1) {
    // Find the end of the StyleSheet.create({ ... }); block
    let braceCount = 0;
    let inBlock = false;
    let blockStart = -1;
    let blockEnd = -1;
    for (let i = createStylesStart; i < content.length; i++) {
      if (content[i] === "{") {
        if (!inBlock) {
          blockStart = i;
          inBlock = true;
        }
        braceCount++;
      } else if (content[i] === "}") {
        braceCount--;
        if (braceCount === 0 && inBlock) {
          // Look for ");" after the closing brace
          const afterBrace = content.substring(i, i + 5);
          if (afterBrace.match(/\}\s*\)/)) {
            blockEnd = content.indexOf(")", i) + 1;
            // Check for semicolon
            const nextChar = content[blockEnd];
            if (nextChar === ";") blockEnd++;
          } else {
            blockEnd = i + 1;
          }
          break;
        }
      }
    }

    if (blockStart !== -1 && blockEnd !== -1) {
      const styleBlock = content.substring(createStylesStart, blockEnd);
      const newStyleBlock = replaceStylesheetColors(styleBlock);
      if (newStyleBlock !== styleBlock) {
        content =
          content.substring(0, createStylesStart) +
          newStyleBlock +
          content.substring(blockEnd);
        changes.push("Replaced hardcoded colors with theme tokens");
      }
    }
  }

  // ── 5. Add useTheme + styles hooks inside the component ──
  // Find the component function
  const compPatterns = [
    // const XxxScreen = ({ ... }) => {
    /const\s+\w+\s*=\s*\(\s*\{[^}]*\}\s*\)\s*=>\s*\{/,
    // const XxxScreen = () => {
    /const\s+\w+\s*=\s*\(\s*\)\s*=>\s*\{/,
    // function XxxScreen({ ... }) {
    /function\s+\w+\s*\(\s*\{[^}]*\}\s*\)\s*\{/,
    // function XxxScreen() {
    /function\s+\w+\s*\(\s*\)\s*\{/,
  ];

  let compMatch = null;
  for (const pat of compPatterns) {
    compMatch = content.match(pat);
    if (compMatch) break;
  }

  if (compMatch && !content.includes("const styles = createStyles(colors)")) {
    // Insert after the opening brace of the component
    const compStart = content.indexOf(compMatch[0]);
    const bracePos = compStart + compMatch[0].length;

    // Check if there's already a `const { colors }` line
    const nextLines = content.substring(bracePos, bracePos + 500);

    if (!nextLines.includes("useTheme()")) {
      const hookLine =
        "\n  const { colors } = useTheme();\n  const styles = createStyles(colors);\n";
      content =
        content.substring(0, bracePos) + hookLine + content.substring(bracePos);
      changes.push("Added useTheme + styles hooks inside component");
    }
  }

  // ── 6. Replace inline placeholderTextColor ──
  content = content.replace(
    /placeholderTextColor=["']#94a3b8["']/g,
    "placeholderTextColor={colors.placeholder}",
  );
  content = content.replace(
    /placeholderTextColor=["']#999["']/g,
    "placeholderTextColor={colors.placeholder}",
  );
  content = content.replace(
    /placeholderTextColor=["']#999999["']/g,
    "placeholderTextColor={colors.placeholder}",
  );
  content = content.replace(
    /placeholderTextColor=["']#aaa["']/g,
    "placeholderTextColor={colors.placeholder}",
  );
  content = content.replace(
    /placeholderTextColor=["']#888["']/g,
    "placeholderTextColor={colors.placeholder}",
  );
  content = content.replace(
    /placeholderTextColor=["']#ccc["']/g,
    "placeholderTextColor={colors.placeholder}",
  );

  // ── 7. Handle <BG> constants used in some admin screens ──
  // const BG = "#f5f6fa" → remove these and let createStyles handle it
  // Actually, those screens use BG in StyleSheet, so it's already handled.

  // ── 8. Handle inline style={{ ... backgroundColor: "#f5f6fa" ... }} ──
  // Common pattern: style={{ flex: 1, backgroundColor: "#f5f6fa" }}
  content = content.replace(
    /backgroundColor:\s*["']#f5f6fa["']/g,
    "backgroundColor: colors.background",
  );
  content = content.replace(
    /backgroundColor:\s*BG\b/g,
    "backgroundColor: colors.background",
  );

  if (changes.length > 0) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`  DONE: ${fileName} (${changes.length} changes)`);
    changes.forEach((c) => console.log(`    - ${c}`));
  } else {
    console.log(`  NO CHANGES: ${fileName}`);
  }

  return { changes };
}

// ── Main ──
console.log("=== Theme Conversion Script ===\n");
const files = getAllScreenFiles(SCREENS_DIR);
console.log(`Found ${files.length} screen files to process.\n`);

let processed = 0;
let skipped = 0;
let errored = 0;

for (const f of files) {
  const relPath = path.relative(SCREENS_DIR, f);
  console.log(`Processing: ${relPath}`);
  try {
    const result = processFile(f);
    if (result.skipped) skipped++;
    else processed++;
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    errored++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Processed: ${processed}`);
console.log(`Skipped: ${skipped}`);
console.log(`Errors: ${errored}`);
console.log(`Total: ${files.length}`);
