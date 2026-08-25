import { useEffect, useState } from "react";
import { fetchModels, type LlmProvider } from "../lib/chat-agent.js";
import {
  ALL_PROVIDERS,
  type ComposerAgentMode
} from "../components/chat-composer.js";
import {
  AUTO_MODEL_KEY,
  AGENT_MODE_KEY,
  loadStoredAgentMode,
  loadStoredAutoModel,
  loadStoredModelMap,
  loadStoredProvider,
  MODE_KEY,
  MODEL_MAP_KEY,
  PROVIDER_KEY
} from "./chats-storage.js";

export function useChatsModelState() {
  const [provider, setProviderState] = useState<LlmProvider>(() =>
    loadStoredProvider()
  );
  const [modelByProvider, setModelByProvider] = useState<
    Record<string, string>
  >(() => loadStoredModelMap());
  const [modelsByProvider, setModelsByProvider] = useState<
    Partial<Record<LlmProvider, string[]>>
  >({});
  const [modelsLoading, setModelsLoading] = useState(true);
  const [autoModel, setAutoModelState] = useState(() => loadStoredAutoModel());
  const [agentMode, setAgentModeState] = useState<ComposerAgentMode>(() =>
    loadStoredAgentMode()
  );
  useChatsModelsCatalog({
    setModelsByProvider,
    setModelByProvider,
    setModelsLoading
  });
  return {
    provider,
    activeModel: modelByProvider[provider] ?? "",
    modelsByProvider,
    modelsLoading,
    autoModel,
    agentMode,
    setAgentMode: (mode: ComposerAgentMode) => {
      setAgentModeState(mode);
      persistAgentMode(mode);
    },
    setAutoModel: (auto: boolean) => {
      setAutoModelState(auto);
      persistAutoModel(auto);
    },
    onModelSelect: (p: LlmProvider, model: string) => {
      setProviderState(p);
      persistProvider(p);
      setAutoModelState(false);
      persistAutoModel(false);
      setModelByProvider((prev) => persistModelMap({ ...prev, [p]: model }));
    }
  };
}

function useChatsModelsCatalog(options: {
  setModelsByProvider: React.Dispatch<
    React.SetStateAction<Partial<Record<LlmProvider, string[]>>>
  >;
  setModelByProvider: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setModelsLoading: (value: boolean) => void;
}) {
  const { setModelsByProvider, setModelByProvider, setModelsLoading } = options;
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      ALL_PROVIDERS.map(async (p) => {
        try {
          return [p, await fetchModels(p)] as const;
        } catch {
          return [p, [] as string[]] as const;
        }
      })
    )
      .then((entries) => {
        if (cancelled) return;
        const next: Partial<Record<LlmProvider, string[]>> = {};
        for (const [p, ids] of entries) next[p] = ids;
        setModelsByProvider(next);
        setModelByProvider((prev) => syncDefaultModels(prev, entries));
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setModelsByProvider, setModelByProvider, setModelsLoading]);
}

function persistProvider(p: LlmProvider) {
  try {
    localStorage.setItem(PROVIDER_KEY, p);
  } catch {
    void 0;
  }
}

function persistAutoModel(auto: boolean) {
  try {
    localStorage.setItem(AUTO_MODEL_KEY, auto ? "1" : "0");
  } catch {
    void 0;
  }
}

function persistAgentMode(mode: ComposerAgentMode) {
  try {
    localStorage.setItem(AGENT_MODE_KEY, mode);
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    void 0;
  }
}

function persistModelMap(updated: Record<string, string>) {
  try {
    localStorage.setItem(MODEL_MAP_KEY, JSON.stringify(updated));
  } catch {
    void 0;
  }
  return updated;
}

function syncDefaultModels(
  prev: Record<string, string>,
  entries: ReadonlyArray<readonly [LlmProvider, string[]]>
): Record<string, string> {
  let changed = false;
  const updated = { ...prev };
  for (const [p, ids] of entries) {
    if (!updated[p]?.trim() && ids[0]) {
      updated[p] = ids[0];
      changed = true;
    }
  }
  return changed ? persistModelMap(updated) : prev;
}
