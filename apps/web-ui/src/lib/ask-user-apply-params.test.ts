import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyAskUserFormToWorkspaceParams } from "./ask-user-apply-params";

const upsertWorkspaceParameter = vi.fn();

vi.mock("./workspaces-api.js", () => ({
  upsertWorkspaceParameter: (...args: unknown[]) =>
    upsertWorkspaceParameter(...args)
}));

describe("ask-user-apply-params", () => {
  beforeEach(() => {
    upsertWorkspaceParameter.mockReset();
    upsertWorkspaceParameter.mockResolvedValue({
      key: "JWT_SECRET",
      value: "x",
      secret: true
    });
  });

  it("upserts only UPPER_SNAKE fields with non-empty values", async () => {
    const saved = await applyAskUserFormToWorkspaceParams({
      workspaceId: "w1",
      fields: [
        { id: "JWT_SECRET", label: "JWT", secret: true },
        { id: "NODE_ENV", label: "Env" },
        { id: "skip_me", label: "Skip" },
        { id: "EMPTY", label: "Empty" }
      ],
      values: {
        JWT_SECRET: " secret ",
        NODE_ENV: "development",
        skip_me: "nope",
        EMPTY: "   "
      }
    });
    expect(saved).toEqual(["JWT_SECRET", "NODE_ENV"]);
    expect(upsertWorkspaceParameter).toHaveBeenCalledTimes(2);
    expect(upsertWorkspaceParameter).toHaveBeenNthCalledWith(1, "w1", {
      key: "JWT_SECRET",
      value: "secret",
      secret: true
    });
    expect(upsertWorkspaceParameter).toHaveBeenNthCalledWith(2, "w1", {
      key: "NODE_ENV",
      value: "development",
      secret: false
    });
  });
});
