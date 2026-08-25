import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatsListView } from "./chats-list-view";
import type { ChatsPageState } from "./use-chats-page";

const state = {
  projectId: "p1",
  sessions: [
    {
      id: "s1",
      title: "Workbench A",
      lastActivityAt: new Date().toISOString()
    }
  ],
  error: null,
  deletingId: null,
  navigate: vi.fn(),
  handleDelete: vi.fn()
} as unknown as ChatsPageState;

describe("ChatsListView", () => {
  it("lists sessions", () => {
    render(<ChatsListView state={state} />);
    expect(screen.getByText("Workbench A")).toBeTruthy();
  });
});
