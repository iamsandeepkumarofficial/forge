import { Calculator, Gamepad2, ImageIcon, Mail, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyStateImportPanels } from "./empty-state-import-panels.js";
import { GithubRepoPicker } from "./github-repo-picker.js";
import type { useDashboardEmptyState } from "./use-dashboard-empty-state.js";

const SUGGESTION_ICONS = [Mail, ImageIcon, Gamepad2, Calculator] as const;

type FullState = ReturnType<typeof useDashboardEmptyState>;
type ViewState = Omit<
  FullState,
  | "fileInputRef"
  | "folderInputRef"
  | "importSectionRef"
  | "handleZipFile"
  | "handleFolderFiles"
>;

export function DashboardEmptyStateView(options: {
  state: ViewState;
  onImportSectionRef: (el: HTMLDivElement | null) => void;
  onChooseZip: () => void;
  onChooseFolder: () => void;
}) {
  const { state: s, onImportSectionRef, onChooseZip, onChooseFolder } = options;
  return (
    <div
      className={`min-h-screen px-6 py-10 ${s.dragOver ? "bg-muted/40" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        s.setDragOver(true);
      }}
      onDragLeave={() => s.setDragOver(false)}
      onDrop={(e) => void s.onDrop(e)}
    >
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:underline"
            >
              Forge
            </Link>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Let&apos;s build something new
            </h1>
          </div>
        </div>
        <DashboardBuildPrompt
          state={s}
          onChooseZip={onChooseZip}
          onChooseFolder={onChooseFolder}
        />
        {s.error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {s.error}
          </p>
        )}
        <div ref={onImportSectionRef}>
          <EmptyStateImportPanels
            busy={s.busy}
            loading={s.loading}
            onGithub={() => {
              s.setError(null);
              s.setShowGithubPicker(true);
            }}
            onFolder={onChooseFolder}
            onZip={onChooseZip}
          />
        </div>
      </div>
      <GithubRepoPicker
        open={s.showGithubPicker}
        onClose={() => {
          if (!s.connectingSlug) s.setShowGithubPicker(false);
        }}
        onSelect={s.handleGithubSelect}
        connectingSlug={s.connectingSlug}
      />
    </div>
  );
}

function DashboardBuildPrompt(options: {
  state: ViewState;
  onChooseZip: () => void;
  onChooseFolder: () => void;
}) {
  const { state: s, onChooseZip, onChooseFolder } = options;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2 shadow-sm">
        <input
          value={s.buildText}
          onChange={(e) => s.setBuildText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              s.handleBuild();
            }
          }}
          placeholder="I want to build…"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          disabled={s.busy}
        />
        <button
          type="button"
          onClick={s.handleBuild}
          disabled={s.busy}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Build
        </button>
      </div>
      <SuggestionChips state={s} />
      <UploadHints
        state={s}
        onChooseZip={onChooseZip}
        onChooseFolder={onChooseFolder}
      />
    </div>
  );
}

function SuggestionChips(options: { state: ViewState }) {
  const s = options.state;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {s.suggestions.map((label, i) => {
        const Icon = SUGGESTION_ICONS[i % SUGGESTION_ICONS.length]!;
        return (
          <button
            key={label}
            type="button"
            disabled={s.busy}
            onClick={() => s.setBuildText(label)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            <Icon className="size-3.5 text-muted-foreground" />
            {label}
          </button>
        );
      })}
      <button
        type="button"
        aria-label="Refresh suggestions"
        disabled={s.busy}
        onClick={() => s.setSuggestionSet((n) => n + 1)}
        className="inline-flex size-8 items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-50"
      >
        <RefreshCw className="size-3.5" />
      </button>
    </div>
  );
}

function UploadHints(options: {
  state: ViewState;
  onChooseZip: () => void;
  onChooseFolder: () => void;
}) {
  const { state: s, onChooseZip, onChooseFolder } = options;
  return (
    <>
      <p className="text-sm text-muted-foreground">
        You can also drag and drop a project folder or ZIP, or choose a{" "}
        <button
          type="button"
          className="text-primary underline-offset-2 hover:underline"
          disabled={s.busy}
          onClick={onChooseZip}
        >
          file
        </button>{" "}
        or{" "}
        <button
          type="button"
          className="text-primary underline-offset-2 hover:underline"
          disabled={s.busy}
          onClick={onChooseFolder}
        >
          folder
        </button>
        .
      </p>
      {s.buildHint && (
        <p className="text-sm text-muted-foreground">
          Connect a repo or upload a folder/ZIP to start
          {s.pendingTitle ? (
            <>
              {" "}
              — first ticket:{" "}
              <span className="font-medium text-foreground">
                {s.pendingTitle}
              </span>
            </>
          ) : null}
          .
        </p>
      )}
    </>
  );
}
