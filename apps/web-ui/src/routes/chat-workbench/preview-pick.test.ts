import { describe, it, expect, vi } from "vitest";
import {
  capturePickShot,
  pickFromElectron,
  pickShotRect,
  previewPickFields
} from "./preview-pick";

describe("preview-pick", () => {
  it("keeps nearby context fields", () => {
    expect(
      previewPickFields({
        url: "http://app.test/",
        tag: "a",
        selector: "a.cta",
        text: "Go",
        ariaLabel: "Start",
        href: "http://app.test/go",
        nearby: "Hero Start"
      })
    ).toMatchObject({
      tag: "a",
      ariaLabel: "Start",
      nearby: "Hero Start"
    });
  });

  it("rejects a malformed rect", () => {
    expect(pickShotRect({ rect: { x: 1 } })).toBeUndefined();
  });

  it("pads the picked rect inside the viewport", () => {
    expect(
      pickShotRect({
        rect: { x: 10, y: 10, w: 20, h: 20 },
        viewport: { w: 200, h: 200 }
      })
    ).toEqual({ x: 0, y: 0, w: 78, h: 78 });
  });

  it("captures a padded section when a rect exists", async () => {
    const capture = vi.fn(async () => "data:image/png;base64,xx");
    await expect(
      capturePickShot({ rect: { x: 1, y: 2, w: 3, h: 4 }, capture })
    ).resolves.toBe("data:image/png;base64,xx");
    expect(capture).toHaveBeenCalled();
    await expect(capturePickShot({ capture })).resolves.toBeUndefined();
  });

  it("maps an electron pick result", () => {
    const mapped = pickFromElectron({
      url: "http://app.test/",
      selector: "h1",
      tag: "h1",
      text: "Hi",
      rect: { x: 0, y: 0, w: 10, h: 10 },
      viewport: { w: 100, h: 100 }
    });
    expect(mapped.pick.tag).toBe("h1");
    expect(mapped.pick.anchor).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(mapped.rect?.w).toBeGreaterThan(10);
  });
});
