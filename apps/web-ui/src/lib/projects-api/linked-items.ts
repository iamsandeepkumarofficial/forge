import { BASE_URL, ConnectProjectError, N_204 } from "./shared.js";

export interface LinkedItem {
  id: string;
  label: string;
  url: string;
  externalKey?: string | null;
  provider?: string | null;
  createdAt: string;
}
export async function listLinkedItems(
  projectId: string,
  chatId: string
): Promise<LinkedItem[]> {
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/linked-items`
  );
  if (!response.ok) {
    throw new ConnectProjectError("Failed to list linked items");
  }
  return response.json();
}
export async function createLinkedItem(options: {
  projectId: string;
  chatId: string;
  label: string;
  url: string;
  externalKey?: string;
  provider?: string;
}): Promise<LinkedItem> {
  const { projectId, chatId, ...item } = options;
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/linked-items`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(item)
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = "Failed to create linked item";
    try {
      const error = JSON.parse(errorText);
      if (error.error) errorMessage = error.error;
    } catch {
      void 0;
    }
    throw new ConnectProjectError(errorMessage);
  }
  return response.json();
}
export async function deleteLinkedItem(options: {
  projectId: string;
  chatId: string;
  linkedItemId: string;
}): Promise<void> {
  const { projectId, chatId, linkedItemId } = options;
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/linked-items/${linkedItemId}`,
    {
      method: "DELETE"
    }
  );
  if (!response.ok && response.status !== N_204) {
    throw new ConnectProjectError("Failed to delete linked item");
  }
}
