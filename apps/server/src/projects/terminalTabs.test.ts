import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeTerminalTabs } from "./terminalTabs.js";

describe("terminalTabs", () => {
  it("merges shell and app tabs only", () => {
    const tabs = mergeTerminalTabs({
      shells: [
        { windowId: "1", name: "main", active: true },
        { windowId: "2", name: "sh-abc", active: false }
      ],
      apps: [{ name: "web", running: true }]
    });
    assert.deepEqual(
      tabs.map((tab) => tab.id),
      ["main", "sh-abc", "app:web"]
    );
    assert.equal(tabs.find((tab) => tab.id === "app:web")?.stoppable, true);
    const qualified = mergeTerminalTabs({
      shells: [],
      apps: [{ name: "bp-backend/bp-backend", running: false }]
    });
    assert.equal(qualified[0]?.id, "app:bp-backend/bp-backend");
    assert.equal(qualified[0]?.label, "bp-backend");
  });
});
