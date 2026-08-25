import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KanbanBoard } from "./kanban-board";
describe("KanbanBoard add entry points", () => {
  it("shows add-after-last-card and post-leftmost add section", () => {
    const onAddInColumn = vi.fn();
    const onAddSection = vi.fn();
    render(
      <KanbanBoard
        chats={[]}
        onUpdate={async () => undefined}
        onOpen={() => undefined}
        onPatch={async () => undefined}
        onDelete={async () => undefined}
        onAddSubtask={async () => undefined}
        onAddInColumn={onAddInColumn}
        onAddSection={onAddSection}
      />
    );
    const addButtons = screen.getAllByRole("button", { name: /Add$/i });
    expect(addButtons.length).toBeGreaterThanOrEqual(5);
    fireEvent.click(screen.getByRole("button", { name: /Add section/i }));
    expect(onAddSection).toHaveBeenCalled();
  });
});
