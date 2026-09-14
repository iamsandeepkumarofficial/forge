import { Router } from "express";
import {
  handleSessionStart,
  handleSessionStatus,
  handleListApps,
  handleSessionHealth,
  handleScaffoldApps,
  handleWriteAppsConfig,
  handleRunApp,
  handleStopApp,
  handleAppLogs,
  handleSessionPush
} from "./session.handlers.js";
import {
  handleTerminalJobs,
  handleTerminalRun,
  handleTerminalStop
} from "./terminal.handlers.js";
import {
  handleTerminalTabCreate,
  handleTerminalTabDelete,
  handleTerminalTabs
} from "./terminalTabs.handlers.js";
import { handleAppHttpRequest } from "./httpRequest.handlers.js";
import { handleAppRoutes } from "./appRoutes.handlers.js";

function mountSessionCoreRoutes(router: Router) {
  router.post("/session/start", (req, res) => {
    return handleSessionStart(req, res);
  });
  router.get("/session/status", (req, res) => {
    return handleSessionStatus(req, res);
  });
  router.get("/apps", (req, res) => {
    return handleListApps(req, res);
  });
  router.get("/session/health", (req, res) => {
    return handleSessionHealth(req, res);
  });
}

function mountSessionAppRoutes(router: Router) {
  router.post("/apps/scaffold", (req, res) => {
    return handleScaffoldApps(req, res);
  });
  router.put("/apps/config", (req, res) => {
    return handleWriteAppsConfig(req, res);
  });
  router.post("/apps/run", (req, res) => {
    return handleRunApp(req, res);
  });
  router.post("/apps/stop", (req, res) => {
    return handleStopApp(req, res);
  });
  router.get("/apps/logs", (req, res) => {
    return handleAppLogs(req, res);
  });
  router.get("/terminal/jobs", (req, res) => {
    return handleTerminalJobs(req, res);
  });
  router.post("/terminal/stop", (req, res) => {
    return handleTerminalStop(req, res);
  });
  router.post("/terminal/run", (req, res) => {
    return handleTerminalRun(req, res);
  });
  router.get("/terminal/tabs", (req, res) => {
    return handleTerminalTabs(req, res);
  });
  router.post("/terminal/tabs", (req, res) => {
    return handleTerminalTabCreate(req, res);
  });
  router.delete("/terminal/tabs/:id", (req, res) => {
    return handleTerminalTabDelete(req, res);
  });
  router.post("/apps/http", (req, res) => {
    return handleAppHttpRequest(req, res);
  });
  router.get("/apps/routes", (req, res) => {
    return handleAppRoutes(req, res);
  });
  router.post("/session/push", (req, res) => {
    return handleSessionPush(req, res);
  });
}

export function mountSessionRoutes(router: Router) {
  mountSessionCoreRoutes(router);
  mountSessionAppRoutes(router);
}
