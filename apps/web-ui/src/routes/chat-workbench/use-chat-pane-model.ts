import { useState } from "react";
import type { ComposerAgentMode } from "../../components/chat-composer.js";
import type { ChatMode, LlmProvider } from "../../lib/chat-agent.js";
import {
  AUTO_MODEL_KEY,
  AGENT_MODE_KEY,
  MODE_KEY,
  MODEL_MAP_KEY,
  PROVIDER_KEY,
  loadStoredAgentMode,
  loadStoredAutoModel,
  loadStoredModelMap,
  loadStoredProvider
} from "./storage.js";
import { useChatPaneModelCatalog } from "./use-chat-pane-model-catalog.js";

export function useChatPaneModel() {
  const [provider, setProviderState] = useState<LlmProvider>(() =>
    loadStoredProvider()
  );
  const [modelByProvider, setModelByProvider] = useState<
    Record<string, string>
  >(() => loadStoredModelMap());
  const [autoModel, setAutoModelState] = useState(() => loadStoredAutoModel());
  const [agentMode, setAgentModeState] = useState<ComposerAgentMode>(() =>
    loadStoredAgentMode()
  );
  const activeModel = modelByProvider[provider] ?? "";
  const catalog = useChatPaneModelCatalog({
    provider,
    activeModel,
    setModelByProvider
  });
  const setProvider = (p: LlmProvider) => {
    setProviderState(p);
    try {
      localStorage.setItem(PROVIDER_KEY, p);
    } catch {
      void 0;
    }
  };
  const setAgentMode = (m: ComposerAgentMode) => {
    setAgentModeState(m);
    try {
      localStorage.setItem(AGENT_MODE_KEY, m);
      localStorage.setItem(MODE_KEY, m);
    } catch {
      void 0;
    }
  };
  const setAutoModel = (auto: boolean) => {
    setAutoModelState(auto);
    try {
      localStorage.setItem(AUTO_MODEL_KEY, auto ? "1" : "0");
    } catch {
      void 0;
    }
  };
  const mode: ChatMode = agentMode;
  const onModelSelect = (p: LlmProvider, m: string) => {
    setProvider(p);
    setModelByProvider((prev) => {
      const next = { ...prev, [p]: m };
      try {
        localStorage.setItem(MODEL_MAP_KEY, JSON.stringify(next));
      } catch {
        void 0;
      }
      return next;
    });
  };
  return {
    provider,
    setProvider,
    activeModel,
    modelsByProvider: catalog.modelsByProvider,
    modelsLoading: catalog.modelsLoading,
    autoModel,
    setAutoModel,
    agentMode,
    setAgentMode,
    contextWindow: catalog.contextWindow,
    maxOutputTokens: catalog.maxOutputTokens,
    mode,
    onModelSelect
  };
}
