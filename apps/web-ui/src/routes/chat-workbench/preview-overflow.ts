export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 25;
export const ZOOM_DEFAULT = 100;

export type ShotRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value)));
}

export function stepZoom(current: number, dir: 1 | -1): number {
  return clampZoom(current + dir * ZOOM_STEP);
}

export function iframeZoomStyle(zoom: number): {
  transform: string;
  transformOrigin: "top left";
  width: string;
  height: string;
} {
  const scale = clampZoom(zoom) / 100;
  return {
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    width: `${100 / scale}%`,
    height: `${100 / scale}%`
  };
}

export function normalizeCrop(
  a: { x: number; y: number },
  b: { x: number; y: number }
): ShotRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y)
  };
}

export function mapCropToPage(rect: ShotRect, zoom: number): ShotRect {
  const scale = clampZoom(zoom) / 100;
  return {
    x: rect.x / scale,
    y: rect.y / scale,
    w: rect.w / scale,
    h: rect.h / scale
  };
}

export function cacheBustUrl(url: string, nonce: number): string {
  try {
    const next = new URL(url);
    next.searchParams.set("_forge_cb", String(nonce));
    return next.href;
  } catch {
    return url;
  }
}

export function clearSiteUrl(appUrl: string): string | null {
  try {
    return `${new URL(appUrl).origin}/__forge/clear`;
  } catch {
    return null;
  }
}

export function inspectShotUrl(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    const src = `${u.pathname}${u.search}${u.hash}` || "/";
    return `${u.origin}/__forge/inspect?src=${encodeURIComponent(src)}`;
  } catch {
    return null;
  }
}

export function screenshotFilename(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `preview-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const SHOT_CONTEXT_PAD = 48;

export function padShotRect(
  rect: ShotRect,
  viewport: { w: number; h: number }
): ShotRect {
  const x = Math.max(0, Math.round(rect.x - SHOT_CONTEXT_PAD));
  const y = Math.max(0, Math.round(rect.y - SHOT_CONTEXT_PAD));
  const right = Math.min(
    viewport.w,
    Math.round(rect.x + rect.w + SHOT_CONTEXT_PAD)
  );
  const bottom = Math.min(
    viewport.h,
    Math.round(rect.y + rect.h + SHOT_CONTEXT_PAD)
  );
  return {
    x,
    y,
    w: Math.max(1, right - x),
    h: Math.max(1, bottom - y)
  };
}

export function shotRectToBounds(rect: ShotRect): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return { x: rect.x, y: rect.y, width: rect.w, height: rect.h };
}

export async function copyPngDataUrl(dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob();
  const type = blob.type || "image/png";
  await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  el.remove();
}

export async function captureInspectFrameShot(options: {
  iframe: HTMLIFrameElement;
  origin: string;
  rect?: ShotRect;
  timeoutMs?: number;
}): Promise<string> {
  const win = options.iframe.contentWindow;
  if (!win) throw new Error("Preview is not ready");

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Screenshot timed out"));
    }, options.timeoutMs ?? 8000);

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== options.origin) return;
      const data = e.data as {
        type?: string;
        dataUrl?: string;
        error?: string;
      };
      if (data?.type !== "forge-inspect-shot-result") return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      if (typeof data.dataUrl === "string") {
        resolve(data.dataUrl);
        return;
      }
      reject(new Error(data.error || "Screenshot failed"));
    };

    window.addEventListener("message", onMessage);
    win.postMessage({ type: "forge-inspect-shot", rect: options.rect }, options.origin);
  });
}

export async function capturePreviewShot(options: {
  pageUrl: string;
  width: number;
  height: number;
  rect?: ShotRect;
  timeoutMs?: number;
}): Promise<string> {
  const shotUrl = inspectShotUrl(options.pageUrl);
  if (!shotUrl) throw new Error("Invalid preview URL");
  const origin = new URL(options.pageUrl).origin;
  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    iframe.setAttribute("title", "Preview screenshot");
    iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;border:0;`;
    iframe.src = shotUrl;

    let requested = false;
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Screenshot timed out"));
    }, options.timeoutMs ?? 8000);

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
      const data = e.data as {
        type?: string;
        dataUrl?: string;
        error?: string;
      };
      if (data?.type === "forge-inspect-ready" && !requested) {
        requested = true;
        iframe.contentWindow?.postMessage(
          { type: "forge-inspect-shot", rect: options.rect },
          origin
        );
        return;
      }
      if (data?.type !== "forge-inspect-shot-result") return;
      cleanup();
      if (typeof data.dataUrl === "string") {
        resolve(data.dataUrl);
        return;
      }
      reject(new Error(data.error || "Screenshot failed"));
    };

    function cleanup() {
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      iframe.remove();
    }

    window.addEventListener("message", onMessage);
    document.body.appendChild(iframe);
  });
}

export async function clearPreviewSite(
  appUrl: string,
  timeoutMs = 4000
): Promise<void> {
  const url = clearSiteUrl(appUrl);
  if (!url) return;
  const origin = new URL(appUrl).origin;

  await new Promise<void>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    iframe.style.cssText =
      "position:fixed;left:-10000px;width:1px;height:1px;border:0;";
    iframe.src = url;
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
      if ((e.data as { type?: string } | null)?.type !== "forge-preview-cleared") {
        return;
      }
      cleanup();
      resolve();
    };
    function cleanup() {
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      iframe.remove();
    }
    window.addEventListener("message", onMessage);
    document.body.appendChild(iframe);
  });
}
