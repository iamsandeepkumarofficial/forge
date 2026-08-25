import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ChangesTab } from "./changes-tab";

vi.mock("../../lib/tool-runner.js", () => ({
  fetchSessionChanges: vi.fn(async () => ({
    repos: [
      {
        repo: "app",
        files: [{ path: "a.ts", status: "M", kind: "modified" }],
        error: null
      }
    ]
  }))
}));

vi.mock("../../components/virtual-file-tree.js", () => ({
  VirtualFileTree: (props: { onSelectFile: (path: string) => void }) => (
    <button type="button" onClick={() => props.onSelectFile("a.ts")}>
      file
    </button>
  ),
  eagerChildrenFromPaths: () => async () => []
}));

describe("ChangesTab", () => {
  it("renders repo changes and opens files", async () => {
    const onOpen = vi.fn();
    const onRepo = vi.fn();
    render(<ChangesTab sessionId="s1" onRepo={onRepo} onOpen={onOpen} />);
    await waitFor(() => {
      expect(screen.getByText("app")).toBeTruthy();
    });
    expect(onRepo).toHaveBeenCalledWith("app");
  });
});
