import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceShell } from "./workspace-shell";

describe("WorkspaceShell", () => {
  it("renders Chats and Settings nav and back to home", () => {
    render(
      <MemoryRouter initialEntries={["/workspaces/w1/chats"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId" element={<WorkspaceShell />}>
            <Route path="chats" element={<div>Chats body</div>} />
            <Route path="settings" element={<div>Settings body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Chats" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Activity" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to home" })).toBeTruthy();
    expect(screen.getByText("Chats body")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Collapse sidebar/i })
    ).toBeTruthy();
  });
});
