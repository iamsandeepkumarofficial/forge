import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@forge/db";
import {
  documents,
  type Document,
  type DocumentInsert,
  type DocumentSource
} from "@forge/db";
export class DocumentRepository {
  async create(
    row: Omit<DocumentInsert, "id" | "createdAt" | "updatedAt">
  ): Promise<Document> {
    const db = getDb();
    const now = new Date();
    const [created] = await db
      .insert(documents)
      .values({ ...row, createdAt: now, updatedAt: now })
      .returning();
    return created as Document;
  }
  async listByUserId(
    userId: string,
    options?: {
      projectId?: string;
    }
  ): Promise<Document[]> {
    const db = getDb();
    const conditions = [eq(documents.userId, userId)];
    if (options?.projectId) {
      conditions.push(eq(documents.projectId, options.projectId));
    }
    return db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.updatedAt));
  }
  async getById(id: string): Promise<Document | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return rows[0] ?? null;
  }
  async update(
    id: string,
    patch: {
      title?: string;
      body?: string;
      projectId?: string | null;
      source?: DocumentSource;
      agentId?: string | null;
      chatFeatureId?: string | null;
      stageId?: string | null;
    }
  ): Promise<Document | null> {
    const db = getDb();
    const [updated] = await db
      .update(documents)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return (updated as Document) ?? null;
  }
  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.delete(documents).where(eq(documents.id, id));
  }
}
