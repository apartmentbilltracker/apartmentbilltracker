/**
 * Exhaustive scan: find ANY `colors.` reference at module scope.
 *
 * Strategy: For each .js file under src/, parse every line and track
 * brace depth. Any `colors.` reference at brace depth 0 (module scope)
 * is flagged — this catches ALL cases regardless of function naming.
 *
 * Also checks for `colors` in `const X = { ... colors. ... }` at top level.
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

const files = glob.sync("src/**/*.js", { ignore: ["**/*.bak"] });

let totalIssues = 0;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  let braceDepth = 0;
  let inString = false;
  let inTemplate = false;
  let inComment = false;
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip pure comments
    if (trimmed.startsWith("//")) continue;
    if (trimmed.startsWith("/*")) inBlockComment = true;
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      continue;
    }

    // Skip import/require lines
    if (
      trimmed.startsWith("import ") ||
      trimmed.startsWith("from ") ||
      trimmed.includes("require(")
    )
      continue;

    // Skip lines that define colors (in theme files)
    if (
      trimmed.startsWith("export const lightColors") ||
      trimmed.startsWith("export const darkColors")
    )
      continue;
    if (file.includes("colors.js") || file.includes("ThemeContext")) continue;

    // Skip createStyles definition line
    if (
      trimmed.startsWith("const createStyles") ||
      trimmed.startsWith("export const createStyles")
    )
      continue;

    // Track brace depth character by character
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      const prev = j > 0 ? line[j - 1] : "";

      // Skip string contents
      if (ch === "'" && prev !== "\\") inString = !inString;
      if (ch === "`" && prev !== "\\") inTemplate = !inTemplate;
      if (inString || inTemplate) continue;

      // Skip // comments
      if (ch === "/" && j + 1 < line.length && line[j + 1] === "/") break;

      if (ch === "{") braceDepth++;
      if (ch === "}") braceDepth--;
    }

    // Check: at module scope (braceDepth 0) and references colors.something
    // But NOT in: useTheme destructuring, createStyles call, comments, strings
    if (braceDepth === 0 && /\bcolors\./.test(trimmed)) {
      // Exclude common false positives
      if (trimmed.includes("useTheme")) continue;
      if (trimmed.includes("createStyles")) continue;
      if (trimmed.startsWith("//")) continue;
      if (trimmed.startsWith("*")) continue;

      console.log(`${file}:${i + 1}: ${trimmed}`);
      totalIssues++;
    }

    // Also flag if we're at depth 1 and the OPENING brace was at depth 0
    // This catches: const OBJ = { key: colors.xxx }
    // But we need to be smarter — check if the line with `colors.` is inside
    // a top-level object literal (depth 1 where depth went from 0 to 1 on a const/let/var line)
    if (braceDepth === 1 && /\bcolors\./.test(trimmed)) {
      // Look back to find the opening — if it's a top-level const/let/var, flag it
      let foundTopLevelObj = false;
      for (let k = i - 1; k >= Math.max(0, i - 20); k--) {
        const prevLine = lines[k].trim();
        if (
          /^(const|let|var)\s+\w+\s*=\s*\{/.test(prevLine) ||
          /^(const|let|var)\s+\w+\s*=\s*\(/.test(prevLine)
        ) {
          foundTopLevelObj = true;
          break;
        }
        if (
          /^(function|const|class|export)\s+\w+/.test(prevLine) &&
          (prevLine.includes("=>") || prevLine.includes("function"))
        ) {
          // This is inside a function, not a top-level object
          break;
        }
      }
      if (foundTopLevelObj) {
        // Exclude createStyles bodies
        if (trimmed.includes("useTheme")) continue;
        if (trimmed.includes("createStyles")) continue;
        if (trimmed.startsWith("//")) continue;

        console.log(`${file}:${i + 1}: [depth=1 top-level obj] ${trimmed}`);
        totalIssues++;
      }
    }
  }
}

console.log(`\n--- Total issues found: ${totalIssues} ---`);
