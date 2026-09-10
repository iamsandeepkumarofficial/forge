import { and, asc, eq, desc } from "drizzle-orm";
import { getDb } from "@forge/db";
import {
  workspaceProjects,
  workspaces,
  type Workspace,
  type WorkspaceInsert,
  type WorkspaceProject,
  type WorkspaceProjectInsert,
  type WorkspaceRoute
} from "@forge/db";

export class WorkspaceRepository {
  async create(
    input: Omit<
      WorkspaceInsert,
      "id" | "createdAt" | "lastActivityAt" | "routes"
    > & {
      routes?: WorkspaceRoute[];
    }
  ): Promise<Workspace> {
    const db = getDb();
    const now = new Date();
    const [created] = await db
      .insert(workspaces)
      .values({
        userId: input.userId,
        name: input.name,
        routes: input.routes ?? [],
        createdAt: now,
        lastActivityAt: now
      })
      .returning();
    return created as Workspace;
  }

  async listByUserId(userId: string): Promise<Workspace[]> {
    const db = getDb();
    return db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userId, userId))
      .orderBy(desc(workspaces.lastActivityAt));
  }

  async getById(id: string): Promise<Workspace | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);
    return result[0] || null;
  }

  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.delete(workspaces).where(eq(workspaces.id, id));
  }

  async updateLastActivity(id: string): Promise<void> {
    const db = getDb();
    await db
      .update(workspaces)
      .set({ lastActivityAt: new Date() })
      .where(eq(workspaces.id, id));
  }

  async updateName(id: string, name: string): Promise<Workspace | null> {
    const db = getDb();
    const [updated] = await db
      .update(workspaces)
      .set({ name, lastActivityAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated || null;
  }

  async updateRoutes(
    id: string,
    routes: WorkspaceRoute[]
  ): Promise<Workspace | null> {
    const db = getDb();
    const [updated] = await db
      .update(workspaces)
      .set({ routes, lastActivityAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated || null;
  }

  async listMembers(workspaceId: string): Promise<WorkspaceProject[]> {
    const db = getDb();
    return db
      .select()
      .from(workspaceProjects)
      .where(eq(workspaceProjects.workspaceId, workspaceId))
      .orderBy(
        asc(workspaceProjects.sortOrder),
        asc(workspaceProjects.repoName)
      );
  }

  async getMember(
    workspaceId: string,
    projectId: string
  ): Promise<WorkspaceProject | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(workspaceProjects)
      .where(
        and(
          eq(workspaceProjects.workspaceId, workspaceId),
          eq(workspaceProjects.projectId, projectId)
        )
      )
      .limit(1);
    return result[0] || null;
  }

  async findMemberByRepoName(
    workspaceId: string,
    repoName: string
  ): Promise<WorkspaceProject | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(workspaceProjects)
      .where(
        and(
          eq(workspaceProjects.workspaceId, workspaceId),
          eq(workspaceProjects.repoName, repoName)
        )
      )
      .limit(1);
    return result[0] || null;
  }

  async addMember(
    input: Omit<WorkspaceProjectInsert, "id" | "createdAt">
  ): Promise<WorkspaceProject> {
    const db = getDb();
    const [created] = await db
      .insert(workspaceProjects)
      .values({
        ...input,
        createdAt: new Date()
      })
      .returning();
    return created as WorkspaceProject;
  }

  async removeMember(workspaceId: string, projectId: string): Promise<void> {
    const db = getDb();
    await db
      .delete(workspaceProjects)
      .where(
        and(
          eq(workspaceProjects.workspaceId, workspaceId),
          eq(workspaceProjects.projectId, projectId)
        )
      );
  }

  async updateMember(options: {
    workspaceId: string;
    projectId: string;
    patch: Partial<
      Pick<
        WorkspaceProject,
        "repoName" | "sortOrder" | "dependsOn" | "env" | "sourceRef"
      >
    >;
  }): Promise<WorkspaceProject | null> {
    const { workspaceId, projectId, patch } = options;
    const db = getDb();
    const [updated] = await db
      .update(workspaceProjects)
      .set(patch)
      .where(
        and(
          eq(workspaceProjects.workspaceId, workspaceId),
          eq(workspaceProjects.projectId, projectId)
        )
      )
      .returning();
    return updated || null;
  }
}
