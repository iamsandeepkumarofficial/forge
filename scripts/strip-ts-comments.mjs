import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const roots = [path.join(root, "apps"), path.join(root, "packages")];

function collectFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === "definitions"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

function stripFileComments(filePath) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const kind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    kind
  );
  const printer = ts.createPrinter({
    removeComments: true,
    newLine: ts.NewLineKind.LineFeed
  });
  const printed = printer.printFile(sourceFile);
  if (printed !== sourceText) {
    fs.writeFileSync(filePath, printed);
    return true;
  }
  return false;
}

const files = roots.flatMap((dir) => collectFiles(dir));
let changed = 0;
for (const file of files) {
  if (stripFileComments(file)) {
    changed += 1;
    console.log(`stripped: ${path.relative(root, file)}`);
  }
}
console.log(`Done. Updated ${changed} / ${files.length} files.`);
