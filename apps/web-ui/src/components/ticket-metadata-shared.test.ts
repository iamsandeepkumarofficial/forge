import { describe, it, expect } from "vitest";
import type { TicketSummary } from "./ticket-metadata-shared";

describe("ticket-metadata-shared", () => {
  it("accepts a ticket summary shape", () => {
    const row: TicketSummary = { id: "1", title: "t", type: "feature" };
    expect(row.id).toBe("1");
  });
});
