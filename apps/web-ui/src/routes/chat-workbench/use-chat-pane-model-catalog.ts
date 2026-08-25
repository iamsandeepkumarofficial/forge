import { useEffect, useState } from "react";
import { ALL_PROVIDERS } from "../../components/chat-composer.js";
import { fetchModels, type LlmProvider } from "../../lib/chat-agent.js";
import { MODEL_MAP_KEY } from "./storage.js";
import { useLoadedModelLimits } from "./use-loaded-model-limits.js";

export function useChatPaneModelCatalog(options: {
  provider: LlmProvider;
  activeModel: string;
  setModelByProvider: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
}) {
  const { provider, activeModel, setModelByProvider } = options;
  const [modelsByProvider, setModelsByProvider] = useState<
    Partial<Record<LlmProvider, string[]>>
  >({});
  const [modelsLoading, setModelsLoading] = useState(true);
  const limits = useLoadedModelLimits({ provider, activeModel });
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      ALL_PROVIDERS.map(async (p) => {
        try {
          const ids = await fetchModels(p);
          return [p, ids] as const;
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
        setModelByProvider((prev) => {
          let changed = false;
          const updated = { ...prev };
          for (const [p, ids] of entries) {
            if (!updated[p]?.trim() && ids[0]) {
              updated[p] = ids[0];
              changed = true;
            }
          }
          if (!changed) return prev;
          try {
            localStorage.setItem(MODEL_MAP_KEY, JSON.stringify(updated));
          } catch {
            void 0;
          }
          return updated;
        });
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setModelByProvider]);
  return {
    modelsByProvider,
    modelsLoading,
    contextWindow: limits.contextWindow,
    maxOutputTokens: limits.maxOutputTokens
  };
}
