const fs = require("fs");
const glob = require("glob");

const files = glob.sync("src/**/*.js", {
  ignore: ["**/*.bak", "**/node_modules/**"],
});

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split("\n");

  let compLine = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (
      /^const \w+(Screen|Navigator|Provider|Stack|Tab)/.test(t) ||
      /^const \w+ = \(\{/.test(t) ||
      /^export default function/.test(t) ||
      /^function \w+(Screen|Navigator)/.test(t)
    ) {
      compLine = i;
      break;
    }
  }

  for (let i = 0; i < compLine; i++) {
    const line = lines[i];
    if (
      /colors\./.test(line) &&
      !line.trim().startsWith("//") &&
      !line.trim().startsWith("*") &&
      !/const \{ colors \}/.test(line) &&
      !/useTheme/.test(line) &&
      !/createStyles/.test(line)
    ) {
      console.log(file + ":" + (i + 1) + ": " + line.trim());
    }
  }
}
