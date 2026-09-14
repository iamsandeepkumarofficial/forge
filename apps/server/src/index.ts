import "./env.js";
import http from "node:http";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createLocalUserMiddleware } from "./api/pocAuth.js";
import { connectPostgres } from "@forge/db";
import { createInternalRouter } from "./api/internal/internal.router.js";
import { attachTerminalSessionWebSocket } from "./api/internal/terminalSession.ws.js";
import { createProjectsRouter } from "./api/projectsRouter.js";
import { createChatFeaturesRouter } from "./api/chatFeaturesRouter.js";
import { createAttachmentsRouter } from "./api/attachmentsRouter.js";
import { createChatRouter } from "./api/chatRouter.js";
import { createWorkspacesRouter } from "./api/workspacesRouter.js";
import { startInProcessPreview } from "./preview/startInProcessPreview.js";
import { cloudSandboxKindFromEnv } from "./projects/sandboxRuntime/resolve.js";

const N_120 = 120;
const N_1200 = 1200;
const N_4000 = 4000;

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "32mb" }));
app.use(
  rateLimit({
    windowMs: 60000,
    max: Number(process.env.RATE_LIMIT_PER_MIN || N_120),
    message: { error: "Too many requests, please try again later." },
    skip: (req) => req.path.startsWith("/internal")
  })
);
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mode: "tool-plane",
    cloudSandbox: cloudSandboxKindFromEnv(),
    localSessions: "host"
  });
});
try {
  await connectPostgres();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(
    `[forge-tool-plane] PostgreSQL connect failed: ${message}\n`
  );
  process.exit(1);
}
const localUser = createLocalUserMiddleware();
app.use("/api", createChatRouter());
app.use("/api/projects", localUser, createChatFeaturesRouter());
app.use("/api/projects", localUser, createAttachmentsRouter());
app.use("/api/projects", localUser, createProjectsRouter());
app.use("/api/workspaces", localUser, createWorkspacesRouter());
app.use(
  "/internal",
  rateLimit({
    windowMs: 60000,
    max: Number(process.env.INTERNAL_RATE_LIMIT_PER_MIN || N_1200),
    message: { error: "Too many requests, please try again later." }
  }),
  createInternalRouter()
);
const port = Number(process.env.PORT || N_4000);
const bindHost =
  process.env.FORGE_BIND_LOOPBACK === "1"
    ? "127.0.0.1"
    : process.env.FORGE_BIND_HOST?.trim() || "127.0.0.1";

startInProcessPreview(bindHost);

const server = http.createServer(app);
attachTerminalSessionWebSocket(server);

server.on("error", (err: NodeJS.ErrnoException) => {
  const detail =
    err.code === "EADDRINUSE"
      ? `Port ${port} is already in use — stop the other Forge server (often a non-desktop pnpm dev) so host mode can bind.`
      : err.message;
  process.stderr.write(`[forge-tool-plane] listen failed: ${detail}\n`);
  process.exit(1);
});

server.listen(port, bindHost, () => {
  const cloud = cloudSandboxKindFromEnv();
  process.stdout.write(
    `Forge tool plane listening on http://${bindHost}:${port} (cloudSandbox=${cloud}, localSessions=host)\n`
  );
  void import("./projects/sandboxIdle.js")
    .then(({ startSandboxIdleSweeper }) => {
      startSandboxIdleSweeper();
    })
    .catch((err) => {
      process.stderr.write(
        `[sandboxIdle] sweeper failed to start: ${err instanceof Error ? err.message : String(err)}\n`
      );
    });
  void import("./tools/web/executeWebTool.js")
    .then(({ ensureWarmPool, webToolsEnabled }) => {
      if (!webToolsEnabled()) return;
      return ensureWarmPool().then(() => {
        process.stdout.write("[web-search-pool] warm pool ready\n");
      });
    })
    .catch((err) => {
      process.stderr.write(
        `[web-search-pool] warm failed: ${err instanceof Error ? err.message : String(err)}\n`
      );
    });
});
