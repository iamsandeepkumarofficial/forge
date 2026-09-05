import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  GitBranch,
  Loader2,
  Paperclip,
  Square,
  X
} from "lucide-react";
import type { LlmProvider } from "../lib/chat-agent.js";
import type {
  ComposerAgentMode,
  ModelsByProvider
} from "./chat-composer-shared.js";
import { ModePicker } from "./mode-picker.js";
import { ModeSwitchPrompt } from "./mode-switch-prompt.js";
import { ModelPicker } from "./model-picker.js";
import {
  ContextUsagePopover,
  ContextUsageRing,
  useContextUsage
} from "./context-usage.js";

export type { ComposerAgentMode } from "./chat-composer-shared.js";
export {
  AGENT_MODES,
  PROVIDER_LABELS,
  ALL_PROVIDERS
} from "./chat-composer-shared.js";
export { ModePicker } from "./mode-picker.js";
export { ModelPicker } from "./model-picker.js";

export type ChatComposerProps = {
  sessionId: string;
  branchName?: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  canSend: boolean;
  status: "ready" | "submitted" | "streaming" | "error";
  agentMode: ComposerAgentMode;
  onAgentModeChange: (mode: ComposerAgentMode) => void;
  provider: LlmProvider;
  model: string;
  autoModel: boolean;
  onAutoModelChange: (auto: boolean) => void;
  modelsByProvider: ModelsByProvider;
  modelsLoading: boolean;
  onModelSelect: (provider: LlmProvider, model: string) => void;
  conversationTokens: number;
  maxContextTokens: number | null;
  maxOutputTokens: number | null;
  attachments: File[];
  onAttachFiles: (files: File[]) => void;
  onRemoveAttachment: (index: number) => void;
  placeholder?: string;
  pendingModeSwitch?: ComposerAgentMode | null;
  modeSwitchRemainingSeconds?: number;
  onConfirmModeSwitch?: () => void;
  onDismissModeSwitch?: () => void;

  leading?: ReactNode;
};

