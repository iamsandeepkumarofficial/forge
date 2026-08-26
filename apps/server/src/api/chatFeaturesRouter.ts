import { Router } from "express";
import {
  SINGLE_LEVEL_PARENT_ERROR,
  VALID_TYPES,
  assertValidChatFeatureType
} from "../projects/chatFeatureService.js";
import { createLocalUserMiddleware } from "./pocAuth.js";
import {
  handleCreateChat,
  handleGetChat,
  handleCreateWorkbench
} from "./chatFeaturesRouter/createHandlers.js";
import {
  handleListWorkbench,
  handleListChats,
  handleListComments,
  handleCreateComment
} from "./chatFeaturesRouter/listHandlers.js";
import {
  handlePatchChat,
  handleDeleteChat
} from "./chatFeaturesRouter/patchHandlers.js";

const router = Router();
const pocAuth = createLocalUserMiddleware();

router.post("/:projectId/chats", pocAuth, (req, res) => {
  return handleCreateChat(req, res);
});
router.get("/:projectId/chats/:chatId", pocAuth, (req, res) => {
  return handleGetChat(req, res);
});
router.post("/:projectId/workbench-sessions", pocAuth, (req, res) => {
  return handleCreateWorkbench(req, res);
});
router.get("/:projectId/workbench-sessions", pocAuth, (req, res) => {
  return handleListWorkbench(req, res);
});
router.get("/:projectId/chats", pocAuth, (req, res) => {
  return handleListChats(req, res);
});
router.get("/:projectId/chats/:chatId/comments", pocAuth, (req, res) => {
  return handleListComments(req, res);
});
router.post("/:projectId/chats/:chatId/comments", pocAuth, (req, res) => {
  return handleCreateComment(req, res);
});
router.patch("/:projectId/chats/:chatId", pocAuth, (req, res) => {
  return handlePatchChat(req, res);
});
router.delete("/:projectId/chats/:chatId", pocAuth, (req, res) => {
  return handleDeleteChat(req, res);
});

export function createChatFeaturesRouter(): Router {
  return router;
}

export { SINGLE_LEVEL_PARENT_ERROR, VALID_TYPES, assertValidChatFeatureType };
