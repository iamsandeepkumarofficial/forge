import { Router, type RequestHandler } from "express";
import {
  createLocalUserMiddleware,
  type AuthedRequest
} from "./pocAuth.js";
import { WorkspaceService } from "../services/workspace/workspace.service.js";
import { ChatFeatureService } from "../projects/chatFeatureService.js";
import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import {
  destroySessionSandbox,
  provisionSessionSandbox
} from "../projects/sessionSandbox.js";
import { finalizeSessionProvision } from "../projects/sessionProvision.js";
import type { WorkspaceRoute } from "@forge/db";
import { ParameterRepository } from "../catalog/parameterRepository.js";
import { WorkspaceHealthRepository } from "../catalog/workspaceHealthRepository.js";
import { runWorkspaceAnalyzeAndPrepare } from "../services/workspace/workspaceHealthJob.js";

const N_201 = 201;
const N_202 = 202;
const N_204 = 204;
const N_400 = 400;
const N_403 = 403;
const N_404 = 404;
const N_409 = 409;
const N_500 = 500;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function statusFromError(error: unknown): number {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  const msg = errorMessage(error).toLowerCase();
  if (msg.includes("not found")) return N_404;
  if (msg.includes("forbidden")) return N_403;
  if (msg.includes("already")) return N_409;
  if (
    msg.includes("required") ||
    msg.includes("invalid") ||
    msg.includes("cycle") ||
    msg.includes("must") ||
    msg.includes("exactly one")
  ) {
    return N_400;
  }
  return N_500;
}

