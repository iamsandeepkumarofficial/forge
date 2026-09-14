import {
  BASE_URL,
  ConnectProjectError,
  type ChatFeatureType,
  type ChatSummary,
  type DescriptionDocument
} from "./shared.js";
import { parseApiErrorText } from "./project-errors.js";

export type { ChatFeatureType, DescriptionDocument };

export async function createChat(
  projectId: string,
  options?: {
    title?: string;
    type?: ChatFeatureType;
    parentId?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    dueDate?: string | null;
    description?: string | DescriptionDocument | null;
    workflowId?: string;
    executionTarget?: "local" | "cloud";
  }
): Promise<ChatSummary> {
  if (!projectId) {
    throw new ConnectProjectError("Project ID is required to create a chat", {
      code: "MISSING_PROJECT_ID",
      help: "Please select a project first."
    });
  }
  try {
    const response = await fetch(
      `${BASE_URL}/api/projects/${projectId}/chats`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: options?.title,
          type: options?.type,
          parentId: options?.parentId,
          priority: options?.priority,
          dueDate: options?.dueDate,
          description: options?.description,
          workflowId: options?.workflowId,
          executionTarget: options?.executionTarget
        })
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to create chat"
      });
      throw new ConnectProjectError(parsed.errorMessage, {
        code: parsed.errorCode,
        help: parsed.helpText
      });
    }
    return response.json();
  } catch (error) {
    if (error instanceof ConnectProjectError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new ConnectProjectError(`Failed to create chat: ${error.message}`, {
        code: "NETWORK_ERROR",
        help: "Check your internet connection and try again."
      });
    }
    throw new ConnectProjectError(
      "Failed to create chat: Unknown error occurred",
      { code: "UNKNOWN_ERROR", help: "Please refresh the page and try again." }
    );
  }
}
export async function fetchChats(projectId: string): Promise<ChatSummary[]> {
  if (!projectId) {
    throw new ConnectProjectError("Project ID is required to fetch chats", {
      code: "MISSING_PROJECT_ID",
      help: "Please select a project first."
    });
  }
  try {
    const response = await fetch(`${BASE_URL}/api/projects/${projectId}/chats`);
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to fetch chats"
      });
      throw new ConnectProjectError(parsed.errorMessage, {
        code: parsed.errorCode,
        help: parsed.helpText
      });
    }
    return response.json();
  } catch (error) {
    if (error instanceof ConnectProjectError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new ConnectProjectError(`Failed to fetch chats: ${error.message}`, {
        code: "NETWORK_ERROR",
        help: "Check your internet connection and try again."
      });
    }
    throw new ConnectProjectError(
      "Failed to fetch chats: Unknown error occurred",
      { code: "UNKNOWN_ERROR", help: "Please refresh the page and try again." }
    );
  }
}
export async function fetchChat(
  projectId: string,
  chatId: string
): Promise<ChatSummary> {
  if (!projectId || !chatId) {
    throw new ConnectProjectError("Project and chat ID are required", {
      code: "MISSING_ID",
      help: "Please select a chat first."
    });
  }
  try {
    const response = await fetch(
      `${BASE_URL}/api/projects/${projectId}/chats/${chatId}`
    );
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to fetch chat"
      });
      throw new ConnectProjectError(parsed.errorMessage);
    }
    return response.json();
  } catch (error) {
    if (error instanceof ConnectProjectError) throw error;
    throw new ConnectProjectError(
      `Failed to fetch chat: ${error instanceof Error ? error.message : "Unknown error"}`,
      {
        code: "NETWORK_ERROR",
        help: "Check your internet connection and try again."
      }
    );
  }
}
export async function updateChat(options: {
  projectId: string;
  chatId: string;
  status?: string;
  order?: number;
  title?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  dueDate?: string | null;
  type?: ChatFeatureType;
  parentId?: string | null;
  description?: DescriptionDocument | null;
}): Promise<unknown> {
  const { projectId, chatId, ...updates } = options;
  if (!projectId) {
    throw new ConnectProjectError("Project ID is required to update chat", {
      code: "MISSING_PROJECT_ID",
      help: "Please select a project first."
    });
  }
  if (!chatId) {
    throw new ConnectProjectError("Chat ID is required to update chat", {
      code: "MISSING_CHAT_ID",
      help: "Please select a chat first."
    });
  }
  try {
    const response = await fetch(
      `${BASE_URL}/api/projects/${projectId}/chats/${chatId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updates)
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to update chat"
      });
      throw new ConnectProjectError(parsed.errorMessage, {
        code: parsed.errorCode,
        help: parsed.helpText
      });
    }
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  } catch (error) {
    if (error instanceof ConnectProjectError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new ConnectProjectError(`Failed to update chat: ${error.message}`, {
        code: "NETWORK_ERROR",
        help: "Check your internet connection and try again."
      });
    }
    throw new ConnectProjectError(
      "Failed to update chat: Unknown error occurred",
      { code: "UNKNOWN_ERROR", help: "Please refresh the page and try again." }
    );
  }
}
export async function deleteChat(
  projectId: string,
  chatId: string
): Promise<void> {
  if (!projectId) {
    throw new ConnectProjectError("Project ID is required to delete chat", {
      code: "MISSING_PROJECT_ID",
      help: "Please select a project first."
    });
  }
  if (!chatId) {
    throw new ConnectProjectError("Chat ID is required to delete chat", {
      code: "MISSING_CHAT_ID",
      help: "Please select a chat first."
    });
  }
  try {
    const response = await fetch(
      `${BASE_URL}/api/projects/${projectId}/chats/${chatId}`,
      {
        method: "DELETE"
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to delete chat"
      });
      throw new ConnectProjectError(parsed.errorMessage, {
        code: parsed.errorCode,
        help: parsed.helpText
      });
    }
  } catch (error) {
    if (error instanceof ConnectProjectError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new ConnectProjectError(`Failed to delete chat: ${error.message}`, {
        code: "NETWORK_ERROR",
        help: "Check your internet connection and try again."
      });
    }
    throw new ConnectProjectError(
      "Failed to delete chat: Unknown error occurred",
      { code: "UNKNOWN_ERROR", help: "Please refresh the page and try again." }
    );
  }
}
