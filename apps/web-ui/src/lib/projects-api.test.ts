import { describe, it, expect } from "vitest";
import * as api from "./projects-api";

describe("projects-api barrel", () => {
  it("re-exports core project helpers", () => {
    expect(typeof api.fetchProjects).toBe("function");
    expect(typeof api.getActivity).toBe("function");
    expect(typeof api.retryStage).toBe("function");
    expect(typeof api.createChat).toBe("function");
    expect(api.ConnectProjectError).toBeTruthy();
  });
});
