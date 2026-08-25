import { eq } from "drizzle-orm";
import { getDb } from "@forge/db";
import { userGithubAccounts, type UserGithubAccount } from "@forge/db";
export class GithubAccountRepository {
  async getByUserId(userId: string): Promise<UserGithubAccount | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(userGithubAccounts)
      .where(eq(userGithubAccounts.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  }
  async upsert(input: {
    userId: string;
    githubUserId: string;
    githubLogin: string;
    accessToken: string;
    scope?: string | null;
    tokenType?: string | null;
  }): Promise<UserGithubAccount> {
    const db = getDb();
    const now = new Date();
    const rows = await db
      .insert(userGithubAccounts)
      .values({
        userId: input.userId,
        githubUserId: input.githubUserId,
        githubLogin: input.githubLogin,
        accessToken: input.accessToken,
        scope: input.scope ?? null,
        tokenType: input.tokenType ?? null,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: userGithubAccounts.userId,
        set: {
          githubUserId: input.githubUserId,
          githubLogin: input.githubLogin,
          accessToken: input.accessToken,
          scope: input.scope ?? null,
          tokenType: input.tokenType ?? null,
          updatedAt: now
        }
      })
      .returning();
    return rows[0]!;
  }
  async deleteByUserId(userId: string): Promise<void> {
    const db = getDb();
    await db
      .delete(userGithubAccounts)
      .where(eq(userGithubAccounts.userId, userId));
  }
}
