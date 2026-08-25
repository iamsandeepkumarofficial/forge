import { useEffect, useState } from "react";
import {
  listWorkflows,
  type WorkflowCatalogEntry
} from "../lib/definitions-api.js";
import { DEFAULT_WORKFLOW_ID } from "./new-chat-dialog-shared.js";
import { buildNewChatSubmitHandler } from "./new-chat-dialog-handlers.js";
import type { ExistingChat } from "./new-chat-dialog-shared.js";
import {
  parentChatOptions,
  useNewChatExtras,
  useNewChatFormFields
} from "./use-new-chat-form-parts.js";

export function useNewChatDialog(options: {
  projectId: string;
  existingChats: ExistingChat[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const { projectId, existingChats, onClose, onCreated } = options;
  const fields = useNewChatFormFields();
  const [workflowId, setWorkflowId] = useState(DEFAULT_WORKFLOW_ID);
  const [workflows, setWorkflows] = useState<WorkflowCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const extras = useNewChatExtras({ setError });
  useEffect(() => {
    void listWorkflows()
      .then((items) => {
        setWorkflows(items);
        if (items.some((w) => w.id === DEFAULT_WORKFLOW_ID)) {
          setWorkflowId(DEFAULT_WORKFLOW_ID);
        } else if (items[0]) {
          setWorkflowId(items[0].id);
        }
      })
      .catch(() => setWorkflows([]));
  }, []);
  const handleSubmit = buildNewChatSubmitHandler({
    projectId,
    ...fields,
    workflowId,
    files: extras.files,
    links: extras.links,
    onCreated,
    onClose,
    setError,
    setLoading
  });
  return {
    onClose,
    ...fields,
    workflowId,
    setWorkflowId,
    workflows,
    ...extras,
    loading,
    error,
    parentOptions: parentChatOptions(existingChats),
    handleSubmit
  };
}

export type NewChatDialogState = ReturnType<typeof useNewChatDialog>;
