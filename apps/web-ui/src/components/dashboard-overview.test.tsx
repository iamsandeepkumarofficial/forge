import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardOverview } from "./dashboard-overview";

describe("DashboardOverview", () => {
  it("renders stats and activity sections", () => {
    render(
      <MemoryRouter>
        <DashboardOverview
          stats={{
            totalChats: 2,
            activeProjects: 1,
            streakDays: 3,
            totalContributions: 5,
            lastActiveAt: Date.now()
          }}
          heatmap={[[{ date: "2026-08-27", count: 1 }]]}
          attention={[
            {
              id: "a1",
              tone: "info",
              title: "Start a chat in Forge",
              detail: "No sessions yet"
            }
          ]}
          loading={false}
          projectCount={1}
          workspaceCount={0}
        />
      </MemoryRouter>
    );
    expect(screen.getByText("Day streak")).toBeTruthy();
    expect(screen.getByText("Activity")).toBeTruthy();
    expect(screen.getByText("Needs attention")).toBeTruthy();
    expect(screen.getByText("Start a chat in Forge")).toBeTruthy();
  });
});
