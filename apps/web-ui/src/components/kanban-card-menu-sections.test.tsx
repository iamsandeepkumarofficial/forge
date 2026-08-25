import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DateQuickPicks, PriorityPicks } from "./kanban-card-menu-sections";

describe("kanban-card-menu-sections", () => {
  it("renders date quick picks", () => {
    render(
      <DateQuickPicks
        dueDay=""
        showCustomDate={false}
        onToggleCustom={vi.fn()}
        onPatch={vi.fn(async () => undefined)}
      />
    );
    expect(screen.getByTitle("Today")).toBeTruthy();
    expect(screen.getByTitle("Tomorrow")).toBeTruthy();
  });

  it("renders priority picks", () => {
    render(
      <PriorityPicks priority="medium" onPatch={vi.fn(async () => undefined)} />
    );
    expect(screen.getByTitle("High priority")).toBeTruthy();
  });
});
