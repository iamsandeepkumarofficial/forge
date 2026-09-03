import { eq, desc, sql, count, and } from "drizzle-orm";
import { getDb } from "@forge/db";
import {
  chatFeatures,
  type ChatFeature,
  type ChatFeatureKind
} from "@forge/db";
export class ChatFeatureRepository {
  async createChatFeature(
    chat: Omit<ChatFeature, "id" | "createdAt" | "lastActivityAt">
  ): Promise<ChatFeature> {
    const db = getDb();
    const now = new Date();
    const [created] = await db
      .insert(chatFeatures)
      .values({
        ...chat,
        createdAt: now,
        lastActivityAt: now
      })
      .returning();
    return created as ChatFeature;
  }
  async listByProjectId(
    projectId: string,
    kind?: ChatFeatureKind
  ): Promise<ChatFeature[]> {
    const db = getDb();
    const where = kind
      ? and(eq(chatFeatures.projectId, projectId), eq(chatFeatures.kind, kind))
      : eq(chatFeatures.projectId, projectId);
    return db
      .select()
      .from(chatFeatures)
      .where(where)
      .orderBy(chatFeatures.order, desc(chatFeatures.lastActivityAt));
  }
  async listByWorkspaceId(
    workspaceId: string,
    kind?: ChatFeatureKind
  ): Promise<ChatFeature[]> {
    const db = getDb();
    const where = kind
      ? and(
          eq(chatFeatures.workspaceId, workspaceId),
          eq(chatFeatures.kind, kind)
        )
      : eq(chatFeatures.workspaceId, workspaceId);
    return db
      .select()
      .from(chatFeatures)
      .where(where)
      .orderBy(chatFeatures.order, desc(chatFeatures.lastActivityAt));
  }
  async deleteChatFeature(id: string): Promise<void> {
    const db = getDb();
    await db.delete(chatFeatures).where(eq(chatFeatures.id, id));
  }
  async getById(id: string): Promise<ChatFeature | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(chatFeatures)
      .where(eq(chatFeatures.id, id))
      .limit(1);
    return result[0] || null;
  }
  async getBySessionId(sessionId: string): Promise<ChatFeature | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(chatFeatures)
      .where(eq(chatFeatures.sessionId, sessionId))
      .limit(1);
    return result[0] || null;
  }
  async update(
    chat: Partial<ChatFeature> & {
      id: string;
    }
  ): Promise<void> {
    const db = getDb();
    await db
      .update(chatFeatures)
      .set({
        ...chat,
        lastActivityAt: chat.lastActivityAt || new Date()
      })
      .where(eq(chatFeatures.id, chat.id));
  }
  async incrementOrder(chatId: string): Promise<void> {
    const db = getDb();
    await db
      .update(chatFeatures)
      .set({ order: sql`${chatFeatures.order} + 1` })
      .where(eq(chatFeatures.id, chatId));
  }
  async updateLastActivity(chatId: string): Promise<void> {
    const db = getDb();
    await db
      .update(chatFeatures)
      .set({ lastActivityAt: new Date() })
      .where(eq(chatFeatures.id, chatId));
  }
  async countChildren(parentId: string): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({ value: count() })
      .from(chatFeatures)
      .where(eq(chatFeatures.parentId, parentId));
    return Number(row?.value ?? 0);
  }
}
