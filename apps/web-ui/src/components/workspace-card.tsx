import { Layers, MoreVertical, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export function WorkspaceCard(options: {
  name: string;
  routeCount: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { name, routeCount, onOpen, onDelete } = options;
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`Open workspace ${name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className="group relative aspect-square cursor-pointer rounded-xl border bg-background p-4 transition-shadow hover:shadow-md"
    >
      <div className="absolute right-2 top-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${name}`}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground outline-none"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete workspace "${name}"?`)) {
                  onDelete();
                }
              }}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
            <Layers className="size-7" />
          </div>
        </div>
        <div>
          <h3 className="line-clamp-2 font-semibold leading-snug">{name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Multi-repo ·{" "}
            {routeCount > 0
              ? `${routeCount} gateway route${routeCount === 1 ? "" : "s"}`
              : "no routes yet"}
          </p>
        </div>
      </div>
    </div>
  );
}
