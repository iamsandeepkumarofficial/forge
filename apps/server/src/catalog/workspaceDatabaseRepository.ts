import { and, eq } from "drizzle-orm";
import { getDb, workspaceDatabases, type WorkspaceDatabase } from "@forge/db";

export class WorkspaceDatabaseRepository {
  async list(workspaceId: string): Promise<WorkspaceDatabase[]> {
    const db = getDb();
    return db
      .select()
      .from(workspaceDatabases)
      .where(eq(workspaceDatabases.workspaceId, workspaceId));
  }

  async attach(input: {
    workspaceId: string;
    engineId: string;
    databaseName: string;
  }): Promise<WorkspaceDatabase> {
    const db = getDb();
    const existing = await db
      .select()
      .from(workspaceDatabases)
      .where(
        and(
          eq(workspaceDatabases.workspaceId, input.workspaceId),
          eq(workspaceDatabases.engineId, input.engineId)
        )
      )
      .limit(1);
    if (existing[0]) return existing[0];
    const [row] = await db
      .insert(workspaceDatabases)
      .values({
        workspaceId: input.workspaceId,
        engineId: input.engineId,
        databaseName: input.databaseName
      })
      .returning();
    return row as WorkspaceDatabase;
  }

  async detach(workspaceId: string, engineId: string): Promise<void> {
    const db = getDb();
    await db
      .delete(workspaceDatabases)
      .where(
        and(
          eq(workspaceDatabases.workspaceId, workspaceId),
          eq(workspaceDatabases.engineId, engineId)
        )
      );
  }
}
