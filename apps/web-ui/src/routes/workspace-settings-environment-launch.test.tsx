import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EnvironmentLaunchCard } from "./workspace-settings-environment-launch";

describe("EnvironmentLaunchCard", () => {
  it("shows empty launch copy and disables clear", () => {
    render(
      <EnvironmentLaunchCard
        apps={[]}
        updatedAt={null}
        busy={false}
        anyBusy={false}
        onClear={() => undefined}
      />
    );
    expect(screen.getByText("Saved launch")).toBeTruthy();
    expect(screen.getByText(/No saved launch yet/i)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Clear saved launch"
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it("lists apps and clears saved launch", () => {
    const onClear = vi.fn();
    render(
      <EnvironmentLaunchCard
        apps={[
          {
            name: "storefront",
            type: "web",
            repo: "frontend",
            cwd: ".",
            port: 3000,
            command: "pnpm dev"
          }
        ]}
        updatedAt="2024-06-01T12:00:00.000Z"
        busy={false}
        anyBusy={false}
        onClear={onClear}
      />
    );
    expect(screen.getByText("storefront")).toBeTruthy();
    expect(screen.getByText(/pnpm dev/)).toBeTruthy();
    expect(screen.getByText(/port 3000/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear saved launch" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
