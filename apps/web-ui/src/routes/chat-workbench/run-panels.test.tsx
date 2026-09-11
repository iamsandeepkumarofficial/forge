import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AppPreviewPane } from "./run-panels";

vi.mock("../../lib/tool-runner.js", () => ({
  fetchApps: vi.fn()
}));

vi.mock("../../lib/session-http.js", () => ({
  requestSessionAppHttp: vi.fn(async () => {
    throw new Error("no spec");
  }),
  fetchAppRoutes: vi.fn(async () => [])
}));

import { fetchApps } from "../../lib/tool-runner.js";

describe("run-panels", () => {
  beforeEach(() => {
    vi.mocked(fetchApps).mockResolvedValue({ exists: true, apps: [] });
  });

  it("AppPreviewPane shows guidance when idle", async () => {
    render(<AppPreviewPane sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText(/No preview yet/i)).toBeTruthy();
    });
  });

  it("AppPreviewPane shows an editable URL bar and comment control for web apps", async () => {
    vi.mocked(fetchApps).mockResolvedValue({
      exists: true,
      apps: [
        {
          name: "web",
          type: "web",
          cwd: ".",
          command: "yarn dev",
          port: 3001,
          running: true,
          url: "http://p3001-s-abc.preview.localhost:8081/"
        }
      ]
    });
    render(<AppPreviewPane sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Preview URL")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Go" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Comment on an element" })
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "DevTools" })).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Preview options" })
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Terminal" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Open in new tab" })
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Copy URL" })).toBeNull();
    });
    await waitFor(() => {
      const frame = document.querySelector("iframe");
      expect(frame?.getAttribute("src")).toContain("/__forge/inspect?src=");
    });
  });

  it("enables back after in-preview navigation", async () => {
    const origin = "http://p3001-s-abc.preview.localhost:8081";
    vi.mocked(fetchApps).mockResolvedValue({
      exists: true,
      apps: [
        {
          name: "web",
          type: "web",
          cwd: ".",
          command: "yarn dev",
          port: 3001,
          running: true,
          url: `${origin}/`
        }
      ]
    });
    render(<AppPreviewPane sessionId="s1" />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Back" }).hasAttribute("disabled")
      ).toBe(true);
    });
    const url = screen.getByLabelText("Preview URL");
    fireEvent.change(url, { target: { value: `${origin}/about` } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Back" }).hasAttribute("disabled")
      ).toBe(false);
      expect((url as HTMLInputElement).value).toBe(`${origin}/about`);
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => {
      expect((url as HTMLInputElement).value).toBe(`${origin}/`);
      expect(
        screen.getByRole("button", { name: "Forward" }).hasAttribute("disabled")
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    await waitFor(() => {
      expect((url as HTMLInputElement).value).toBe(`${origin}/about`);
    });
  });

  it("opens the preview overflow menu with screenshot and zoom actions", async () => {
    vi.mocked(fetchApps).mockResolvedValue({
      exists: true,
      apps: [
        {
          name: "web",
          type: "web",
          cwd: ".",
          command: "yarn dev",
          port: 3001,
          running: true,
          url: "http://p3001-s-abc.preview.localhost:8081/"
        }
      ]
    });
    render(<AppPreviewPane sessionId="s1" />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Preview options" })
      ).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview options" }));
    await waitFor(() => {
      expect(screen.getByText("Take Screenshot")).toBeTruthy();
      expect(screen.getByText("Hard Reload")).toBeTruthy();
      expect(screen.getByText("Zoom")).toBeTruthy();
      expect(screen.getByText("Clear Cache")).toBeTruthy();
    });
  });

  it("AppPreviewPane shows a request builder and port-only selector for api ports", async () => {
    vi.mocked(fetchApps).mockResolvedValue({
      exists: true,
      apps: [
        {
          name: "bp-backend",
          type: "api",
          cwd: ".",
          command: "yarn dev",
          port: 3000,
          running: true,
          hostPort: 13000,
          url: "http://p3000-s-abc.preview.localhost:8081/"
        }
      ]
    });
    render(<AppPreviewPane sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
      expect(
        screen.getByRole("combobox", { name: "Preview port" })
      ).toBeTruthy();
    });
    expect(screen.getByRole("option", { name: "3000" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /bp-backend/i })).toBeNull();
  });

  it("AppPreviewPane explains missing URL for out-of-range ports", async () => {
    vi.mocked(fetchApps).mockResolvedValue({
      exists: true,
      apps: [
        {
          name: "web",
          type: "web",
          cwd: ".",
          command: "yarn dev",
          port: 4000,
          running: true
        }
      ]
    });
    render(<AppPreviewPane sessionId="s1" />);
    await waitFor(() => {
      expect(screen.getByText(/no preview URL/i)).toBeTruthy();
      expect(screen.getByText(/3000–3009/i)).toBeTruthy();
    });
  });
});
