import { Router } from "express";
import { createLocalUserMiddleware } from "./pocAuth.js";
import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import {
  ChatTurnChunkRepository,
  ChatTurnRepository,
  SessionMessageRepository
} from "../catalog/sessionChatRepository.js";
import { handleModelContextWindow, handleModelsList } from "./modelsRouter.js";
import {
  handleGetLlmSettings,
  handlePutLlmSettings
} from "./settingsHandlers.js";
import {
  handleGetRuntimeActivity,
  handleStopRuntimeApp,
  handleStopRuntimeSession
} from "./runtimeActivityHandlers.js";
import {
  handleListChatMessages,
  handleDeleteMessagesFrom,
  handleBranchSessionMessages,
  handleGetRunningTurn,
  handleGetCurrentPlan,
  handleStartChat,
  handleStreamTurn,
  handleCancelTurn,
  handleStartPlan,
  handleTurnAnswer
} from "./chatRouter/handlers.js";

export function createChatRouter(): Router {
  const router = Router();
  const pocAuth = createLocalUserMiddleware();
  const features = new ChatFeatureRepository();
  const messages = new SessionMessageRepository();
  const turns = new ChatTurnRepository();
  const chunks = new ChatTurnChunkRepository();
  registerSupportRoutes(router, pocAuth);
  router.get("/sessions/:sessionId/messages", pocAuth, (req, res) => {
    return handleListChatMessages({ req, res, features, messages });
  });
  router.delete(
    "/sessions/:sessionId/messages/from/:messageId",
    pocAuth,
    (req, res) => {
      return handleDeleteMessagesFrom({ req, res, features, messages });
    }
  );
  router.post("/sessions/:sessionId/branch", pocAuth, (req, res) => {
    return handleBranchSessionMessages({ req, res, features, messages });
  });
  router.get("/sessions/:sessionId/turns/running", pocAuth, (req, res) => {
    return handleGetRunningTurn({ req, res, features, turns });
  });
  router.get("/sessions/:sessionId/plans/current", pocAuth, (req, res) => {
    return handleGetCurrentPlan({ req, res, features });
  });
  router.post("/sessions/:sessionId/chat", pocAuth, (req, res) => {
    return handleStartChat({ req, res, features, turns });
  });
  router.get(
    "/sessions/:sessionId/turns/:turnId/stream",
    pocAuth,
    (req, res) => {
      return handleStreamTurn({ req, res, features, turns, chunks });
    }
  );
  router.post(
    "/sessions/:sessionId/turns/:turnId/cancel",
    pocAuth,
    (req, res) => {
      return handleCancelTurn({ req, res, features, turns });
    }
  );
  router.post(
    "/sessions/:sessionId/turns/:turnId/answer",
    pocAuth,
    (req, res) => {
      return handleTurnAnswer({ req, res, features, turns });
    }
  );
  router.post(
    "/sessions/:sessionId/turns/:turnId/start-plan",
    pocAuth,
    (req, res) => {
      return handleStartPlan({ req, res, features, turns });
    }
  );
  return router;
}

function registerSupportRoutes(
  router: Router,
  pocAuth: ReturnType<typeof createLocalUserMiddleware>
): void {
  router.get("/settings/llm", pocAuth, (req, res) => {
    return handleGetLlmSettings(req, res);
  });
  router.put("/settings/llm", pocAuth, (req, res) => {
    return handlePutLlmSettings(req, res);
  });
  router.get("/runtime/activity", pocAuth, (req, res) => {
    return handleGetRuntimeActivity(req, res);
  });
  router.post(
    "/runtime/activity/sessions/:sessionId/stop",
    pocAuth,
    (req, res) => {
      return handleStopRuntimeSession(req, res);
    }
  );
  router.post("/runtime/activity/apps/stop", pocAuth, (req, res) => {
    return handleStopRuntimeApp(req, res);
  });
  router.get("/models", pocAuth, (req, res) => {
    return handleModelsList(req, res);
  });
  router.get("/models/context-window", pocAuth, (req, res) => {
    return handleModelContextWindow(req, res);
  });
}
