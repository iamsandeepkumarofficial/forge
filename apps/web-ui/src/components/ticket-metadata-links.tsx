import { Link2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TicketMetadataState } from "./use-ticket-metadata-panel.js";

export function TicketMetadataLinks({ state }: { state: TicketMetadataState }) {
  const {
    links,
    linkLabel,
    setLinkLabel,
    linkUrl,
    setLinkUrl,
    onAddLink,
    removeLink
  } = state;
  return (
    <div className="space-y-2">
      <h4 className="font-medium flex items-center gap-1">
        <Link2 size={14} /> Linked work items
      </h4>
      <div className="grid gap-1">
        <Input
          placeholder="Label"
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
          onClick={() => void onAddLink()}
        >
          Add link
        </Button>
      </div>
      <ul className="space-y-1">
        {links.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 rounded border px-2 py-1"
          >
            <a
              className="truncate text-primary hover:underline"
              href={item.url}
              target="_blank"
              rel="noreferrer"
            >
              {item.label}
            </a>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => void removeLink(item.id)}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {links.length === 0 && (
          <li className="text-xs text-muted-foreground">No linked items</li>
        )}
      </ul>
    </div>
  );
}
