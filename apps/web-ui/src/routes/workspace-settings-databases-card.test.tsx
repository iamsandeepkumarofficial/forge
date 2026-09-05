import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DatabasesEngineCard } from "./workspace-settings-databases-card";
import type { WorkspaceDatabaseEngine } from "../lib/workspaces-api.js";

function engine(
  overrides: Partial<WorkspaceDatabaseEngine> = {}
): WorkspaceDatabaseEngine {
  return {
    id: "postgres",
    label: "PostgreSQL 16",
    image: "postgres:16",
    envKey: "DATABASE_URL",
    networkAlias: "postgres-apps",
    hostPort: 5434,
    engineRunning: false,
    attached: false,
    database: null,
    ...overrides
  };
}

describe("DatabasesEngineCard", () => {
  it("provisions when not attached", () => {
    const onProvision = vi.fn();
    render(
      <DatabasesEngineCard
        engine={engine()}
        busy={false}
        onProvision={onProvision}
        onDetach={() => undefined}
      />
    );
    expect(screen.getByText("PostgreSQL 16")).toBeTruthy();
    expect(screen.getByText("not running")).toBeTruthy();
    expect(screen.getByText("postgres:16")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Provision for workspace" })
    );
    expect(onProvision).toHaveBeenCalledTimes(1);
  });

  it("detaches when attached", () => {
    const onDetach = vi.fn();
    render(
      <DatabasesEngineCard
        engine={engine({
          attached: true,
          engineRunning: true,
          database: "ws_demo"
        })}
        busy={false}
        onProvision={() => undefined}
        onDetach={onDetach}
      />
    );
    expect(screen.getByText("attached")).toBeTruthy();
    expect(screen.getByText("ws_demo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Detach" }));
    expect(onDetach).toHaveBeenCalledTimes(1);
  });
});
