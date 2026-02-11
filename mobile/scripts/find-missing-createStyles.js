/**
 * Find files that reference `colors.` but DON'T use the createStyles factory.
 * These files have raw StyleSheet.create at module top level with colors.xxx → crash.
 *
 * Also find files that have a bare `colors` destructuring (const {colors} = ...)
 * at module scope (outside any function).
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

const files = glob.sync("src/**/*.js", { ignore: ["**/*.bak", "**/theme/**"] });

console.log("=== Files using colors. WITHOUT createStyles factory ===\n");

let issues = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");

  // Skip files that don't reference colors.
  if (!/\bcolors\./.test(content)) continue;

  // Check if file has createStyles pattern
  const hasCreateStyles =
    /const\s+createStyles\s*=/.test(content) ||
    /function\s+createStyles/.test(content);

  if (!hasCreateStyles) {
    // This file uses colors. but has no createStyles factory!
    // Check if it has StyleSheet.create at module scope
    const hasStyleSheet = /StyleSheet\.create/.test(content);
    const lines = content.split("\n");

    // Find where colors. is used in style objects (not JSX/component)
    let styleLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        /\bcolors\./.test(line) &&
        !line.startsWith("//") &&
        !line.startsWith("*")
      ) {
        styleLines.push({ line: i + 1, text: line.substring(0, 100) });
      }
    }

    if (styleLines.length > 0) {
      console.log(
        `\n❌ ${file} (NO createStyles, uses colors. in ${styleLines.length} places)`,
      );
      // Show first few
      styleLines
        .slice(0, 5)
        .forEach((s) => console.log(`   L${s.line}: ${s.text}`));
      if (styleLines.length > 5)
        console.log(`   ... and ${styleLines.length - 5} more`);
      issues.push(file);
    }
  }
}

console.log(
  `\n\n=== Files WITH createStyles but colors. outside the factory ===\n`,
);

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  if (!/\bcolors\./.test(content)) continue;

  const hasCreateStyles =
    /const\s+createStyles\s*=/.test(content) ||
    /function\s+createStyles/.test(content);
  if (!hasCreateStyles) continue; // already handled above

  const lines = content.split("\n");

  // Find the createStyles definition line
  let createStylesLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/const\s+createStyles\s*=/.test(lines[i])) {
      createStylesLine = i;
      break;
    }
  }

  // Find any component/function definition
  let firstComponentLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      /^(export\s+)?(default\s+)?function\s+\w+/.test(line) ||
      /^(export\s+)?(const|let)\s+\w+(Screen|Navigator|Provider|Modal|Component|View|Page)\s*=/.test(
        line,
      ) ||
      /^(export\s+)?default\s+(function|class)/.test(line)
    ) {
      firstComponentLine = i;
      break;
    }
  }

  // Check BEFORE the first component for colors. references
  // (excluding imports, comments, createStyles definition itself)
  let beforeComponent = Math.min(
    firstComponentLine > 0 ? firstComponentLine : lines.length,
    createStylesLine > 0 ? createStylesLine : lines.length,
  );

  let moduleIssues = [];
  for (let i = 0; i < beforeComponent; i++) {
    const line = lines[i].trim();
    if (
      /\bcolors\./.test(line) &&
      !line.startsWith("//") &&
      !line.startsWith("*") &&
      !line.startsWith("import") &&
      !line.includes("require(") &&
      !line.includes("useTheme") &&
      !line.includes("createStyles")
    ) {
      moduleIssues.push({ line: i + 1, text: line.substring(0, 100) });
    }
  }

  if (moduleIssues.length > 0) {
    console.log(
      `\n⚠️  ${file} (has createStyles, but colors. at module scope before component)`,
    );
    moduleIssues.forEach((s) => console.log(`   L${s.line}: ${s.text}`));
    issues.push(file);
  }
}

console.log(`\n\n=== TOTAL problem files: ${issues.length} ===`);
issues.forEach((f) => console.log(`  - ${f}`));
