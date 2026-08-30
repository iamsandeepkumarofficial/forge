import { describe, it, expect } from "vitest";
import {
  formatPreviewComment,
  inspectFrameUrl,
  pathFromPreviewUrl,
  previewFrameUrl,
  pushPreviewHistory,
  resolvePreviewNavigation,
  samePreviewUrl,
  stripCacheBust
} from "./preview-nav";

const BASE = "http://p3001-s-abc.preview.localhost:8081/app";

describe("preview-nav", () => {
  it("allows same-origin paths and full urls", () => {
    expect(resolvePreviewNavigation(BASE, "/about")).toBe(
      "http://p3001-s-abc.preview.localhost:8081/about"
    );
    expect(resolvePreviewNavigation(BASE, "about")).toBe(
      "http://p3001-s-abc.preview.localhost:8081/about"
    );
    expect(
      resolvePreviewNavigation(
        BASE,
        "http://p3001-s-abc.preview.localhost:8081/x"
      )
    ).toBe("http://p3001-s-abc.preview.localhost:8081/x");
  });

  it("tracks preview history and extracts the path", () => {
    const first = pushPreviewHistory([], { index: -1, next: `${BASE}/a` });
    const second = pushPreviewHistory(first.stack, {
      index: first.index,
      next: `${BASE}/b`
    });
    expect(second.stack).toEqual([`${BASE}/a`, `${BASE}/b`]);
    expect(pathFromPreviewUrl("http://p3001-s-abc.preview.localhost:8081/about?x=1")).toBe(
      "/about?x=1"
    );
  });

  it("rejects other origins", () => {
    expect(resolvePreviewNavigation(BASE, "https://evil.example/")).toBeNull();
  });

  it("builds inspect and preview frame urls", () => {
    expect(inspectFrameUrl(`${BASE}/home`)).toContain("/__forge/inspect?src=");
    expect(inspectFrameUrl(`${BASE}/home`)).toContain("mode=comment");
    expect(previewFrameUrl(`${BASE}/home`)).toContain("/__forge/inspect?src=");
    expect(previewFrameUrl(`${BASE}/home`)).not.toContain("mode=comment");
    expect(samePreviewUrl(`${BASE}/home`, `${BASE}/home/`)).toBe(true);
    expect(stripCacheBust(`${BASE}/home?_forge_cb=3`)).toBe(`${BASE}/home`);
  });

  it("formats a comment for chat", () => {
    const text = formatPreviewComment(
      {
        url: `${BASE}/`,
        selector: "button.cta",
        tag: "button",
        text: "Coming Soon"
      },
      "Make this primary."
    );
    expect(text).toContain("I left a comment on the preview.");
    expect(text).toContain("button.cta");
    expect(text).toContain("Make this primary.");
  });

  it("includes nearby context and a section screenshot", () => {
    const text = formatPreviewComment(
      {
        url: `${BASE}/`,
        selector: "a.cta",
        tag: "a",
        text: "Go",
        nearby: "Hero Go now",
        href: `${BASE}/start`,
        shot: "data:image/png;base64,xx"
      },
      "Bigger."
    );
    expect(text).toContain("Nearby: \"Hero Go now\"");
    expect(text).toContain("Href:");
    expect(text).toContain("![preview section](data:image/png;base64,xx)");
  });
});