function ComposerAttachments(options: {
  attachments: File[];
  onRemoveAttachment: (index: number) => void;
}) {
  const { attachments, onRemoveAttachment } = options;
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
      {attachments.map((file, i) => (
        <span
          key={`${file.name}-${i}`}
          className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"
        >
          <Paperclip className="size-3 shrink-0 opacity-60" />
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onRemoveAttachment(i)}
            className="rounded-full p-0.5 hover:bg-background"
            aria-label={`Remove ${file.name}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

function ComposerSendButton(options: {
  status: ChatComposerProps["status"];
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
}) {
  const { status, canSend, onSend, onStop } = options;
  if (status === "streaming") {
    return (
      <button
        type="button"
        onClick={onStop}
        className="inline-flex size-8 items-center justify-center rounded-full bg-foreground text-background"
        title="Stop"
        aria-label="Stop"
      >
        <Square className="size-3.5 fill-current" />
      </button>
    );
  }
  if (status === "submitted") {
    return (
      <button
        type="button"
        disabled
        className="inline-flex size-8 items-center justify-center rounded-full bg-foreground text-background opacity-90"
        title="Thinking…"
        aria-label="Thinking"
      >
        <Loader2 className="size-4 animate-spin" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onSend}
      disabled={!canSend}
      className="inline-flex size-8 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-35"
      title="Send"
      aria-label="Send"
    >
      <ArrowUp className="size-4" strokeWidth={2.5} />
    </button>
  );
}

function ComposerToolbar(options: {
  props: ChatComposerProps;
  contextOpen: boolean;
  setContextOpen: (updater: boolean | ((v: boolean) => boolean)) => void;
  contextWrapRef: React.RefObject<HTMLDivElement | null>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  usage: ReturnType<typeof useContextUsage>;
}) {
  const {
    props: p,
    contextOpen,
    setContextOpen,
    contextWrapRef,
    fileRef,
    usage
  } = options;
  return (
    <div className="flex items-center gap-2 px-2.5 pb-2.5">
      <ModePicker value={p.agentMode} onChange={p.onAgentModeChange} />
      <ModelPicker
        provider={p.provider}
        model={p.model}
        auto={p.autoModel}
        modelsByProvider={p.modelsByProvider}
        loading={p.modelsLoading}
        onAutoChange={p.onAutoModelChange}
        onSelect={p.onModelSelect}
      />
      <div className="flex-1" />
      <div className="relative shrink-0" ref={contextWrapRef}>
        <ContextUsageRing
          ratio={usage.ratio}
          open={contextOpen}
          onClick={() => setContextOpen((v) => !v)}
        />
        {contextOpen ? (
          <ContextUsagePopover
            percentFull={usage.percentFull}
            usageSubtitle={usage.usageSubtitle}
            rows={usage.rows}
            onClose={() => setContextOpen(false)}
          />
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) p.onAttachFiles(files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Attach files"
        aria-label="Attach files"
      >
        <Paperclip className="size-4" />
      </button>
      <ComposerSendButton
        status={p.status}
        canSend={p.canSend}
        onSend={p.onSend}
        onStop={p.onStop}
      />
    </div>
  );
}

function PendingModeBanner(options: {
  target: ComposerAgentMode | null | undefined;
  remainingSeconds?: number;
  onConfirm?: () => void;
  onDismiss?: () => void;
}) {
  if (!options.target || !options.onConfirm || !options.onDismiss) {
    return null;
  }
  return (
    <ModeSwitchPrompt
      target={options.target}
      remainingSeconds={options.remainingSeconds ?? 0}
      onConfirm={options.onConfirm}
      onDismiss={options.onDismiss}
    />
  );
}

function useComposerContextDismiss() {
  const contextWrapRef = useRef<HTMLDivElement>(null);
  const [contextOpen, setContextOpen] = useState(false);
  useEffect(() => {
    if (!contextOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!contextWrapRef.current) return;
      if (contextWrapRef.current.contains(e.target as Node)) return;
      setContextOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextOpen]);
  return { contextWrapRef, contextOpen, setContextOpen };
}

export function ChatComposer(props: ChatComposerProps) {
  const {
    sessionId,
    value,
    onChange,
    onSend,
    canSend,
    conversationTokens,
    maxContextTokens,
    maxOutputTokens,
    agentMode,
    attachments,
    onRemoveAttachment,
    placeholder = "Ask Forge to plan, build, or debug…"
  } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const { contextWrapRef, contextOpen, setContextOpen } =
    useComposerContextDismiss();
  const usage = useContextUsage({
    sessionId,
    agentMode,
    conversationTokens,
    maxContextTokens,
    maxOutputTokens
  });
  return (
    <div className="shrink-0 px-3 pb-3 pt-10">
      <div className="relative">
        {props.leading}
        <div className="rounded-2xl border border-border bg-background shadow-sm">
          <PendingModeBanner
            target={props.pendingModeSwitch}
            remainingSeconds={props.modeSwitchRemainingSeconds}
            onConfirm={props.onConfirmModeSwitch}
            onDismiss={props.onDismissModeSwitch}
          />
          <ComposerAttachments
            attachments={attachments}
            onRemoveAttachment={onRemoveAttachment}
          />
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            placeholder={placeholder}
            rows={2}
            className="w-full resize-none bg-transparent px-3 pt-3 pb-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <ComposerToolbar
            props={props}
            contextOpen={contextOpen}
            setContextOpen={setContextOpen}
            contextWrapRef={contextWrapRef}
            fileRef={fileRef}
            usage={usage}
          />
        </div>
      </div>
      {props.branchName ? (
        <p
          title={props.branchName}
          aria-label={`Branch ${props.branchName}`}
          className="mt-1.5 flex min-w-0 items-center gap-1 px-1 font-mono text-[11px] text-muted-foreground"
        >
          <GitBranch className="size-3 shrink-0" />
          <span className="truncate">{props.branchName}</span>
        </p>
      ) : null}
    </div>
  );
}
