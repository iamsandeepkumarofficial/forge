import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-root">{children}</div>
  )
}));

describe("ThemeProvider", () => {
  it("renders children through the theme wrapper", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <span>themed</span>
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-root")).toBeTruthy();
    expect(screen.getByText("themed")).toBeTruthy();
  });
});
