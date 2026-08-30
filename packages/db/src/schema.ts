// Forge v1 targets chat + workspaces. Board / SDLC pipeline tables below are
// legacy and retained for first-boot compatibility (no schema rewrite yet).
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
  type AnyPgColumn
} from "drizzle-orm/pg-core";
export const projectSourceEnum = pgEnum("project_source", ["github", "local"]);
export const projectStatusEnum = pgEnum("project_status", [
  "available",
  "unavailable"
]);
export const chatFeatureStatusEnum = pgEnum("chat_feature_status", [
  "no_section",
  "planning",
  "development",
  "qa",
  "done"
]);
export const chatFeatureTypeEnum = pgEnum("chat_feature_type", [
  "feature",
  "bug",
  "refactor"
]);
export const chatFeaturePriorityEnum = pgEnum("chat_feature_priority", [
  "low",
  "medium",
  "high",
  "urgent"
]);
export const chatFeatureKindEnum = pgEnum("chat_feature_kind", [
  "ticket",
  "workbench"
]);
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    emailUnique: unique("users_email_unique").on(table.email)
  })
);
export const userGithubAccounts = pgTable(
  "user_github_accounts",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    githubUserId: varchar("github_user_id", { length: 64 }).notNull(),
    githubLogin: varchar("github_login", { length: 255 }).notNull(),
    accessToken: text("access_token").notNull(),
    scope: text("scope"),
    tokenType: varchar("token_type", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    loginIndex: index("user_github_accounts_login_idx").on(table.githubLogin)
  })
);
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sessionId: text("session_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});
export const uiState = pgTable("ui_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 255 }).notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    source: projectSourceEnum("source").notNull(),
    dedupeKey: varchar("dedupe_key", { length: 255 }).notNull(),
    canonicalKey: text("canonical_key"),
    status: projectStatusEnum("status").notNull().default("available"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    userIndex: index("projects_user_id_idx").on(table.userId),
    dedupeKeyUnique: unique("projects_user_id_dedupe_key_unique").on(
      table.userId,
      table.dedupeKey
    )
  })
);

/** Ordered path-prefix rules for the workspace single-origin preview gateway. */
export type WorkspaceRoute = {
  pathPrefix: string;
  /** Member repoName that receives matching requests. */
  target: string;
  /** When true, strip pathPrefix before proxying (default false). */
  stripPrefix?: boolean;
};

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    /** Gateway route map; specific prefixes before catch-all `/`. */
    routes: jsonb("routes").$type<WorkspaceRoute[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    userIndex: index("workspaces_user_id_idx").on(table.userId)
  })
);

export const workspaceProjects = pgTable(
  "workspace_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Mount directory name under /workspace/{repoName}. */
    repoName: varchar("repo_name", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Other member repoNames this member depends on (startup order). */
    dependsOn: jsonb("depends_on").$type<string[]>().notNull().default([]),
    /**
     * Env templates resolved at provision time.
     * Placeholders: {{svc.internalUrl}}, {{svc.publicUrl}}.
     */
    env: jsonb("env")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    workspaceProjectUnique: unique(
      "workspace_projects_workspace_id_project_id_unique"
    ).on(table.workspaceId, table.projectId),
    workspaceRepoNameUnique: unique(
      "workspace_projects_workspace_id_repo_name_unique"
    ).on(table.workspaceId, table.repoName),
    workspaceIdIndex: index("workspace_projects_workspace_id_idx").on(
      table.workspaceId
    ),
    projectIdIndex: index("workspace_projects_project_id_idx").on(
      table.projectId
    )
  })
);

export const projectParameters = pgTable(
  "project_parameters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 255 }).notNull(),
    value: text("value").notNull(),
    secret: boolean("secret").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    projectKeyUnique: unique("project_parameters_project_id_key_unique").on(
      table.projectId,
      table.key
    ),
    projectIdIndex: index("project_parameters_project_id_idx").on(table.projectId)
  })
);

export const workspaceParameters = pgTable(
  "workspace_parameters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 255 }).notNull(),
    value: text("value").notNull(),
    secret: boolean("secret").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    workspaceKeyUnique: unique("workspace_parameters_workspace_id_key_unique").on(
      table.workspaceId,
      table.key
    ),
    workspaceIdIndex: index("workspace_parameters_workspace_id_idx").on(
      table.workspaceId
    )
  })
);

export type WorkspaceHealthStatus =
  | "ready"
  | "blocked"
  | "warnings"
  | "computing";

export const workspaceHealth = pgTable("workspace_health", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 32 })
    .notNull()
    .default("computing")
    .$type<WorkspaceHealthStatus>(),
  report: jsonb("report").$type<Record<string, unknown>>().notNull().default({}),
  computedAt: timestamp("computed_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

/** Engines the workspace opted into (shared docker servers; per-workspace db name). */
export const workspaceDatabases = pgTable(
  "workspace_databases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    engineId: varchar("engine_id", { length: 64 }).notNull(),
    databaseName: varchar("database_name", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    workspaceEngineUnique: unique(
      "workspace_databases_workspace_id_engine_id_unique"
    ).on(table.workspaceId, table.engineId),
    workspaceIdIndex: index("workspace_databases_workspace_id_idx").on(
      table.workspaceId
    )
  })
);

