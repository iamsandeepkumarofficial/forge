import { and, eq } from "drizzle-orm";
import { getDb } from "@forge/db";
import {
  projectParameters,
  workspaceParameters,
  type ProjectParameter,
  type WorkspaceParameter
} from "@forge/db";

export class ParameterRepository {
  async listProjectParameters(projectId: string): Promise<ProjectParameter[]> {
    const db = getDb();
    return db
      .select()
      .from(projectParameters)
      .where(eq(projectParameters.projectId, projectId));
  }

  async upsertProjectParameter(input: {
    projectId: string;
    key: string;
    value: string;
    secret?: boolean;
  }): Promise<ProjectParameter> {
    const db = getDb();
    const now = new Date();
    const existing = await db
      .select()
      .from(projectParameters)
      .where(
        and(
          eq(projectParameters.projectId, input.projectId),
          eq(projectParameters.key, input.key)
        )
      )
      .limit(1);
    if (existing[0]) {
      const [updated] = await db
        .update(projectParameters)
        .set({
          value: input.value,
          secret: input.secret ?? existing[0].secret,
          updatedAt: now
        })
        .where(eq(projectParameters.id, existing[0].id))
        .returning();
      return updated as ProjectParameter;
    }
    const [created] = await db
      .insert(projectParameters)
      .values({
        projectId: input.projectId,
        key: input.key,
        value: input.value,
        secret: input.secret ?? false,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    return created as ProjectParameter;
  }

  async deleteProjectParameter(
    projectId: string,
    key: string
  ): Promise<void> {
    const db = getDb();
    await db
      .delete(projectParameters)
      .where(
        and(
          eq(projectParameters.projectId, projectId),
          eq(projectParameters.key, key)
        )
      );
  }

  async listWorkspaceParameters(
    workspaceId: string
  ): Promise<WorkspaceParameter[]> {
    const db = getDb();
    return db
      .select()
      .from(workspaceParameters)
      .where(eq(workspaceParameters.workspaceId, workspaceId));
  }

  async upsertWorkspaceParameter(input: {
    workspaceId: string;
    key: string;
    value: string;
    secret?: boolean;
  }): Promise<WorkspaceParameter> {
    const db = getDb();
    const now = new Date();
    const existing = await db
      .select()
      .from(workspaceParameters)
      .where(
        and(
          eq(workspaceParameters.workspaceId, input.workspaceId),
          eq(workspaceParameters.key, input.key)
        )
      )
      .limit(1);
    if (existing[0]) {
      const [updated] = await db
        .update(workspaceParameters)
        .set({
          value: input.value,
          secret: input.secret ?? existing[0].secret,
          updatedAt: now
        })
        .where(eq(workspaceParameters.id, existing[0].id))
        .returning();
      return updated as WorkspaceParameter;
    }
    const [created] = await db
      .insert(workspaceParameters)
      .values({
        workspaceId: input.workspaceId,
        key: input.key,
        value: input.value,
        secret: input.secret ?? false,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    return created as WorkspaceParameter;
  }

  
  async ensureWorkspaceParameter(input: {
    workspaceId: string;
    key: string;
    value: string;
    secret?: boolean;
  }): Promise<boolean> {
    const db = getDb();
    const existing = await db
      .select()
      .from(workspaceParameters)
      .where(
        and(
          eq(workspaceParameters.workspaceId, input.workspaceId),
          eq(workspaceParameters.key, input.key)
        )
      )
      .limit(1);
    if (existing[0]) {
      if (existing[0].value.trim() !== "") return false;
      await db
        .update(workspaceParameters)
        .set({
          value: input.value,
          secret: input.secret ?? existing[0].secret,
          updatedAt: new Date()
        })
        .where(eq(workspaceParameters.id, existing[0].id));
      return true;
    }
    await this.upsertWorkspaceParameter(input);
    return true;
  }

  async deleteWorkspaceParameter(
    workspaceId: string,
    key: string
  ): Promise<void> {
    const db = getDb();
    await db
      .delete(workspaceParameters)
      .where(
        and(
          eq(workspaceParameters.workspaceId, workspaceId),
          eq(workspaceParameters.key, key)
        )
      );
  }
}
