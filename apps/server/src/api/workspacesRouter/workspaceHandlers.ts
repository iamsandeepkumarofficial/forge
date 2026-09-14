import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import type { WorkspaceRoute } from "@forge/db";
import {
  errorMessage,
  N_204,
  N_400,
  statusFromError,
  workspaceService
} from "./shared.js";

export async function handleCreateWorkspace(req: Request, res: Response) {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
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
}

export async function handleListWorkspaces(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).forgeUser.id;
    const list = await workspaceService.listWorkspaces(userId);
    res.json({ workspaces: list });
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}

export async function handleGetWorkspace(req: Request, res: Response) {
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
}

export async function handlePatchWorkspace(req: Request, res: Response) {
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
      await workspaceService.renameWorkspace({ workspaceId, userId, name });
    }
    if (routes != null) {
      await workspaceService.setRoutes({ workspaceId, userId, routes });
    }
    const ws = await workspaceService.getWorkspaceDetail(workspaceId, userId);
    res.json(ws);
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}

export async function handleDeleteWorkspace(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).forgeUser.id;
    await workspaceService.deleteWorkspace(
      String(req.params.workspaceId),
      userId
    );
    res.status(N_204).end();
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}
