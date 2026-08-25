import { EditorContent } from "@tiptap/react";
import { DescriptionEditorToolbar } from "./description-editor-toolbar.js";
import { useTicketDescriptionEditor } from "./use-ticket-description-editor.js";
import type { DescriptionDocument } from "@/lib/projects-api";

interface TicketDescriptionEditorProps {
  projectId: string;
  chatId: string;
  description: DescriptionDocument | null | undefined;
  onSaved?: (doc: DescriptionDocument) => void;
}

export function TicketDescriptionEditor(props: TicketDescriptionEditorProps) {
  const { editor, save } = useTicketDescriptionEditor(props);
  if (!editor) return null;
  return (
    <div className="rounded-lg border border-border">
      <DescriptionEditorToolbar editor={editor} onSave={() => void save()} />
      <EditorContent editor={editor} />
    </div>
  );
}
