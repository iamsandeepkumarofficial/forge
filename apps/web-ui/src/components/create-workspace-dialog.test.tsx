import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

vi.mock("../lib/workspaces-api.js", () => ({
  createWorkspace: vi.fn()
}));

import { createWorkspace } from "../lib/workspaces-api.js";

describe("CreateWorkspaceDialog", () => {
  beforeEach(() => {
    vi.mocked(createWorkspace).mockResolvedValue({
      id: "w1",
      name: "Feature workspace",
      members: [],
      routes: []
    } as never);
  });

  it("creates a workspace and notifies onCreated", async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<CreateWorkspaceDialog onClose={onClose} onCreated={onCreated} />);
    expect(screen.getByText("Create a workspace")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("My workspace"), {
      target: { value: "Feature workspace" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(createWorkspace).toHaveBeenCalledWith("Feature workspace");
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: "w1", name: "Feature workspace" })
      );
    });
  });

  it("closes on cancel", () => {
    const onClose = vi.fn();
    render(<CreateWorkspaceDialog onClose={onClose} onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
