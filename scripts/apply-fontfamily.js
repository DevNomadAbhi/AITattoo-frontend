const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const exts = [".ts", ".tsx"];
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walk(path.join(dir, entry.name));
    } else {
      const ext = path.extname(entry.name);
      if (exts.includes(ext)) files.push(path.join(dir, entry.name));
    }
  }
}
walk(root);
let updatedFiles = 0;
for (const file of files) {
  let text = fs.readFileSync(file, "utf8");
  if (!text.includes("StyleSheet.create(")) continue;
  const lines = text.split(/\r?\n/);
  let changed = false;
  const hasFontsImport =
    /import\s+\{[^}]*\bFonts\b[^}]*\}\s+from\s+"@\/constants\/theme"/.test(
      text,
    );
  let inCreate = false;
  let braceDepth = 0;
  let styleDepth = 0;
  let currentStyleHasFont = false;
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inCreate) {
      if (/StyleSheet\.create\s*\(\s*\{/.test(line)) {
        inCreate = true;
        braceDepth +=
          (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      }
      newLines.push(line);
      continue;
    }

    const open = (line.match(/\{/g) || []).length;
    const close = (line.match(/\}/g) || []).length;

    if (styleDepth === 0 && /^\s*[A-Za-z0-9_$]+\s*:\s*\{\s*$/.test(line)) {
      styleDepth = 1;
      currentStyleHasFont = false;
      newLines.push(line);
      braceDepth += open - close;
      continue;
    }

    if (styleDepth > 0) {
      if (/fontFamily\s*:/.test(line)) {
        currentStyleHasFont = true;
      }
      styleDepth += open - close;
      if (styleDepth === 0) {
        if (!currentStyleHasFont) {
          const indent = (line.match(/^(\s*)/) || [""])[0];
          newLines.push(`${indent}  fontFamily: Fonts.fredoka,`);
          changed = true;
        }
        newLines.push(line);
        braceDepth += open - close;
        continue;
      }
      newLines.push(line);
      braceDepth += open - close;
      continue;
    }

    newLines.push(line);
    braceDepth += open - close;
    if (inCreate && braceDepth <= 0) {
      inCreate = false;
    }
  }

  if (changed) {
    let output = newLines.join("\r\n");
    if (!hasFontsImport) {
      const outLines = [];
      let inserted = false;
      for (const line of output.split("\r\n")) {
        if (!inserted && /^import\s/.test(line)) {
          outLines.push(line);
          continue;
        }
        if (!inserted) {
          outLines.push('import { Fonts } from "@/constants/theme"');
          outLines.push(line);
          inserted = true;
          continue;
        }
        outLines.push(line);
      }
      output = outLines.join("\r\n");
    }
    fs.writeFileSync(file, output, "utf8");
    console.log("Updated:", file);
    updatedFiles++;
  }
}
console.log("Updated files:", updatedFiles);
