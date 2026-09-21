import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConnectProjectDialog } from "./connect-project-dialog";

vi.mock("../lib/desktop.js", () => ({
  isDesktop: () => false,
  pickFolder: vi.fn()
}));
vi.mock("../lib/projects-api.js", () => ({
  connectLocalProject: vi.fn()
}));

import { connectLocalProject } from "../lib/projects-api.js";

describe("ConnectProjectDialog", () => {
  beforeEach(() => {
    vi.mocked(connectLocalProject).mockResolvedValue({
      projectId: "p1",
      workspaceId: "w1"
    });
  });

  it("renders connect heading and cancel closes", () => {
    const onClose = vi.fn();
    render(<ConnectProjectDialog onClose={onClose} onConnected={vi.fn()} />);
    expect(screen.getByText("Connect a project")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("connects a local path and notifies connected", async () => {
    const onConnected = vi.fn();
    const onClose = vi.fn();
    render(
      <ConnectProjectDialog onClose={onClose} onConnected={onConnected} />
    );
    fireEvent.change(screen.getByPlaceholderText(/\/Users\/you\/projects/i), {
      target: { value: "/tmp/my-app" }
    });
    fireEvent.click(screen.getByLabelText("Connect folder"));
    await waitFor(() => {
      expect(connectLocalProject).toHaveBeenCalledWith("/tmp/my-app");
      expect(onConnected).toHaveBeenCalledWith("w1");
      expect(onClose).toHaveBeenCalled();
    });
  });
});
