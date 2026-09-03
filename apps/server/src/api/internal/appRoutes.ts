export type DiscoveredRoute = {
  method: string;
  path: string;
  summary?: string;
};

const CALL_RE =
  /(?:app|router|server|api|fastify)\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
const ROUTE_CHAIN_RE =
  /(?:app|router|server)\.route\s*\(\s*['"`]([^'"`]+)['"`]\s*\)((?:\s*\.\s*(?:get|post|put|patch|delete|all)\s*\([^)]*\))*)/gi;
const MOUNT_RE =
  /(?:app|router|server)\.use\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([A-Za-z_$][\w$]*)\s*\)/gi;
const DECORATOR_RE =
  /@(Get|Post|Put|Patch|Delete|All)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
const FLASK_RE =
  /@(?:app|bp|blueprint)\.route\s*\(\s*['"`]([^'"`]+)['"`]([^)]*)\)/gi;
const NEXT_APP_RE = /(?:^|\/)app\/(api\/.+)\/route\.[tj]sx?$/i;
const NEXT_PAGES_RE = /(?:^|\/)pages\/(api\/.+)\.[tj]sx?$/i;
const SKIP_MOUNT_IDENT =
  /(limiter|handler|middleware|sanitize|parser|session|helmet|cors|compression|morgan|favicon|static|json|urlencoded)$/i;

export function joinMountPath(prefix: string, path: string): string {
  const base = prefix.trim() || "/";
  const leaf = path.trim() || "/";
  if (base === "/") return leaf.startsWith("/") ? leaf : `/${leaf}`;
  const cleanBase = base.replace(/\/+$/, "");
  if (leaf === "/") return cleanBase;
  return `${cleanBase}${leaf.startsWith("/") ? leaf : `/${leaf}`}`;
}

export function parseRouteScanLines(text: string): DiscoveredRoute[] {
  const found = new Map<string, DiscoveredRoute>();
  const mounts = new Set<string>();
  const add = (method: string, path: string, summary?: string) => {
    if (!path.startsWith("/")) return;
    const key = `${method.toUpperCase()} ${path}`;
    if (!found.has(key)) {
      found.set(key, { method: method.toUpperCase(), path, summary });
    }
  };
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || isCommentedSource(trimmed)) continue;
    addNextFileRoute(trimmed, add);
    const colon = trimmed.indexOf(":");
    if (colon > 0) addNextFileRoute(trimmed.slice(0, colon), add);
    CALL_RE.lastIndex = 0;
    ROUTE_CHAIN_RE.lastIndex = 0;
    MOUNT_RE.lastIndex = 0;
    DECORATOR_RE.lastIndex = 0;
    FLASK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CALL_RE.exec(trimmed))) {
      add(m[1] ?? "GET", m[2] ?? "/");
    }
    while ((m = ROUTE_CHAIN_RE.exec(trimmed))) {
      const path = m[1] ?? "/";
      const chained = [...(m[2] ?? "").matchAll(/\.(get|post|put|patch|delete|all)/gi)];
      if (chained.length === 0) add("GET", path);
      for (const method of chained) add(method[1] ?? "GET", path);
    }
    while ((m = MOUNT_RE.exec(trimmed))) {
      const prefix = m[1] ?? "/";
      const ident = m[2] ?? "";
      if (!prefix.startsWith("/") || SKIP_MOUNT_IDENT.test(ident)) continue;
      mounts.add(prefix);
    }
    while ((m = DECORATOR_RE.exec(trimmed))) {
      add(m[1] ?? "GET", m[2] ?? "/");
    }
    while ((m = FLASK_RE.exec(trimmed))) {
      const methods = parseFlaskMethods(m[2] ?? "");
      for (const method of methods) add(method, m[1] ?? "/");
    }
  }
  if (mounts.size > 0) {
    const leaves = [...found.values()];
    for (const prefix of mounts) {
      if (prefix === "/") continue;
      for (const leaf of leaves) {
        add(leaf.method, joinMountPath(prefix, leaf.path));
      }
    }
  }
  return [...found.values()].sort((a, b) =>
    a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)
  );
}

function isCommentedSource(line: string): boolean {
  const m = line.match(/:\d+:(.*)$/);
  const code = m?.[1] ?? line;
  return /^\s*(\/\/|#)/.test(code);
}

function addNextFileRoute(
  file: string,
  add: (method: string, path: string, summary?: string) => void
): void {
  const app = file.match(NEXT_APP_RE);
  if (app?.[1]) {
    add("GET", `/${app[1]}`, "Next.js app route");
    return;
  }
  const pages = file.match(NEXT_PAGES_RE);
  if (pages?.[1]) {
    add("GET", `/${pages[1].replace(/\/index$/i, "")}`, "Next.js pages API");
  }
}

function parseFlaskMethods(raw: string): string[] {
  const m = raw.match(/methods\s*=\s*\[([^\]]+)\]/i);
  if (!m?.[1]) return ["GET"];
  return m[1]
    .split(",")
    .map((s) => s.replace(/['"\s]/g, "").toUpperCase())
    .filter(Boolean);
}

export const ROUTE_SCAN_SCRIPT = [
  "grep -R -n -E",
  "'(\\.(get|post|put|patch|delete)\\(|@(Get|Post|Put|Patch|Delete)|\\.route\\(|\\.use\\()'",
  "--include='*.ts' --include='*.js' --include='*.tsx' --include='*.jsx' --include='*.py'",
  "--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.next --exclude-dir=coverage",
  ". 2>/dev/null | head -n 400;",
  "find . -type f \\( -path '*/app/api/*/route.ts' -o -path '*/app/api/*/route.js' -o -path '*/pages/api/*' \\)",
  "! -path '*/node_modules/*' 2>/dev/null | head -n 80"
].join(" ");
