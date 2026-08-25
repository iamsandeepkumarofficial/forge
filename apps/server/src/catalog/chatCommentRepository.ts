import { eq, asc, sql } from "drizzle-orm";
import { getDb } from "@forge/db";
import { chatComments, chatFeatures, type ChatComment } from "@forge/db";
export class ChatCommentRepository {
  async create(
    comment: Omit<ChatComment, "id" | "createdAt">
  ): Promise<ChatComment> {
    const db = getDb();
    const [created] = await db
      .insert(chatComments)
      .values({ ...comment, createdAt: new Date() })
      .returning();
    return created as ChatComment;
  }
  async listByChatFeatureId(chatFeatureId: string): Promise<ChatComment[]> {
    const db = getDb();
    return db
      .select()
      .from(chatComments)
      .where(eq(chatComments.chatFeatureId, chatFeatureId))
      .orderBy(asc(chatComments.createdAt));
  }
  async countsByProjectId(projectId: string): Promise<Record<string, number>> {
    const db = getDb();
    const rows = await db
      .select({
        chatFeatureId: chatComments.chatFeatureId,
        count: sql<number>`count(*)::int`
      })
      .from(chatComments)
      .innerJoin(chatFeatures, eq(chatComments.chatFeatureId, chatFeatures.id))
      .where(eq(chatFeatures.projectId, projectId))
      .groupBy(chatComments.chatFeatureId);
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.chatFeatureId] = row.count;
    }
    return counts;
  }
}
