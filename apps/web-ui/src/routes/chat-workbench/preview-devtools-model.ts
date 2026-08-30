export type DevtoolsTab = "console" | "elements" | "network";

export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug";

export type ConsoleEntry = {
  id: string;
  ts: number;
  level: ConsoleLevel;
  args: string[];
  stack?: string;
};

export type NetworkEntry = {
  id: string;
  ts: number;
  method: string;
  url: string;
  status: number;
  duration: number;
  error?: string;
};

export type DomNode = {
  tag: string;
  id: string;
  className: string;
  children: DomNode[];
};

export type PreviewPickSummary = {
  tag: string;
  selector: string;
  text: string;
};

const MAX_ENTRIES = 200;
const CONSOLE_LEVELS: readonly ConsoleLevel[] = [
  "log",
  "info",
  "warn",
  "error",
  "debug"
];

export function formatDomLabel(node: DomNode): string {
  let label = node.tag || "element";
  if (node.id) {
    label += `#${node.id}`;
  }
  const cls = node.className
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(".");
  if (cls) {
    label += `.${cls}`;
  }
  return label;
}

export function formatNetworkStatus(entry: NetworkEntry): string {
  if (entry.error) return "ERR";
  if (!entry.status) return "—";
  return String(entry.status);
}

export function capEntries<T>(items: T[]): T[] {
  return items.length > MAX_ENTRIES ? items.slice(-MAX_ENTRIES) : items;
}

export function parseConsoleMessage(
  data: unknown
): Omit<ConsoleEntry, "id"> | null {
  if (!isRecord(data) || data.type !== "forge-devtools-console") return null;
  const level = CONSOLE_LEVELS.includes(data.level as ConsoleLevel)
    ? (data.level as ConsoleLevel)
    : "log";
  const args = Array.isArray(data.args)
    ? data.args.map((arg) => (typeof arg === "string" ? arg : String(arg)))
    : [];
  return {
    ts: numberOrNow(data.ts),
    level,
    args,
    stack: typeof data.stack === "string" ? data.stack : undefined
  };
}

export function parseNetworkMessage(
  data: unknown
): Omit<NetworkEntry, "id"> | null {
  if (!isRecord(data) || data.type !== "forge-devtools-network") return null;
  return {
    ts: numberOrNow(data.ts),
    method: typeof data.method === "string" ? data.method : "GET",
    url: typeof data.url === "string" ? data.url : "",
    status: typeof data.status === "number" ? data.status : 0,
    duration: typeof data.duration === "number" ? data.duration : 0,
    error: typeof data.error === "string" ? data.error : undefined
  };
}

export function parseDomResult(data: unknown): DomNode | { error: string } | null {
  if (!isRecord(data) || data.type !== "forge-devtools-dom-result") return null;
  if (typeof data.error === "string") return { error: data.error };
  const tree = parseDomNode(data.tree);
  return tree ?? { error: "No document" };
}

export function parseInspectPick(data: unknown): PreviewPickSummary | null {
  if (!isRecord(data) || data.type !== "forge-inspect-pick") return null;
  if (typeof data.tag !== "string") return null;
  return {
    tag: data.tag,
    selector: typeof data.selector === "string" ? data.selector : "",
    text: typeof data.text === "string" ? data.text : ""
  };
}

export function postToPreviewInspect(message: unknown): boolean {
  const frames = document.querySelectorAll<HTMLIFrameElement>(
    'iframe[title$="preview"]'
  );
  let sent = false;
  for (const frame of frames) {
    try {
      const origin = frame.src ? new URL(frame.src, window.location.href).origin : "*";
      frame.contentWindow?.postMessage(message, origin);
      sent = true;
    } catch {
      void 0;
    }
  }
  return sent;
}

function parseDomNode(value: unknown): DomNode | null {
  if (!isRecord(value) || typeof value.tag !== "string") return null;
  const children = Array.isArray(value.children)
    ? value.children
        .map((child) => parseDomNode(child))
        .filter((child): child is DomNode => child !== null)
    : [];
  return {
    tag: value.tag,
    id: typeof value.id === "string" ? value.id : "",
    className: typeof value.className === "string" ? value.className : "",
    children
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function numberOrNow(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Date.now();
}
