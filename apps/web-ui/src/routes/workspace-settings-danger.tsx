import { Trash2 } from "lucide-react";

export function WorkspaceDangerSection(options: {
  busy: boolean;
  onDelete: () => void;
}) {
  const { busy, onDelete } = options;
  return (
    <section className="border-t border-border/60 pt-8">
      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
        Delete workspace
      </button>
    </section>
  );
}
