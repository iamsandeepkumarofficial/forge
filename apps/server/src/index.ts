import "./env.js";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createPocAuth } from "./api/pocAuth.js";
import { connectPostgres } from "@forge/db";
import { createInternalRouter } from "./api/internal/internal.router.js";
import { createProjectsRouter } from "./api/projectsRouter.js";
import { createChatFeaturesRouter } from "./api/chatFeaturesRouter.js";
import { createAttachmentsRouter } from "./api/attachmentsRouter.js";
import { createChatRouter } from "./api/chatRouter.js";

const N_120 = 120;
const N_1200 = 1200;
const N_4000 = 4000;

const pocToken = process.env.FORGE_POC_TOKEN?.trim();
if (!pocToken) {
  process.stderr.write("[forge-tool-plane] FORGE_POC_TOKEN is required\n");
  process.exit(1);
}
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
  res.json({ ok: true, mode: "tool-plane" });
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
const pocAuth = createPocAuth(pocToken);
app.use("/api", createChatRouter());
app.use("/api/projects", pocAuth, createChatFeaturesRouter());
app.use("/api/projects", pocAuth, createAttachmentsRouter());
app.use("/api/projects", pocAuth, createProjectsRouter());
app.use(
  "/internal",
  rateLimit({
    windowMs: 60000,
    max: Number(process.env.INTERNAL_RATE_LIMIT_PER_MIN || N_1200),
    message: { error: "Too many requests, please try again later." }
  }),
  createInternalRouter(pocToken)
);
const port = Number(process.env.PORT || N_4000);
const bindHost =
  process.env.FORGE_BIND_LOOPBACK === "1"
    ? "127.0.0.1"
    : process.env.FORGE_BIND_HOST?.trim() || "127.0.0.1";
app.listen(port, bindHost, () => {
  process.stdout.write(
    `Forge tool plane listening on http://${bindHost}:${port}\n`
  );
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
