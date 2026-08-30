import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  backendNodeId,
  pickFromBackendNode,
  setInspectEnabled,
  startInspectPick,
  waitForInspectPick,
  wrapDebugger
} from "./previewInspect.js";

function fakeCdp(options?: {
  objectId?: string;
  value?: { tag: string };
}): {
  calls: string[];
  client: import("./previewInspect.js").CdpClient;
  emit: (method: string, params: unknown) => void;
} {
  const calls: string[] = [];
  const listeners = new Set<(method: string, params: unknown) => void>();
  return {
    calls,
    emit: (method, params) => {
      for (const fn of listeners) fn(method, params);
    },
    client: {
      attach() {
        calls.push("attach");
      },
      async send(method) {
        calls.push(method);
        if (method === "DOM.resolveNode") {
          return { object: { objectId: options?.objectId } };
        }
        if (method === "Runtime.callFunctionOn") {
          return { result: { value: options?.value ?? null } };
        }
        return {};
      },
      onMessage(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      }
    }
  };
}

describe("previewInspect", () => {
  it("reads backendNodeId and wraps a debugger", () => {
    assert.equal(backendNodeId({ backendNodeId: 9 }), 9);
    assert.equal(backendNodeId({}), null);
    const sent: string[] = [];
    const cdp = wrapDebugger({
      isAttached: () => false,
      attach() {
        sent.push("attach");
      },
      async sendCommand(method) {
        sent.push(method);
        return {};
      },
      on() {
        return undefined;
      },
      removeListener() {
        return undefined;
      }
    });
    cdp.attach();
    assert.deepEqual(sent, ["attach"]);
  });

  it("enables Chromium inspect mode", async () => {
    const fake = fakeCdp();
    await setInspectEnabled(fake.client, true);
    assert.ok(fake.calls.includes("Overlay.setInspectMode"));
    assert.ok(fake.calls.includes("attach"));
  });

  it("picks from a resolved backend node", async () => {
    const fake = fakeCdp({ objectId: "1", value: { tag: "button" } });
    const pick = await pickFromBackendNode(fake.client, 4);
    assert.equal(pick?.tag, "button");
  });

  it("starts inspect mode then waits for a node", async () => {
    const fake = fakeCdp({ objectId: "1", value: { tag: "nav" } });
    const session = await startInspectPick(fake.client);
    fake.emit("Overlay.inspectNodeRequested", { backendNodeId: 2 });
    const pick = await session.promise;
    assert.equal(pick?.tag, "nav");
    assert.ok(fake.calls.includes("Overlay.setInspectMode"));
  });

  it("resolves when inspect requests a node", async () => {
    const fake = fakeCdp({ objectId: "1", value: { tag: "h1" } });
    const session = waitForInspectPick(fake.client);
    fake.emit("Overlay.inspectNodeRequested", { backendNodeId: 3 });
    const pick = await session.promise;
    assert.equal(pick?.tag, "h1");
  });
});
