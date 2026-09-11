import { Router } from "express";
import {
  ChatTurnChunkRepository,
  ChatTurnRepository,
  SessionMessageRepository
} from "../../catalog/sessionChatRepository.js";
import {
  handleListSessionMessages,
  handleCreateSessionMessage,
  handlePatchMessageParts,
  handleGetTurn,
  handleCreateTurn,
  handleFinishTurn,
  handleCheckpointTurn,
  handleAppendChunk,
  handleListChunks
} from "./chat.handlers.js";

function mountChatMessageRoutes(router: Router) {
  const messages = new SessionMessageRepository();
  router.get("/chat/sessions/:sessionId/messages", (req, res) => {
    return handleListSessionMessages({ req, res, messages });
  });
  router.post("/chat/sessions/:sessionId/messages", (req, res) => {
    return handleCreateSessionMessage({ req, res, messages });
  });
  router.patch("/chat/messages/:id/parts", (req, res) => {
    return handlePatchMessageParts({ req, res, messages });
  });
}

function mountChatTurnRoutes(router: Router) {
  const turns = new ChatTurnRepository();
  const chunks = new ChatTurnChunkRepository();
  router.get("/chat/turns/:turnId", (req, res) => {
    return handleGetTurn({ req, res, turns });
  });
  router.post("/chat/turns", (req, res) => {
    return handleCreateTurn({ req, res, turns });
  });
  router.post("/chat/turns/:turnId/finish", (req, res) => {
    return handleFinishTurn({ req, res, turns });
  });
  router.post("/chat/turns/:turnId/checkpoint", (req, res) => {
    return handleCheckpointTurn({ req, res, turns });
  });
  router.post("/chat/turns/:turnId/chunks", (req, res) => {
    return handleAppendChunk({ req, res, chunks });
  });
  router.get("/chat/turns/:turnId/chunks", (req, res) => {
    return handleListChunks({ req, res, chunks });
  });
}

export function mountChatRoutes(router: Router) {
  mountChatMessageRoutes(router);
  mountChatTurnRoutes(router);
}
