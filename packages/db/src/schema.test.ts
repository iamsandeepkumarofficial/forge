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
  users
} from "./schema.js";

describe("schema tables", () => {
  it("exposes expected table names", () => {
    assert.equal(getTableName(users), "users");
    assert.equal(getTableName(projects), "projects");
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
      "projects",
      "sessionMessages",
      "uiState",
      "userGithubAccounts",
      "users"
    ]);
  });

  it("defines project and chat feature enum values", () => {
    assert.deepEqual(projectSourceEnum.enumValues, ["github", "upload"]);
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
  });
});
