import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KanbanBoard, type ChatItem } from "./kanban-board";

const chat: ChatItem = {
  id: "c1",
  title: "Implement auth",
  status: "planning",
  type: "feature",
  priority: "high",
  order: 0,
  commentCount: 0,
  subtaskTotal: 0,
  subtaskDone: 0,
  dueDate: null
};

describe("KanbanBoard", () => {
  it("renders column labels and chat cards", () => {
    render(
      <KanbanBoard
        chats={[chat]}
        onUpdate={vi.fn()}
        onOpen={vi.fn()}
        onPatch={vi.fn()}
        onDelete={vi.fn()}
        onAddSubtask={vi.fn()}
        onAddInColumn={vi.fn()}
        onAddSection={vi.fn()}
      />
    );
    expect(screen.getByText(/Planning/)).toBeTruthy();
    expect(screen.getByText("Implement auth")).toBeTruthy();
  });
});
