import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardContent, type ChatItem } from "./kanban-board";
const base: ChatItem = {
  id: "c1",
  title: "Implement auth",
  status: "planning",
  type: "feature",
  priority: "high",
  order: 0,
  commentCount: 2,
  subtaskTotal: 1,
  subtaskDone: 0,
  dueDate: "2026-08-20T00:00:00Z"
};
describe("CardContent", () => {
  it("shows type, priority, due date, and counts", () => {
    render(<CardContent chat={base} />);
    expect(screen.getByText("Implement auth")).toBeTruthy();
    expect(screen.getByText("Feature")).toBeTruthy();
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });
  it("stays stable when optional metadata is missing", () => {
    render(
      <CardContent
        chat={{
          ...base,
          title: "Sparse ticket",
          dueDate: null,
          commentCount: 0,
          subtaskTotal: 0,
          priority: "low"
        }}
      />
    );
    expect(screen.getByText("Sparse ticket")).toBeTruthy();
    expect(screen.getByText("Feature")).toBeTruthy();
    expect(screen.getByText("Low")).toBeTruthy();
  });
});
