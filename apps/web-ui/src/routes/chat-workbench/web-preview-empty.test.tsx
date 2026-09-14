import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EmptyPreview, MissingPreviewUrl } from "./web-preview-empty";

describe("web-preview-empty", () => {
  it("shows empty preview with Start an app CTA", () => {
    const onOpenRun = vi.fn();
    render(<EmptyPreview onOpenRun={onOpenRun} />);
    expect(screen.getByText("No preview yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start an app" }));
    expect(onOpenRun).toHaveBeenCalledTimes(1);
  });

  it("falls back to Open Run copy without a CTA", () => {
    render(<EmptyPreview />);
    expect(screen.getByText(/Open/)).toBeTruthy();
    expect(screen.getByText("Run")).toBeTruthy();
  });

  it("explains missing preview URL for running ports", () => {
    render(
      <MissingPreviewUrl
        ports={[{ name: "web", port: 3010, running: true, url: null } as never]}
      />
    );
    expect(screen.getByText(/:3010/)).toBeTruthy();
    expect(screen.getByText(/3000–3009/)).toBeTruthy();
  });
});
