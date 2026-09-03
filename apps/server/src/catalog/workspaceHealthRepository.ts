import { eq } from "drizzle-orm";
import { getDb } from "@forge/db";
import {
  workspaceHealth,
  type WorkspaceHealthStatus
} from "@forge/db";
import type { WorkspaceHealthReport } from "../services/workspace/health/types.js";

export class WorkspaceHealthRepository {
  async get(workspaceId: string) {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaceHealth)
      .where(eq(workspaceHealth.workspaceId, workspaceId))
      .limit(1);
    return rows[0] ?? null;
  }

  async setComputing(workspaceId: string): Promise<void> {
    const db = getDb();
    const now = new Date();
    await db
      .insert(workspaceHealth)
      .values({
        workspaceId,
        status: "computing",
        report: {},
        computedAt: now
      })
      .onConflictDoUpdate({
        target: workspaceHealth.workspaceId,
        set: { status: "computing", computedAt: now }
      });
  }

  async saveReport(
    workspaceId: string,
    status: WorkspaceHealthStatus,
    report: WorkspaceHealthReport
  ): Promise<void> {
    const db = getDb();
    const now = new Date();
    await db
      .insert(workspaceHealth)
      .values({
        workspaceId,
        status,
        report: report as unknown as Record<string, unknown>,
        computedAt: now
      })
      .onConflictDoUpdate({
        target: workspaceHealth.workspaceId,
        set: {
          status,
          report: report as unknown as Record<string, unknown>,
          computedAt: now
        }
      });
  }
}
