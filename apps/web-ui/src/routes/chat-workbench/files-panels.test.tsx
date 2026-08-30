import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FilesTab } from "./files-panels";

vi.mock("../../lib/tool-runner.js", () => ({
  listSandboxDir: vi.fn().mockResolvedValue([]),
  executeTool: vi.fn(),
  fetchFileDiff: vi.fn(),
  fetchSessionChanges: vi.fn()
}));
vi.mock("../../components/virtual-file-tree.js", () => ({
  VirtualFileTree: () => <div>File tree</div>,
  eagerChildrenFromPaths: () => async () => []
}));
vi.mock("../../components/tool-calls.js", () => ({
  DiffText: () => null
}));

describe("FilesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a refresh control and the file tree", () => {
    render(<FilesTab sessionId="s1" onOpen={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Refresh files" })).toBeTruthy();
    expect(screen.getByText("File tree")).toBeTruthy();
  });
});
