import { eq } from "drizzle-orm";
import { getDb } from "@forge/db";
import {
  users,
  conversations,
  uiState,
  type User,
  type Conversation,
  type UiState
} from "@forge/db";
export class CatalogRepository {
  async findUserByEmail(email: string): Promise<User | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0] || null;
  }
  async getOrCreateUser(email: string): Promise<User> {
    const existing = await this.findUserByEmail(email);
    if (existing) {
      return existing;
    }
    const db = getDb();
    const now = new Date();
    const [created] = await db
      .insert(users)
      .values({ email, createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (created) {
      return created;
    }
    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new Error(`Failed to resolve or create user for email: ${email}`);
    }
    return user;
  }
  async listConversations(userId: string): Promise<Conversation[]> {
    const db = getDb();
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(conversations.updatedAt);
  }
  async getActiveSessionId(_userId: string): Promise<string | null> {
    return null;
  }
  async setActiveSessionId(
    _userId: string,
    _sessionId: string
  ): Promise<void> {}
  async getUiState(userId: string, _key: string): Promise<UiState | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(uiState)
      .where(eq(uiState.userId, userId))
      .limit(1);
    return result[0] || null;
  }
  async setUiState(options: {
    userId: string;
    key: string;
    value: string;
  }): Promise<void> {
    const { userId, key, value } = options;
    const db = getDb();
    await db
      .insert(uiState)
      .values({
        userId,
        key,
        value,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [uiState.userId, uiState.key],
        set: {
          value,
          updatedAt: new Date()
        }
      });
  }
  async getUserUiState(userId: string): Promise<UiState[]> {
    const db = getDb();
    return db.select().from(uiState).where(eq(uiState.userId, userId));
  }
}
