import { BASE_URL, ConnectProjectError, pocToken } from "./shared.js";
import { parseApiErrorText } from "./project-errors.js";

export interface ChatComment {
  id: string;
  chatFeatureId: string;
  userId: string;
  text: string;
  createdAt: string;
}
export async function fetchComments(
  projectId: string,
  chatId: string
): Promise<ChatComment[]> {
  if (!projectId || !chatId) {
    throw new ConnectProjectError(
      "Project and chat ID are required to fetch comments",
      {
        code: "MISSING_ID",
        help: "Please select a chat first."
      }
    );
  }
  try {
    const response = await fetch(
      `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/comments`,
      { headers: { Authorization: `Bearer ${pocToken()}` } }
    );
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to fetch comments"
      });
      throw new ConnectProjectError(parsed.errorMessage);
    }
    return response.json();
  } catch (error) {
    if (error instanceof ConnectProjectError) throw error;
    throw new ConnectProjectError(
      `Failed to fetch comments: ${error instanceof Error ? error.message : "Unknown error"}`,
      {
        code: "NETWORK_ERROR",
        help: "Check your internet connection and try again."
      }
    );
  }
}
export async function createComment(options: {
  projectId: string;
  chatId: string;
  text: string;
}): Promise<ChatComment> {
  const { projectId, chatId, text } = options;
  if (!projectId || !chatId) {
    throw new ConnectProjectError(
      "Project and chat ID are required to post a comment",
      {
        code: "MISSING_ID",
        help: "Please select a chat first."
      }
    );
  }
  try {
    const response = await fetch(
      `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pocToken()}`
        },
        body: JSON.stringify({ text })
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to post comment"
      });
      throw new ConnectProjectError(parsed.errorMessage);
    }
    return response.json();
  } catch (error) {
    if (error instanceof ConnectProjectError) throw error;
    throw new ConnectProjectError(
      `Failed to post comment: ${error instanceof Error ? error.message : "Unknown error"}`,
      {
        code: "NETWORK_ERROR",
        help: "Check your internet connection and try again."
      }
    );
  }
}