/** Durable session-root launch.json promoted from a successful chat env. */
export const workspaceEnvironments = pgTable("workspace_environments", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  launch: jsonb("launch")
    .$type<{ apps?: unknown[] } & Record<string, unknown>>()
    .notNull()
    .default({}),
  sourceSessionId: text("source_session_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const chatFeatures = pgTable(
  "chat_features",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Set for project-scoped chats; null when workspace-scoped. */
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade"
    }),
    /** Set for workspace-scoped chats; null when project-scoped. */
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade"
    }),
    userId: uuid("user_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    kind: chatFeatureKindEnum("kind").notNull().default("ticket"),
    type: chatFeatureTypeEnum("type").notNull().default("feature"),
    parentId: uuid("parent_id").references((): AnyPgColumn => chatFeatures.id, {
      onDelete: "set null"
    }),
    status: chatFeatureStatusEnum("status").notNull().default("no_section"),
    priority: chatFeaturePriorityEnum("priority").notNull().default("medium"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    description: jsonb("description").$type<Record<string, unknown> | null>(),
    order: integer("order").notNull().default(0),
    branchName: varchar("branch_name", { length: 255 }).notNull(),
    sessionId: text("session_id").notNull(),
    workflowId: varchar("workflow_id", { length: 128 })
      .notNull()
      .default("sdlc"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    projectStatusOrderIndex: index("chat_features_project_status_order_idx").on(
      table.projectId,
      table.status,
      table.order
    ),
    projectIdUnique: unique("chat_features_project_id_status_branch_unique").on(
      table.projectId,
      table.branchName
    ),
    workspaceBranchUnique: unique(
      "chat_features_workspace_id_branch_unique"
    ).on(table.workspaceId, table.branchName),
    parentIdIndex: index("chat_features_parent_id_idx").on(table.parentId),
    projectKindActivityIndex: index(
      "chat_features_project_kind_activity_idx"
    ).on(table.projectId, table.kind, table.lastActivityAt),
    workspaceKindActivityIndex: index(
      "chat_features_workspace_kind_activity_idx"
    ).on(table.workspaceId, table.kind, table.lastActivityAt)
  })
);
export const documentSourceEnum = pgEnum("document_source", ["user", "agent"]);
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id"),
    title: varchar("title", { length: 512 }).notNull(),
    body: text("body").notNull().default(""),
    source: documentSourceEnum("source").notNull().default("user"),
    agentId: varchar("agent_id", { length: 128 }),
    chatFeatureId: uuid("chat_feature_id"),
    stageId: varchar("stage_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    userIdIndex: index("documents_user_id_idx").on(table.userId),
    userProjectIndex: index("documents_user_id_project_id_idx").on(
      table.userId,
      table.projectId
    ),
    chatFeatureIdIndex: index("documents_chat_feature_id_idx").on(
      table.chatFeatureId
    )
  })
);
export const chatActivityKindEnum = pgEnum("chat_activity_kind", [
  "history",
  "worklog"
]);
export const chatActivityActorEnum = pgEnum("chat_activity_actor", [
  "agent",
  "builder",
  "system"
]);
export const chatAttachments = pgTable(
  "chat_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatFeatureId: uuid("chat_feature_id")
      .notNull()
      .references(() => chatFeatures.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 512 }).notNull(),
    contentType: varchar("content_type", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    uploadedBy: uuid("uploaded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    chatFeatureIdIndex: index("chat_attachments_chat_feature_id_idx").on(
      table.chatFeatureId
    )
  })
);
export const chatLinkedItems = pgTable(
  "chat_linked_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatFeatureId: uuid("chat_feature_id")
      .notNull()
      .references(() => chatFeatures.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 512 }).notNull(),
    url: text("url").notNull(),
    externalKey: varchar("external_key", { length: 255 }),
    provider: varchar("provider", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    chatFeatureIdIndex: index("chat_linked_items_chat_feature_id_idx").on(
      table.chatFeatureId
    )
  })
);
export const chatActivities = pgTable(
  "chat_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatFeatureId: uuid("chat_feature_id")
      .notNull()
      .references(() => chatFeatures.id, { onDelete: "cascade" }),
    kind: chatActivityKindEnum("kind").notNull(),
    actorType: chatActivityActorEnum("actor_type").notNull(),
    agentId: varchar("agent_id", { length: 128 }),
    userId: uuid("user_id"),
    summary: text("summary").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    chatFeatureCreatedIndex: index(
      "chat_activities_chat_feature_id_created_at_idx"
    ).on(table.chatFeatureId, table.createdAt)
  })
);
export const chatComments = pgTable(
  "chat_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chatFeatureId: uuid("chat_feature_id")
      .notNull()
      .references(() => chatFeatures.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    chatFeatureIdIndex: index("chat_comments_chat_feature_id_idx").on(
      table.chatFeatureId
    )
  })
);
export const chatTurnStatusEnum = pgEnum("chat_turn_status", [
  "running",
  "completed",
  "cancelled",
  "failed"
]);
export const sessionMessageRoleEnum = pgEnum("session_message_role", [
  "user",
  "assistant",
  "system",
  "tool"
]);
export const sessionMessages = pgTable(
  "session_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: text("session_id").notNull(),
    role: sessionMessageRoleEnum("role").notNull(),
    parts: jsonb("parts").$type<unknown[]>().notNull().default([]),
    turnId: uuid("turn_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    sessionCreatedIndex: index("session_messages_session_id_created_at_idx").on(
      table.sessionId,
      table.createdAt
    )
  })
);
export const chatTurns = pgTable(
  "chat_turns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: text("session_id").notNull(),
    workflowId: text("workflow_id").notNull(),
    status: chatTurnStatusEnum("status").notNull().default("running"),
    mode: varchar("mode", { length: 16 }).notNull().default("build"),
    provider: varchar("provider", { length: 32 }),
    model: varchar("model", { length: 128 }),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true })
  },
  (table) => ({
    sessionStatusIndex: index("chat_turns_session_id_status_idx").on(
      table.sessionId,
      table.status
    ),
    workflowIdUnique: unique("chat_turns_workflow_id_unique").on(
      table.workflowId
    )
  })
);
export const chatTurnChunks = pgTable(
  "chat_turn_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    turnId: uuid("turn_id")
      .notNull()
      .references(() => chatTurns.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => ({
    turnSeqUnique: unique("chat_turn_chunks_turn_id_seq_unique").on(
      table.turnId,
      table.seq
    ),
    turnSeqIndex: index("chat_turn_chunks_turn_id_seq_idx").on(
      table.turnId,
      table.seq
    )
  })
);
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationInsert = typeof conversations.$inferInsert;
export type UiState = typeof uiState.$inferSelect;
export type UiStateInsert = typeof uiState.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceInsert = typeof workspaces.$inferInsert;
export type WorkspaceProject = typeof workspaceProjects.$inferSelect;
export type WorkspaceProjectInsert = typeof workspaceProjects.$inferInsert;
export type ProjectParameter = typeof projectParameters.$inferSelect;
export type ProjectParameterInsert = typeof projectParameters.$inferInsert;
export type WorkspaceParameter = typeof workspaceParameters.$inferSelect;
export type WorkspaceParameterInsert = typeof workspaceParameters.$inferInsert;
export type WorkspaceHealthRow = typeof workspaceHealth.$inferSelect;
export type WorkspaceDatabase = typeof workspaceDatabases.$inferSelect;
export type WorkspaceDatabaseInsert = typeof workspaceDatabases.$inferInsert;
export type WorkspaceEnvironment = typeof workspaceEnvironments.$inferSelect;
export type WorkspaceEnvironmentInsert =
  typeof workspaceEnvironments.$inferInsert;
export type ChatFeature = typeof chatFeatures.$inferSelect;
export type ChatFeatureInsert = typeof chatFeatures.$inferInsert;
export type ChatFeatureKind = (typeof chatFeatureKindEnum.enumValues)[number];
export type ChatComment = typeof chatComments.$inferSelect;
export type ChatCommentInsert = typeof chatComments.$inferInsert;
export type ChatAttachment = typeof chatAttachments.$inferSelect;
export type ChatAttachmentInsert = typeof chatAttachments.$inferInsert;
export type ChatLinkedItem = typeof chatLinkedItems.$inferSelect;
export type ChatLinkedItemInsert = typeof chatLinkedItems.$inferInsert;
export type ChatActivity = typeof chatActivities.$inferSelect;
export type ChatActivityInsert = typeof chatActivities.$inferInsert;
export type SessionMessage = typeof sessionMessages.$inferSelect;
export type SessionMessageInsert = typeof sessionMessages.$inferInsert;
export type ChatTurn = typeof chatTurns.$inferSelect;
export type ChatTurnInsert = typeof chatTurns.$inferInsert;
export type ChatTurnChunk = typeof chatTurnChunks.$inferSelect;
export type ChatTurnChunkInsert = typeof chatTurnChunks.$inferInsert;
export type UserGithubAccount = typeof userGithubAccounts.$inferSelect;
export type UserGithubAccountInsert = typeof userGithubAccounts.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type DocumentInsert = typeof documents.$inferInsert;
export type DocumentSource = (typeof documentSourceEnum.enumValues)[number];
export const allTables = {
  users,
  userGithubAccounts,
  conversations,
  uiState,
  projects,
  workspaces,
  workspaceProjects,
  projectParameters,
  workspaceParameters,
  workspaceHealth,
  workspaceDatabases,
  workspaceEnvironments,
  chatFeatures,
  documents,
  chatComments,
  chatAttachments,
  chatLinkedItems,
  chatActivities,
  sessionMessages,
  chatTurns,
  chatTurnChunks
};
