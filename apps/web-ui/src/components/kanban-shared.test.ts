import { describe, it, expect } from "vitest";
import { COLUMNS, formatDueDate, isoDateOffset } from "./kanban-shared";

describe("kanban-shared", () => {
  it("exposes board columns", () => {
    expect(COLUMNS.some((c) => c.status === "planning")).toBe(true);
  });

  it("formats due dates and offsets", () => {
    expect(isoDateOffset(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(formatDueDate("2030-01-15")).toBeTruthy();
  });
});
