import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AppPreviewPane } from "./run-panels";

vi.mock("../../lib/tool-runner.js", () => ({
  fetchApps: vi.fn()
}));

import { fetchApps } from "../../lib/tool-runner.js";

describe("run-panels", () => {
  beforeEach(() => {
    vi.mocked(fetchApps).mockResolvedValue({ exists: true, apps: [] });
  });

  it("AppPreviewPane shows guidance when idle", async () => {
    render(<AppPreviewPane sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText(/No web app is running/i)).toBeTruthy();
    });
  });
});
