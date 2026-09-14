import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppPreviewToolbar } from "./app-preview-toolbar";
import type { AppStatus } from "../../lib/tool-runner.js";

const requestDevtoolsToggle = vi.fn();

vi.mock("./terminal-toggle.js", () => ({
  requestDevtoolsToggle: () => requestDevtoolsToggle()
}));

function app(overrides: Partial<AppStatus> = {}): AppStatus {
  return {
    name: "web",
    cwd: ".",
    command: "npm start",
    type: "web",
    port: 3000,
    running: true,
    url: "http://127.0.0.1:3000",
    ...overrides
  };
}

function renderToolbar(
  overrides: Partial<Parameters<typeof AppPreviewToolbar>[0]> = {}
) {
  const props = {
    apps: [app()],
    active: app(),
    surface: "browser" as const,
    address: "/home",
    commenting: false,
    canBack: false,
    canForward: false,
    onBack: vi.fn(),
    onForward: vi.fn(),
    onAddress: vi.fn(),
    onSubmitAddress: vi.fn(),
    onSelect: vi.fn(),
    onReload: vi.fn(),
    onToggleComment: vi.fn(),
    ...overrides
  };
  render(<AppPreviewToolbar {...props} />);
  return props;
}

describe("AppPreviewToolbar", () => {
  beforeEach(() => {
    requestDevtoolsToggle.mockClear();
  });

  it("submits the address bar with Go", () => {
    const props = renderToolbar({ address: "/docs" });
    fireEvent.change(screen.getByLabelText("Preview URL"), {
      target: { value: "/about" }
    });
    expect(props.onAddress).toHaveBeenCalledWith("/about");
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(props.onSubmitAddress).toHaveBeenCalled();
  });

  it("opens DevTools when the surface is browser", () => {
    renderToolbar({ surface: "browser" });
    fireEvent.click(screen.getByRole("button", { name: "DevTools" }));
    expect(requestDevtoolsToggle).toHaveBeenCalledTimes(1);
  });

  it("selects a preview port from the select", () => {
    const api = app({ name: "api", type: "api", port: 3001 });
    const props = renderToolbar({
      apps: [app(), api],
      active: app()
    });
    fireEvent.change(screen.getByLabelText("Preview port"), {
      target: { value: "api" }
    });
    expect(props.onSelect).toHaveBeenCalledWith("api");
  });

  it("disables Go and DevTools when no surface is live", () => {
    renderToolbar({ surface: "none", apps: [], active: undefined });
    expect(
      (screen.getByRole("button", { name: "Go" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "DevTools" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (screen.getByLabelText("Preview URL") as HTMLInputElement).disabled
    ).toBe(true);
    expect(screen.getByPlaceholderText("No app running")).toBeTruthy();
  });
});
