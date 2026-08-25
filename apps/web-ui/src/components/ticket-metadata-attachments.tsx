import { Paperclip, Trash2, Upload } from "lucide-react";
import { downloadAttachmentUrl } from "@/lib/projects-api";
import type { TicketMetadataState } from "./use-ticket-metadata-panel.js";

export function TicketMetadataAttachments({
  state
}: {
  state: TicketMetadataState;
}) {
  const { attachments, projectId, chatId, onUpload, removeAttachment } = state;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-1">
          <Paperclip size={14} /> Attachments
        </h4>
        <label className="inline-flex items-center gap-1 text-xs cursor-pointer text-primary">
          <Upload size={14} /> Upload
          <input
            type="file"
            className="hidden"
            onChange={(e) => void onUpload(e.target.files?.[0])}
          />
        </label>
      </div>
      <ul className="space-y-1">
        {attachments.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-2 rounded border px-2 py-1"
          >
            <a
              className="truncate text-primary hover:underline"
              href={downloadAttachmentUrl({
                projectId,
                chatId,
                attachmentId: a.id
              })}
              target="_blank"
              rel="noreferrer"
            >
              {a.fileName}
            </a>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => void removeAttachment(a.id)}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {attachments.length === 0 && (
          <li className="text-xs text-muted-foreground">No attachments</li>
        )}
      </ul>
    </div>
  );
}
