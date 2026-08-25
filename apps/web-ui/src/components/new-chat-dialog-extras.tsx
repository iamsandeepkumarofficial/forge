import { Link2, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NewChatDialogState } from "./use-new-chat-dialog.js";

export function NewChatAttachmentsSection({
  state
}: {
  state: NewChatDialogState;
}) {
  const { files, setFiles } = state;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Paperclip size={14} /> Attachments
        </Label>
        <label className="inline-flex items-center gap-1 text-xs cursor-pointer text-primary">
          <Upload size={14} /> Add files
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const next = Array.from(e.target.files ?? []);
              if (next.length) {
                setFiles((prev) => [...prev, ...next]);
              }
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Optional — documents, images, or archives up to 25MB each.
        </p>
      ) : (
        <ul className="space-y-1">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-sm"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${file.name}`}
                onClick={() =>
                  setFiles((prev) => prev.filter((_, idx) => idx !== i))
                }
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NewChatLinksSection({ state }: { state: NewChatDialogState }) {
  const {
    links,
    setLinks,
    linkLabel,
    setLinkLabel,
    linkUrl,
    setLinkUrl,
    addLink
  } = state;
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Link2 size={14} /> Linked work items
      </Label>
      <div className="grid gap-1.5">
        <Input
          placeholder="Label (e.g. PROJ-12)"
          value={linkLabel}
          onChange={(e) => setLinkLabel(e.target.value)}
        />
        <Input
          placeholder="https://…"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={addLink}
        >
          <Plus size={14} /> Add link
        </Button>
      </div>
      {links.length > 0 && (
        <ul className="space-y-1">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-sm"
            >
              <span className="truncate">
                {link.label}{" "}
                <span className="text-muted-foreground">· {link.url}</span>
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${link.label}`}
                onClick={() =>
                  setLinks((prev) => prev.filter((l) => l.id !== link.id))
                }
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
