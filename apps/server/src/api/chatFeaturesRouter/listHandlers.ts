import type { Request, Response } from "express";
import type { AuthedRequest } from "../pocAuth.js";
import { chatRepo, commentRepo, param, projectRepo } from "./shared.js";

const N_201 = 201;
const N_400 = 400;
const N_404 = 404;

export async function handleListWorkbench(
  req: Request,
  res: Response
): Promise<void> {
  const projectId = param(req.params.projectId);
  const userId = (req as AuthedRequest).forgeUser.id;
  try {
    const project = await projectRepo.getById(projectId);
    if (!project) {
      res.status(N_404).json({ error: "Project not found" });
      return;
    }
    const sessions = await chatRepo.listByProjectId(projectId, "workbench");
    res.json(sessions.filter((s) => s.userId === userId));
  } catch (error: unknown) {
    res
      .status(N_400)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function handleListChats(
  req: Request,
  res: Response
): Promise<void> {
  const projectId = param(req.params.projectId);
  try {
    const project = await projectRepo.getById(projectId);
    if (!project) {
      res.status(N_404).json({ error: "Project not found" });
      return;
    }
    const chats = await chatRepo.listByProjectId(projectId, "ticket");
    const commentCounts = await commentRepo.countsByProjectId(projectId);
    const enriched = chats.map((chat) => {
      const children = chats.filter((c) => c.parentId === chat.id);
      return {
        ...chat,
        commentCount: commentCounts[chat.id] ?? 0,
        subtaskTotal: children.length,
        subtaskDone: children.filter((c) => c.status === "done").length,
        activeAgent: null
      };
    });
    res.json(enriched);
  } catch (error: unknown) {
    res
      .status(N_400)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function handleListComments(
  req: Request,
  res: Response
): Promise<void> {
  const projectId = param(req.params.projectId);
  const chatId = param(req.params.chatId);
  const userId = (req as AuthedRequest).forgeUser.id;
  try {
    const chat = await chatRepo.getById(chatId);
    if (!chat || chat.projectId !== projectId || chat.userId !== userId) {
      res.status(N_404).json({ error: "Chat not found" });
      return;
    }
    const comments = await commentRepo.listByChatFeatureId(chatId);
    res.json(comments);
  } catch (error: unknown) {
    res
      .status(N_400)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function handleCreateComment(
  req: Request,
  res: Response
): Promise<void> {
  const projectId = param(req.params.projectId);
  const chatId = param(req.params.chatId);
  const userId = (req as AuthedRequest).forgeUser.id;
  const { text } = req.body;
  if (typeof text !== "string" || !text.trim()) {
    res.status(N_400).json({ error: "Comment text is required" });
    return;
  }
  try {
    const chat = await chatRepo.getById(chatId);
    if (!chat || chat.projectId !== projectId || chat.userId !== userId) {
      res.status(N_404).json({ error: "Chat not found" });
      return;
    }
    const comment = await commentRepo.create({
      chatFeatureId: chatId,
      userId,
      text: text.trim()
    });
    await chatRepo.updateLastActivity(chatId);
    res.status(N_201).json(comment);
  } catch (error: unknown) {
    res
      .status(N_400)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
}
