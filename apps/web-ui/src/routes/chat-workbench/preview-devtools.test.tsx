import { describe, it, expect } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { PreviewDevtools } from "./preview-devtools";

describe("PreviewDevtools", () => {
  it("shows console messages from the preview inspect frame", () => {
    render(<PreviewDevtools />);
    expect(
      screen.getByText("Console output from the preview will appear here.")
    ).toBeTruthy();
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "forge-devtools-console",
            level: "log",
            args: ["hello from preview"]
          }
        })
      );
    });
    expect(screen.getByText("hello from preview")).toBeTruthy();
  });

  it("lists network requests and can switch to Elements", () => {
    render(<PreviewDevtools />);
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "forge-devtools-network",
            method: "GET",
            url: "/health",
            status: 200,
            duration: 8
          }
        })
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Network" }));
    expect(screen.getByText("/health")).toBeTruthy();
    expect(screen.getByText("200")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Elements" }));
    expect(screen.getByRole("button", { name: "Select element" })).toBeTruthy();
  });
});
