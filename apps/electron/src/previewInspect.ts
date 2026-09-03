import type { PreviewPickResult } from "./types.js";

export type CdpClient = {
  attach: () => void;
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  onMessage: (fn: (method: string, params: unknown) => void) => () => void;
};

export type DebuggerLike = {
  isAttached: () => boolean;
  attach: (version?: string) => void;
  sendCommand: (
    method: string,
    params?: Record<string, unknown>
  ) => Promise<unknown>;
  on: (event: "message", listener: (...args: unknown[]) => void) => void;
  removeListener: (
    event: "message",
    listener: (...args: unknown[]) => void
  ) => void;
};

export const INSPECT_HIGHLIGHT = {
  showInfo: true,
  showRulers: false,
  showStyles: false,
  showExtensionLines: false,
  contentColor: { r: 111, g: 168, b: 220, a: 0.55 },
  paddingColor: { r: 147, g: 196, b: 125, a: 0.4 },
  borderColor: { r: 255, g: 229, b: 153, a: 0.66 },
  marginColor: { r: 246, g: 178, b: 107, a: 0.4 }
};

export const PICK_FROM_ELEMENT_FN = `function () {
  const el = this;
  if (!(el instanceof Element)) return null;
  const r = el.getBoundingClientRect();
  const root = el.closest("section,article,main,[role='main'],body") || el;
  const cssPath = (node) => {
    if (node.id) return "#" + node.id;
    const parts = [];
    let cur = node;
    while (cur && cur.nodeType === 1 && parts.length < 5) {
      let name = cur.tagName.toLowerCase();
      if (cur.classList && cur.classList.length) {
        name += "." + Array.from(cur.classList).slice(0, 2).join(".");
      }
      parts.unshift(name);
      cur = cur.parentElement;
      if (cur && cur.tagName === "BODY") break;
    }
    return parts.join(" > ");
  };
  return {
    url: location.href,
    tag: el.tagName.toLowerCase(),
    selector: cssPath(el),
    text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 120),
    ariaLabel: (el.getAttribute("aria-label") || "").trim(),
    href: typeof el.href === "string" ? el.href : "",
    nearby: (root.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 240),
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    viewport: { w: window.innerWidth, h: window.innerHeight }
  };
}`;

export function wrapDebugger(dbg: DebuggerLike): CdpClient {
  return {
    attach() {
      if (!dbg.isAttached()) dbg.attach("1.3");
    },
    send(method, params) {
      return dbg.sendCommand(method, params);
    },
    onMessage(fn) {
      const listener = (...args: unknown[]) => {
        fn(String(args[1] ?? ""), args[2]);
      };
      dbg.on("message", listener);
      return () => dbg.removeListener("message", listener);
    }
  };
}

export function backendNodeId(params: unknown): number | null {
  if (!params || typeof params !== "object") return null;
  const id = (params as { backendNodeId?: unknown }).backendNodeId;
  return typeof id === "number" ? id : null;
}

export async function setInspectEnabled(
  cdp: CdpClient,
  on: boolean
): Promise<void> {
  cdp.attach();
  await cdp.send("DOM.enable");
  await cdp.send("Overlay.enable");
  await cdp.send("Overlay.setInspectMode", {
    mode: on ? "searchForNode" : "none",
    highlightConfig: INSPECT_HIGHLIGHT
  });
}

export async function pickFromBackendNode(
  cdp: CdpClient,
  nodeId: number
): Promise<PreviewPickResult | null> {
  const resolved = (await cdp.send("DOM.resolveNode", {
    backendNodeId: nodeId
  })) as { object?: { objectId?: string } };
  const objectId = resolved.object?.objectId;
  if (!objectId) return null;
  const evaled = (await cdp.send("Runtime.callFunctionOn", {
    objectId,
    functionDeclaration: PICK_FROM_ELEMENT_FN,
    returnByValue: true
  })) as { result?: { value?: PreviewPickResult | null } };
  return evaled.result?.value ?? null;
}

export async function startInspectPick(cdp: CdpClient): Promise<{
  promise: Promise<PreviewPickResult | null>;
  cancel: () => Promise<void>;
}> {
  await setInspectEnabled(cdp, true);
  return waitForInspectPick(cdp);
}

export function waitForInspectPick(cdp: CdpClient): {
  promise: Promise<PreviewPickResult | null>;
  cancel: () => Promise<void>;
} {
  let settle: (value: PreviewPickResult | null) => void = () => undefined;
  const promise = new Promise<PreviewPickResult | null>((resolve) => {
    settle = resolve;
  });
  let settled = false;
  const finish = async (value: PreviewPickResult | null) => {
    if (settled) return;
    settled = true;
    stop();
    await setInspectEnabled(cdp, false).catch(() => undefined);
    settle(value);
  };
  const stop = cdp.onMessage((method, params) => {
    if (method === "Overlay.inspectModeCanceled") {
      void finish(null);
      return;
    }
    if (method !== "Overlay.inspectNodeRequested") return;
    const id = backendNodeId(params);
    if (id == null) {
      void finish(null);
      return;
    }
    void pickFromBackendNode(cdp, id).then((pick) => finish(pick));
  });
  return { promise, cancel: () => finish(null) };
}
