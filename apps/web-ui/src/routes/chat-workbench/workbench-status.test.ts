import { describe, it, expect } from "vitest";
import { deriveTurnStatus } from "./workbench-status";

describe("deriveTurnStatus", () => {
  it("prefers waiting on you when ask-user is pending", () => {
    expect(
      deriveTurnStatus({ status: "streaming", pendingAskUser: true })
    ).toBe("waiting");
  });

  it("maps submitted and streaming", () => {
    expect(
      deriveTurnStatus({ status: "submitted", pendingAskUser: false })
    ).toBe("thinking");
    expect(
      deriveTurnStatus({ status: "streaming", pendingAskUser: false })
    ).toBe("running");
  });

  it("is idle when ready or errored", () => {
    expect(deriveTurnStatus({ status: "ready", pendingAskUser: false })).toBe(
      "idle"
    );
    expect(deriveTurnStatus({ status: "error", pendingAskUser: false })).toBe(
      "idle"
    );
  });
});
