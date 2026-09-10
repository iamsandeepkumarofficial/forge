import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PreviewHost, type HostedView } from "./previewHost.js";

function fakeView(): HostedView & { visible: boolean; bounds: unknown } {
  const state = { url: "about:blank", visible: false, bounds: null as unknown };
  const wc = {
    loadURL: async (url: string) => {
      state.url = url;
    },
    getURL: () => state.url,
    reload: () => undefined,
    reloadIgnoringCache: () => undefined,
    goBack: () => undefined,
    goForward: () => undefined,
    canGoBack: () => false,
    canGoForward: () => false,
    setZoomFactor: () => undefined,
    capturePage: async () => ({ toDataURL: () => "data:image/png;base64,xx" }),
    executeJavaScript: async () => null,
    setDevToolsWebContents: () => undefined,
    openDevTools: () => undefined,
    on: () => undefined,
    session: { clearStorageData: async () => undefined }
  };
  return {
    webContents: wc,
    visible: false,
    bounds: null,
    setBounds(bounds) {
      state.bounds = bounds;
      this.bounds = bounds;
    },
    setVisible(visible) {
      state.visible = visible;
      this.visible = visible;
    }
  };
}

describe("PreviewHost", () => {
  it("skips loadURL when already on that href", async () => {
    const preview = fakeView();
    const devtools = fakeView();
    const host = new PreviewHost(
      {
        contentView: { addChildView: () => undefined },
        webContents: { send: () => undefined }
      },
      {
        createPreview: () => preview,
        createDevtools: () => devtools
      }
    );
    await host.loadURL("http://app.test/home");
    await host.loadURL("http://app.test/home");
    assert.equal(preview.webContents.getURL(), "http://app.test/home");
    host.setPreviewBounds({ x: 10, y: 20, width: 100, height: 80 });
    assert.deepEqual(preview.bounds, { x: 10, y: 20, width: 100, height: 80 });
    host.setPreviewVisible(true);
    assert.equal(preview.visible, true);
    host.setDevtoolsVisible(true);
    assert.equal(devtools.visible, true);
  });

  it("hides a view when bounds have no size", () => {
    const preview = fakeView();
    preview.setVisible(true);
    const host = new PreviewHost(
      {
        contentView: { addChildView: () => undefined },
        webContents: { send: () => undefined }
      },
      {
        createPreview: () => preview,
        createDevtools: () => fakeView()
      }
    );
    host.setPreviewBounds({ x: 0, y: 0, width: 0, height: 10 });
    assert.equal(preview.visible, false);
  });

  it("always loads about:blank even if already blank-skipping would apply", async () => {
    const preview = fakeView();
    const host = new PreviewHost(
      {
        contentView: { addChildView: () => undefined },
        webContents: { send: () => undefined }
      },
      {
        createPreview: () => preview,
        createDevtools: () => fakeView()
      }
    );
    await host.loadURL("http://other.test/");
    await host.loadURL("about:blank");
    assert.equal(preview.webContents.getURL(), "about:blank");
  });

  it("picks via Chromium inspect mode when a debugger is present", async () => {
    const listeners = new Set<(...args: unknown[]) => void>();
    const preview = fakeView();
    preview.webContents.debugger = {
      isAttached: () => true,
      attach() {
        return undefined;
      },
      async sendCommand(method) {
        if (method === "DOM.resolveNode") {
          return { object: { objectId: "1" } };
        }
        if (method === "Runtime.callFunctionOn") {
          return {
            result: {
              value: {
                url: "http://app.test/",
                tag: "button",
                selector: "button",
                text: "Go"
              }
            }
          };
        }
        return {};
      },
      on(_event, listener) {
        listeners.add(listener);
      },
      removeListener(_event, listener) {
        listeners.delete(listener);
      }
    };
    const host = new PreviewHost(
      {
        contentView: { addChildView: () => undefined },
        webContents: { send: () => undefined }
      },
      {
        createPreview: () => preview,
        createDevtools: () => fakeView()
      }
    );
    const pending = host.startPick();
    for (let i = 0; i < 20 && listeners.size === 0; i++) {
      await Promise.resolve();
    }
    for (const listener of listeners) {
      listener({}, "Overlay.inspectNodeRequested", { backendNodeId: 7 });
    }
    const pick = await pending;
    assert.equal(pick?.tag, "button");
  });
});
