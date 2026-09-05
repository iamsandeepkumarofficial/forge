import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  closeShellTab,
  createShellTab,
  listTerminalTabs,
  stopTerminalJob
} from "./session-terminal";

describe("session-terminal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("lists terminal tabs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tabs: [{ id: "main", kind: "shell", label: "Shell", running: false }]
      })
    } as Response);
    const tabs = await listTerminalTabs("s1");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/internal/terminal/tabs?sessionId=s1",
      expect.any(Object)
    );
    expect(tabs[0]?.id).toBe("main");
  });

  it("creates and closes shell tabs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tabId: "sh-new",
        tab: {
          id: "sh-new",
          kind: "shell",
          label: "sh-new",
          running: false,
          closable: true
        }
      })
    } as Response);
    const created = await createShellTab("s1");
    expect(created.tabId).toBe("sh-new");
    expect(created.tab.id).toBe("sh-new");

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true })
    } as Response);
    await closeShellTab({ sessionId: "s1", tabId: "sh-new" });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/internal/terminal/tabs/sh-new?sessionId=s1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("stops terminal jobs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true })
    } as Response);
    await stopTerminalJob({ sessionId: "s1", name: "install" });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/internal/terminal/stop",
      expect.objectContaining({ method: "POST" })
    );
  });
});
