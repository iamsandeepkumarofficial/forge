import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@forge/db";
import {
  chatTurnChunks,
  chatTurns,
  sessionMessages,
  type ChatTurn,
  type ChatTurnChunk,
  type SessionMessage
} from "@forge/db";
import { sanitizeJsonForPg } from "./sanitizeJsonForPg.js";
export class SessionMessageRepository {
  async listBySessionId(sessionId: string): Promise<SessionMessage[]> {
    const db = getDb();
    return db
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.sessionId, sessionId))
      .orderBy(asc(sessionMessages.createdAt));
  }
  async create(input: {
    sessionId: string;
    role: SessionMessage["role"];
    parts: unknown[];
    turnId?: string | null;
  }): Promise<SessionMessage> {
    const db = getDb();
    const [created] = await db
      .insert(sessionMessages)
      .values({
        sessionId: input.sessionId,
        role: input.role,
        parts: sanitizeJsonForPg(input.parts),
        turnId: input.turnId ?? null,
        createdAt: new Date()
      })
      .returning();
    return created as SessionMessage;
  }
  async updateParts(
    id: string,
    parts: unknown[]
  ): Promise<SessionMessage | null> {
    const db = getDb();
    const [updated] = await db
      .update(sessionMessages)
      .set({ parts: sanitizeJsonForPg(parts) })
      .where(eq(sessionMessages.id, id))
      .returning();
    return (updated as SessionMessage) ?? null;
  }
}
export class ChatTurnRepository {
  async create(input: {
    id?: string;
    sessionId: string;
    workflowId: string;
    mode?: string;
    provider?: string | null;
    model?: string | null;
  }): Promise<ChatTurn> {
    const db = getDb();
    const [created] = await db
      .insert(chatTurns)
      .values({
        ...(input.id ? { id: input.id } : {}),
        sessionId: input.sessionId,
        workflowId: input.workflowId,
        status: "running",
        mode: input.mode ?? "build",
        provider: input.provider ?? null,
        model: input.model ?? null,
        startedAt: new Date()
      })
      .returning();
    return created as ChatTurn;
  }
  async getById(id: string): Promise<ChatTurn | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(chatTurns)
      .where(eq(chatTurns.id, id))
      .limit(1);
    return (row as ChatTurn) ?? null;
  }
  async getRunningBySessionId(sessionId: string): Promise<ChatTurn | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(chatTurns)
      .where(
        and(eq(chatTurns.sessionId, sessionId), eq(chatTurns.status, "running"))
      )
      .orderBy(desc(chatTurns.startedAt))
      .limit(1);
    return (row as ChatTurn) ?? null;
  }
  async listRunningSessionIds(): Promise<string[]> {
    const db = getDb();
    const rows = await db
      .select({ sessionId: chatTurns.sessionId })
      .from(chatTurns)
      .where(eq(chatTurns.status, "running"));
    return [...new Set(rows.map((row) => row.sessionId))];
  }
  async finish(options: {
    id: string;
    status: "completed" | "cancelled" | "failed";
    error?: string | null;
  }): Promise<ChatTurn | null> {
    const { id, status, error } = options;
    const db = getDb();
    const [updated] = await db
      .update(chatTurns)
      .set({
        status,
        error: error ?? null,
        finishedAt: new Date()
      })
      .where(eq(chatTurns.id, id))
      .returning();
    return (updated as ChatTurn) ?? null;
  }
}
export class ChatTurnChunkRepository {
  async append(input: {
    turnId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<ChatTurnChunk> {
    const db = getDb();
    const [maxRow] = await db
      .select({
        max: sql<number>`coalesce(max(${chatTurnChunks.seq}), 0)::int`
      })
      .from(chatTurnChunks)
      .where(eq(chatTurnChunks.turnId, input.turnId));
    const seq = Number(maxRow?.max ?? 0) + 1;
    const [created] = await db
      .insert(chatTurnChunks)
      .values({
        turnId: input.turnId,
        seq,
        eventType: input.eventType,
        payload: sanitizeJsonForPg(input.payload),
        createdAt: new Date()
      })
      .returning();
    return created as ChatTurnChunk;
  }
  async listAfter(turnId: string, afterSeq: number): Promise<ChatTurnChunk[]> {
    const db = getDb();
    return db
      .select()
      .from(chatTurnChunks)
      .where(
        and(eq(chatTurnChunks.turnId, turnId), gt(chatTurnChunks.seq, afterSeq))
      )
      .orderBy(asc(chatTurnChunks.seq));
  }
  async maxSeq(turnId: string): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({
        max: sql<number>`coalesce(max(${chatTurnChunks.seq}), 0)::int`
      })
      .from(chatTurnChunks)
      .where(eq(chatTurnChunks.turnId, turnId));
    return Number(row?.max ?? 0);
  }
}
