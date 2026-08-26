/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TOOL_RUNNER_URL: string;
  readonly VITE_FORGE_AGENT_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
