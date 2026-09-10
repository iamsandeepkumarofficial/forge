import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelpSidebar } from "./help-sidebar.js";

vi.mock("./health-panel.js", () => ({
  HealthPanel: () => <div data-testid="health-panel" />
}));

describe("HelpSidebar", () => {
  it("renders HealthPanel", () => {
    render(<HelpSidebar sessionId="s1" />);
    expect(screen.getByTestId("health-panel")).toBeTruthy();
  });
});
