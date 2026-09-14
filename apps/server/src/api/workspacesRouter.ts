import { Router } from "express";
import { createLocalUserMiddleware } from "./pocAuth.js";
import {
  handleCreateWorkspace,
  handleDeleteWorkspace,
  handleGetWorkspace,
  handleListWorkspaces,
  handlePatchWorkspace
} from "./workspacesRouter/workspaceHandlers.js";
import {
  handleAddProject,
  handleRemoveProject,
  handleUpdateProject
} from "./workspacesRouter/projectHandlers.js";
import {
  handleCreateChat,
  handleDeleteChat,
  handleGetChat,
  handleListChats
} from "./workspacesRouter/chatHandlers.js";
import {
  handleAnalyze,
  handleAttachDatabase,
  handleClearDepsCache,
  handleClearLaunch,
  handleDeleteParameter,
  handleDetachDatabase,
  handleGetEnvironment,
  handleGetHealth,
  handleListDatabases,
  handleListParameters,
  handleUpsertParameter
} from "./workspacesRouter/resourceHandlers.js";

export function createWorkspacesRouter(): Router {
  const router = Router();
  const pocAuth = createLocalUserMiddleware();

  router.post("/", pocAuth, (req, res) => handleCreateWorkspace(req, res));
  router.get("/", pocAuth, (req, res) => handleListWorkspaces(req, res));
  router.get("/:workspaceId", pocAuth, (req, res) =>
    handleGetWorkspace(req, res)
  );
  router.patch("/:workspaceId", pocAuth, (req, res) =>
    handlePatchWorkspace(req, res)
  );
  router.delete("/:workspaceId", pocAuth, (req, res) =>
    handleDeleteWorkspace(req, res)
  );

  router.post("/:workspaceId/projects", pocAuth, (req, res) =>
    handleAddProject(req, res)
  );
  router.patch("/:workspaceId/projects/:projectId", pocAuth, (req, res) =>
    handleUpdateProject(req, res)
  );
  router.delete("/:workspaceId/projects/:projectId", pocAuth, (req, res) =>
    handleRemoveProject(req, res)
  );

  router.get("/:workspaceId/chats", pocAuth, (req, res) =>
    handleListChats(req, res)
  );
  router.get("/:workspaceId/chats/:chatId", pocAuth, (req, res) =>
    handleGetChat(req, res)
  );
  router.post("/:workspaceId/chats", pocAuth, (req, res) =>
    handleCreateChat(req, res)
  );
  router.delete("/:workspaceId/chats/:chatId", pocAuth, (req, res) =>
    handleDeleteChat(req, res)
  );

  router.get("/:workspaceId/health", pocAuth, (req, res) =>
    handleGetHealth(req, res)
  );
  router.post("/:workspaceId/analyze", pocAuth, (req, res) =>
    handleAnalyze(req, res)
  );
  router.get("/:workspaceId/parameters", pocAuth, (req, res) =>
    handleListParameters(req, res)
  );
  router.put("/:workspaceId/parameters", pocAuth, (req, res) =>
    handleUpsertParameter(req, res)
  );
  router.delete("/:workspaceId/parameters/:key", pocAuth, (req, res) =>
    handleDeleteParameter(req, res)
  );

  router.get("/:workspaceId/databases", pocAuth, (req, res) =>
    handleListDatabases(req, res)
  );
  router.post("/:workspaceId/databases", pocAuth, (req, res) =>
    handleAttachDatabase(req, res)
  );
  router.delete("/:workspaceId/databases/:engineId", pocAuth, (req, res) =>
    handleDetachDatabase(req, res)
  );

  router.get("/:workspaceId/environment", pocAuth, (req, res) =>
    handleGetEnvironment(req, res)
  );
  router.delete("/:workspaceId/environment/launch", pocAuth, (req, res) =>
    handleClearLaunch(req, res)
  );
  router.delete("/:workspaceId/environment/deps-cache", pocAuth, (req, res) =>
    handleClearDepsCache(req, res)
  );

  return router;
}
