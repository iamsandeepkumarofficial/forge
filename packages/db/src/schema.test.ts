import assert from "node:assert/strict";
import { getTableName } from "drizzle-orm";
import { describe, it } from "node:test";
import {
  allTables,
  chatFeatureKindEnum,
  chatFeatureStatusEnum,
  chatFeatures,
  documents,
  projectSourceEnum,
  projects,
  users,
  workspaceDatabases,
  workspaceEnvironments,
  workspaceHealth,
  workspaceParameters,
  workspaceProjects,
  workspaces
} from "./schema.js";

describe("schema tables", () => {
  it("exposes expected table names", () => {
    assert.equal(getTableName(users), "users");
    assert.equal(getTableName(projects), "projects");
    assert.equal(getTableName(workspaces), "workspaces");
    assert.equal(getTableName(workspaceProjects), "workspace_projects");
    assert.equal(getTableName(workspaceParameters), "workspace_parameters");
    assert.equal(getTableName(workspaceHealth), "workspace_health");
    assert.equal(getTableName(workspaceDatabases), "workspace_databases");
    assert.equal(getTableName(workspaceEnvironments), "workspace_environments");
    assert.equal(getTableName(chatFeatures), "chat_features");
    assert.equal(getTableName(documents), "documents");
  });

  it("includes every table in allTables", () => {
    const keys = Object.keys(allTables).sort();
    assert.deepEqual(keys, [
      "chatActivities",
      "chatAttachments",
      "chatComments",
      "chatFeatures",
      "chatLinkedItems",
      "chatTurnChunks",
      "chatTurns",
      "conversations",
      "documents",
      "projectParameters",
      "projects",
      "sessionMessages",
      "uiState",
      "userGithubAccounts",
      "users",
      "workspaceDatabases",
      "workspaceEnvironments",
      "workspaceHealth",
      "workspaceParameters",
      "workspaceProjects",
      "workspaces"
    ]);
  });

  it("defines project and chat feature enum values", () => {
    assert.deepEqual(projectSourceEnum.enumValues, ["github", "local"]);
    assert.deepEqual(chatFeatureKindEnum.enumValues, ["ticket", "workbench"]);
    assert.ok(chatFeatureStatusEnum.enumValues.includes("planning"));
    assert.ok(chatFeatureStatusEnum.enumValues.includes("done"));
  });

  it("defines required columns on users and projects", () => {
    assert.ok(users.id);
    assert.ok(users.email);
    assert.ok(projects.dedupeKey);
    assert.ok(projects.source);
    assert.ok(chatFeatures.branchName);
    assert.ok(chatFeatures.workflowId);
    assert.ok(chatFeatures.workspaceId);
    assert.ok(workspaces.routes);
    assert.ok(workspaceProjects.repoName);
    assert.ok(workspaceProjects.dependsOn);
    assert.ok(workspaceProjects.env);
  });
});
