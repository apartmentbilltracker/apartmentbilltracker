#!/usr/bin/env node
/**
 * Dark-mode pass 6 — Final edge-case cleanup.
 * Handles remaining ternary-context surface colours, un-themed green buttons,
 * warm surfaces, and gray JSX icon props.
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

const SRC = path.join(__dirname, "..", "src", "screens");
const SKIP = ["OnboardingScreen.js", "SplashScreen.js", "SimpleLoginScreen.js"];

const RULES = [
  // ── Remaining ternary surface pairs ───
  // isActive ? "#e8f5e9" : "#e3f2fd"
  {
    p: /\?\s*"#e8f5e9"\s*:\s*"#e3f2fd"/g,
    r: "? colors.successBg : colors.infoBg",
  },
  // paid ? "#e8f5e9" : "#fff3e0"
  {
    p: /\?\s*"#e8f5e9"\s*:\s*"#fff3e0"/g,
    r: "? colors.successBg : colors.warningBg",
  },
  // Remaining standalone ternary branches with "#e8f5e9"
  { p: /\?\s*"#e8f5e9"/g, r: "? colors.successBg" },
  { p: /:\s*"#e8f5e9"/g, r: ": colors.successBg" },

  // ── Green success buttons (#28a745) ───
  { p: /backgroundColor:\s*"#28a745"/g, r: "backgroundColor: colors.success" },
  { p: /="#28a745"/g, r: "={colors.success}" },
  { p: /"#28a745"/g, r: "colors.success" },

  // ── Warm surface #fef3e2 (AdminMembersScreen) ───
  {
    p: /backgroundColor:\s*"#fef3e2"/g,
    r: "backgroundColor: colors.accentSurface",
  },
  { p: /"#fef3e2"/g, r: "colors.accentSurface" },

  // ── Gray JSX icon/text props ───
  { p: /color="#d1d5db"/g, r: "color={colors.textTertiary}" },
  { p: /color="#cbd5e1"/g, r: "color={colors.textTertiary}" },
  { p: /color="#94a3b8"/g, r: "color={colors.textSecondary}" },

  // ── #b3860412 (gold 12% opacity) ───
  {
    p: /backgroundColor:\s*"#b3860412"/g,
    r: "backgroundColor: colors.accentLight",
  },

  // ── Remaining color: "#b38604" in styles if any slipped through ───
  { p: /(?<![A-Za-z])color:\s*"#b38604"/g, r: "color: colors.accent" },
];

const files = glob.sync("**/*.js", {
  cwd: SRC,
  absolute: true,
  ignore: ["**/*.bak"],
});
let totalFixes = 0;
const report = [];

for (const file of files) {
  if (SKIP.includes(path.basename(file))) continue;
  let src = fs.readFileSync(file, "utf8");
  let count = 0;
  for (const { p, r } of RULES) {
    p.lastIndex = 0;
    const m = src.match(p);
    if (m) count += m.length;
    src = src.replace(p, r);
  }
  if (count > 0) {
    fs.writeFileSync(file, src, "utf8");
    report.push(
      `  ${path.relative(path.join(__dirname, ".."), file)}: ${count} fixes`,
    );
    totalFixes += count;
  }
}

console.log("\n=== Dark Mode Fix (Sixth Pass — Final Cleanup) ===\n");
report.forEach((l) => console.log(l));
console.log(`\n  TOTAL: ${totalFixes} fixes across ${report.length} files\n`);
