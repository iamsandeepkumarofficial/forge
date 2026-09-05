import { useEffect, useState } from "react";
import {
  getWorkspaceHealth,
  type WorkspaceHealthFinding
} from "../lib/workspaces-api.js";
import { setupCtaModeFromFindings } from "./workspace-setup-drawer.js";
import type { SettingsTab } from "./workspace-settings-helpers.js";

export function useWorkspaceHealthSettings(
  workspaceId: string,
  memberCount: number
) {
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [healthFindings, setHealthFindings] = useState<
    WorkspaceHealthFinding[]
  >([]);
  const [setupDrawer, setSetupDrawer] = useState<"analyze" | "fix" | null>(
    null
  );

  useEffect(() => {
    if (!workspaceId) return;
    void getWorkspaceHealth(workspaceId)
      .then((h) => {
        setHealthStatus(h.status);
        const report = h.report as { findings?: WorkspaceHealthFinding[] };
        setHealthFindings(report.findings ?? []);
      })
      .catch(() => undefined);
  }, [workspaceId, memberCount]);

  const setupCtaMode = setupCtaModeFromFindings(healthFindings, healthStatus);

  return {
    healthStatus,
    healthFindings,
    setHealthStatus,
    setHealthFindings,
    setupDrawer,
    setSetupDrawer,
    setupCtaMode,
    setupDrawerOpen: setupDrawer != null
  };
}

export function useSettingsTab(initial: SettingsTab = "overview") {
  const [tab, setTab] = useState<SettingsTab>(initial);
  return { tab, setTab };
}
