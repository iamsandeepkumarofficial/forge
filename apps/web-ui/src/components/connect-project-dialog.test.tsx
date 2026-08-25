import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConnectProjectDialog } from "./connect-project-dialog";

vi.mock("../lib/projects-api.js", () => ({
  connectProject: vi.fn(),
  uploadProject: vi.fn()
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

import { connectProject, uploadProject } from "../lib/projects-api.js";

describe("ConnectProjectDialog", () => {
  beforeEach(() => {
    vi.mocked(connectProject).mockResolvedValue({
      projectId: "p1",
      alreadyConnected: false
    });
    vi.mocked(uploadProject).mockResolvedValue({ projectId: "p1" });
  });

  it("renders connect heading and cancel closes", () => {
    const onClose = vi.fn();
    render(<ConnectProjectDialog onClose={onClose} onConnected={vi.fn()} />);
    expect(screen.getByText("Connect a workspace")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("uploads a zip and notifies connected", async () => {
    const onConnected = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <ConnectProjectDialog onClose={onClose} onConnected={onConnected} />
    );
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["zip"], "app.zip", { type: "application/zip" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload ZIP" }));
    await waitFor(() => {
      expect(uploadProject).toHaveBeenCalledWith(file);
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
