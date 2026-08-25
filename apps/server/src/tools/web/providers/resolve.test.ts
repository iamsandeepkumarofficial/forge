import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  readWebSearchProviderConfig,
  resolveSearchProvider
} from "./resolve.js";

const KEYS = [
  "WEB_SEARCH_PROVIDER",
  "WEB_SEARCH_BASE_URL",
  "WEB_SEARCH_API_KEY"
] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

describe("web search provider resolve", () => {
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      const v = saved[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("defaults to duckduckgo with optional overrides", () => {
    assert.deepEqual(readWebSearchProviderConfig(), {
      providerId: "duckduckgo",
      baseUrl: undefined,
      apiKey: undefined
    });
    process.env.WEB_SEARCH_PROVIDER = " DuckDuckGo ";
    process.env.WEB_SEARCH_BASE_URL = " https://html.duckduckgo.com ";
    process.env.WEB_SEARCH_API_KEY = " secret ";
    assert.deepEqual(readWebSearchProviderConfig(), {
      providerId: "duckduckgo",
      baseUrl: "https://html.duckduckgo.com",
      apiKey: "secret"
    });
  });

  it("resolveSearchProvider returns a duckduckgo SearchProvider", async () => {
    const provider = resolveSearchProvider({
      providerId: "duckduckgo",
      baseUrl: "https://html.duckduckgo.com"
    });
    assert.equal(typeof provider.search, "function");
  });

  it("falls back to duckduckgo for unimplemented provider ids", () => {
    const provider = resolveSearchProvider({
      providerId: "bing",
      baseUrl: undefined,
      apiKey: undefined
    });
    assert.equal(typeof provider.search, "function");
  });
});
