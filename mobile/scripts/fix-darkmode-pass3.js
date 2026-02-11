/**
 * fix-darkmode-pass3.js
 *
 * Third pass: catches patterns the previous scripts missed.
 * Specifically targets:
 *   - Remaining #ebebeb borders, #f5f5f5 borders
 *   - #1a1a1a backgrounds (active pills → colors.text)
 *   - #bbb backgrounds → colors.textTertiary
 *   - #fdf6e3 backgrounds → colors.accentSurface
 *   - color: "#fff" where it's text on cards (not on accent buttons)
 *   - color: "#333" / "#ccc" in JSX
 *   - #e0ede0 / #f0e6c8 borders
 *   - #8b6914 text → colors.accent
 *   - #bdbdbd icon → colors.textTertiary
 *
 * Usage: node scripts/fix-darkmode-pass3.js
 */

const fs = require("fs");
const path = require("path");

const SCREENS_DIR = path.join(__dirname, "..", "src", "screens");

function walk(dir) {
  const files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(fp));
    else if (e.name.endsWith(".js") && !e.name.endsWith(".bak")) files.push(fp);
  }
  return files;
}

const REPLACEMENTS = [
  // ── Borders ──
  [/borderBottomColor:\s*"#ebebeb"/gi, "borderBottomColor: colors.border"],
  [/borderTopColor:\s*"#ebebeb"/gi, "borderTopColor: colors.border"],
  [/borderColor:\s*"#ebebeb"/gi, "borderColor: colors.border"],
  [/borderBottomColor:\s*"#f5f5f5"/gi, "borderBottomColor: colors.border"],
  [/borderTopColor:\s*"#e0ede0"/gi, "borderTopColor: colors.border"],
  [/borderTopColor:\s*"#f0e6c8"/gi, "borderTopColor: colors.border"],
  [/borderColor:\s*"#b3e5fc"/gi, "borderColor: colors.border"],

  // ── Active pill: dark bg → theme-aware ──
  [/backgroundColor:\s*"#1a1a1a"/gi, "backgroundColor: colors.text"],

  // ── Light accent surface ──
  [/backgroundColor:\s*"#fdf6e3"/gi, "backgroundColor: colors.accentSurface"],

  // ── Gray dots/pills ──
  [/backgroundColor:\s*"#bbb"/gi, "backgroundColor: colors.textTertiary"],

  // ── Text color on active pills ──
  // color: "#fff" in roomPillTextActive or similarly named styles
  // We'll handle this carefully — only in styles, not JSX props

  // ── Dark brown text → accent ──
  [/color:\s*"#8b6914"/gi, "color: colors.accent"],

  // ── JSX icon props ──
  [/color="#bdbdbd"/gi, "color={colors.textTertiary}"],
  [/color="#333"/gi, "color={colors.text}"],
  [/color="#ccc"/gi, "color={colors.textTertiary}"],

  // ── Ternary in JSX: ? "#b38604" : "#ccc" → ? colors.accent : colors.textTertiary ──
  [/\? "#b38604" : "#ccc"/g, "? colors.accent : colors.textTertiary"],
  [/\? "#b38604" : "#999"/g, "? colors.accent : colors.textTertiary"],

  // ── Ternary: isPayer ? "#28a745" : "#666" → keep green, fix gray ──
  [/\? "#28a745" : "#666"/g, '? "#28a745" : colors.textSecondary'],
  [/\? "#666" : "#28a745"/g, '? colors.textSecondary : "#28a745"'],

  // ── Various inline where isPayer determines text ──
  [/\? "#27ae60" : "#999"/g, '? "#27ae60" : colors.textTertiary'],
  [/\? "#28a745" : "#999"/g, '? "#28a745" : colors.textTertiary'],
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let count = 0;

  for (const [pattern, replacement] of REPLACEMENTS) {
    const matches = content.match(pattern);
    if (matches) {
      count += matches.length;
      content = content.replace(pattern, replacement);
    }
  }

  if (count > 0) {
    fs.writeFileSync(filePath, content, "utf8");
  }
  return count;
}

const files = walk(SCREENS_DIR);
let grandTotal = 0;
const results = [];

for (const f of files) {
  const rel = path.relative(path.join(__dirname, ".."), f);
  const c = processFile(f);
  if (c > 0) {
    results.push({ file: rel, count: c });
    grandTotal += c;
  }
}

console.log("\n=== Dark Mode Fix (Third Pass) ===\n");
for (const r of results) {
  console.log(`  ${r.file}: ${r.count} fixes`);
}
console.log(`\n  TOTAL: ${grandTotal} fixes across ${results.length} files\n`);
