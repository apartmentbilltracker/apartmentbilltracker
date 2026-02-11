#!/usr/bin/env node
/**
 * Dark-mode pass 5 — Replace remaining semantic colours that are invisible/hard
 * to see on dark backgrounds, including ternary-expression contexts missed by
 * pass 4 (which only matched style-property and direct-JSX-prop patterns).
 *
 * Two-phase approach per colour:
 *   Phase A: ="HEXVALUE"  →  ={colors.token}   (JSX props: color=, stopColor=, etc.)
 *   Phase B:  "HEXVALUE"  →   colors.token      (style values, ternaries, object fields)
 *
 * Phase A runs first so Phase B does not clobber JSX props.
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

const SRC = path.join(__dirname, "..", "src", "screens");

const SKIP = ["OnboardingScreen.js", "SplashScreen.js", "SimpleLoginScreen.js"];

/* ── Colour → token mapping ─────────────────────────────────────── */
const MAP = [
  { hex: "#2e7d32", token: "colors.success" },
  { hex: "#f57f17", token: "colors.electricityColor" },
  { hex: "#1565c0", token: "colors.waterColor" },
  { hex: "#6a1b9a", token: "colors.internetColor" },
  { hex: "#7b1fa2", token: "colors.internetColor" },
];

/* Build ordered rules: Phase A (JSX prop) before Phase B (general) */
const RULES = [];
for (const { hex, token } of MAP) {
  const escaped = hex.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Phase A — JSX prop  ="hex"  →  ={token}
  RULES.push({ p: new RegExp(`="${escaped}"`, "gi"), r: `={${token}}` });
  // Phase B — remaining  "hex"  →  token  (style/ternary/object literals)
  RULES.push({ p: new RegExp(`"${escaped}"`, "gi"), r: token });
}

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
    p.lastIndex = 0;
    const matches = src.match(p);
    if (matches) count += matches.length;
    src = src.replace(p, r);
  }

  if (count > 0) {
    fs.writeFileSync(file, src, "utf8");
    const rel = path.relative(path.join(__dirname, ".."), file);
    report.push(`  ${rel}: ${count} fixes`);
    totalFixes += count;
  }
}

console.log("\n=== Dark Mode Fix (Fifth Pass — Semantic Colours) ===\n");
report.forEach((l) => console.log(l));
console.log(`\n  TOTAL: ${totalFixes} fixes across ${report.length} files\n`);
