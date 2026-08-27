import { Router, type RequestHandler } from "express";
import {
  createLocalUserMiddleware,
  type AuthedRequest
} from "./pocAuth.js";
import { WorkspaceService } from "../services/workspace/workspace.service.js";
import { ChatFeatureService } from "../projects/chatFeatureService.js";
import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { provisionSessionSandbox } from "../projects/sessionSandbox.js";
import { autoStartPreview } from "../projects/appRunner.js";
import type { WorkspaceRoute } from "@forge/db";

const N_201 = 201;
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
      const chat = await chatFeatureService.create({
        workspaceId,
        userId,
        title
      });
      void provisionSessionSandbox(chat.sessionId)
        .then(() => autoStartPreview(chat.sessionId))
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

  return router;
}
