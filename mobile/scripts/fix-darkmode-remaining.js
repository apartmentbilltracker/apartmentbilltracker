/**
 * fix-darkmode-remaining.js
 *
 * Second-pass fix for remaining hardcoded colors inside BOTH
 * JSX (render) sections AND createStyles definitions.
 *
 * Targets: light backgrounds, dark text, borders, gray text,
 * placeholderTextColor that were missed by the first conversion.
 *
 * Usage: node scripts/fix-darkmode-remaining.js
 */

const fs = require("fs");
const path = require("path");

const SCREENS_DIR = path.join(__dirname, "..", "src", "screens");

function findScreenFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...findScreenFiles(full));
    else if (entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

// ═══════════════════════════════════════════════════════
// RULES — applied to the ENTIRE file (JSX + createStyles)
// ═══════════════════════════════════════════════════════

// -- Style property: backgroundColor --
const BG_RULES = [
  [/#fafafa/gi, "colors.cardAlt"],
  [/#f8f9fa/gi, "colors.cardAlt"],
  [/#f8f9fb/gi, "colors.cardAlt"],
  [/#f8fafc/gi, "colors.cardAlt"],
  [/#f0f0f5/gi, "colors.cardAlt"],
  [/#f0f0f0/gi, "colors.inputBg"],
  [/#ddd(?![\da-fA-F])/gi, "colors.skeleton"],
  [/#e0e0e0/gi, "colors.skeleton"],
  [/#eee(?![\da-fA-F])/gi, "colors.skeleton"],
  [/#d1d5db/gi, "colors.border"],
  [/#f0faf0/gi, "colors.successBg"],
  [/#f0f8ff/gi, "colors.infoBg"],
  [/#fffde7/gi, "colors.warningBg"],
  [/#fffdf5/gi, "colors.warningBg"],
];

// -- Style property: color (text) --
const TEXT_RULES = [
  [/#1a1a1a/gi, "colors.text"],
  [/#334155/gi, "colors.text"],
  [/#444(?![\da-fA-F])/gi, "colors.text"],
  [/#475569/gi, "colors.textSecondary"],
  [/#bbb(?![\da-fA-F])/gi, "colors.textTertiary"],
  [/#64748b/gi, "colors.textSecondary"],
];

// -- Style property: borderColor / borderBottomColor / borderTopColor --
const BORDER_RULES = [
  [/#ebebeb/gi, "colors.border"],
  [/#e8e8e8/gi, "colors.border"],
  [/#e8dcc0/gi, "colors.border"],
  [/#f5f5f5/gi, "colors.border"],
];

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyStylePropertyRules(content, propPattern, rules) {
  let result = content;
  let count = 0;
  for (const [hexRe, token] of rules) {
    // Match: propertyName:  "hex"  or  propertyName: 'hex'
    // propPattern is like "backgroundColor" or "color" etc.
    const dq = new RegExp(
      `(${propPattern}:\\s*)"(${hexRe.source})"`,
      hexRe.flags,
    );
    const sq = new RegExp(
      `(${propPattern}:\\s*)'(${hexRe.source})'`,
      hexRe.flags,
    );
    const dqM = (result.match(dq) || []).length;
    const sqM = (result.match(sq) || []).length;
    result = result.replace(dq, `$1${token}`);
    result = result.replace(sq, `$1${token}`);
    count += dqM + sqM;
  }
  return { result, count };
}

function applyJsxPropColorRules(content, rules) {
  let result = content;
  let count = 0;
  for (const [hexRe, token] of rules) {
    // Match JSX prop: color="hex" or color='hex'
    const dq = new RegExp(`(color=)"(${hexRe.source})"`, hexRe.flags);
    const sq = new RegExp(`(color=)'(${hexRe.source})'`, hexRe.flags);
    const dqM = (result.match(dq) || []).length;
    const sqM = (result.match(sq) || []).length;
    result = result.replace(dq, `$1{${token}}`);
    result = result.replace(sq, `$1{${token}}`);
    count += dqM + sqM;
  }
  return { result, count };
}

function fixPlaceholderTextColor(content) {
  let result = content;
  let count = 0;
  // placeholderTextColor="#bbb" or "#999" or "#aaa" or "#ccc"
  const re = /placeholderTextColor="(#bbb|#999|#aaa|#ccc)"/gi;
  const m = (result.match(re) || []).length;
  result = result.replace(re, "placeholderTextColor={colors.textTertiary}");
  count += m;
  return { result, count };
}

function fixTernaryColors(content) {
  // Fix patterns like: color="#ccc"  that should be colors.textTertiary
  // and color="#888" that should be colors.textSecondary
  let result = content;
  let count = 0;

  // JSX prop: color="#888"
  const r1 = /color="#888"/gi;
  count += (result.match(r1) || []).length;
  result = result.replace(r1, "color={colors.textSecondary}");

  // JSX prop: color="#ddd"
  const r2 = /color="#ddd"/gi;
  count += (result.match(r2) || []).length;
  result = result.replace(r2, "color={colors.skeleton}");

  // Inline style: color: "#888"
  const r3 = /(color:\s*)"#888"/gi;
  count += (result.match(r3) || []).length;
  result = result.replace(r3, "$1colors.textSecondary");

  return { result, count };
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let totalCount = 0;

  // Background colors
  const bgProps = "backgroundColor";
  const r1 = applyStylePropertyRules(content, bgProps, BG_RULES);
  content = r1.result;
  totalCount += r1.count;

  // Text colors
  const textProps = "(?<!background)color";
  const r2 = applyStylePropertyRules(content, textProps, TEXT_RULES);
  content = r2.result;
  totalCount += r2.count;

  // Border colors
  const borderProps = "border(?:Bottom|Top|Left|Right)?Color|borderColor";
  const r3 = applyStylePropertyRules(content, borderProps, BORDER_RULES);
  content = r3.result;
  totalCount += r3.count;

  // JSX prop color="hex" for text rules
  const r4 = applyJsxPropColorRules(content, TEXT_RULES);
  content = r4.result;
  totalCount += r4.count;

  // placeholderTextColor
  const r5 = fixPlaceholderTextColor(content);
  content = r5.result;
  totalCount += r5.count;

  // Extra fixes (#888, #ddd)
  const r6 = fixTernaryColors(content);
  content = r6.result;
  totalCount += r6.count;

  if (totalCount > 0) {
    fs.writeFileSync(filePath, content, "utf8");
  }

  return {
    bg: r1.count,
    text: r2.count,
    border: r3.count,
    jsxColor: r4.count,
    placeholder: r5.count,
    extra: r6.count,
    total: totalCount,
  };
}

// ── Main ──
const files = findScreenFiles(SCREENS_DIR);
let grandTotal = 0;
const results = [];

for (const file of files) {
  const rel = path.relative(path.join(__dirname, ".."), file);
  const r = processFile(file);
  if (r.total > 0) {
    results.push({ file: rel, ...r });
    grandTotal += r.total;
  }
}

console.log("\n=== Dark Mode Fix (Second Pass) ===\n");
for (const r of results) {
  console.log(
    `  ${r.file}: ${r.total} fixes (bg:${r.bg} text:${r.text} border:${r.border} jsx:${r.jsxColor} ph:${r.placeholder} extra:${r.extra})`,
  );
}
console.log(`\n  TOTAL: ${grandTotal} fixes across ${results.length} files\n`);
