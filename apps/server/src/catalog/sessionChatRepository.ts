import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  like,
  not,
  sql
} from "drizzle-orm";
import { getDb } from "@forge/db";
import {
  chatTurnChunks,
  chatTurns,
  sessionMessages,
  type ChatTurn,
  type ChatTurnChunk,
  type SessionMessage
} from "@forge/db";
import {
  AGENT_TASK_STREAM_WORKFLOW_PREFIX,
  isAgentTaskStreamWorkflowId
} from "@forge/core";
import { sanitizeJsonForPg } from "./sanitizeJsonForPg.js";
import { idsFromMessageOnward } from "./sessionMessagesRevert.js";

export { AGENT_TASK_STREAM_WORKFLOW_PREFIX, isAgentTaskStreamWorkflowId };
export class SessionMessageRepository {
  async listBySessionId(sessionId: string): Promise<SessionMessage[]> {
    const db = getDb();
    return db
      .select()
      .from(sessionMessages)
      .where(
        and(
          eq(sessionMessages.sessionId, sessionId),
          isNull(sessionMessages.deletedAt)
        )
      )
      .orderBy(asc(sessionMessages.createdAt), asc(sessionMessages.id));
  }
  async create(input: {
    sessionId: string;
    role: SessionMessage["role"];
    parts: unknown[];
    turnId?: string | null;
    createdAt?: Date;
  }): Promise<SessionMessage> {
    const db = getDb();
    const [created] = await db
      .insert(sessionMessages)
      .values({
        sessionId: input.sessionId,
        role: input.role,
        parts: sanitizeJsonForPg(input.parts),
        turnId: input.turnId ?? null,
        createdAt: input.createdAt ?? new Date()
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
  async deleteFromMessage(
    sessionId: string,
    messageId: string
  ): Promise<number> {
    const rows = await this.listBySessionId(sessionId);
    const ids = idsFromMessageOnward(rows, messageId);
    if (!ids || ids.length === 0) return 0;
    const db = getDb();
    await db
      .update(sessionMessages)
      .set({ deletedAt: new Date() })
      .where(inArray(sessionMessages.id, ids));
    return ids.length;
  }
  async copyUntil(options: {
    sourceSessionId: string;
    targetSessionId: string;
    untilMessageId: string;
    turnIdMap?: ReadonlyMap<string, string>;
  }): Promise<number> {
    const { sourceSessionId, targetSessionId, untilMessageId, turnIdMap } =
      options;
    const rows = await this.listBySessionId(sourceSessionId);
    const idx = rows.findIndex((row) => row.id === untilMessageId);
    if (idx < 0) return 0;
    const slice = rows.slice(0, idx + 1);
    for (const row of slice) {
      const mapped =
        row.turnId && turnIdMap ? (turnIdMap.get(row.turnId) ?? null) : null;
      await this.create({
        sessionId: targetSessionId,
        role: row.role,
        parts: Array.isArray(row.parts) ? row.parts : [],
        turnId: mapped,
        createdAt: row.createdAt
      });
    }
    return slice.length;
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
        and(
          eq(chatTurns.sessionId, sessionId),
          eq(chatTurns.status, "running"),
          not(
            like(chatTurns.workflowId, `${AGENT_TASK_STREAM_WORKFLOW_PREFIX}%`)
          )
        )
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
      .where(
        and(
          eq(chatTurns.status, "running"),
          not(
            like(chatTurns.workflowId, `${AGENT_TASK_STREAM_WORKFLOW_PREFIX}%`)
          )
        )
      );
    return [...new Set(rows.map((row) => row.sessionId))];
  }
  async listBySessionId(sessionId: string): Promise<ChatTurn[]> {
    const db = getDb();
    return db
      .select()
      .from(chatTurns)
      .where(eq(chatTurns.sessionId, sessionId))
      .orderBy(asc(chatTurns.startedAt), asc(chatTurns.id));
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
  async cloneCompleted(input: {
    id: string;
    sessionId: string;
    workflowId: string;
    source: ChatTurn;
  }): Promise<ChatTurn> {
    const status =
      input.source.status === "running" ? "completed" : input.source.status;
    const db = getDb();
    const [created] = await db
      .insert(chatTurns)
      .values({
        id: input.id,
        sessionId: input.sessionId,
        workflowId: input.workflowId,
        status,
        mode: input.source.mode,
        provider: input.source.provider,
        model: input.source.model,
        error: input.source.error,
        rounds: input.source.rounds,
        toolCallCount: input.source.toolCallCount,
        toolNames: input.source.toolNames,
        hitRoundCap: input.source.hitRoundCap,
        workspaceCheckpoint: input.source.workspaceCheckpoint,
        startedAt: input.source.startedAt,
        finishedAt: input.source.finishedAt ?? new Date()
      })
      .returning();
    return created as ChatTurn;
  }
  async setWorkspaceCheckpoint(
    id: string,
    checkpoint: {
      version: 1;
      files: Array<{
        path: string;
        op: "create" | "update" | "delete";
        blob: string | null;
      }>;
    }
  ): Promise<ChatTurn | null> {
    const db = getDb();
    const [updated] = await db
      .update(chatTurns)
      .set({ workspaceCheckpoint: checkpoint })
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
