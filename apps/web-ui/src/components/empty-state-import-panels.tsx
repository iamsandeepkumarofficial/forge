import { Folder, Loader2, Upload } from "lucide-react";
import { TEMPLATES } from "./empty-state-shared.js";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

type ImportPanelOptions = {
  busy: boolean;
  loading: "github" | "upload" | null;
  onGithub: () => void;
  onFolder: () => void;
  onZip: () => void;
};

function ProviderButtons(options: ImportPanelOptions) {
  const { busy, loading, onGithub } = options;
  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={onGithub}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading === "github" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GitHubMark className="size-4" />
        )}
        Continue with GitHub
      </button>
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground opacity-60"
      >
        Continue with GitLab
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
          Coming soon
        </span>
      </button>
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground opacity-60"
      >
        Continue with Bitbucket
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
          Coming soon
        </span>
      </button>
    </div>
  );
}

function LocalUploadSection(options: ImportPanelOptions) {
  const { busy, loading, onFolder, onZip } = options;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        type="button"
        disabled={busy}
        onClick={onFolder}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm hover:bg-muted/50 disabled:opacity-50"
      >
        {loading === "upload" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="size-4" />
            Upload folder or ZIP
          </>
        )}
      </button>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="inline-flex items-start gap-1.5">
          <Folder className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Drop a folder anywhere on this page, or{" "}
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              disabled={busy}
              onClick={onZip}
            >
              choose a ZIP
            </button>
            . Large dirs like node_modules are skipped.
          </span>
        </span>
      </p>
    </div>
  );
}

function ImportGitSection(options: ImportPanelOptions) {
  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="text-base font-semibold">Import Git Repository</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Select a Git provider to import an existing project from a Git
        repository.
      </p>
      <ProviderButtons
        busy={options.busy}
        loading={options.loading}
        onGithub={options.onGithub}
        onFolder={options.onFolder}
        onZip={options.onZip}
      />
      <LocalUploadSection
        busy={options.busy}
        loading={options.loading}
        onGithub={options.onGithub}
        onFolder={options.onFolder}
        onZip={options.onZip}
      />
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
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
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
  const { busy, loading, onGithub, onFolder, onZip } = options;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ImportGitSection
        busy={busy}
        loading={loading}
        onGithub={onGithub}
        onFolder={onFolder}
        onZip={onZip}
      />
      <CloneTemplateSection />
    </div>
  );
}
