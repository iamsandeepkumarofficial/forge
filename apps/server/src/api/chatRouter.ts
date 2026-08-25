import { Router } from "express";
import { createPocAuth } from "./pocAuth.js";
import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import {
  ChatTurnChunkRepository,
  ChatTurnRepository,
  SessionMessageRepository
} from "../catalog/sessionChatRepository.js";
import { handleModelContextWindow, handleModelsList } from "./modelsRouter.js";
import {
  handleListChatMessages,
  handleStartChat,
  handleStreamTurn,
  handleCancelTurn
} from "./chatRouter/handlers.js";

export function createChatRouter(): Router {
  const router = Router();
  const pocAuth = createPocAuth(process.env.FORGE_POC_TOKEN || "");
  const features = new ChatFeatureRepository();
  const messages = new SessionMessageRepository();
  const turns = new ChatTurnRepository();
  const chunks = new ChatTurnChunkRepository();
  router.get("/models", pocAuth, (req, res) => {
    return handleModelsList(req, res);
  });
  router.get("/models/context-window", pocAuth, (req, res) => {
    return handleModelContextWindow(req, res);
  });
  router.get("/sessions/:sessionId/messages", pocAuth, (req, res) => {
    return handleListChatMessages({ req, res, features, messages });
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
  return router;
}
