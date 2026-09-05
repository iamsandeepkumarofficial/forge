import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandThemePicker } from "@/components/brand-theme-picker";
import { ForgeMarkLink } from "@/components/forge-mark";
import { ModeToggle } from "@/components/mode-toggle";
import { runnerUrl } from "@/lib/tool-runner.js";

export const LLM_SETTINGS_KEY = "forge.settings.llm";

export type LlmSettings = {
  openaiApiKey: string;
  anthropicApiKey: string;
  openaiCompatibleBaseUrl: string;
  openaiCompatibleApiKey: string;
  openaiCompatibleModel: string;
};

const EMPTY: LlmSettings = {
  openaiApiKey: "",
  anthropicApiKey: "",
  openaiCompatibleBaseUrl: "",
  openaiCompatibleApiKey: "",
  openaiCompatibleModel: ""
};

export function loadLlmSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(LLM_SETTINGS_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    return {
      openaiApiKey: String(parsed.openaiApiKey ?? ""),
      anthropicApiKey: String(parsed.anthropicApiKey ?? ""),
      openaiCompatibleBaseUrl: String(parsed.openaiCompatibleBaseUrl ?? ""),
      openaiCompatibleApiKey: String(parsed.openaiCompatibleApiKey ?? ""),
      openaiCompatibleModel: String(parsed.openaiCompatibleModel ?? "")
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveLlmSettings(settings: LlmSettings): void {
  localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify(settings));
}

function settingsHasValues(s: Partial<LlmSettings>): boolean {
  return Object.values(s).some(
    (v) => typeof v === "string" && v.trim().length > 0
  );
}

function normalizeSettings(raw: Partial<LlmSettings>): LlmSettings {
  return {
    openaiApiKey: String(raw.openaiApiKey ?? ""),
    anthropicApiKey: String(raw.anthropicApiKey ?? ""),
    openaiCompatibleBaseUrl: String(raw.openaiCompatibleBaseUrl ?? ""),
    openaiCompatibleApiKey: String(raw.openaiCompatibleApiKey ?? ""),
    openaiCompatibleModel: String(raw.openaiCompatibleModel ?? "")
  };
}

async function persistLlmSettingsToServer(
  settings: LlmSettings
): Promise<LlmSettings> {
  const res = await fetch(`${runnerUrl()}/api/settings/llm`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings)
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Failed to save settings (${res.status})`);
  }
  const saved = (await res.json()) as Partial<LlmSettings>;
  return normalizeSettings(saved);
}

async function resolveInitialForm(): Promise<{
  form: LlmSettings;
  syncNote: string | null;
}> {
  const local = loadLlmSettings();
  try {
    const res = await fetch(`${runnerUrl()}/api/settings/llm`);
    if (!res.ok) return { form: local, syncNote: null };
    const remote = normalizeSettings(
      (await res.json()) as Partial<LlmSettings>
    );
    if (settingsHasValues(remote)) {
      return { form: remote, syncNote: null };
    }
    if (settingsHasValues(local)) {
      const migrated = await persistLlmSettingsToServer(local);
      return {
        form: migrated,
        syncNote:
          "Synced browser settings to ~/.forge/config.json — try chat again."
      };
    }
    return { form: local, syncNote: null };
  } catch {
    void 0;
    return { form: local, syncNote: null };
  }
}

function AppearanceSection() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Appearance</h2>
          <p className="text-xs text-muted-foreground">
            Pick the forge&apos;s heat. Light &amp; dark both supported.
          </p>
        </div>
        <ModeToggle />
      </div>
      <BrandThemePicker />
    </section>
  );
}

function OpenAiCompatibleFields(options: {
  form: LlmSettings;
  onUpdate: (key: keyof LlmSettings, value: string) => void;
}) {
  const { form, onUpdate } = options;
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">
        OpenAI-compatible endpoint
      </legend>
      <div className="space-y-1.5">
        <Label htmlFor="openaiCompatibleBaseUrl">Base URL</Label>
        <Input
          id="openaiCompatibleBaseUrl"
          type="text"
          inputMode="url"
          autoComplete="off"
          value={form.openaiCompatibleBaseUrl}
          onChange={(e) => onUpdate("openaiCompatibleBaseUrl", e.target.value)}
          placeholder="https://openrouter.ai/api/v1"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="openaiCompatibleApiKey">API key</Label>
        <Input
          id="openaiCompatibleApiKey"
          type="password"
          autoComplete="off"
          value={form.openaiCompatibleApiKey}
          onChange={(e) => onUpdate("openaiCompatibleApiKey", e.target.value)}
          placeholder="sk-or-…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="openaiCompatibleModel">Model</Label>
        <Input
          id="openaiCompatibleModel"
          type="text"
          autoComplete="off"
          value={form.openaiCompatibleModel}
          onChange={(e) => onUpdate("openaiCompatibleModel", e.target.value)}
          placeholder="openai/gpt-4o-mini"
        />
      </div>
    </fieldset>
  );
}

function LlmSettingsFields(options: {
  form: LlmSettings;
  onUpdate: (key: keyof LlmSettings, value: string) => void;
}) {
  const { form, onUpdate } = options;
  return (
    <>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">OpenAI</legend>
        <div className="space-y-1.5">
          <Label htmlFor="openaiApiKey">API key</Label>
          <Input
            id="openaiApiKey"
            type="password"
            autoComplete="off"
            value={form.openaiApiKey}
            onChange={(e) => onUpdate("openaiApiKey", e.target.value)}
            placeholder="sk-…"
          />
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Anthropic</legend>
        <div className="space-y-1.5">
          <Label htmlFor="anthropicApiKey">API key</Label>
          <Input
            id="anthropicApiKey"
            type="password"
            autoComplete="off"
            value={form.anthropicApiKey}
            onChange={(e) => onUpdate("anthropicApiKey", e.target.value)}
            placeholder="sk-ant-…"
          />
        </div>
      </fieldset>
      <OpenAiCompatibleFields form={form} onUpdate={onUpdate} />
    </>
  );
}

function SettingsSaveFooter(options: {
  saving: boolean;
  saved: boolean;
  syncNote: string | null;
  error: string | null;
}) {
  const { saving, saved, syncNote, error } = options;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {saved ? (
          <span className="text-sm text-muted-foreground">
            Saved to ~/.forge/config.json — retry chat
          </span>
        ) : null}
      </div>
      {syncNote ? (
        <span className="text-sm text-muted-foreground">{syncNote}</span>
      ) : null}
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </div>
  );
}

function ModelsIntro() {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Models</h2>
      <p className="text-sm text-muted-foreground">
        Must be saved to{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          ~/.forge/config.json
        </code>{" "}
        for chat to work. Browser storage alone is not enough.
      </p>
    </div>
  );
}

export function SettingsPage() {
  const [form, setForm] = useState<LlmSettings>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const resolved = await resolveInitialForm();
      if (!cancelled) {
        setForm(resolved.form);
        setSyncNote(resolved.syncNote);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (key: keyof LlmSettings, value: string) => {
    setSaved(false);
    setError(null);
    setSyncNote(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSyncNote(null);
    try {
      if (
        !form.openaiCompatibleBaseUrl.trim() &&
        !form.openaiApiKey.trim() &&
        !form.anthropicApiKey.trim()
      ) {
        throw new Error(
          "Enter at least an OpenAI-compatible base URL (or an OpenAI/Anthropic API key)."
        );
      }
      saveLlmSettings(form);
      const persisted = await persistLlmSettingsToServer(form);
      setForm(persisted);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl space-y-8 px-6 py-10">
        <div className="space-y-3">
          <ForgeMarkLink to="/" size="sm" />
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        </div>
        <AppearanceSection />
        <ModelsIntro />
        <form onSubmit={(e) => void onSave(e)} className="space-y-6">
          <LlmSettingsFields form={form} onUpdate={update} />
          <SettingsSaveFooter
            saving={saving}
            saved={saved}
            syncNote={syncNote}
            error={error}
          />
        </form>
      </div>
    </div>
  );
}
