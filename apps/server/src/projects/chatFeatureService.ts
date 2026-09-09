import { DEFAULT_WORKFLOW_ID } from "@forge/workflows";
import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import type { ChatFeature } from "@forge/db";
import type { DescriptionDocument } from "../catalog/descriptionDocument.js";
export const VALID_TYPES = ["feature", "bug", "refactor"] as const;
type ChatFeatureTypeValue = (typeof VALID_TYPES)[number];
export const SINGLE_LEVEL_PARENT_ERROR =
  "Only single-level parent/child is allowed";
export class ChatFeatureValidationError extends Error {}
export interface CreateChatFeatureInput {
  projectId?: string | null;
  workspaceId?: string | null;
  userId: string;
  title?: string;
  type?: string;
  parentId?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  dueDate?: Date | null;
  description?: DescriptionDocument | null;
  workflowId?: string;
  executionTarget?: "local" | "cloud";
}
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
type PriorityValue = (typeof VALID_PRIORITIES)[number];
export function assertValidChatFeatureType(type: string): void {
  if (!(VALID_TYPES as readonly string[]).includes(type)) {
    throw new ChatFeatureValidationError(
      `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`
    );
  }
}
export class ChatFeatureService {
  private chatRepo: ChatFeatureRepository;
  constructor(chatRepo = new ChatFeatureRepository()) {
    this.chatRepo = chatRepo;
  }
  async assertSingleLevelParent(options: {
    projectId: string;
    chatId: string;
    parentId: string;
  }): Promise<void> {
    const { projectId, chatId, parentId } = options;
    const parent = await this.chatRepo.getById(parentId);
    if (!parent || parent.projectId !== projectId) {
      throw new ChatFeatureValidationError(
        "Parent chat/feature not found in this project"
      );
    }
    if (parent.parentId !== null) {
      throw new ChatFeatureValidationError(SINGLE_LEVEL_PARENT_ERROR);
    }
    const childCount = await this.chatRepo.countChildren(chatId);
    if (childCount > 0) {
      throw new ChatFeatureValidationError(SINGLE_LEVEL_PARENT_ERROR);
    }
  }
  async create(input: CreateChatFeatureInput): Promise<ChatFeature> {
    const projectId = input.projectId?.trim() || null;
    const workspaceId = input.workspaceId?.trim() || null;
    if ((projectId == null) === (workspaceId == null)) {
      throw new ChatFeatureValidationError(
        "Exactly one of projectId or workspaceId is required"
      );
    }
    const type: ChatFeatureTypeValue =
      input.type && (VALID_TYPES as readonly string[]).includes(input.type)
        ? (input.type as ChatFeatureTypeValue)
        : "feature";
    const priority: PriorityValue =
      input.priority &&
      (VALID_PRIORITIES as readonly string[]).includes(input.priority)
        ? input.priority
        : "medium";
    if (input.parentId) {
      if (!projectId) {
        throw new ChatFeatureValidationError(
          "Parent/child chats are only supported for project-scoped chats"
        );
      }
      const parent = await this.chatRepo.getById(input.parentId);
      if (!parent || parent.projectId !== projectId) {
        throw new ChatFeatureValidationError(
          "Parent chat/feature not found in this project"
        );
      }
      if (parent.parentId !== null) {
        throw new ChatFeatureValidationError(SINGLE_LEVEL_PARENT_ERROR);
      }
    }
    const workflowId =
      typeof input.workflowId === "string" && input.workflowId.trim()
        ? input.workflowId.trim()
        : DEFAULT_WORKFLOW_ID;
    const stamp = Date.now();
    const sessionId = `session-${stamp}`;
    const executionTarget =
      input.executionTarget === "cloud" ? "cloud" : "local";
    const chat = await this.chatRepo.createChatFeature({
      projectId,
      workspaceId,
      userId: input.userId,
      title: input.title?.trim() || "New Chat",
      kind: "ticket",
      type,
      parentId: input.parentId || null,
      status: "no_section",
      priority,
      dueDate: input.dueDate ?? null,
      description: (input.description ?? null) as Record<
        string,
        unknown
      > | null,
      order: 0,
      branchName: `chat-${stamp}`,
      sessionId,
      executionTarget,
      workflowId
    });
    const { rememberSessionExecutionTarget } =
      await import("./sandboxRuntime/resolve.js");
    rememberSessionExecutionTarget(sessionId, executionTarget);
    return chat;
  }
  async createWorkbench(input: {
    projectId?: string | null;
    workspaceId?: string | null;
    userId: string;
    title?: string;
    executionTarget?: "local" | "cloud";
  }): Promise<ChatFeature> {
    const projectId = input.projectId?.trim() || null;
    const workspaceId = input.workspaceId?.trim() || null;
    if ((projectId == null) === (workspaceId == null)) {
      throw new ChatFeatureValidationError(
        "Exactly one of projectId or workspaceId is required"
      );
    }
    const stamp = Date.now();
    const sessionId = `workbench-${stamp}`;
    const executionTarget =
      input.executionTarget === "cloud" ? "cloud" : "local";
    const chat = await this.chatRepo.createChatFeature({
      projectId,
      workspaceId,
      userId: input.userId,
      title: input.title?.trim() || "Workbench",
      kind: "workbench",
      type: "feature",
      parentId: null,
      status: "no_section",
      priority: "medium",
      dueDate: null,
      description: null,
      order: 0,
      branchName: `workbench-${stamp}`,
      sessionId,
      executionTarget,
      workflowId: DEFAULT_WORKFLOW_ID
    });
    const { rememberSessionExecutionTarget } =
      await import("./sandboxRuntime/resolve.js");
    rememberSessionExecutionTarget(sessionId, executionTarget);
    return chat;
  }
}
