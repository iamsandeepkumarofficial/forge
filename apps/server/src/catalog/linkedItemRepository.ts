import { desc, eq } from "drizzle-orm";
import { getDb } from "@forge/db";
import {
  chatLinkedItems,
  type ChatLinkedItem,
  type ChatLinkedItemInsert
} from "@forge/db";
export class LinkedItemRepository {
  async create(
    row: Omit<ChatLinkedItemInsert, "id" | "createdAt">
  ): Promise<ChatLinkedItem> {
    const db = getDb();
    const [created] = await db.insert(chatLinkedItems).values(row).returning();
    return created as ChatLinkedItem;
  }
  async listByChatFeatureId(chatFeatureId: string): Promise<ChatLinkedItem[]> {
    const db = getDb();
    return db
      .select()
      .from(chatLinkedItems)
      .where(eq(chatLinkedItems.chatFeatureId, chatFeatureId))
      .orderBy(desc(chatLinkedItems.createdAt));
  }
  async getById(id: string): Promise<ChatLinkedItem | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(chatLinkedItems)
      .where(eq(chatLinkedItems.id, id))
      .limit(1);
    return rows[0] ?? null;
  }
  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.delete(chatLinkedItems).where(eq(chatLinkedItems.id, id));
  }
}
