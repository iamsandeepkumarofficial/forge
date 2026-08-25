import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyStateImportPanels } from "./empty-state-import-panels";

describe("EmptyStateImportPanels", () => {
  it("renders github and template sections", () => {
    render(
      <EmptyStateImportPanels
        busy={false}
        loading={null}
        onGithub={vi.fn()}
        onFolder={vi.fn()}
        onZip={vi.fn()}
      />
    );
    expect(screen.getByText(/Continue with GitHub/i)).toBeTruthy();
    expect(screen.getByText(/Clone Template/i)).toBeTruthy();
  });
});
