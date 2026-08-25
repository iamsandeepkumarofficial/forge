import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChatsPage } from "./chats";

vi.mock("../lib/projects-api.js", () => ({
  createWorkbenchSession: vi.fn(),
  deleteChat: vi.fn(),
  fetchWorkbenchSessions: vi.fn()
}));
vi.mock("../lib/chat-agent.js", () => ({
  fetchModels: async () => []
}));
vi.mock("../components/chat-composer.js", async () => {
  const actual = await vi.importActual<
    typeof import("../components/chat-composer.js")
  >("../components/chat-composer.js");
  return {
    ...actual,
    ModePicker: () => <div>Mode</div>,
    ModelPicker: () => <div>Model</div>
  };
});

import { fetchWorkbenchSessions } from "../lib/projects-api.js";

describe("ChatsPage", () => {
  beforeEach(() => {
    vi.mocked(fetchWorkbenchSessions).mockResolvedValue([]);
  });

  it("renders new-chat composer when there are no sessions", async () => {
    render(
      <MemoryRouter initialEntries={["/projects/p1/chats"]}>
        <Routes>
          <Route path="/projects/:projectId/chats" element={<ChatsPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(fetchWorkbenchSessions).toHaveBeenCalledWith("p1");
      expect(
        screen.getByRole("heading", { name: /What do you want to create/i })
      ).toBeTruthy();
    });
  });
});
