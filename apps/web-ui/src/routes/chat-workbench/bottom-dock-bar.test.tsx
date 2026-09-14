import { describe, expect, it } from "vitest";
import { DockBar } from "./bottom-dock-bar";
import { render, screen } from "@testing-library/react";

describe("DockBar", () => {
  it("renders the pinned Terminal tab", () => {
    render(
      <DockBar
        open
        mode="terminal"
        extras={[]}
        onSelect={() => undefined}
        onCloseExtra={() => undefined}
        onToggle={() => undefined}
      />
    );
    expect(screen.getByRole("button", { name: /terminal/i })).toBeTruthy();
  });
});
