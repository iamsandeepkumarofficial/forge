import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import {
  destroySessionSandbox,
  provisionSessionSandbox
} from "../../projects/sessionSandbox.js";
import { finalizeSessionProvision } from "../../projects/sessionProvision.js";
import {
  chatFeatureService,
  chatRepo,
  errorMessage,
  N_201,
  N_204,
  N_404,
  statusFromError,
  workspaceService
} from "./shared.js";

export async function handleListChats(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).forgeUser.id;
    const workspaceId = String(req.params.workspaceId);
    await workspaceService.getWorkspaceDetail(workspaceId, userId);
    const chats = await chatRepo.listByWorkspaceId(workspaceId);
    res.json({ chats });
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}

export async function handleGetChat(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).forgeUser.id;
    const workspaceId = String(req.params.workspaceId);
    const chatId = String(req.params.chatId);
    await workspaceService.getWorkspaceDetail(workspaceId, userId);
    const chat = await chatRepo.getById(chatId);
    if (!chat || chat.workspaceId !== workspaceId || chat.userId !== userId) {
      return res.status(N_404).json({ error: "Chat not found" });
    }
    res.json(chat);
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}

export async function handleCreateChat(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).forgeUser.id;
    const workspaceId = String(req.params.workspaceId);
    await workspaceService.getWorkspaceDetail(workspaceId, userId);
    const title =
      typeof req.body?.title === "string" ? req.body.title : undefined;
    const chat = await chatFeatureService.createWorkbench({
      workspaceId,
      userId,
      title
    });
    void provisionSessionSandbox(chat.sessionId)
      .then(() => finalizeSessionProvision(chat.sessionId))
      .catch((err) => {
        console.warn(
          `[workspace chat ${chat.id}] sandbox provisioning failed (will retry on open): ${err instanceof Error ? err.message : String(err)}`
        );
      });
    res.status(N_201).json(chat);
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}

export async function handleDeleteChat(req: Request, res: Response) {
  try {
    const userId = (req as AuthedRequest).forgeUser.id;
    const workspaceId = String(req.params.workspaceId);
    const chatId = String(req.params.chatId);
    await workspaceService.getWorkspaceDetail(workspaceId, userId);
    const chat = await chatRepo.getById(chatId);
    if (!chat || chat.workspaceId !== workspaceId || chat.userId !== userId) {
      return res.status(N_404).json({ error: "Chat not found" });
    }
    await chatRepo.deleteChatFeature(chatId);
    void destroySessionSandbox(chat.sessionId).catch((err) => {
      console.warn(
        `[workspace chat ${chatId}] sandbox teardown failed: ${err instanceof Error ? err.message : String(err)}`
      );
    });
    res.status(N_204).end();
  } catch (error: unknown) {
    res.status(statusFromError(error)).json({ error: errorMessage(error) });
  }
}
