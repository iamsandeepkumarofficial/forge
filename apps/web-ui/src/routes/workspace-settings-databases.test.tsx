import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DatabasesPanel } from "./workspace-settings-databases";

const getWorkspaceDatabases = vi.fn();
const provisionWorkspaceDatabase = vi.fn();
const detachWorkspaceDatabase = vi.fn();

vi.mock("../lib/workspaces-api.js", () => ({
  getWorkspaceDatabases: (...args: unknown[]) => getWorkspaceDatabases(...args),
  provisionWorkspaceDatabase: (...args: unknown[]) =>
    provisionWorkspaceDatabase(...args),
  detachWorkspaceDatabase: (...args: unknown[]) =>
    detachWorkspaceDatabase(...args)
}));

const engines = [
  {
    id: "postgres" as const,
    label: "PostgreSQL 16",
    image: "postgres:16",
    envKey: "DATABASE_URL",
    networkAlias: "postgres-apps",
    hostPort: 5434,
    engineRunning: false,
    attached: false,
    database: null
  },
  {
    id: "mongo" as const,
    label: "MongoDB 7",
    image: "mongo:7",
    envKey: "MONGODB_URI",
    networkAlias: "mongo-apps",
    hostPort: 27017,
    engineRunning: false,
    attached: false,
    database: null
  }
];

describe("DatabasesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceDatabases.mockResolvedValue({
      enabled: true,
      network: "forge",
      engines
    });
    provisionWorkspaceDatabase.mockResolvedValue(undefined);
    detachWorkspaceDatabase.mockResolvedValue(undefined);
  });

  it("loads engines and shows provision actions", async () => {
    const onSetupCta = vi.fn();
    render(
      <DatabasesPanel
        workspaceId="w1"
        onSetupCta={onSetupCta}
        setupBusy={false}
        setupCtaLabel="Analyze"
      />
    );
    expect(await screen.findByText("Databases")).toBeTruthy();
    expect(await screen.findByText("PostgreSQL 16")).toBeTruthy();
    expect(screen.getByText("MongoDB 7")).toBeTruthy();
    expect(screen.getAllByText(/Provision for workspace/).length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(onSetupCta).toHaveBeenCalledTimes(1);
  });

  it("provisions an engine", async () => {
    getWorkspaceDatabases
      .mockResolvedValueOnce({ enabled: true, network: "forge", engines })
      .mockResolvedValueOnce({
        enabled: true,
        network: "forge",
        engines: [
          {
            ...engines[0],
            attached: true,
            engineRunning: true,
            database: "ws_w1"
          },
          engines[1]
        ]
      });
    render(
      <DatabasesPanel
        workspaceId="w1"
        onSetupCta={() => undefined}
        setupBusy={false}
        setupCtaLabel="Analyze"
      />
    );
    expect(await screen.findByText("PostgreSQL 16")).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Provision for workspace" })[0]!
    );
    await waitFor(() => {
      expect(provisionWorkspaceDatabase).toHaveBeenCalledWith("w1", "postgres");
    });
    expect(await screen.findByText("ws_w1")).toBeTruthy();
  });

  it("shows disabled message when app databases are off", async () => {
    getWorkspaceDatabases.mockResolvedValue({
      enabled: false,
      network: "forge",
      engines: []
    });
    render(
      <DatabasesPanel
        workspaceId="w1"
        onSetupCta={() => undefined}
        setupBusy={false}
        setupCtaLabel="Fix"
      />
    );
    expect(await screen.findByText(/App databases are disabled/i)).toBeTruthy();
  });
});
