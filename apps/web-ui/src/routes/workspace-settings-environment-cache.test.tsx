import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EnvironmentCacheCard } from "./workspace-settings-environment-cache";

describe("EnvironmentCacheCard", () => {
  it("shows the volume name and clears the cache", () => {
    const onClear = vi.fn();
    render(
      <EnvironmentCacheCard
        depsVolumeName="forge-ws-deps-w1"
        busy={false}
        anyBusy={false}
        onClear={onClear}
      />
    );
    expect(screen.getByText("Package cache")).toBeTruthy();
    expect(screen.getByText("forge-ws-deps-w1")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Clear package cache" })
    );
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("shows Clearing… and disables while anyBusy", () => {
    render(
      <EnvironmentCacheCard
        depsVolumeName="vol"
        busy
        anyBusy
        onClear={() => undefined}
      />
    );
    expect(
      (screen.getByRole("button", { name: "Clearing…" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
