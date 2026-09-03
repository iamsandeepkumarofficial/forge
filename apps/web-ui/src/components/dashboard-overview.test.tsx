import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
              tone: "warning",
              title: "Backend is unavailable",
              detail: "Reconnect or refresh the project to resume work."
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
    expect(screen.getByText("Backend is unavailable")).toBeTruthy();
  });

  it("previews three attention items and expands on show more", () => {
    render(
      <MemoryRouter>
        <DashboardOverview
          stats={{
            totalChats: 0,
            activeProjects: 4,
            streakDays: 0,
            totalContributions: 0,
            lastActiveAt: null
          }}
          heatmap={[]}
          attention={[
            {
              id: "w1",
              tone: "warning",
              title: "A is unavailable",
              detail: "Reconnect"
            },
            {
              id: "w2",
              tone: "warning",
              title: "B is unavailable",
              detail: "Reconnect"
            },
            {
              id: "w3",
              tone: "warning",
              title: "C is unavailable",
              detail: "Reconnect"
            },
            {
              id: "w4",
              tone: "warning",
              title: "D is unavailable",
              detail: "Reconnect"
            }
          ]}
          loading={false}
          projectCount={4}
          workspaceCount={0}
        />
      </MemoryRouter>
    );
    expect(screen.getByText("A is unavailable")).toBeTruthy();
    expect(screen.getByText("C is unavailable")).toBeTruthy();
    expect(screen.queryByText("D is unavailable")).toBeNull();
    expect(screen.getByText("Show 1 more")).toBeTruthy();
    fireEvent.click(screen.getByText("Show 1 more"));
    expect(screen.getByText("D is unavailable")).toBeTruthy();
  });
});
