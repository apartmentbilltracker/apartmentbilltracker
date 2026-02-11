#!/usr/bin/env node
/**
 * Dark-mode pass 4 — comprehensive cleanup of every remaining hardcoded hex colour
 * that causes white cards, invisible text, or unthemed elements in dark mode.
 *
 * Runs on: mobile/src/screens/**\/*.js  (skips .bak, OnboardingScreen, SplashScreen, SimpleLoginScreen)
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

const SRC = path.join(__dirname, "..", "src", "screens");

/* ── Skip list (gradient / decorative screens) ─────────────────────── */
const SKIP = ["OnboardingScreen.js", "SplashScreen.js", "SimpleLoginScreen.js"];

/* ── Replacement rules (applied in order) ──────────────────────────── */
const RULES = [
  // ══════════════════════════════════════════════════════════════════
  // 1. TERNARY expressions (must match before single-value patterns)
  // ══════════════════════════════════════════════════════════════════

  // isPaid / isPayer / allPaid  ?  green : warm
  {
    p: /\?\s*"#e8f5e9"\s*:\s*"#fff8e1"/g,
    r: "? colors.successBg : colors.accentSurface",
  },
  {
    p: /\?\s*"#e8f5e9"\s*:\s*"#fef8e8"/g,
    r: "? colors.successBg : colors.accentSurface",
  },
  // active dot
  {
    p: /active\s*\?\s*"#fff"\s*:\s*"#ccc"/g,
    r: "active ? colors.card : colors.textTertiary",
  },
  // isPaid ? entry.bg : near-white
  { p: /entry\.bg\s*:\s*"#f9fafb"/g, r: "entry.bg : colors.cardAlt" },
  // isPaid ? entry.color : gray
  { p: /entry\.color\s*:\s*"#999"/g, r: "entry.color : colors.textSecondary" },
  { p: /entry\.color\s*:\s*"#888"/g, r: "entry.color : colors.textSecondary" },

  // ══════════════════════════════════════════════════════════════════
  // 2. backgroundColor (style properties & inline JSX objects)
  // ══════════════════════════════════════════════════════════════════

  // Near-white / light-gray surfaces → cardAlt / inputBg
  { p: /backgroundColor:\s*"#fafbfd"/g, r: "backgroundColor: colors.cardAlt" },
  { p: /backgroundColor:\s*"#f9f9fb"/g, r: "backgroundColor: colors.cardAlt" },
  { p: /backgroundColor:\s*"#f9fafb"/g, r: "backgroundColor: colors.cardAlt" },
  { p: /backgroundColor:\s*"#f0f1f5"/g, r: "backgroundColor: colors.inputBg" },

  // Warm accent surfaces
  {
    p: /backgroundColor:\s*"#fff8e1"/g,
    r: "backgroundColor: colors.accentSurface",
  },
  {
    p: /backgroundColor:\s*"#fffbf0"/g,
    r: "backgroundColor: colors.accentSurface",
  },
  {
    p: /backgroundColor:\s*"#fffaf3"/g,
    r: "backgroundColor: colors.accentSurface",
  },
  {
    p: /backgroundColor:\s*"#fef8e8"/g,
    r: "backgroundColor: colors.accentSurface",
  },
  {
    p: /backgroundColor:\s*"#fdf8ec"/g,
    r: "backgroundColor: colors.accentSurface",
  },
  {
    p: /backgroundColor:\s*"#f5ecd0"/g,
    r: "backgroundColor: colors.accentSurface",
  },

  // Status surfaces
  {
    p: /backgroundColor:\s*"#e8f5e9"/g,
    r: "backgroundColor: colors.successBg",
  },
  {
    p: /backgroundColor:\s*"#d4edda"/g,
    r: "backgroundColor: colors.successBg",
  },
  { p: /backgroundColor:\s*"#e3f2fd"/g, r: "backgroundColor: colors.infoBg" },
  { p: /backgroundColor:\s*"#e8f4f8"/g, r: "backgroundColor: colors.infoBg" },
  { p: /backgroundColor:\s*"#e1f5fe"/g, r: "backgroundColor: colors.infoBg" },
  { p: /backgroundColor:\s*"#e8f0fe"/g, r: "backgroundColor: colors.infoBg" },
  {
    p: /backgroundColor:\s*"#fff3cd"/g,
    r: "backgroundColor: colors.warningBg",
  },
  { p: /backgroundColor:\s*"#f3e5f5"/g, r: "backgroundColor: colors.purpleBg" },
  { p: /backgroundColor:\s*"#ede7f6"/g, r: "backgroundColor: colors.purpleBg" },

  // Gold accent buttons
  { p: /backgroundColor:\s*"#b38604"/g, r: "backgroundColor: colors.accent" },
  // Gold with 20% alpha
  {
    p: /backgroundColor:\s*"#b3860420"/g,
    r: "backgroundColor: colors.accentLight",
  },
  // Blue buttons
  { p: /backgroundColor:\s*"#0066cc"/g, r: "backgroundColor: colors.info" },

  // Dividers / separators using backgroundColor
  { p: /backgroundColor:\s*"#ebebeb"/g, r: "backgroundColor: colors.divider" },
  {
    p: /backgroundColor:\s*"#ccc"/g,
    r: "backgroundColor: colors.textTertiary",
  },

  // ══════════════════════════════════════════════════════════════════
  // 3. borderColor variants
  // ══════════════════════════════════════════════════════════════════
  { p: /borderColor:\s*"#ebebeb"/g, r: "borderColor: colors.border" },
  { p: /borderColor:\s*"#e0e0e0"/g, r: "borderColor: colors.inputBorder" },
  {
    p: /borderBottomColor:\s*"#ebebeb"/g,
    r: "borderBottomColor: colors.border",
  },
  {
    p: /borderBottomColor:\s*"#e0e0e0"/g,
    r: "borderBottomColor: colors.inputBorder",
  },

  // ══════════════════════════════════════════════════════════════════
  // 4. Text color (style property – lowercase "color:")
  //    Uses negative lookbehind so we never touch "backgroundColor:"
  // ══════════════════════════════════════════════════════════════════
  { p: /(?<![A-Za-z])color:\s*"#b38604"/g, r: "color: colors.accent" },
  { p: /(?<![A-Za-z])color:\s*"#8a6d00"/g, r: "color: colors.accent" },
  { p: /(?<![A-Za-z])color:\s*"#8f8f8f"/g, r: "color: colors.textSecondary" },
  { p: /(?<![A-Za-z])color:\s*"#d1d5db"/g, r: "color: colors.textTertiary" },
  { p: /(?<![A-Za-z])color:\s*"#ccc"/g, r: "color: colors.textTertiary" },

  // ══════════════════════════════════════════════════════════════════
  // 5. Semantic bill-type colours in STYLE PROPERTIES
  //    (electricity orange, water blue, internet purple)
  //    These are dark on dark-bg so we theme them.
  // ══════════════════════════════════════════════════════════════════
  {
    p: /(?<![A-Za-z])color:\s*"#f57f17"/g,
    r: "color: colors.electricityColor",
  },
  { p: /(?<![A-Za-z])color:\s*"#1565c0"/g, r: "color: colors.waterColor" },
  { p: /(?<![A-Za-z])color:\s*"#6a1b9a"/g, r: "color: colors.internetColor" },
  { p: /(?<![A-Za-z])color:\s*"#7b1fa2"/g, r: "color: colors.internetColor" },

  // ══════════════════════════════════════════════════════════════════
  // 6. JSX icon / text color="..." props
  // ══════════════════════════════════════════════════════════════════
  { p: /color="#aaa"/g, r: "color={colors.textTertiary}" },
  { p: /color="#555"/g, r: "color={colors.textSecondary}" },
  { p: /color="#8f8f8f"/g, r: "color={colors.textSecondary}" },
  { p: /color="#d4a843"/g, r: "color={colors.accent}" },
  { p: /color="#0a66c2"/g, r: "color={colors.info}" },
  // Bill-type icon colours
  { p: /color="#f57f17"/g, r: "color={colors.electricityColor}" },
  { p: /color="#ef6c00"/g, r: "color={colors.electricityColor}" },
  { p: /color="#1565c0"/g, r: "color={colors.waterColor}" },
  { p: /color="#6a1b9a"/g, r: "color={colors.internetColor}" },
  { p: /color="#7b1fa2"/g, r: "color={colors.internetColor}" },
];

/* ── Collect files ─────────────────────────────────────────────────── */
const files = glob.sync("**/*.js", {
  cwd: SRC,
  absolute: true,
  ignore: ["**/*.bak"],
});

let totalFixes = 0;
const report = [];

for (const file of files) {
  const base = path.basename(file);
  if (SKIP.includes(base)) continue;

  let src = fs.readFileSync(file, "utf8");
  let count = 0;

  for (const { p, r } of RULES) {
    // Reset lastIndex for global regexes
    p.lastIndex = 0;
    const before = src;
    src = src.replace(p, r);
    // Count replacements by comparing
    p.lastIndex = 0;
    const matches = before.match(p);
    if (matches) count += matches.length;
  }

  if (count > 0) {
    fs.writeFileSync(file, src, "utf8");
    const rel = path.relative(path.join(__dirname, ".."), file);
    report.push(`  ${rel}: ${count} fixes`);
    totalFixes += count;
  }
}

console.log("\n=== Dark Mode Fix (Fourth Pass — Comprehensive) ===\n");
report.forEach((l) => console.log(l));
console.log(`\n  TOTAL: ${totalFixes} fixes across ${report.length} files\n`);
