import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardMenu } from "./kanban-card-menu";
import type { ChatItem } from "./kanban-shared";

const chat: ChatItem = {
  id: "c1",
  title: "Ticket",
  status: "todo" as never,
  type: "feature",
  priority: "medium",
  order: 0,
  commentCount: 0,
  subtaskTotal: 0,
  subtaskDone: 0
};

describe("CardMenu", () => {
  it("renders the card options trigger", () => {
    render(
      <CardMenu
        chat={{ ...chat, status: "planning" }}
        onPatch={vi.fn(async () => undefined)}
        onDelete={vi.fn(async () => undefined)}
        onAddSubtask={vi.fn(async () => undefined)}
      />
    );
    expect(screen.getByLabelText("Card options")).toBeTruthy();
  });
});
