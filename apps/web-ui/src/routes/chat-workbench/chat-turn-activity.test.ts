import { describe, it, expect } from "vitest";
import { chatTurnActivity, liveToolName } from "./chat-turn-activity";

describe("chatTurnActivity", () => {
  it("labels thinking, running, and waiting", () => {
    expect(chatTurnActivity({ status: "submitted" })).toBe("Thinking…");
    expect(chatTurnActivity({ status: "streaming" })).toBe("Running…");
    expect(
      chatTurnActivity({ status: "streaming", toolName: "bash" })
    ).toBe("Running bash…");
    expect(
      chatTurnActivity({ status: "streaming", waiting: true })
    ).toBe("Waiting on you");
  });

  it("is silent when the turn is idle", () => {
    expect(chatTurnActivity({ status: "ready" })).toBeNull();
    expect(chatTurnActivity({ status: "error" })).toBeNull();
  });
});

describe("liveToolName", () => {
  it("returns the latest unfinished tool", () => {
    expect(
      liveToolName([
        { type: "tool-bash", toolName: "bash", output: "ok" },
        { type: "tool-write", toolName: "writeFile" }
      ])
    ).toBe("writeFile");
  });

  it("ignores finished and failed tools", () => {
    expect(
      liveToolName([
        { type: "tool-bash", toolName: "bash", output: "ok" },
        { type: "tool-write", toolName: "writeFile", errorText: "nope" }
      ])
    ).toBeUndefined();
  });
});
