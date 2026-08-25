import { useEffect, useState } from "react";
import {
  fetchModelTokenLimits,
  type LlmProvider
} from "../../lib/chat-agent.js";

export function useLoadedModelLimits(options: {
  provider: LlmProvider;
  activeModel: string;
}) {
  const { provider, activeModel } = options;
  const [loadedLimits, setLoadedLimits] = useState<{
    key: string;
    contextWindow: number | null;
    maxOutputTokens: number | null;
  }>({ key: "", contextWindow: null, maxOutputTokens: null });
  const modelKey = `${provider}:${activeModel}`;
  useEffect(() => {
    if (!activeModel.trim()) return;
    let cancelled = false;
    void fetchModelTokenLimits(provider, activeModel).then((limits) => {
      if (!cancelled) {
        setLoadedLimits({
          key: modelKey,
          contextWindow: limits.contextWindow,
          maxOutputTokens: limits.maxOutputTokens
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [provider, activeModel, modelKey]);
  const matched = loadedLimits.key === modelKey && !!activeModel.trim();
  return {
    contextWindow: matched ? loadedLimits.contextWindow : null,
    maxOutputTokens: matched ? loadedLimits.maxOutputTokens : null
  };
}
