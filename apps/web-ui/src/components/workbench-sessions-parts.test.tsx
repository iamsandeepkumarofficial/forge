import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  WorkbenchCreateForm,
  WorkbenchSessionList
} from "./workbench-sessions-parts";

describe("workbench-sessions-parts", () => {
  it("renders create form controls", () => {
    render(
      <WorkbenchCreateForm
        title=""
        creating={false}
        onTitleChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/New manual chat/i)).toBeTruthy();
    expect(screen.getByText(/Start workbench session/i)).toBeTruthy();
  });

  it("renders session rows", () => {
    render(
      <WorkbenchSessionList
        loading={false}
        sessions={[
          {
            id: "s1",
            projectId: "p1",
            userId: "u1",
            kind: "workbench",
            sessionId: "sess1",
            branchName: "main",
            title: "Manual",
            createdAt: "2026-01-01T00:00:00.000Z",
            lastActivityAt: "2026-01-01T00:00:00.000Z"
          }
        ]}
        deletingId={null}
        onResume={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText("Manual")).toBeTruthy();
  });
});
