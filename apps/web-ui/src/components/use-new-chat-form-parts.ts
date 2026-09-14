import { useState } from "react";
import type {
  ChatFeatureType,
  ChatPriority,
  ExistingChat,
  PendingLink
} from "./new-chat-dialog-shared.js";

export function useNewChatFormFields() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ChatFeatureType>("feature");
  const [priority, setPriority] = useState<ChatPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [executionTarget, setExecutionTarget] = useState<"local" | "cloud">(
    "local"
  );
  return {
    title,
    setTitle,
    type,
    setType,
    priority,
    setPriority,
    dueDate,
    setDueDate,
    parentId,
    setParentId,
    description,
    setDescription,
    executionTarget,
    setExecutionTarget
  };
}

export function useNewChatExtras(options: {
  setError: (value: string | null) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<PendingLink[]>([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const addLink = () => {
    if (!linkLabel.trim() || !linkUrl.trim()) {
      options.setError("Linked item needs both a label and a URL");
      return;
    }
    options.setError(null);
    setLinks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: linkLabel.trim(),
        url: linkUrl.trim()
      }
    ]);
    setLinkLabel("");
    setLinkUrl("");
  };
  return {
    files,
    setFiles,
    links,
    setLinks,
    linkLabel,
    setLinkLabel,
    linkUrl,
    setLinkUrl,
    addLink
  };
}

export function parentChatOptions(existingChats: ExistingChat[]) {
  return existingChats.filter((c) => !c.parentId);
}
