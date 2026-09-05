import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  MousePointer2,
  RotateCw,
  SquareTerminal
} from "lucide-react";
import type { AppStatus } from "../../lib/tool-runner.js";
import { cn } from "@/lib/utils";
import { previewPortLabel } from "./api-explorer-model.js";
import { requestDevtoolsToggle } from "./terminal-toggle.js";

function chromeBtn(extra?: string): string {
  return cn(
    "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30",
    extra
  );
}

function PreviewChromeNav(options: {
  surface: "browser" | "api" | "none";
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
}) {
  const { surface, canBack, canForward, onBack, onForward, onReload } = options;
  return (
    <>
      <button
        type="button"
        aria-label="Back"
        title="Back"
        disabled={!canBack}
        onClick={onBack}
        className={chromeBtn()}
      >
        <ArrowLeft className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Forward"
        title="Forward"
        disabled={!canForward}
        onClick={onForward}
        className={chromeBtn()}
      >
        <ArrowRight className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Refresh preview"
        title="Refresh"
        disabled={surface !== "browser"}
        onClick={onReload}
        className={chromeBtn()}
      >
        <RotateCw className="size-3.5" />
      </button>
      <span className="mx-1 h-4 w-px shrink-0 bg-border" />
    </>
  );
}

function PreviewAddressBar(options: {
  surface: "browser" | "api" | "none";
  address: string;
  urlLive: boolean;
  onAddress: (v: string) => void;
  onSubmitAddress: (typed?: string) => void;
}) {
  const { surface, address, urlLive, onAddress, onSubmitAddress } = options;
  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border bg-background px-2.5 py-1"
      onSubmit={(e) => {
        e.preventDefault();
        const typed = new FormData(e.currentTarget).get("preview-url");
        onSubmitAddress(typeof typed === "string" ? typed : address);
      }}
    >
      {surface === "api" ? (
        <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
          API
        </span>
      ) : (
        <Lock className="size-3 shrink-0 text-muted-foreground" />
      )}
      <input
        name="preview-url"
        aria-label="Preview URL"
        value={address}
        disabled={!urlLive}
        onChange={(e) => onAddress(e.target.value)}
        placeholder={urlLive ? "Path or URL" : "No app running"}
        className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none disabled:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={!urlLive}
        className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background disabled:opacity-40"
      >
        Go
      </button>
    </form>
  );
}

export function AppPreviewToolbar(options: {
  apps: AppStatus[];
  active: AppStatus | undefined;
  surface: "browser" | "api" | "none";
  address: string;
  commenting: boolean;
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onAddress: (v: string) => void;
  onSubmitAddress: (typed?: string) => void;
  onSelect: (name: string) => void;
  onReload: () => void;
  onToggleComment: () => void;
  overflow?: ReactNode;
}) {
  const o = options;
  const urlLive = o.surface === "browser" || o.surface === "api";
  return (
    <div className="flex items-center gap-0.5 border-b bg-muted/40 px-2 py-1">
      <PreviewChromeNav
        surface={o.surface}
        canBack={o.canBack}
        canForward={o.canForward}
        onBack={o.onBack}
        onForward={o.onForward}
        onReload={o.onReload}
      />
      {o.apps.length > 0 ? (
        <select
          value={o.active?.name}
          onChange={(e) => o.onSelect(e.target.value)}
          aria-label="Preview port"
          className="mr-1 rounded-md border-0 bg-transparent px-1 py-0.5 text-[11px] text-muted-foreground outline-none hover:bg-muted"
        >
          {o.apps.map((a) => (
            <option key={a.name} value={a.name} title={a.name}>
              {previewPortLabel(a)}
            </option>
          ))}
        </select>
      ) : null}
      <PreviewAddressBar
        surface={o.surface}
        address={o.address}
        urlLive={urlLive}
        onAddress={o.onAddress}
        onSubmitAddress={o.onSubmitAddress}
      />
      <button
        type="button"
        onClick={o.onToggleComment}
        disabled={o.surface !== "browser"}
        title="Comment on an element"
        aria-label="Comment on an element"
        aria-pressed={o.commenting}
        className={chromeBtn(
          o.commenting ? "border border-primary text-primary" : undefined
        )}
      >
        <MousePointer2 className="size-3.5" />
      </button>
      <button
        type="button"
        title="DevTools"
        aria-label="DevTools"
        disabled={o.surface !== "browser"}
        onClick={() => requestDevtoolsToggle()}
        className={chromeBtn()}
      >
        <SquareTerminal className="size-3.5" />
      </button>
      {o.overflow}
    </div>
  );
}
