import type { AppStatus } from "../../lib/tool-runner.js";
import { apiBaseUrl } from "./api-explorer-model.js";

export function previewHrefFor(options: {
  appUrl: string;
  surface: "browser" | "api" | "none";
  active: AppStatus | undefined;
}): string {
  const fallbackUrl =
    options.appUrl ||
    (options.surface === "api" ? apiBaseUrl(options.active ?? {}) : "");
  if (!fallbackUrl) return "";
  return fallbackUrl.startsWith("http")
    ? fallbackUrl
    : `http://${fallbackUrl}/`;
}
