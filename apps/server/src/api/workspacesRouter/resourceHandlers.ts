import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import { ParameterRepository } from "../../catalog/parameterRepository.js";
import { WorkspaceHealthRepository } from "../../catalog/workspaceHealthRepository.js";
import { runWorkspaceAnalyzeAndPrepare } from "../../services/workspace/workspaceHealthJob.js";
import {
  errorMessage,
  N_201,
  N_202,
  N_204,
  N_400,
  statusFromError,
  workspaceService
} from "./shared.js";

export async function handleGetHealth(req: Request, res: Response) {
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
}

export async function handleAnalyze(req: Request, res: Response) {
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
}

export async function handleListParameters(req: Request, res: Response) {
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
}

export async function handleUpsertParameter(req: Request, res: Response) {
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
}

export async function handleDeleteParameter(req: Request, res: Response) {
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
}

export async function handleListDatabases(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).forgeUser.id;
    const workspaceId = String(req.params.workspaceId);
    await workspaceService.getWorkspaceDetail(workspaceId, userId);
    const { loadWorkspaceAppDbStatus } =
      await import("../../projects/sessionAppDb.js");
    res.json(await loadWorkspaceAppDbStatus(workspaceId));
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}

export async function handleAttachDatabase(req: Request, res: Response) {
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
    const { attachWorkspaceDatabase } =
      await import("../../projects/sessionAppDb.js");
    const provisioned = await attachWorkspaceDatabase({
      workspaceId,
      engineId
    });
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
}

export async function handleDetachDatabase(req: Request, res: Response) {
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
    const { detachWorkspaceDatabase } =
      await import("../../projects/sessionAppDb.js");
    await detachWorkspaceDatabase({ workspaceId, engineId });
    res.status(N_204).end();
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}

export async function handleGetEnvironment(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).forgeUser.id;
    const workspaceId = String(req.params.workspaceId);
    await workspaceService.getWorkspaceDetail(workspaceId, userId);
    const { getWorkspaceEnvironmentStatus } =
      await import("../../projects/workspaceEnvironment.js");
    res.json(await getWorkspaceEnvironmentStatus(workspaceId));
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}

export async function handleClearLaunch(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).forgeUser.id;
    const workspaceId = String(req.params.workspaceId);
    await workspaceService.getWorkspaceDetail(workspaceId, userId);
    const { clearWorkspaceLaunch } =
      await import("../../projects/workspaceEnvironment.js");
    await clearWorkspaceLaunch(workspaceId);
    res.status(N_204).end();
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}

export async function handleClearDepsCache(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).forgeUser.id;
    const workspaceId = String(req.params.workspaceId);
    await workspaceService.getWorkspaceDetail(workspaceId, userId);
    const { clearWorkspacePackageCache } =
      await import("../../projects/workspaceEnvironment.js");
    await clearWorkspacePackageCache(workspaceId);
    res.status(N_204).end();
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}
