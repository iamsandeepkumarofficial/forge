import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardContent } from "./kanban-card-content";
import type { ChatItem } from "./kanban-shared";

const sample: ChatItem = {
  id: "c1",
  title: "Ship board",
  status: "development",
  type: "feature",
  priority: "high",
  dueDate: "2030-01-15",
  order: 0,
  commentCount: 2,
  subtaskTotal: 3,
  subtaskDone: 1
};

describe("CardContent", () => {
  it("renders title, type, and footer meta", () => {
    render(<CardContent chat={sample} parentTitle="Epic" />);
    expect(screen.getByText("Ship board")).toBeTruthy();
    expect(screen.getByText(/Epic/)).toBeTruthy();
    expect(screen.getByText("Feature")).toBeTruthy();
  });
});
