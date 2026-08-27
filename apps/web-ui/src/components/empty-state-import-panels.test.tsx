import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyStateImportPanels } from "./empty-state-import-panels";

describe("EmptyStateImportPanels", () => {
  it("renders local folder selection and templates", () => {
    render(
      <EmptyStateImportPanels
        busy={false}
        loading={null}
        desktop={false}
        showPathInput
        localPath=""
        onLocalPathChange={vi.fn()}
        onSelectFolder={vi.fn()}
        onConnectPath={vi.fn()}
      />
    );
    expect(screen.getByText(/Select a project folder/i)).toBeTruthy();
    expect(screen.getByLabelText("Select folder")).toBeTruthy();
    expect(
      screen.getByText(/Paste an absolute path below/i)
    ).toBeTruthy();
    expect(screen.getByText(/Clone Template/i)).toBeTruthy();
    expect(screen.getByText("Chat Template")).toBeTruthy();
    expect(screen.queryByText(/Continue with GitHub/i)).toBeNull();
  });
});
