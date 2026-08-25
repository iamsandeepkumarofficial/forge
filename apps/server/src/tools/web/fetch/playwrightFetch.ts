import { getSessionSandboxStatus } from "../../../projects/sessionSandbox.js";
import { assertPublicHttpUrl } from "../ssrf.js";
import {
  fetchWithCurlFallback,
  fetchWithPlaywright,
  playwrightAvailable
} from "./playwrightFetchHelpers.js";

export async function playwrightFetchInSession(
  sessionId: string,
  url: string
): Promise<{
  success: boolean;
  output: string;
  metadata: Record<string, unknown>;
}> {
  try {
    await assertPublicHttpUrl(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      output: `web_fetch failed: ${message}`,
      metadata: { url, code: "ssrf" }
    };
  }
  const status = await getSessionSandboxStatus(sessionId);
  if (status.status === "absent" || !status.running) {
    return {
      success: false,
      output: "web_fetch failed: session sandbox not available",
      metadata: { url, code: "no_sandbox", sessionId }
    };
  }
  if (await playwrightAvailable(sessionId)) {
    return fetchWithPlaywright({ sessionId, url });
  }
  return fetchWithCurlFallback({ sessionId, url });
}
