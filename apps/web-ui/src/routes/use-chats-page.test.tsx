import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useChatsPage } from "./use-chats-page";

vi.mock("../lib/projects-api.js", () => ({
  fetchWorkbenchSessions: vi.fn(async () => []),
  fetchProject: vi.fn(async () => ({
    id: "p1",
    name: "Forge App",
    source: "github",
    status: "available"
  }))
}));

vi.mock("./use-chats-model-state.js", () => ({
  useChatsModelState: () => ({
    provider: "openai-compatible",
    activeModel: "",
    modelsByProvider: {},
    modelsLoading: false,
    autoModel: true,
    agentMode: "agent",
    setAgentMode: vi.fn(),
    setAutoModel: vi.fn(),
    onModelSelect: vi.fn()
  })
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/projects/p1/chats"]}>
      <Routes>
        <Route path="/projects/:projectId/chats" element={children} />
      </Routes>
    </MemoryRouter>
  );
}

describe("useChatsPage", () => {
  it("loads empty sessions and shows composer", async () => {
    const { result } = renderHook(() => useChatsPage(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.showComposer).toBe(true);
  });
});
