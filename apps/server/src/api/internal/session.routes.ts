import { Router } from "express";
import {
  handleSessionStart,
  handleSessionStatus,
  handleDownloadArchive,
  handlePromote,
  handleListApps,
  handleScaffoldApps,
  handleWriteAppsConfig,
  handleRunApp,
  handleStopApp,
  handleAppLogs,
  handleSessionPush
} from "./session.handlers.js";
import {
  handleTerminalJobs,
  handleTerminalLogs,
  handleTerminalStop
} from "./terminal.handlers.js";

function mountSessionCoreRoutes(router: Router) {
  router.post("/session/start", (req, res) => {
    return handleSessionStart(req, res);
  });
  router.get("/session/status", (req, res) => {
    return handleSessionStatus(req, res);
  });
  router.get("/download", (req, res) => {
    return handleDownloadArchive(req, res);
  });
  router.post("/promote", (req, res) => {
    return handlePromote(req, res);
  });
  router.get("/apps", (req, res) => {
    return handleListApps(req, res);
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
  router.get("/terminal/logs", (req, res) => {
    return handleTerminalLogs(req, res);
  });
  router.post("/terminal/stop", (req, res) => {
    return handleTerminalStop(req, res);
  });
  router.post("/session/push", (req, res) => {
    return handleSessionPush(req, res);
  });
}

export function mountSessionRoutes(router: Router) {
  mountSessionCoreRoutes(router);
  mountSessionAppRoutes(router);
}
