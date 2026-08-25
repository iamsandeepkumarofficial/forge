import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils.js";
import type { LlmProvider } from "../lib/chat-agent.js";
import {
  ALL_PROVIDERS,
  PROVIDER_LABELS,
  type ModelsByProvider
} from "./chat-composer-shared.js";

type ModelGroup = {
  provider: LlmProvider;
  label: string;
  models: string[];
};

function ModelGroupList(options: {
  provider: LlmProvider;
  model: string;
  auto: boolean;
  loading: boolean;
  groups: ModelGroup[];
  onAutoChange: (auto: boolean) => void;
  onSelect: (provider: LlmProvider, model: string) => void;
  onClose: () => void;
}) {
  const {
    provider,
    model,
    auto,
    loading,
    groups,
    onAutoChange,
    onSelect,
    onClose
  } = options;
  if (loading && groups.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">Loading models…</p>
    );
  }
  if (groups.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">
        No models found.
      </p>
    );
  }
  return (
    <>
      {groups.map((group) => (
        <div key={group.provider} className="py-1">
          <div className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </div>
          {group.models.map((m) => {
            const selected =
              !auto && provider === group.provider && model === m;
            return (
              <button
                key={`${group.provider}:${m}`}
                type="button"
                onClick={() => {
                  onAutoChange(false);
                  onSelect(group.provider, m);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent",
                  selected && "bg-accent"
                )}
              >
                <span className="min-w-0 flex-1 truncate">{m}</span>
                {selected ? (
                  <Check className="size-3.5 shrink-0 opacity-70" />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

function ModelPickerPanel(options: {
  provider: LlmProvider;
  model: string;
  auto: boolean;
  loading: boolean;
  groups: ModelGroup[];
  query: string;
  onQueryChange: (q: string) => void;
  onAutoChange: (auto: boolean) => void;
  onSelect: (provider: LlmProvider, model: string) => void;
  onClose: () => void;
}) {
  const {
    provider,
    model,
    auto,
    loading,
    groups,
    query,
    onQueryChange,
    onAutoChange,
    onSelect,
    onClose
  } = options;
  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
      <div className="border-b border-border px-3 py-2">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search models"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoFocus
        />
      </div>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm">Auto</span>
        <button
          type="button"
          role="switch"
          aria-checked={auto}
          onClick={() => onAutoChange(!auto)}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            auto ? "bg-foreground" : "bg-muted-foreground/30"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full bg-background transition-transform",
              auto ? "left-4" : "left-0.5"
            )}
          />
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        <ModelGroupList
          provider={provider}
          model={model}
          auto={auto}
          loading={loading}
          groups={groups}
          onAutoChange={onAutoChange}
          onSelect={onSelect}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

export function ModelPicker(options: {
  provider: LlmProvider;
  model: string;
  auto: boolean;
  modelsByProvider: ModelsByProvider;
  loading: boolean;
  onAutoChange: (auto: boolean) => void;
  onSelect: (provider: LlmProvider, model: string) => void;
}) {
  const {
    provider,
    model,
    auto,
    modelsByProvider,
    loading,
    onAutoChange,
    onSelect
  } = options;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    return ALL_PROVIDERS.map((p) => {
      const models = (modelsByProvider[p] ?? []).filter((m) =>
        q
          ? m.toLowerCase().includes(q) ||
            PROVIDER_LABELS[p].toLowerCase().includes(q)
          : true
      );
      return { provider: p, label: PROVIDER_LABELS[p], models };
    }).filter((g) => g.models.length > 0);
  }, [modelsByProvider, q]);
  const label = auto ? "Auto" : model.trim() || "Select model";
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 max-w-44 items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted"
        title={auto ? "Auto model" : `${PROVIDER_LABELS[provider]} · ${model}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3 shrink-0 opacity-50" />
      </button>
      {open ? (
        <ModelPickerPanel
          provider={provider}
          model={model}
          auto={auto}
          loading={loading}
          groups={groups}
          query={query}
          onQueryChange={setQuery}
          onAutoChange={onAutoChange}
          onSelect={onSelect}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
