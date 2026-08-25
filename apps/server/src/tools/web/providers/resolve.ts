import { createDuckDuckGoProvider } from "./duckduckgo.js";
import type { SearchProvider, WebSearchProviderConfig } from "./types.js";
export function readWebSearchProviderConfig(): WebSearchProviderConfig {
  return {
    providerId: (
      process.env.WEB_SEARCH_PROVIDER?.trim() || "duckduckgo"
    ).toLowerCase(),
    baseUrl: process.env.WEB_SEARCH_BASE_URL?.trim() || undefined,
    apiKey: process.env.WEB_SEARCH_API_KEY?.trim() || undefined
  };
}
export function resolveSearchProvider(
  config = readWebSearchProviderConfig()
): SearchProvider {
  const id = config.providerId || "duckduckgo";
  if (id !== "duckduckgo") {
    console.warn(
      `[web] WEB_SEARCH_PROVIDER="${id}" not implemented yet — using duckduckgo with optional baseUrl`
    );
  }
  return createDuckDuckGoProvider({ baseUrl: config.baseUrl });
}
