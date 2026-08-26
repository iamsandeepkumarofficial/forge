import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConnectProjectDialog } from "./connect-project-dialog";

vi.mock("../lib/desktop.js", () => ({
  isDesktop: () => false,
  pickFolder: vi.fn()
}));
vi.mock("../lib/projects-api.js", () => ({
  connectProject: vi.fn(),
  connectLocalProject: vi.fn()
}));
vi.mock("./github-repo-picker.js", () => ({
  GithubRepoPicker: ({
    open,
    onSelect
  }: {
    open: boolean;
    onSelect: (slug: string) => void;
  }) =>
    open ? (
      <button type="button" onClick={() => void onSelect("octocat/hello")}>
        Pick repo
      </button>
    ) : null
}));

import { connectProject, connectLocalProject } from "../lib/projects-api.js";

describe("ConnectProjectDialog", () => {
  beforeEach(() => {
    vi.mocked(connectProject).mockResolvedValue({
      projectId: "p1",
      alreadyConnected: false
    });
    vi.mocked(connectLocalProject).mockResolvedValue({ projectId: "p1" });
  });

  it("renders connect heading and cancel closes", () => {
    const onClose = vi.fn();
    render(<ConnectProjectDialog onClose={onClose} onConnected={vi.fn()} />);
    expect(screen.getByText("Connect a workspace")).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => {
      expect(connectLocalProject).toHaveBeenCalledWith("/tmp/my-app");
      expect(onConnected).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("connects a github repo via picker", async () => {
    const onConnected = vi.fn();
    render(
      <ConnectProjectDialog onClose={vi.fn()} onConnected={onConnected} />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with GitHub" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Pick repo" }));
    await waitFor(() => {
      expect(connectProject).toHaveBeenCalledWith("octocat/hello");
      expect(onConnected).toHaveBeenCalled();
    });
  });
});
