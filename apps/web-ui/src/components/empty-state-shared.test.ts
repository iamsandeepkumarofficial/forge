import { describe, it, expect } from "vitest";
import { SUGGESTION_SETS, TEMPLATES } from "./empty-state-shared";

describe("empty-state-shared", () => {
  it("exposes suggestion sets and templates", () => {
    expect(SUGGESTION_SETS.length).toBeGreaterThan(0);
    expect(TEMPLATES[0]?.title).toBeTruthy();
  });
});
