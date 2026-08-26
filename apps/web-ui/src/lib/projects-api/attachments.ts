import { BASE_URL, ConnectProjectError, N_204 } from "./shared.js";

export interface ChatAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}
export async function listAttachments(
  projectId: string,
  chatId: string
): Promise<ChatAttachment[]> {
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/attachments`
  );
  if (!response.ok) {
    throw new ConnectProjectError("Failed to list attachments");
  }
  return response.json();
}
export async function uploadAttachment(options: {
  projectId: string;
  chatId: string;
  file: File;
}): Promise<ChatAttachment> {
  const { projectId, chatId, file } = options;
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/attachments`,
    {
      method: "POST",
      body: formData
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = "Failed to upload attachment";
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
export async function deleteAttachment(options: {
  projectId: string;
  chatId: string;
  attachmentId: string;
}): Promise<void> {
  const { projectId, chatId, attachmentId } = options;
  const response = await fetch(
    `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/attachments/${attachmentId}`,
    {
      method: "DELETE"
    }
  );
  if (!response.ok && response.status !== N_204) {
    throw new ConnectProjectError("Failed to delete attachment");
  }
}
export function downloadAttachmentUrl(options: {
  projectId: string;
  chatId: string;
  attachmentId: string;
}): string {
  const { projectId, chatId, attachmentId } = options;
  return `${BASE_URL}/api/projects/${projectId}/chats/${chatId}/attachments/${attachmentId}`;
}
