import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProjectCard } from "./project-card";

vi.mock("../lib/projects-api.js", () => ({
  fetchProject: vi.fn()
}));

import { fetchProject } from "../lib/projects-api.js";

describe("ProjectCard", () => {
  beforeEach(() => {
    vi.mocked(fetchProject).mockResolvedValue({
      id: "p1",
      name: "Forge",
      source: "github",
      status: "available"
    });
  });

  it("renders name, source, and status", () => {
    render(
      <ProjectCard
        projectId="p1"
        name="Forge"
        source="github"
        status="available"
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText("Forge")).toBeTruthy();
    expect(screen.getByText(/GitHub/)).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy();
  });

  it("calls onOpen when the card is clicked", () => {
    const onOpen = vi.fn();
    render(
      <ProjectCard
        projectId="p1"
        name="Forge"
        source="upload"
        status="unavailable"
        onOpen={onOpen}
        onDelete={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Forge/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("refreshes via fetchProject without opening", async () => {
    const onOpen = vi.fn();
    render(
      <ProjectCard
        projectId="p1"
        name="Forge"
        source="github"
        status="available"
        onOpen={onOpen}
        onDelete={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => {
      expect(fetchProject).toHaveBeenCalledWith("p1");
    });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
