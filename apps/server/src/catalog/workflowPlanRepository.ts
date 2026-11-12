import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@forge/db";
import {
  workflowPlans,
  workflowTasks,
  type WorkflowPlan,
  type WorkflowTask
} from "@forge/db";
import { sanitizeJsonForPg } from "./sanitizeJsonForPg.js";

export class WorkflowPlanRepository {
  async create(input: {
    id?: string;
    sessionId: string;
    turnId: string;
    workflowId: string;
    goal: string;
    status?: WorkflowPlan["status"];
    version?: number;
    snapshot?: Record<string, unknown> | null;
  }): Promise<WorkflowPlan> {
    const db = getDb();
    const [created] = await db
      .insert(workflowPlans)
      .values({
        id: input.id,
        sessionId: input.sessionId,
        turnId: input.turnId,
        workflowId: input.workflowId,
        goal: input.goal,
        status: input.status ?? "planned",
        version: input.version ?? 1,
        snapshot: input.snapshot ? sanitizeJsonForPg(input.snapshot) : null
      })
      .returning();
    return created as WorkflowPlan;
  }

  async getById(id: string): Promise<WorkflowPlan | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(workflowPlans)
      .where(eq(workflowPlans.id, id))
      .limit(1);
    return (row as WorkflowPlan) ?? null;
  }

  async getByTurnId(turnId: string): Promise<WorkflowPlan | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(workflowPlans)
      .where(eq(workflowPlans.turnId, turnId))
      .limit(1);
    return (row as WorkflowPlan) ?? null;
  }

  async getCurrentBySessionId(sessionId: string): Promise<WorkflowPlan | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(workflowPlans)
      .where(eq(workflowPlans.sessionId, sessionId))
      .orderBy(desc(workflowPlans.updatedAt))
      .limit(1);
    return (row as WorkflowPlan) ?? null;
  }

  async update(
    id: string,
    patch: Partial<{
      status: WorkflowPlan["status"];
      version: number;
      replanCount: number;
      queuedFollowUp: WorkflowPlan["queuedFollowUp"];
      workingMs: number;
      llmTokens: number;
      costUsd: string;
      budgetStopReason: string | null;
      snapshot: Record<string, unknown> | null;
      goal: string;
    }>
  ): Promise<WorkflowPlan | null> {
    const db = getDb();
    const [updated] = await db
      .update(workflowPlans)
      .set({
        ...patch,
        snapshot:
          patch.snapshot === undefined
            ? undefined
            : patch.snapshot
              ? sanitizeJsonForPg(patch.snapshot)
              : null,
        queuedFollowUp:
          patch.queuedFollowUp === undefined
            ? undefined
            : patch.queuedFollowUp
              ? sanitizeJsonForPg(patch.queuedFollowUp)
              : null,
        updatedAt: new Date()
      })
      .where(eq(workflowPlans.id, id))
      .returning();
    return (updated as WorkflowPlan) ?? null;
  }

  async upsertTasks(input: {
    planId: string;
    version: number;
    tasks: Array<{
      id: string;
      description: string;
      executor: WorkflowTask["executor"];
      dependencies?: string[];
      status?: WorkflowTask["status"];
      idempotent?: boolean;
      input?: unknown;
      inputSchema?: Record<string, unknown>;
      outputSchema?: Record<string, unknown>;
      inputMappings?: Array<Record<string, unknown>>;
    }>;
  }): Promise<WorkflowTask[]> {
    const db = getDb();
    const { planId, version, tasks } = input;
    if (tasks.length === 0) return [];
    const emptySchema = {
      schemaVersion: 1,
      type: "object",
      additionalProperties: false,
      properties: {}
    };
    const rows = await db
      .insert(workflowTasks)
      .values(
        tasks.map((t) => ({
          planId,
          id: t.id,
          version,
          description: t.description,
          executor: t.executor,
          dependencies: t.dependencies ?? [],
          status: t.status ?? "pending",
          idempotent: t.idempotent ?? false,
          input: t.input === undefined ? null : sanitizeJsonForPg(t.input),
          inputSchema: sanitizeJsonForPg(t.inputSchema ?? emptySchema),
          outputSchema: sanitizeJsonForPg(t.outputSchema ?? emptySchema),
          inputMappings: sanitizeJsonForPg(t.inputMappings ?? [])
        }))
      )
      .onConflictDoUpdate({
        target: [workflowTasks.planId, workflowTasks.version, workflowTasks.id],
        set: {
          description: sql`excluded.description`,
          executor: sql`excluded.executor`,
          dependencies: sql`excluded.dependencies`,
          status: sql`excluded.status`,
          idempotent: sql`excluded.idempotent`,
          input: sql`excluded.input`,
          inputSchema: sql`excluded.input_schema`,
          outputSchema: sql`excluded.output_schema`,
          inputMappings: sql`excluded.input_mappings`
        }
      })
      .returning();
    return rows as WorkflowTask[];
  }

  async listTasks(planId: string, version?: number): Promise<WorkflowTask[]> {
    const db = getDb();
    const plan = await this.getById(planId);
    const v = version ?? plan?.version ?? 1;
    return db
      .select()
      .from(workflowTasks)
      .where(
        and(eq(workflowTasks.planId, planId), eq(workflowTasks.version, v))
      )
      .orderBy(asc(workflowTasks.id));
  }

  async updateTask(input: {
    planId: string;
    version: number;
    taskId: string;
    patch: Partial<{
      status: WorkflowTask["status"];
      waitReason: Record<string, unknown> | null;
      output: unknown;
      error: string | null;
      attemptCount: number;
      childWorkflowId: string | null;
      worktreePath: string | null;
      streamTurnId: string | null;
      startedAt: Date | null;
      finishedAt: Date | null;
    }>;
  }): Promise<WorkflowTask | null> {
    const db = getDb();
    const { planId, version, taskId, patch } = input;
    const [updated] = await db
      .update(workflowTasks)
      .set({
        ...patch,
        waitReason:
          patch.waitReason === undefined
            ? undefined
            : patch.waitReason
              ? sanitizeJsonForPg(patch.waitReason)
              : null,
        output:
          patch.output === undefined
            ? undefined
            : patch.output === null
              ? null
              : sanitizeJsonForPg(patch.output)
      })
      .where(
        and(
          eq(workflowTasks.planId, planId),
          eq(workflowTasks.version, version),
          eq(workflowTasks.id, taskId)
        )
      )
      .returning();
    return (updated as WorkflowTask) ?? null;
  }

  async countRunningAgentTasks(): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workflowTasks)
      .where(
        and(
          eq(workflowTasks.status, "running"),
          eq(workflowTasks.executor, "agent")
        )
      );
    return Number(row?.count ?? 0);
  }
}
