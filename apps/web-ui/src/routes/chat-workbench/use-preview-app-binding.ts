import { useState } from "react";
import type { AppStatus } from "../../lib/tool-runner.js";
import { apiBaseUrl } from "./api-explorer-model.js";
import { previewHrefFor } from "./preview-href.js";

export function usePreviewAppBinding(options: {
  active: AppStatus | undefined;
  appUrl: string;
  surface: "browser" | "api" | "none";
  setAddress: (v: string) => void;
  setHistory: (v: string[] | ((s: string[]) => string[])) => void;
  setHistIndex: (v: number) => void;
  setApiPath: (v: string) => void;
  setZoom: (v: number) => void;
  setCacheBust: (v: number | ((n: number) => number)) => void;
}) {
  const [boundApp, setBoundApp] = useState(options.active?.name ?? "");
  const previewHref = previewHrefFor({
    appUrl: options.appUrl,
    surface: options.surface,
    active: options.active
  });
  if (boundApp !== (options.active?.name ?? "")) {
    setBoundApp(options.active?.name ?? "");
    if (previewHref) {
      options.setAddress(previewHref);
      options.setHistory([previewHref]);
      options.setHistIndex(0);
      options.setApiPath("/");
    }
  }
  return previewHref;
}

export function usePreviewApiAddressSync(options: {
  surface: "browser" | "api" | "none";
  appUrl: string;
  active: AppStatus | undefined;
  apiPath: string;
  setAddress: (v: string) => void;
}) {
  const apiAddressKey = `${options.surface}:${options.appUrl}:${options.active?.hostPort ?? ""}:${options.active?.port ?? ""}:${options.apiPath}`;
  const [apiSyncKey, setApiSyncKey] = useState("");
  if (options.surface === "api" && apiSyncKey !== apiAddressKey) {
    setApiSyncKey(apiAddressKey);
    const raw = options.appUrl || apiBaseUrl(options.active ?? {});
    if (raw) {
      const base = raw.startsWith("http") ? raw : `http://${raw}/`;
      try {
        options.setAddress(new URL(options.apiPath || "/", base).href);
      } catch {
        options.setAddress(options.apiPath);
      }
    }
  }
}
