import { and, desc, eq, lt } from "drizzle-orm";
import { getDb } from "@forge/db";
import {
  chatActivities,
  type ChatActivity,
  type ChatActivityInsert
} from "@forge/db";

const N_50 = 50;

export class ActivityRepository {
  async create(
    row: Omit<ChatActivityInsert, "id" | "createdAt">
  ): Promise<ChatActivity> {
    const db = getDb();
    const [created] = await db.insert(chatActivities).values(row).returning();
    return created as ChatActivity;
  }
  async listByChatFeatureId(
    chatFeatureId: string,
    options?: {
      kind?: "history" | "worklog";
      limit?: number;
      before?: Date;
    }
  ): Promise<ChatActivity[]> {
    const db = getDb();
    const limit = options?.limit ?? N_50;
    const conditions = [eq(chatActivities.chatFeatureId, chatFeatureId)];
    if (options?.kind) {
      conditions.push(eq(chatActivities.kind, options.kind));
    }
    if (options?.before) {
      conditions.push(lt(chatActivities.createdAt, options.before));
    }
    return db
      .select()
      .from(chatActivities)
      .where(and(...conditions))
      .orderBy(desc(chatActivities.createdAt))
      .limit(limit);
  }
}
