import type { NavigateFunction, SetURLSearchParams } from "react-router-dom";
import type { RefObject } from "react";
import {
  createWorkbenchSession,
  deleteChat,
  fetchWorkbenchSessions,
  type ProjectWorkbenchSession
} from "../lib/projects-api.js";
import { titleFromPrompt } from "./chats-storage.js";

export async function loadChatSessions(options: {
  projectId: string | undefined;
  setLoading: (value: boolean) => void;
  setSessions: (rows: ProjectWorkbenchSession[]) => void;
  setError: (value: string | null) => void;
}): Promise<void> {
  if (!options.projectId) return;
  options.setLoading(true);
  try {
    options.setSessions(await fetchWorkbenchSessions(options.projectId));
    options.setError(null);
  } catch (err) {
    options.setError(
      err instanceof Error ? err.message : "Failed to load chats"
    );
  } finally {
    options.setLoading(false);
  }
}

export async function startWorkbenchChat(options: {
  projectId: string | undefined;
  creating: boolean;
  text: string;
  navigate: NavigateFunction;
  setCreating: (value: boolean) => void;
  setError: (value: string | null) => void;
}): Promise<void> {
  if (!options.projectId || options.creating) return;
  const trimmed = options.text.trim();
  if (!trimmed) return;
  options.setCreating(true);
  options.setError(null);
  try {
    const session = await createWorkbenchSession({
      projectId: options.projectId,
      title: titleFromPrompt(trimmed)
    });
    void options.navigate(
      `/projects/${options.projectId}/chats/${session.id}`,
      { state: { initialPrompt: trimmed } }
    );
  } catch (err) {
    options.setError(
      err instanceof Error ? err.message : "Failed to create chat"
    );
    options.setCreating(false);
  }
}

export async function deleteWorkbenchChat(options: {
  projectId: string | undefined;
  sessionId: string;
  sessionTitle: string;
  setDeletingId: (value: string | null) => void;
  setError: (value: string | null) => void;
  reload: () => Promise<void>;
}): Promise<void> {
  if (!options.projectId) return;
  if (
    !window.confirm(
      `Delete chat "${options.sessionTitle}"? This cannot be undone.`
    )
  ) {
    return;
  }
  options.setDeletingId(options.sessionId);
  options.setError(null);
  try {
    await deleteChat(options.projectId, options.sessionId);
    await options.reload();
  } catch (err) {
    options.setError(
      err instanceof Error ? err.message : "Failed to delete chat"
    );
  } finally {
    options.setDeletingId(null);
  }
}

export type { RefObject, SetURLSearchParams };
