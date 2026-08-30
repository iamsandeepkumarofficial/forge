export function pathFromPreviewUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}${u.hash}` || "/";
  } catch {
    return url.startsWith("/") ? url : "/";
  }
}

export function pushPreviewHistory(
  stack: string[],
  step: { index: number; next: string }
): { stack: string[]; index: number } {
  const { index, next } = step;
  if (stack[index] === next) return { stack, index };
  const trimmed = stack.slice(0, index + 1);
  trimmed.push(next);
  return { stack: trimmed, index: trimmed.length - 1 };
}

export function resolvePreviewNavigation(
  baseUrl: string,
  typed: string
): string | null {
  const raw = typed.trim();
  if (!raw) return null;
  try {
    const base = new URL(baseUrl);
    if (raw.startsWith("/") || raw.startsWith("?") || raw.startsWith("#")) {
      return new URL(raw, base.origin).href;
    }
    if (/^https?:\/\//i.test(raw)) {
      const next = new URL(raw);
      return next.origin === base.origin ? next.href : null;
    }
    if (!raw.includes("://")) {
      return new URL(`/${raw}`, base.origin).href;
    }
    return null;
  } catch {
    return null;
  }
}

export function previewFrameUrl(appUrl: string, commenting = false): string {
  const u = new URL(appUrl);
  const src = `${u.pathname}${u.search}${u.hash}` || "/";
  const qs = new URLSearchParams({ src });
  if (commenting) qs.set("mode", "comment");
  return `${u.origin}/__forge/inspect?${qs.toString()}`;
}

export function inspectFrameUrl(appUrl: string): string {
  return previewFrameUrl(appUrl, true);
}

export function stripCacheBust(url: string): string {
  try {
    const next = new URL(url);
    next.searchParams.delete("_forge_cb");
    return next.href;
  } catch {
    return url;
  }
}

export function samePreviewUrl(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    const path = (p: string) => (p === "/" ? "/" : p.replace(/\/$/, ""));
    return (
      ua.origin === ub.origin &&
      path(ua.pathname) === path(ub.pathname) &&
      ua.search === ub.search &&
      ua.hash === ub.hash
    );
  } catch {
    return a === b;
  }
}

export type PreviewAnchor = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PreviewPick = {
  url: string;
  selector: string;
  tag: string;
  text: string;
  ariaLabel?: string;
  href?: string;
  nearby?: string;
  shot?: string;
  pageShot?: string;
  anchor?: PreviewAnchor;
  viewport?: { w: number; h: number };
};

export function formatPreviewComment(
  pick: PreviewPick,
  comment: string
): string {
  const body = comment.trim();
  const quote = pick.text.trim();
  const lines = [
    "I left a comment on the preview.",
    "",
    `URL: ${pick.url}`,
    `Element: ${pick.tag}${pick.selector ? ` \`${pick.selector}\`` : ""}`
  ];
  if (pick.ariaLabel) lines.push(`Accessible name: ${pick.ariaLabel}`);
  if (pick.href) lines.push(`Href: ${pick.href}`);
  if (quote) lines.push(`Text: "${quote}"`);
  if (pick.nearby) lines.push(`Nearby: "${pick.nearby}"`);
  if (body) {
    lines.push("", body);
  }
  if (pick.shot) {
    lines.push("", "Section screenshot:", "", `![preview section](${pick.shot})`);
  }
  return lines.join("\n");
}
