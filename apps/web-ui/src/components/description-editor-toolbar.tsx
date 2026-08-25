import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code2,
  Quote,
  Minus,
  Table as TableIcon,
  CheckSquare,
  Info,
  Scale,
  ChevronsDownUp,
  ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TABLE_ROWS = 2;
const TABLE_COLS = 2;

function ToolbarBtn(options: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={options.title}
      onClick={options.onClick}
      className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {options.children}
    </button>
  );
}

export function DescriptionEditorToolbar(options: {
  editor: Editor;
  onSave: () => void;
}) {
  const { editor, onSave } = options;
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
      <ToolbarBtn
        title="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Ordered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Checklist"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <CheckSquare size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Code block"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={14} />
      </ToolbarBtn>
      <DescriptionEditorInsertToolbar editor={editor} />
      <div className="ml-auto">
        <Button size="xs" variant="secondary" onClick={onSave}>
          Save
        </Button>
      </div>
    </div>
  );
}

function insertTable(editor: Editor) {
  editor
    .chain()
    .focus()
    .insertTable({
      rows: TABLE_ROWS,
      cols: TABLE_COLS,
      withHeaderRow: true
    })
    .run();
}

function DescriptionEditorInsertToolbar(options: { editor: Editor }) {
  const { editor } = options;
  return (
    <>
      <ToolbarBtn title="Table" onClick={() => insertTable(editor)}>
        <TableIcon size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Image URL"
        onClick={() => {
          const src = window.prompt("Image URL or attachment key");
          if (src) editor.chain().focus().setImage({ src }).run();
        }}
      >
        <ImageIcon size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Info panel"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertContent({
              type: "infoPanel",
              attrs: { variant: "info" },
              content: [{ type: "paragraph" }]
            })
            .run()
        }
      >
        <Info size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Decision"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertContent({
              type: "decision",
              attrs: { status: "open" },
              content: [{ type: "paragraph" }]
            })
            .run()
        }
      >
        <Scale size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        title="Collapsible"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertContent({
              type: "collapsible",
              attrs: { summary: "Details", collapsed: true },
              content: [{ type: "paragraph" }]
            })
            .run()
        }
      >
        <ChevronsDownUp size={14} />
      </ToolbarBtn>
    </>
  );
}
