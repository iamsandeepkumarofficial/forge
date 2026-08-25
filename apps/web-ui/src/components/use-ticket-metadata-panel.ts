import type { TicketSummary } from "./ticket-metadata-shared.js";
import {
  addTicketLinkedItem,
  removeTicketAttachment,
  removeTicketLinkedItem,
  saveTicketMetadataFields,
  uploadTicketAttachment
} from "./ticket-metadata-actions.js";
import { useTicketMetadataFields } from "./use-ticket-metadata-fields.js";

export function useTicketMetadataPanel(options: {
  projectId: string;
  chat: TicketSummary;
  allChats: TicketSummary[];
  onUpdated?: () => void;
}) {
  const fields = useTicketMetadataFields(options);
  const { projectId, chat, onUpdated } = options;
  const saveFields = () =>
    saveTicketMetadataFields({
      projectId,
      chatId: chat.id,
      type: fields.type,
      dueDate: fields.dueDate,
      parentId: fields.parentId,
      onUpdated,
      setError: fields.setError,
      setSaving: fields.setSaving
    });
  const onUpload = (file: File | undefined) =>
    uploadTicketAttachment({
      projectId,
      chatId: chat.id,
      file,
      setError: fields.setError,
      setAttachments: fields.setAttachments
    });
  const onAddLink = () =>
    addTicketLinkedItem({
      projectId,
      chatId: chat.id,
      linkLabel: fields.linkLabel,
      linkUrl: fields.linkUrl,
      setError: fields.setError,
      setLinks: fields.setLinks,
      setLinkLabel: fields.setLinkLabel,
      setLinkUrl: fields.setLinkUrl
    });
  const removeAttachment = (attachmentId: string) =>
    removeTicketAttachment({
      projectId,
      chatId: chat.id,
      attachmentId,
      setAttachments: fields.setAttachments
    });
  const removeLink = (linkedItemId: string) =>
    removeTicketLinkedItem({
      projectId,
      chatId: chat.id,
      linkedItemId,
      setLinks: fields.setLinks
    });
  return {
    ...fields,
    saveFields,
    onUpload,
    onAddLink,
    removeAttachment,
    removeLink
  };
}

export type TicketMetadataState = ReturnType<typeof useTicketMetadataPanel>;
