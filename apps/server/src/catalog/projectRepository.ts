import { and, eq, desc } from "drizzle-orm";
import { getDb } from "@forge/db";
import { projects, type Project } from "@forge/db";
export class ProjectRepository {
  async createProject(
    project: Omit<Project, "id" | "createdAt" | "lastActivityAt">
  ): Promise<Project> {
    const db = getDb();
    const now = new Date();
    const [created] = await db
      .insert(projects)
      .values({
        ...project,
        createdAt: now,
        lastActivityAt: now
      })
      .returning();
    return created as Project;
  }
  async listByUserId(userId: string): Promise<Project[]> {
    const db = getDb();
    return db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.lastActivityAt));
  }
  async getById(id: string): Promise<Project | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return result[0] || null;
  }
  async findByDedupeKey(
    userId: string,
    dedupeKey: string
  ): Promise<Project | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(projects)
      .where(
        and(eq(projects.userId, userId), eq(projects.dedupeKey, dedupeKey))
      )
      .limit(1);
    return result[0] || null;
  }
  async deleteProject(id: string): Promise<void> {
    const db = getDb();
    await db.delete(projects).where(eq(projects.id, id));
  }
  async updateStatus(
    id: string,
    status: "available" | "unavailable"
  ): Promise<void> {
    const db = getDb();
    await db
      .update(projects)
      .set({ status, lastActivityAt: new Date() })
      .where(eq(projects.id, id));
  }
  async updateLastActivity(id: string): Promise<void> {
    const db = getDb();
    await db
      .update(projects)
      .set({ lastActivityAt: new Date() })
      .where(eq(projects.id, id));
  }
  async updateCanonicalKey(id: string, canonicalKey: string): Promise<void> {
    const db = getDb();
    await db.update(projects).set({ canonicalKey }).where(eq(projects.id, id));
  }
}
