import {
  uploadAttachment,
  deleteAttachment,
  createLinkedItem,
  deleteLinkedItem,
  updateChat,
  type ChatAttachment,
  type LinkedItem,
  type ChatFeatureType
} from "@/lib/projects-api";

type SetErr = (value: string | null) => void;
type SetBool = (value: boolean) => void;

export async function saveTicketMetadataFields(options: {
  projectId: string;
  chatId: string;
  type: ChatFeatureType;
  dueDate: string;
  parentId: string;
  onUpdated?: () => void;
  setError: SetErr;
  setSaving: SetBool;
}): Promise<void> {
  options.setSaving(true);
  options.setError(null);
  try {
    await updateChat({
      projectId: options.projectId,
      chatId: options.chatId,
      type: options.type,
      dueDate: options.dueDate ? options.dueDate : null,
      parentId: options.parentId || null
    });
    options.onUpdated?.();
  } catch (err) {
    options.setError(err instanceof Error ? err.message : "Failed to save");
  } finally {
    options.setSaving(false);
  }
}

export async function uploadTicketAttachment(options: {
  projectId: string;
  chatId: string;
  file: File | undefined;
  setError: SetErr;
  setAttachments: React.Dispatch<React.SetStateAction<ChatAttachment[]>>;
}): Promise<void> {
  if (!options.file) return;
  options.setError(null);
  try {
    const created = await uploadAttachment({
      projectId: options.projectId,
      chatId: options.chatId,
      file: options.file
    });
    options.setAttachments((prev) => [created, ...prev]);
  } catch (err) {
    options.setError(err instanceof Error ? err.message : "Upload failed");
  }
}

export async function addTicketLinkedItem(options: {
  projectId: string;
  chatId: string;
  linkLabel: string;
  linkUrl: string;
  setError: SetErr;
  setLinks: React.Dispatch<React.SetStateAction<LinkedItem[]>>;
  setLinkLabel: (value: string) => void;
  setLinkUrl: (value: string) => void;
}): Promise<void> {
  if (!options.linkLabel.trim() || !options.linkUrl.trim()) {
    options.setError("Link label and URL are required");
    return;
  }
  options.setError(null);
  try {
    const created = await createLinkedItem({
      projectId: options.projectId,
      chatId: options.chatId,
      label: options.linkLabel.trim(),
      url: options.linkUrl.trim()
    });
    options.setLinks((prev) => [created, ...prev]);
    options.setLinkLabel("");
    options.setLinkUrl("");
  } catch (err) {
    options.setError(err instanceof Error ? err.message : "Failed to add link");
  }
}

export function removeTicketAttachment(options: {
  projectId: string;
  chatId: string;
  attachmentId: string;
  setAttachments: React.Dispatch<React.SetStateAction<ChatAttachment[]>>;
}) {
  return deleteAttachment({
    projectId: options.projectId,
    chatId: options.chatId,
    attachmentId: options.attachmentId
  }).then(() =>
    options.setAttachments((prev) =>
      prev.filter((x) => x.id !== options.attachmentId)
    )
  );
}

export function removeTicketLinkedItem(options: {
  projectId: string;
  chatId: string;
  linkedItemId: string;
  setLinks: React.Dispatch<React.SetStateAction<LinkedItem[]>>;
}) {
  return deleteLinkedItem({
    projectId: options.projectId,
    chatId: options.chatId,
    linkedItemId: options.linkedItemId
  }).then(() =>
    options.setLinks((prev) =>
      prev.filter((x) => x.id !== options.linkedItemId)
    )
  );
}
