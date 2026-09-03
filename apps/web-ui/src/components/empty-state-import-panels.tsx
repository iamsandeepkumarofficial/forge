import { Folder, Loader2 } from "lucide-react";
import { TEMPLATES } from "./empty-state-shared.js";

type ImportPanelOptions = {
  busy: boolean;
  loading: "local" | null;
  desktop: boolean;
  showPathInput: boolean;
  localPath: string;
  onLocalPathChange: (value: string) => void;
  onSelectFolder: () => void;
  onConnectPath: () => void;
};

function LocalFolderSection(options: ImportPanelOptions) {
  const {
    busy,
    loading,
    desktop,
    showPathInput,
    localPath,
    onLocalPathChange,
    onSelectFolder,
    onConnectPath
  } = options;

  return (
    <section className="rounded-xl border border-border p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <button
          type="button"
          disabled={busy}
          onClick={onSelectFolder}
          aria-label="Select folder"
          className="inline-flex size-16 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
        >
          {loading === "local" ? (
            <Loader2 className="size-7 animate-spin" />
          ) : (
            <Folder className="size-7" />
          )}
        </button>
        <div>
          <h2 className="text-base font-semibold">Select a project folder</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {desktop
              ? "Choose a folder on this machine to connect as a project."
              : "Paste an absolute path below, or use the desktop app for a native folder picker."}
          </p>
        </div>
      </div>

      {showPathInput && !desktop && (
        <form
          className="mx-auto mt-5 max-w-md space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            onConnectPath();
          }}
        >
          <label className="block text-xs font-medium text-muted-foreground">
            Absolute folder path
            <input
              type="text"
              value={localPath}
              onChange={(e) => onLocalPathChange(e.target.value)}
              placeholder="/Users/you/projects/my-app"
              disabled={busy}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !localPath.trim()}
            aria-label="Connect folder"
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading === "local" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Folder className="size-4" />
            )}
          </button>
        </form>
      )}
    </section>
  );
}

function CloneTemplateSection() {
  return (
    <section className="rounded-xl border border-border p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Clone Template</h2>
        <span className="text-xs text-muted-foreground">Coming soon</span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <div
            key={t.title}
            className="rounded-lg border border-border bg-muted/20 p-3 opacity-70"
            aria-disabled
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold">{t.title}</h3>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t.description}
            </p>
            <div className="mt-3 h-16 rounded-md border border-dashed border-border bg-background/60" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function EmptyStateImportPanels(options: ImportPanelOptions) {
  return (
    <div className="flex flex-col gap-6">
      <LocalFolderSection {...options} />
      <CloneTemplateSection />
    </div>
  );
}
