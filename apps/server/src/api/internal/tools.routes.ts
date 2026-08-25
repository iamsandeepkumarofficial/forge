import { Router, type Request, type Response } from "express";
import {
  resolveChatAgentMode,
  serializeChatToolDefinitions
} from "@forge/core";
import { composeChatAgentSystemPrompt } from "../../prompts/chatAgent.prompts.js";
import { ensureLaunchConfig } from "../../projects/launchScaffold.js";
import { getSessionRepoInfo } from "../../projects/sessionSandbox.js";
import { resolveSandbox } from "../../projects/sandboxExec.js";
import { ensurePackagedSkillsInSession } from "../../tools/skillIndex.js";
import { ToolService } from "../../tools/tool.service.js";
import {
  collectSandboxChanges,
  diffFileInSandbox
} from "../../tools/sandbox.tool.js";
import type { WebBudgetLimits } from "../../tools/web/budgets.js";
import { webToolsEnabled } from "../../tools/web/enabled.js";

const N_400 = 400;
const N_404 = 404;
const N_500 = 500;

function mountToolsPrepareRoutes(
  router: Router,
  _toolService: ToolService
): void {
  router.post("/prepare", async (req, res) => {
    const sessionId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
    if (!sessionId.trim()) {
      res.status(N_400).json({ error: "sessionId required" });
      return;
    }
    try {
      const { repoDir, workingDir, sessionRoot } =
        await resolveSandbox(sessionId);
      ensurePackagedSkillsInSession(workingDir);
      res.json({ sessionRoot, worktrees: { [repoDir]: workingDir } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(N_500).json({ error: message });
    }
  });
  router.get("/system-prompt", async (req, res) => {
    const sessionId =
      typeof req.query.sessionId === "string" ? req.query.sessionId : "";
    if (!sessionId.trim()) {
      res.status(N_400).json({ error: "sessionId required" });
      return;
    }
    try {
      await ensureLaunchConfig(sessionId).catch(() => undefined);
      const { workingDir, repoDir, sessionRoot } =
        await getSessionRepoInfo(sessionId);
      const prompt = composeChatAgentSystemPrompt({
        sessionRoot,
        repoDir,
        workingDir,
        sessionId
      });
      res.type("text/plain; charset=utf-8").send(prompt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(N_500).json({ error: message });
    }
  });
  router.get("/chat-tool-definitions", async (req, res) => {
    await handleChatToolDefinitions(req, res);
  });
  router.get("/changes", async (req, res) => {
    const sessionId =
      typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
    if (!sessionId) {
      res.status(N_400).json({ error: "sessionId query required" });
      return;
    }
    try {
      const repos = await collectSandboxChanges(sessionId);
      const sessionRoot = repos[0]?.worktreePath ?? "/workspace";
      res.json({ sessionRoot, repos });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(N_500).json({ error: message });
    }
  });
}

async function handleChatToolDefinitions(
  req: Request,
  res: Response
): Promise<void> {
  const agentMode = resolveChatAgentMode(req.query.mode);
  res.json({
    mode: agentMode,
    text: serializeChatToolDefinitions({
      agentMode,
      includeWebTools: webToolsEnabled()
    })
  });
}

function parseWebBudgets(raw: unknown): Partial<WebBudgetLimits> | null {
  if (raw === undefined || typeof raw !== "object" || raw === null) {
    return null;
  }
  const webBudgetsRaw = raw as Record<string, unknown>;
  return {
    ...(typeof webBudgetsRaw.maxSearches === "number"
      ? { maxSearches: webBudgetsRaw.maxSearches }
      : {}),
    ...(typeof webBudgetsRaw.maxFetches === "number"
      ? { maxFetches: webBudgetsRaw.maxFetches }
      : {}),
    ...(typeof webBudgetsRaw.maxTotal === "number"
      ? { maxTotal: webBudgetsRaw.maxTotal }
      : {})
  };
}

function parseToolExecuteBody(body: Record<string, unknown> | undefined): {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  turnId: string | null;
  agentMode: string | null;
  webBudgets: Partial<WebBudgetLimits> | null;
} {
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const toolName = typeof body?.toolName === "string" ? body.toolName : "";
  const args =
    body?.args !== undefined &&
    typeof body.args === "object" &&
    body.args !== null
      ? (body.args as Record<string, unknown>)
      : {};
  const turnId =
    typeof body?.turnId === "string" && body.turnId.trim()
      ? body.turnId.trim()
      : null;
  const agentMode = typeof body?.agentMode === "string" ? body.agentMode : null;
  return {
    sessionId,
    toolName,
    args,
    turnId,
    agentMode,
    webBudgets: parseWebBudgets(body?.webBudgets)
  };
}

async function handleToolExecute(options: {
  req: Request;
  res: Response;
  toolService: ToolService;
}): Promise<void> {
  const parsed = parseToolExecuteBody(
    options.req.body as Record<string, unknown> | undefined
  );
  if (!parsed.sessionId.trim() || !parsed.toolName) {
    options.res
      .status(N_400)
      .json({ error: "sessionId and toolName required" });
    return;
  }
  const outcome = await options.toolService.execute(parsed);
  options.res.status(outcome.status).json(outcome.body);
}

async function handleFileDiff(options: {
  req: Request;
  res: Response;
}): Promise<void> {
  const sessionId =
    typeof options.req.query.sessionId === "string"
      ? options.req.query.sessionId.trim()
      : "";
  const repo =
    typeof options.req.query.repo === "string"
      ? options.req.query.repo.trim()
      : "";
  const filePath =
    typeof options.req.query.path === "string"
      ? options.req.query.path.trim()
      : "";
  if (!sessionId || !repo || !filePath) {
    options.res
      .status(N_400)
      .json({ error: "sessionId, repo, and path query params required" });
    return;
  }
  try {
    const diff = await diffFileInSandbox({
      sessionId,
      repo,
      relPath: filePath
    });
    options.res.type("text/plain; charset=utf-8").send(diff);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /unknown repo/.test(message) ? N_404 : N_500;
    options.res.status(status).type("text/plain; charset=utf-8").send(message);
  }
}

function mountToolsExecRoutes(router: Router, toolService: ToolService): void {
  router.get("/changes/file-diff", async (req, res) => {
    await handleFileDiff({ req, res });
  });
  router.post("/tool-execute", async (req, res) => {
    await handleToolExecute({ req, res, toolService });
  });
}

export function mountToolsRoutes(
  router: Router,
  toolService: ToolService
): void {
  mountToolsPrepareRoutes(router, toolService);
  mountToolsExecRoutes(router, toolService);
}
