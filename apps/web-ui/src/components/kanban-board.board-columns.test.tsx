import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { KanbanBoard, COLUMNS } from "@/components/kanban-board";
afterEach(() => {
  cleanup();
});
describe("KanbanBoard columns", () => {
  it("renders every configured column on an empty board", () => {
    render(
      <KanbanBoard
        chats={[]}
        onUpdate={async () => undefined}
        onOpen={() => undefined}
        onPatch={async () => undefined}
        onDelete={async () => undefined}
        onAddSubtask={async () => undefined}
      />
    );
    for (const col of COLUMNS) {
      expect(screen.getByText(new RegExp(`^${col.label}`))).toBeTruthy();
    }
    expect(COLUMNS).toHaveLength(5);
  });
  it("keeps empty columns when only some statuses have cards", () => {
    render(
      <KanbanBoard
        chats={[
          {
            id: "1",
            title: "Only planning",
            status: "planning",
            type: "feature",
            priority: "medium",
            order: 0,
            commentCount: 0,
            subtaskTotal: 0,
            subtaskDone: 0
          }
        ]}
        onUpdate={async () => undefined}
        onOpen={() => undefined}
        onPatch={async () => undefined}
        onDelete={async () => undefined}
        onAddSubtask={async () => undefined}
      />
    );
    expect(screen.getByText(/^No Section/)).toBeTruthy();
    expect(screen.getByText(/^QA/)).toBeTruthy();
    expect(screen.getByText(/^Done/)).toBeTruthy();
    expect(screen.getByText("Only planning")).toBeTruthy();
  });
});
