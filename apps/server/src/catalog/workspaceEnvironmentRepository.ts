import { eq } from "drizzle-orm";
import { getDb, workspaceEnvironments } from "@forge/db";

export type WorkspaceLaunchJson = {
  apps: unknown[];
};

function asLaunch(raw: unknown): WorkspaceLaunchJson {
  if (!raw || typeof raw !== "object") return { apps: [] };
  const apps = (raw as { apps?: unknown }).apps;
  return {
    apps: Array.isArray(apps) ? apps : []
  };
}

export class WorkspaceEnvironmentRepository {
  async get(workspaceId: string) {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaceEnvironments)
      .where(eq(workspaceEnvironments.workspaceId, workspaceId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      workspaceId: row.workspaceId,
      launch: asLaunch(row.launch),
      sourceSessionId: row.sourceSessionId,
      updatedAt: row.updatedAt
    };
  }

  async upsertLaunch(
    workspaceId: string,
    launch: WorkspaceLaunchJson,
    sourceSessionId: string | null
  ): Promise<void> {
    const db = getDb();
    const now = new Date();
    await db
      .insert(workspaceEnvironments)
      .values({
        workspaceId,
        launch,
        sourceSessionId,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: workspaceEnvironments.workspaceId,
        set: {
          launch,
          sourceSessionId,
          updatedAt: now
        }
      });
  }

  async clearLaunch(workspaceId: string): Promise<void> {
    const db = getDb();
    await db
      .delete(workspaceEnvironments)
      .where(eq(workspaceEnvironments.workspaceId, workspaceId));
  }
}
