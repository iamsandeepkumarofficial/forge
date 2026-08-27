import { describe, it, expect } from "vitest";
import {
  buildActivityCounts,
  buildAttentionItems,
  buildHeatmapWeeks,
  computeStreak,
  dayKey,
  formatRelativeTime
} from "./dashboard-insights";

describe("dashboard-insights", () => {
  it("counts activity by day", () => {
    const day = new Date("2026-08-27T15:00:00");
    const counts = buildActivityCounts([
      day.getTime(),
      day.getTime(),
      day.getTime() + 86_400_000
    ]);
    expect(counts.get(dayKey(day))).toBe(2);
    expect(counts.size).toBe(2);
  });

  it("computes streak across consecutive days", () => {
    const now = new Date("2026-08-27T12:00:00");
    const counts = buildActivityCounts([
      now.getTime(),
      now.getTime() - 86_400_000,
      now.getTime() - 2 * 86_400_000
    ]);
    expect(computeStreak(counts, now)).toBe(3);
  });

  it("builds heatmap weeks", () => {
    const now = new Date("2026-08-27T12:00:00");
    const weeks = buildHeatmapWeeks(new Map(), 4, now);
    expect(weeks).toHaveLength(4);
    expect(weeks[0]).toHaveLength(7);
  });

  it("creates attention items for unavailable projects and empty chats", () => {
    const now = Date.parse("2026-08-27T00:00:00");
    const items = buildAttentionItems({
      projects: [
        { id: "p1", name: "Backend", status: "unavailable" },
        { id: "p2", name: "Frontend", status: "available" }
      ],
      workspaces: [],
      sessions: [],
      now
    });
    expect(items.some((item) => item.title.includes("unavailable"))).toBe(true);
    expect(items.some((item) => item.title.includes("Start a chat"))).toBe(
      true
    );
  });

  it("formats relative time", () => {
    const now = Date.parse("2026-08-27T12:00:00");
    expect(formatRelativeTime(now, now)).toBe("today");
    expect(formatRelativeTime(now - 86_400_000, now)).toBe("yesterday");
  });
});
