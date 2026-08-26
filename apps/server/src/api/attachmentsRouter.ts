import { randomUUID } from "node:crypto";
import {
  Router,
  type Request,
  type Response,
  type RequestHandler
} from "express";
import multer from "multer";
import { createLocalUserMiddleware, type AuthedRequest } from "./pocAuth.js";
import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { AttachmentRepository } from "../catalog/attachmentRepository.js";
import {
  MAX_ATTACHMENT_BYTES,
  validateAttachmentUpload
} from "../catalog/attachmentValidation.js";
import {
  putObject,
  getObject,
  deleteObject,
  ticketAttachmentKey
} from "../services/storage/objectStore.js";

const N_201 = 201;
const N_204 = 204;
const N_400 = 400;
const N_404 = 404;

const chatRepo = new ChatFeatureRepository();
const attachmentRepo = new AttachmentRepository();
const pocAuth = createLocalUserMiddleware();
const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES }
}).single("file");
function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}
function bucket(): string {
  return process.env.OBJECT_STORE_BUCKET || "projects";
}
async function loadOwnedChat(options: {
  projectId: string;
  chatId: string;
  userId: string;
}) {
  const chat = await chatRepo.getById(options.chatId);
  if (
    !chat ||
    chat.projectId !== options.projectId ||
    chat.userId !== options.userId
  ) {
    return null;
  }
  return chat;
}
const handleUploadMiddleware: RequestHandler = (...args) => {
  const [req, res, next] = args;
  uploadSingle(req, res, (err: unknown) => {
    if (err) {
      const multerErr = err as {
        code?: string;
        message?: string;
      };
      if (multerErr.code === "LIMIT_FILE_SIZE") {
        return res.status(N_400).json({ error: "File exceeds 25MB limit" });
      }
      return res.status(N_400).json({
        error: multerErr.message || "Upload failed"
      });
    }
    next();
  });
};
async function handleUploadAttachment(req: Request, res: Response) {
  const projectId = param(req.params.projectId);
  const chatId = param(req.params.chatId);
  const userId = (req as AuthedRequest).forgeUser.id;
  if (!req.file) {
    return res.status(N_400).json({ error: "No file uploaded" });
  }
  const contentType = req.file.mimetype || "application/octet-stream";
  const validation = validateAttachmentUpload(contentType, req.file.size);
  if (!validation.ok) {
    return res.status(N_400).json({ error: validation.error });
  }
  try {
    const chat = await loadOwnedChat({ projectId, chatId, userId });
    if (!chat) {
      return res.status(N_404).json({ error: "Chat not found" });
    }
    const id = randomUUID();
    const storageKey = ticketAttachmentKey(chatId, id);
    await putObject({
      bucket: bucket(),
      key: storageKey,
      body: req.file.buffer,
      contentType
    });
    const created = await attachmentRepo.create({
      id,
      chatFeatureId: chatId,
      fileName: req.file.originalname || "file",
      contentType,
      sizeBytes: req.file.size,
      storageKey,
      uploadedBy: userId
    });
    await chatRepo.updateLastActivity(chatId);
    res.status(N_201).json({
      id: created.id,
      fileName: created.fileName,
      contentType: created.contentType,
      sizeBytes: created.sizeBytes,
      createdAt: created.createdAt
    });
  } catch (error: unknown) {
    return res.status(N_400).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
async function handleListAttachments(req: Request, res: Response) {
  const projectId = param(req.params.projectId);
  const chatId = param(req.params.chatId);
  const userId = (req as AuthedRequest).forgeUser.id;
  try {
    const chat = await loadOwnedChat({ projectId, chatId, userId });
    if (!chat) {
      return res.status(N_404).json({ error: "Chat not found" });
    }
    const rows = await attachmentRepo.listByChatFeatureId(chatId);
    res.json(
      rows.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        createdAt: row.createdAt
      }))
    );
  } catch (error: unknown) {
    return res.status(N_400).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
async function handleDownloadAttachment(req: Request, res: Response) {
  const projectId = param(req.params.projectId);
  const chatId = param(req.params.chatId);
  const attachmentId = param(req.params.attachmentId);
  const userId = (req as AuthedRequest).forgeUser.id;
  try {
    const chat = await loadOwnedChat({ projectId, chatId, userId });
    if (!chat) {
      return res.status(N_404).json({ error: "Chat not found" });
    }
    const row = await attachmentRepo.getById(attachmentId);
    if (!row || row.chatFeatureId !== chatId) {
      return res.status(N_404).json({ error: "Attachment not found" });
    }
    const body = await getObject(bucket(), row.storageKey);
    if (!body) {
      return res.status(N_404).json({ error: "Attachment blob not found" });
    }
    res.setHeader("Content-Type", row.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${row.fileName.replace(/"/g, "")}"`
    );
    res.send(Buffer.from(body));
  } catch (error: unknown) {
    return res.status(N_400).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
async function handleDeleteAttachment(req: Request, res: Response) {
  const projectId = param(req.params.projectId);
  const chatId = param(req.params.chatId);
  const attachmentId = param(req.params.attachmentId);
  const userId = (req as AuthedRequest).forgeUser.id;
  try {
    const chat = await loadOwnedChat({ projectId, chatId, userId });
    if (!chat) {
      return res.status(N_404).json({ error: "Chat not found" });
    }
    const row = await attachmentRepo.getById(attachmentId);
    if (!row || row.chatFeatureId !== chatId) {
      return res.status(N_404).json({ error: "Attachment not found" });
    }
    try {
      await deleteObject(bucket(), row.storageKey);
    } catch (err) {
      console.warn(
        `[attachments] blob delete failed for ${row.storageKey}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    await attachmentRepo.delete(attachmentId);
    res.status(N_204).end();
  } catch (error: unknown) {
    return res.status(N_400).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
export function createAttachmentsRouter(): Router {
  const router = Router();
  router.post(
    "/:projectId/chats/:chatId/attachments",
    pocAuth,
    handleUploadMiddleware,
    handleUploadAttachment
  );
  router.get(
    "/:projectId/chats/:chatId/attachments",
    pocAuth,
    handleListAttachments
  );
  router.get(
    "/:projectId/chats/:chatId/attachments/:attachmentId",
    pocAuth,
    handleDownloadAttachment
  );
  router.delete(
    "/:projectId/chats/:chatId/attachments/:attachmentId",
    pocAuth,
    handleDeleteAttachment
  );
  return router;
}
