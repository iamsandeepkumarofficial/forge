import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import {
  errorMessage,
  N_400,
  statusFromError,
  workspaceService
} from "./shared.js";

export async function handleAddProject(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).forgeUser.id;
    const projectId =
      typeof req.body?.projectId === "string" ? req.body.projectId.trim() : "";
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
      typeof req.body?.sortOrder === "number" ? req.body.sortOrder : undefined;
    const ws = await workspaceService.addProject({
      workspaceId: String(req.params.workspaceId),
      userId,
      input: { projectId, repoName, dependsOn, env, sortOrder }
    });
    res.json(ws);
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}

export async function handleUpdateProject(req: Request, res: Response) {
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
      typeof req.body?.sortOrder === "number" ? req.body.sortOrder : undefined;
    const ws = await workspaceService.updateMember({
      workspaceId: String(req.params.workspaceId),
      userId,
      projectId: String(req.params.projectId),
      patch: { repoName, dependsOn, env, sortOrder }
    });
    res.json(ws);
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}

export async function handleRemoveProject(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).forgeUser.id;
    const ws = await workspaceService.removeProject({
      workspaceId: String(req.params.workspaceId),
      userId,
      projectId: String(req.params.projectId)
    });
    res.json(ws);
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}
