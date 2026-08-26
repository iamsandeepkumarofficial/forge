import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyStateImportPanels } from "./empty-state-import-panels";

describe("EmptyStateImportPanels", () => {
  it("renders github and template sections", () => {
    render(
      <EmptyStateImportPanels
        busy={false}
        loading={null}
        desktop={false}
        showPathInput
        localPath=""
        onLocalPathChange={vi.fn()}
        onGithub={vi.fn()}
        onSelectFolder={vi.fn()}
        onConnectPath={vi.fn()}
      />
    );
    expect(screen.getByText(/Continue with GitHub/i)).toBeTruthy();
    expect(screen.getByText(/Select folder/i)).toBeTruthy();
    expect(screen.getByText(/Clone Template/i)).toBeTruthy();
    expect(
      screen.getByText(/Native folder picker requires the desktop app/i)
    ).toBeTruthy();
  });
});
