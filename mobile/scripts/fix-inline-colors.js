/**
 * fix-inline-colors.js
 *
 * Replaces hardcoded inline JSX color props (on Ionicons, ActivityIndicator,
 * RefreshControl, etc.) and inline style backgroundColor values with dynamic
 * `colors.xxx` tokens from the theme system.
 *
 * Only modifies the JSX/render section (BEFORE the createStyles function).
 *
 * Usage: node scripts/fix-inline-colors.js
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

// ── JSX prop color="#xxx" → color={colors.token} ──
const PROP_COLOR_MAP = {
  "#b38604": "colors.accent",
  "#d4a017": "colors.accent",
  "#1a1a2e": "colors.text",
  "#fff": "colors.textOnAccent",
  "#ffffff": "colors.textOnAccent",
  "#FFF": "colors.textOnAccent",
  "#666": "colors.textSecondary",
  "#666666": "colors.textSecondary",
  "#999": "colors.textTertiary",
  "#999999": "colors.textTertiary",
  "#ccc": "colors.textSecondary",
  "#cccccc": "colors.textSecondary",
  "#28a745": "colors.success",
  "#e53935": "colors.error",
  "#e74c3c": "colors.error",
  "#1565c0": "colors.info",
  "#2196f3": "colors.info",
  "#4caf50": "colors.success",
};

// ── Inline style backgroundColor: "#xxx" → backgroundColor: colors.token ──
const INLINE_BG_MAP = {
  "#e8f5e9": "colors.successBg",
  "#e3f2fd": "colors.infoBg",
  "#fce4ec": "colors.errorBg",
  "#ffebee": "colors.errorBg",
  "#fdf6e3": "colors.accentLight",
  "#fff8e1": "colors.warningBg",
  "#fff3e0": "colors.warningBg",
  "#f5f5f5": "colors.inputBg",
  "#f8f8f8": "colors.inputBg",
  "#e0e0e0": "colors.skeleton",
  "#b3860415": "colors.accentLight",
};

// ── Inline style color: "#xxx" → color: colors.token ──
const INLINE_COLOR_MAP = {
  "#b38604": "colors.accent",
  "#d4a017": "colors.accent",
  "#1a1a2e": "colors.text",
  "#666": "colors.textSecondary",
  "#666666": "colors.textSecondary",
  "#999": "colors.textTertiary",
  "#999999": "colors.textTertiary",
  "#ccc": "colors.textSecondary",
  "#fff": "colors.textOnAccent",
  "#ffffff": "colors.textOnAccent",
};

const SCREENS_DIR = path.join(__dirname, "..", "src", "screens");

function findScreenFiles() {
  return glob.sync("**/*.js", { cwd: SCREENS_DIR, absolute: true });
}

function splitAtCreateStyles(content) {
  // Find the createStyles definition to isolate JSX section
  const idx = content.indexOf("const createStyles");
  if (idx === -1) return { jsx: content, styles: "" };
  return { jsx: content.slice(0, idx), styles: content.slice(idx) };
}

function replaceJsxPropColors(jsx) {
  let result = jsx;
  let count = 0;

  for (const [hex, token] of Object.entries(PROP_COLOR_MAP)) {
    // Match: color="hex" or color='hex' (JSX props)
    const dq = new RegExp(`color="${escapeRegex(hex)}"`, "gi");
    const sq = new RegExp(`color='${escapeRegex(hex)}'`, "gi");
    const dqMatches = (result.match(dq) || []).length;
    const sqMatches = (result.match(sq) || []).length;
    result = result.replace(dq, `color={${token}}`);
    result = result.replace(sq, `color={${token}}`);
    count += dqMatches + sqMatches;

    // Also handle tintColor
    const tdq = new RegExp(`tintColor="${escapeRegex(hex)}"`, "gi");
    const tsq = new RegExp(`tintColor='${escapeRegex(hex)}'`, "gi");
    const tdqM = (result.match(tdq) || []).length;
    const tsqM = (result.match(tsq) || []).length;
    result = result.replace(tdq, `tintColor={${token}}`);
    result = result.replace(tsq, `tintColor={${token}}`);
    count += tdqM + tsqM;
  }

  return { result, count };
}

function replaceInlineBgColors(jsx) {
  let result = jsx;
  let count = 0;

  for (const [hex, token] of Object.entries(INLINE_BG_MAP)) {
    // Match: backgroundColor: "hex" or backgroundColor: 'hex'
    const dq = new RegExp(`backgroundColor:\\s*"${escapeRegex(hex)}"`, "gi");
    const sq = new RegExp(`backgroundColor:\\s*'${escapeRegex(hex)}'`, "gi");
    const dqM = (result.match(dq) || []).length;
    const sqM = (result.match(sq) || []).length;
    result = result.replace(dq, `backgroundColor: ${token}`);
    result = result.replace(sq, `backgroundColor: ${token}`);
    count += dqM + sqM;
  }

  return { result, count };
}

function replaceInlineStyleColors(jsx) {
  let result = jsx;
  let count = 0;

  for (const [hex, token] of Object.entries(INLINE_COLOR_MAP)) {
    // Only match style object color values: { color: "hex" } not JSX props
    // Look for pattern: (property): "hex" where property is NOT backgroundColor
    // We specifically target: color: "hex"
    const dq = new RegExp(
      `(?<=\\{[^}]*?)\\bcolor:\\s*"${escapeRegex(hex)}"`,
      "gi",
    );
    const sq = new RegExp(
      `(?<=\\{[^}]*?)\\bcolor:\\s*'${escapeRegex(hex)}'`,
      "gi",
    );
    const dqM = (result.match(dq) || []).length;
    const sqM = (result.match(sq) || []).length;
    result = result.replace(dq, `color: ${token}`);
    result = result.replace(sq, `color: ${token}`);
    count += dqM + sqM;
  }

  return { result, count };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const { jsx, styles } = splitAtCreateStyles(content);

  const r1 = replaceJsxPropColors(jsx);
  const r2 = replaceInlineBgColors(r1.result);
  const r3 = replaceInlineStyleColors(r2.result);

  const totalReplacements = r1.count + r2.count + r3.count;

  if (totalReplacements > 0) {
    fs.writeFileSync(filePath, r3.result + styles, "utf8");
  }

  return {
    props: r1.count,
    bgs: r2.count,
    inlineColors: r3.count,
    total: totalReplacements,
  };
}

// ── Main ──
const files = findScreenFiles();
let grandTotal = 0;
const results = [];

for (const file of files) {
  const rel = path.relative(SCREENS_DIR, file);
  const r = processFile(file);
  if (r.total > 0) {
    results.push({ file: rel, ...r });
    grandTotal += r.total;
  }
}

console.log("\n=== Inline Color Fix Results ===\n");
for (const r of results) {
  console.log(
    `  ${r.file}: ${r.total} replacements (props: ${r.props}, bg: ${r.bgs}, inline: ${r.inlineColors})`,
  );
}
console.log(
  `\n  TOTAL: ${grandTotal} replacements across ${results.length} files\n`,
);
