import { parseDuckDuckGoHtml } from "../providers/duckduckgo.js";
import { readWebSearchProviderConfig } from "../providers/resolve.js";
import type { WebSearchResult } from "../providers/types.js";
import { recordSearchMetrics, withPoolSlot } from "./pool.js";
import { fetchHtmlInWorker } from "./workerSandbox.js";

const N_8 = 8;

function formatResults(results: WebSearchResult[]): string {
  if (results.length === 0) {
    return "No search results found.";
  }
  return results
    .map((r) => {
      const snip = r.snippet ? `\n   ${r.snippet}` : "";
      return `${r.rank}. ${r.title}\n   ${r.url}${snip}`;
    })
    .join("\n\n");
}
export async function searchViaPool(
  query: string,
  maxResults = 5
): Promise<{
  success: boolean;
  output: string;
  metadata: Record<string, unknown>;
}> {
  const cfg = readWebSearchProviderConfig();
  const start = Date.now();
  try {
    const { results, workerId } = await withPoolSlot(async (worker) => {
      const base = (
        cfg.baseUrl?.replace(/\/$/, "") || "https://html.duckduckgo.com"
      ).replace(/\/html\/?$/, "");
      const url = `${base}/html/?q=${encodeURIComponent(query.trim())}`;
      const html = await fetchHtmlInWorker({
        containerName: worker.containerName,
        url
      });
      const parsed = parseDuckDuckGoHtml(
        html,
        Math.max(1, Math.min(N_8, maxResults))
      );
      return { results: parsed, workerId: worker.id };
    });
    recordSearchMetrics(Date.now() - start);
    return {
      success: true,
      output: formatResults(results),
      metadata: {
        provider: cfg.providerId || "duckduckgo",
        resultCount: results.length,
        workerId,
        results
      }
    };
  } catch (err) {
    recordSearchMetrics(Date.now() - start);
    let code =
      err && typeof err === "object" && "code" in err
        ? String(
            (
              err as {
                code: unknown;
              }
            ).code
          )
        : "provider";
    const message = err instanceof Error ? err.message : String(err);
    if (/abort|timeout|ETIMEDOUT/i.test(message)) code = "timeout";
    if (
      ![
        "disabled",
        "budget",
        "timeout",
        "overloaded",
        "parse",
        "provider",
        "ssrf"
      ].includes(code)
    ) {
      code = "provider";
    }
    return {
      success: false,
      output: `web_search failed: ${message}`,
      metadata: { provider: cfg.providerId || "duckduckgo", code }
    };
  }
}
