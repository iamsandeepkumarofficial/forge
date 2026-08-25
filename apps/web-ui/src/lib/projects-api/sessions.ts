import {
  BASE_URL,
  ConnectProjectError,
  pocToken,
  type SessionStatus
} from "./shared.js";
import { parseApiErrorText } from "./project-errors.js";

export async function startSession(sessionId: string): Promise<SessionStatus> {
  if (!sessionId) {
    throw new ConnectProjectError("Session ID is required to start session", {
      code: "MISSING_SESSION_ID",
      help: "Please select a chat first."
    });
  }
  try {
    const response = await fetch(`${BASE_URL}/internal/session/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pocToken()}`
      },
      body: JSON.stringify({ sessionId })
    });
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to start session"
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
      throw new ConnectProjectError("Failed to start session: Network error", {
        code: "NETWORK_ERROR",
        help: "Check your internet connection and try again."
      });
    }
    throw new ConnectProjectError(
      "Failed to start session: Unknown error occurred",
      { code: "UNKNOWN_ERROR", help: "Please refresh the page and try again." }
    );
  }
}
export async function getSessionStatus(
  sessionId: string
): Promise<SessionStatus> {
  if (!sessionId) {
    throw new ConnectProjectError(
      "Session ID is required to get session status",
      {
        code: "MISSING_SESSION_ID",
        help: "Please select a chat first."
      }
    );
  }
  try {
    const response = await fetch(
      `${BASE_URL}/internal/session/status?sessionId=${encodeURIComponent(sessionId)}`,
      {
        headers: {
          Authorization: `Bearer ${pocToken()}`
        }
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to get session status"
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
      throw new ConnectProjectError(
        "Failed to get session status: Network error",
        {
          code: "NETWORK_ERROR",
          help: "Check your internet connection and try again."
        }
      );
    }
    throw new ConnectProjectError(
      "Failed to get session status: Unknown error occurred",
      { code: "UNKNOWN_ERROR", help: "Please refresh the page and try again." }
    );
  }
}

export async function pushToSession(
  chatId: string,
  content: string
): Promise<void> {
  if (!chatId || !content) {
    throw new ConnectProjectError(
      "Chat ID and content are required to push to session",
      {
        code: "MISSING_DATA",
        help: "Please provide valid chat ID and content."
      }
    );
  }
  try {
    const response = await fetch(`${BASE_URL}/internal/session/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pocToken()}`
      },
      body: JSON.stringify({ chatId, content })
    });
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to push to session"
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
      throw new ConnectProjectError(
        "Failed to push to session: Network error",
        {
          code: "NETWORK_ERROR",
          help: "Check your internet connection and try again."
        }
      );
    }
    throw new ConnectProjectError(
      "Failed to push to session: Unknown error occurred",
      { code: "UNKNOWN_ERROR", help: "Please refresh the page and try again." }
    );
  }
}
