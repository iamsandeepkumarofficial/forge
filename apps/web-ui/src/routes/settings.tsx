import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export function SettingsPage() {
  const [form, setForm] = useState<LlmSettings>(EMPTY);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(loadLlmSettings());
  }, []);

  const update = (key: keyof LlmSettings, value: string) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    saveLlmSettings(form);
    setSaved(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl space-y-8 px-6 py-10">
        <div className="space-y-2">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Workspaces
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            LLM credentials are stored in this browser under{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              {LLM_SETTINGS_KEY}
            </code>
            . The desktop supervisor will sync them to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              ~/.forge/config.json
            </code>
            .
          </p>
          <p className="text-sm text-muted-foreground">
            Desktop: Connect local folder or git URL via the Forge desktop app.
          </p>
        </div>

        <form onSubmit={onSave} className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">OpenAI</legend>
            <div className="space-y-1.5">
              <Label htmlFor="openaiApiKey">API key</Label>
              <Input
                id="openaiApiKey"
                type="password"
                autoComplete="off"
                value={form.openaiApiKey}
                onChange={(e) => update("openaiApiKey", e.target.value)}
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
                onChange={(e) => update("anthropicApiKey", e.target.value)}
                placeholder="sk-ant-…"
              />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">
              OpenAI-compatible endpoint
            </legend>
            <div className="space-y-1.5">
              <Label htmlFor="openaiCompatibleBaseUrl">Base URL</Label>
              <Input
                id="openaiCompatibleBaseUrl"
                type="url"
                autoComplete="off"
                value={form.openaiCompatibleBaseUrl}
                onChange={(e) =>
                  update("openaiCompatibleBaseUrl", e.target.value)
                }
                placeholder="https://api.example.com/v1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="openaiCompatibleApiKey">API key</Label>
              <Input
                id="openaiCompatibleApiKey"
                type="password"
                autoComplete="off"
                value={form.openaiCompatibleApiKey}
                onChange={(e) =>
                  update("openaiCompatibleApiKey", e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="openaiCompatibleModel">Model</Label>
              <Input
                id="openaiCompatibleModel"
                type="text"
                autoComplete="off"
                value={form.openaiCompatibleModel}
                onChange={(e) =>
                  update("openaiCompatibleModel", e.target.value)
                }
                placeholder="gpt-4o-mini"
              />
            </div>
          </fieldset>

          <div className="flex items-center gap-3">
            <Button type="submit">Save</Button>
            {saved ? (
              <span className="text-sm text-muted-foreground">Saved</span>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
