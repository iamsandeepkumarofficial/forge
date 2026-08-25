import type { SearchProvider, WebSearchResult } from "./types.js";

const N_12000 = 12000;
const N_1500000 = 1500000;
const N_200 = 200;

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
export function parseDuckDuckGoHtml(
  html: string,
  maxResults: number
): WebSearchResult[] {
  const capped = html.length > N_1500000 ? html.slice(0, N_1500000) : html;
  const results: WebSearchResult[] = [];
  const blockRe =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(capped)) !== null && results.length < maxResults) {
    let url = m[1] ?? "";
    const title = decodeBasicEntities(m[2] ?? "");
    try {
      const u = new URL(url, "https://duckduckgo.com");
      const uddg = u.searchParams.get("uddg");
      if (uddg) url = decodeURIComponent(uddg);
      else url = u.href;
    } catch {
      void 0;
    }
    if (!/^https?:\/\//i.test(url)) continue;
    results.push({
      rank: results.length + 1,
      title: title || url,
      url,
      snippet: ""
    });
  }
  const snipRe =
    /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<td[^>]+class="[^"]*result-snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;
  let si = 0;
  while ((m = snipRe.exec(capped)) !== null && si < results.length) {
    const snip = decodeBasicEntities(m[1] || m[2] || "");
    if (snip && results[si]) results[si]!.snippet = snip;
    si += 1;
  }
  return results.slice(0, maxResults);
}
export function createDuckDuckGoProvider(opts?: {
  baseUrl?: string;
  fetchHtml?: (url: string) => Promise<string>;
}): SearchProvider {
  const base = (
    opts?.baseUrl?.replace(/\/$/, "") || "https://html.duckduckgo.com"
  ).replace(/\/html\/?$/, "");
  const fetchHtml =
    opts?.fetchHtml ??
    (async (url: string) => {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), N_12000);
      try {
        const res = await fetch(url, {
          signal: ac.signal,
          headers: {
            "User-Agent":
              "ForgeAgentWebSearch/1.0 (+https://localhost; research bot)",
            Accept: "text/html"
          },
          redirect: "follow"
        });
        if (!res.ok) {
          throw Object.assign(new Error(`DuckDuckGo HTTP ${res.status}`), {
            code: "provider" as const
          });
        }
        return await res.text();
      } finally {
        clearTimeout(t);
      }
    });
  return {
    id: "duckduckgo",
    async search(
      query: string,
      maxResults: number
    ): Promise<WebSearchResult[]> {
      const q = query.trim();
      if (!q) {
        throw Object.assign(new Error("empty query"), {
          code: "provider" as const
        });
      }
      const url = `${base}/html/?q=${encodeURIComponent(q)}`;
      const html = await fetchHtml(url);
      const results = parseDuckDuckGoHtml(html, maxResults);
      if (results.length === 0 && html.length < N_200) {
        throw Object.assign(
          new Error("DuckDuckGo returned empty/unparseable page"),
          {
            code: "parse" as const
          }
        );
      }
      return results;
    }
  };
}
