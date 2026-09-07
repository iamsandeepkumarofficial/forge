import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProjectShell } from "./project-shell";

describe("ProjectShell", () => {
  it("renders chats nav and back to projects", () => {
    render(
      <MemoryRouter initialEntries={["/projects/p1/chats"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectShell />}>
            <Route path="chats" element={<div>Chats body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Chats" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Activity" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to projects" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Board" })).toBeNull();
    expect(screen.getByText("Chats body")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /New chat/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Collapse sidebar/i })
    ).toBeTruthy();
  });
});
