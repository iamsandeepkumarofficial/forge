import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ModeToggle } from "./mode-toggle";

const setTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "dark",
    setTheme
  })
}));

describe("ModeToggle", () => {
  it("switches from dark to light", async () => {
    render(<ModeToggle />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Switch to light mode/i })
      ).toBeTruthy();
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Switch to light mode/i })
    );
    expect(setTheme).toHaveBeenCalledWith("light");
  });
});
