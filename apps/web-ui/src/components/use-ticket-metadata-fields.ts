import { useEffect, useState } from "react";
import {
  listAttachments,
  listLinkedItems,
  type ChatAttachment,
  type LinkedItem,
  type ChatFeatureType
} from "@/lib/projects-api";
import type { TicketSummary } from "./ticket-metadata-shared.js";

const N_10 = 10;

type FieldSnapshot = {
  chatId: string;
  type: ChatFeatureType;
  dueDate: string;
  parentId: string;
};

function fieldsFromChat(chat: TicketSummary): FieldSnapshot {
  return {
    chatId: chat.id,
    type: chat.type,
    dueDate: chat.dueDate?.slice(0, N_10) ?? "",
    parentId: chat.parentId ?? ""
  };
}

export function useTicketMetadataFields(options: {
  projectId: string;
  chat: TicketSummary;
  allChats: TicketSummary[];
}) {
  const { projectId, chat, allChats } = options;
  const [fields, setFields] = useState(() => fieldsFromChat(chat));
  if (fields.chatId !== chat.id) {
    setFields(fieldsFromChat(chat));
  }
  const setType = (type: ChatFeatureType) =>
    setFields((prev) => ({ ...prev, type }));
  const setDueDate = (dueDate: string) =>
    setFields((prev) => ({ ...prev, dueDate }));
  const setParentId = (parentId: string) =>
    setFields((prev) => ({ ...prev, parentId }));
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [links, setLinks] = useState<LinkedItem[]>([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const parentOptions = allChats.filter((c) => c.id !== chat.id && !c.parentId);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listAttachments(projectId, chat.id),
      listLinkedItems(projectId, chat.id)
    ])
      .then(([atts, items]) => {
        if (cancelled) return;
        setAttachments(atts);
        setLinks(items);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load metadata"
        );
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, chat.id]);
  return {
    type: fields.type,
    setType,
    dueDate: fields.dueDate,
    setDueDate,
    parentId: fields.parentId,
    setParentId,
    attachments,
    setAttachments,
    links,
    setLinks,
    linkLabel,
    setLinkLabel,
    linkUrl,
    setLinkUrl,
    error,
    setError,
    saving,
    setSaving,
    parentOptions,
    projectId,
    chatId: chat.id
  };
}
