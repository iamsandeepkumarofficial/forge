import { desc, eq } from "drizzle-orm";
import { getDb } from "@forge/db";
import {
  chatAttachments,
  type ChatAttachment,
  type ChatAttachmentInsert
} from "@forge/db";
export class AttachmentRepository {
  async create(
    row: Omit<ChatAttachmentInsert, "id" | "createdAt"> & {
      id?: string;
    }
  ): Promise<ChatAttachment> {
    const db = getDb();
    const [created] = await db.insert(chatAttachments).values(row).returning();
    return created as ChatAttachment;
  }
  async listByChatFeatureId(chatFeatureId: string): Promise<ChatAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(chatAttachments)
      .where(eq(chatAttachments.chatFeatureId, chatFeatureId))
      .orderBy(desc(chatAttachments.createdAt));
  }
  async getById(id: string): Promise<ChatAttachment | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(chatAttachments)
      .where(eq(chatAttachments.id, id))
      .limit(1);
    return rows[0] ?? null;
  }
  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.delete(chatAttachments).where(eq(chatAttachments.id, id));
  }
}
