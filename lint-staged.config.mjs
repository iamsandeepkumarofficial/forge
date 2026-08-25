import path from "node:path";

const root = process.cwd();

function toRepoPath(file) {
  const abs = path.resolve(file);
  return path.relative(root, abs).split(path.sep).join("/");
}

function packageRoot(file) {
  const normalized = toRepoPath(file);
  const apps = normalized.match(/^(apps\/[^/]+)\//);
  if (apps) return apps[1];
  const packages = normalized.match(/^(packages\/[^/]+)\//);
  if (packages) return packages[1];
  return null;
}

function quote(file) {
  return `"${file.replace(/"/g, '\\"')}"`;
}

function eslintCommands(files) {
  const byPkg = new Map();
  const rootFiles = [];
  for (const file of files) {
    const pkg = packageRoot(file);
    if (!pkg) {
      rootFiles.push(toRepoPath(file));
      continue;
    }
    if (!byPkg.has(pkg)) byPkg.set(pkg, []);
    byPkg.get(pkg).push(file);
  }
  const commands = [];
  for (const [pkg, pkgFiles] of byPkg) {
    const pkgAbs = path.join(root, pkg);
    const rel = pkgFiles
      .map((f) => quote(path.relative(pkgAbs, path.resolve(f))))
      .join(" ");
    commands.push(
      `pnpm --dir ${quote(pkg)} exec eslint --no-warn-ignored ${rel}`
    );
  }
  if (rootFiles.length > 0) {
    commands.push(
      `pnpm exec eslint --no-warn-ignored ${rootFiles.map(quote).join(" ")}`
    );
  }
  return commands;
}

export default {
  // Prettier must run before ESLint so max-lines counts match formatted code.
  "*.{ts,tsx}": (files) => {
    const quoted = files.map((f) => quote(toRepoPath(f))).join(" ");
    return [`prettier --write ${quoted}`, ...eslintCommands(files)];
  },
  "*.{js,mjs,cjs,json,md,yml,yaml,css}": (files) => {
    const filtered = files.filter((file) => {
      const rel = toRepoPath(file);
      return !rel.includes("/templates/") && !rel.startsWith("infra/opentofu/");
    });
    if (filtered.length === 0) {
      return [];
    }
    return [
      `prettier --write ${filtered.map((f) => quote(toRepoPath(f))).join(" ")}`
    ];
  }
};