export function createWorkspacesRouter(): Router {
  const router = Router();
  const pocAuth = createLocalUserMiddleware();
  const workspaceService = new WorkspaceService();
  const chatFeatureService = new ChatFeatureService();
  const chatRepo = new ChatFeatureRepository();

  router.post("/", pocAuth, (async (req, res) => {
    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      return res.status(N_400).json({ error: "name is required" });
    }
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const ws = await workspaceService.createWorkspace(userId, name);
      res.json(ws);
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.get("/", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const list = await workspaceService.listWorkspaces(userId);
      res.json({ workspaces: list });
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.get("/:workspaceId", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const ws = await workspaceService.getWorkspaceDetail(
        String(req.params.workspaceId),
        userId
      );
      res.json(ws);
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.patch("/:workspaceId", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      const name =
        typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
      const routes = Array.isArray(req.body?.routes)
        ? (req.body.routes as WorkspaceRoute[])
        : undefined;
      if (name == null && routes == null) {
        return res
          .status(N_400)
          .json({ error: "Provide name and/or routes to update" });
      }
      if (name != null) {
        await workspaceService.renameWorkspace(workspaceId, userId, name);
      }
      if (routes != null) {
        await workspaceService.setRoutes(workspaceId, userId, routes);
      }
      const ws = await workspaceService.getWorkspaceDetail(workspaceId, userId);
      res.json(ws);
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.delete("/:workspaceId", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      await workspaceService.deleteWorkspace(
        String(req.params.workspaceId),
        userId
      );
      res.status(204).end();
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.post("/:workspaceId/projects", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const projectId =
        typeof req.body?.projectId === "string"
          ? req.body.projectId.trim()
          : "";
      if (!projectId) {
        return res.status(N_400).json({ error: "projectId is required" });
      }
      const repoName =
        typeof req.body?.repoName === "string"
          ? req.body.repoName.trim()
          : undefined;
      const dependsOn = Array.isArray(req.body?.dependsOn)
        ? (req.body.dependsOn as string[])
        : undefined;
      const env =
        req.body?.env &&
        typeof req.body.env === "object" &&
        !Array.isArray(req.body.env)
          ? (req.body.env as Record<string, string>)
          : undefined;
      const sortOrder =
        typeof req.body?.sortOrder === "number"
          ? req.body.sortOrder
          : undefined;
      const ws = await workspaceService.addProject(
        String(req.params.workspaceId),
        userId,
        { projectId, repoName, dependsOn, env, sortOrder }
      );
      res.json(ws);
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.patch("/:workspaceId/projects/:projectId", pocAuth, (async (
    req,
    res
  ) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const repoName =
        typeof req.body?.repoName === "string"
          ? req.body.repoName.trim()
          : undefined;
      const dependsOn = Array.isArray(req.body?.dependsOn)
        ? (req.body.dependsOn as string[])
        : undefined;
      const env =
        req.body?.env &&
        typeof req.body.env === "object" &&
        !Array.isArray(req.body.env)
          ? (req.body.env as Record<string, string>)
          : undefined;
      const sortOrder =
        typeof req.body?.sortOrder === "number"
          ? req.body.sortOrder
          : undefined;
      const ws = await workspaceService.updateMember(
        String(req.params.workspaceId),
        userId,
        String(req.params.projectId),
        { repoName, dependsOn, env, sortOrder }
      );
      res.json(ws);
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.delete("/:workspaceId/projects/:projectId", pocAuth, (async (
    req,
    res
  ) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const ws = await workspaceService.removeProject(
        String(req.params.workspaceId),
        userId,
        String(req.params.projectId)
      );
      res.json(ws);
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.get("/:workspaceId/chats", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const chats = await chatRepo.listByWorkspaceId(workspaceId);
      res.json({ chats });
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.get("/:workspaceId/chats/:chatId", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      const chatId = String(req.params.chatId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const chat = await chatRepo.getById(chatId);
      if (
        !chat ||
        chat.workspaceId !== workspaceId ||
        chat.userId !== userId
      ) {
        return res.status(N_404).json({ error: "Chat not found" });
      }
      res.json(chat);
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.post("/:workspaceId/chats", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const title =
        typeof req.body?.title === "string" ? req.body.title : undefined;
      const chat = await chatFeatureService.createWorkbench({
        workspaceId,
        userId,
        title
      });
      void provisionSessionSandbox(chat.sessionId)
        .then(() => finalizeSessionProvision(chat.sessionId))
        .catch((err) => {
          console.warn(
            `[workspace chat ${chat.id}] sandbox provisioning failed (will retry on open): ${err instanceof Error ? err.message : String(err)}`
          );
        });
      res.status(N_201).json(chat);
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.delete("/:workspaceId/chats/:chatId", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      const chatId = String(req.params.chatId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const chat = await chatRepo.getById(chatId);
      if (
        !chat ||
        chat.workspaceId !== workspaceId ||
        chat.userId !== userId
      ) {
        return res.status(N_404).json({ error: "Chat not found" });
      }
      await chatRepo.deleteChatFeature(chatId);
      void destroySessionSandbox(chat.sessionId).catch((err) => {
        console.warn(
          `[workspace chat ${chatId}] sandbox teardown failed: ${err instanceof Error ? err.message : String(err)}`
        );
      });
      res.status(N_204).end();
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.get("/:workspaceId/health", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const healthRepo = new WorkspaceHealthRepository();
      const row = await healthRepo.get(workspaceId);
      res.json(
        row ?? {
          workspaceId,
          status: "computing",
          report: {},
          computedAt: null
        }
      );
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.post("/:workspaceId/analyze", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const healthRepo = new WorkspaceHealthRepository();
      await healthRepo.setComputing(workspaceId);
      void runWorkspaceAnalyzeAndPrepare(workspaceId, userId).catch((err) => {
        console.warn(
          `[workspace analyze ${workspaceId}]: ${err instanceof Error ? err.message : String(err)}`
        );
      });
      const row = await healthRepo.get(workspaceId);
      res.status(N_202).json(
        row ?? {
          workspaceId,
          status: "computing",
          report: {},
          computedAt: null
        }
      );
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.get("/:workspaceId/parameters", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const paramRepo = new ParameterRepository();
      const parameters = await paramRepo.listWorkspaceParameters(workspaceId);
      res.json({
        parameters: parameters.map((p) => ({
          key: p.key,
          value: p.secret ? (p.value ? "••••••••" : "") : p.value,
          secret: p.secret,
          hasValue: p.value.length > 0
        }))
      });
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.put("/:workspaceId/parameters", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const key = typeof req.body?.key === "string" ? req.body.key.trim() : "";
      const value = typeof req.body?.value === "string" ? req.body.value : "";
      const secret = Boolean(req.body?.secret);
      if (!key) {
        return res.status(N_400).json({ error: "key is required" });
      }
      const paramRepo = new ParameterRepository();
      const saved = await paramRepo.upsertWorkspaceParameter({
        workspaceId,
        key,
        value,
        secret
      });
      res.json({
        key: saved.key,
        value: saved.secret ? "••••••••" : saved.value,
        secret: saved.secret
      });
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.delete("/:workspaceId/parameters/:key", pocAuth, (async (
    req,
    res
  ) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const paramRepo = new ParameterRepository();
      await paramRepo.deleteWorkspaceParameter(
        workspaceId,
        String(req.params.key)
      );
      res.status(N_204).end();
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.get("/:workspaceId/databases", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const { loadWorkspaceAppDbStatus } = await import(
        "../projects/sessionAppDb.js"
      );
      res.json(await loadWorkspaceAppDbStatus(workspaceId));
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.post("/:workspaceId/databases", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const engineId =
        typeof req.body?.engineId === "string" ? req.body.engineId.trim() : "";
      if (engineId !== "postgres" && engineId !== "mongo") {
        return res
          .status(N_400)
          .json({ error: "engineId must be postgres or mongo" });
      }
      const { attachWorkspaceDatabase } = await import(
        "../projects/sessionAppDb.js"
      );
      const provisioned = await attachWorkspaceDatabase(workspaceId, engineId);
      res.status(N_201).json({
        engineId: provisioned.engineId,
        label: provisioned.label,
        image: provisioned.image,
        database: provisioned.database,
        envKey: provisioned.envKey,
        networkAlias: provisioned.networkAlias,
        hostPort: provisioned.hostPort,
        reused: provisioned.reused,
        pulled: provisioned.pulled
      });
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.delete("/:workspaceId/databases/:engineId", pocAuth, (async (
    req,
    res
  ) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      const engineId = String(req.params.engineId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      if (engineId !== "postgres" && engineId !== "mongo") {
        return res
          .status(N_400)
          .json({ error: "engineId must be postgres or mongo" });
      }
      const { detachWorkspaceDatabase } = await import(
        "../projects/sessionAppDb.js"
      );
      await detachWorkspaceDatabase(workspaceId, engineId);
      res.status(N_204).end();
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.get("/:workspaceId/environment", pocAuth, (async (req, res) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const { getWorkspaceEnvironmentStatus } = await import(
        "../projects/workspaceEnvironment.js"
      );
      res.json(await getWorkspaceEnvironmentStatus(workspaceId));
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.delete("/:workspaceId/environment/launch", pocAuth, (async (
    req,
    res
  ) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const { clearWorkspaceLaunch } = await import(
        "../projects/workspaceEnvironment.js"
      );
      await clearWorkspaceLaunch(workspaceId);
      res.status(N_204).end();
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  router.delete("/:workspaceId/environment/deps-cache", pocAuth, (async (
    req,
    res
  ) => {
    try {
      const userId = (req as AuthedRequest).forgeUser.id;
      const workspaceId = String(req.params.workspaceId);
      await workspaceService.getWorkspaceDetail(workspaceId, userId);
      const { clearWorkspacePackageCache } = await import(
        "../projects/workspaceEnvironment.js"
      );
      await clearWorkspacePackageCache(workspaceId);
      res.status(N_204).end();
    } catch (error: unknown) {
      res.status(statusFromError(error)).json({ error: errorMessage(error) });
    }
  }) as RequestHandler);

  return router;
}
