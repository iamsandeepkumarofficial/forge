import { useEffect, useCallback } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Table,
  TableRow,
  TableCell,
  TableHeader
} from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import type { DescriptionDocument } from "@/lib/projects-api";
import { updateChat } from "@/lib/projects-api";
import {
  descriptionToTipTap,
  tipTapToDescription
} from "@/lib/description-document";
import { InfoPanel } from "@/components/description-nodes/info-panel";
import { Decision } from "@/components/description-nodes/decision";
import { Collapsible } from "@/components/description-nodes/collapsible";

export function useTicketDescriptionEditor(options: {
  projectId: string;
  chatId: string;
  description: DescriptionDocument | null | undefined;
  onSaved?: (doc: DescriptionDocument) => void;
}) {
  const { projectId, chatId, description, onSaved } = options;
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "Add a description…"
      }),
      InfoPanel,
      Decision,
      Collapsible
    ],
    content: descriptionToTipTap(description),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[160px] px-3 py-2 focus:outline-none"
      }
    }
  });
  useEffect(() => {
    if (!editor) return;
    const next = descriptionToTipTap(description);
    const current = tipTapToDescription(editor.getJSON());
    const nextSerialized = JSON.stringify(next);
    const currentSerialized = JSON.stringify(descriptionToTipTap(current));
    if (nextSerialized !== currentSerialized) {
      editor.commands.setContent(next);
    }
  }, [description, editor]);
  const save = useCallback(async () => {
    if (!editor) return;
    const doc = tipTapToDescription(editor.getJSON());
    await updateChat({ projectId, chatId, description: doc });
    onSaved?.(doc);
  }, [editor, projectId, chatId, onSaved]);
  return { editor, save };
}
