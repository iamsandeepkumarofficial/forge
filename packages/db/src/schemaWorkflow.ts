import {
  pgTable,
  text,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  index,
  unique,
  jsonb,
  boolean,
  numeric
} from "drizzle-orm/pg-core";
import { chatTurns } from "./schema.js";

export const workflowPlanStatusEnum = pgEnum("workflow_plan_status", [
  "planned",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled"
]);
export const workflowTaskStatusEnum = pgEnum("workflow_task_status", [
  "pending",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled"
]);
export const workflowTaskExecutorEnum = pgEnum("workflow_task_executor", [
  "agent",
  "tool",
  "human"
]);
export const workflowPlans = pgTable(
  "workflow_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: text("session_id").notNull(),
    turnId: uuid("turn_id")
      .notNull()
      .references(() => chatTurns.id, { onDelete: "cascade" }),
    workflowId: text("workflow_id").notNull(),
    goal: text("goal").notNull(),
    status: workflowPlanStatusEnum("status").notNull().default("planned"),
    version: integer("version").notNull().default(1),
    replanCount: integer("replan_count").notNull().default(0),
    queuedFollowUp: jsonb("queued_follow_up").$type<{
      text: string;
      mode?: string;
      provider?: string;
      model?: string;
      reasoningEffort?: string;
    } | null>(),
    workingMs: integer("working_ms").notNull().default(0),
    llmTokens: integer("llm_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),
    budgetStopReason: varchar("budget_stop_reason", { length: 16 }),
    snapshot: jsonb("snapshot").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    sessionStatusIndex: index("workflow_plans_session_id_status_idx").on(
      table.sessionId,
      table.status
    ),
    turnIdUnique: unique("workflow_plans_turn_id_unique").on(table.turnId)
  })
);
export const workflowTasks = pgTable(
  "workflow_tasks",
  {
    planId: uuid("plan_id")
      .notNull()
      .references(() => workflowPlans.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    version: integer("version").notNull().default(1),
    description: text("description").notNull(),
    executor: workflowTaskExecutorEnum("executor").notNull().default("agent"),
    dependencies: jsonb("dependencies").$type<string[]>().notNull().default([]),
    status: workflowTaskStatusEnum("status").notNull().default("pending"),
    idempotent: boolean("idempotent").notNull().default(false),
    waitReason: jsonb("wait_reason").$type<Record<string, unknown> | null>(),
    input: jsonb("input").$type<unknown>(),
    output: jsonb("output").$type<unknown>(),
    inputSchema: jsonb("input_schema")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({
        schemaVersion: 1,
        type: "object",
        additionalProperties: false,
        properties: {}
      }),
    outputSchema: jsonb("output_schema")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({
        schemaVersion: 1,
        type: "object",
        additionalProperties: false,
        properties: {}
      }),
    inputMappings: jsonb("input_mappings")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    error: text("error"),
    attemptCount: integer("attempt_count").notNull().default(0),
    childWorkflowId: text("child_workflow_id"),
    worktreePath: text("worktree_path"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true })
  },
  (table) => ({
    pk: unique("workflow_tasks_plan_version_id_unique").on(
      table.planId,
      table.version,
      table.id
    ),
    planVersionIndex: index("workflow_tasks_plan_id_version_idx").on(
      table.planId,
      table.version
    ),
    statusIndex: index("workflow_tasks_status_idx").on(table.status)
  })
);
export type WorkflowPlan = typeof workflowPlans.$inferSelect;
export type WorkflowPlanInsert = typeof workflowPlans.$inferInsert;
export type WorkflowTask = typeof workflowTasks.$inferSelect;
export type WorkflowTaskInsert = typeof workflowTasks.$inferInsert;
