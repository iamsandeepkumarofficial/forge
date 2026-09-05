import { apiBaseUrl } from "./api-explorer-model.js";
import {
  pathFromPreviewUrl,
  pushPreviewHistory,
  resolvePreviewNavigation
} from "./preview-nav.js";
import type { AppStatus } from "../../lib/tool-runner.js";

export function submitPreviewAddress(options: {
  typed: string;
  address: string;
  appUrl: string;
  active: AppStatus | undefined;
  surface: "browser" | "api" | "none";
  history: string[];
  histIndex: number;
  setAddress: (v: string) => void;
  setHistory: (v: string[]) => void;
  setHistIndex: (v: number) => void;
  setApiPath: (v: string) => void;
}): void {
  const base =
    options.appUrl ||
    (options.surface === "api" ? apiBaseUrl(options.active ?? {}) : "");
  if (!base) return;
  const next = resolvePreviewNavigation(
    base.startsWith("http") ? base : `http://${base}/`,
    options.typed
  );
  if (!next) {
    if (options.appUrl) options.setAddress(options.appUrl);
    return;
  }
  options.setAddress(next);
  const moved = pushPreviewHistory(options.history, {
    index: options.histIndex,
    next
  });
  options.setHistory(moved.stack);
  options.setHistIndex(moved.index);
  if (options.surface === "api") {
    options.setApiPath(pathFromPreviewUrl(next));
  }
}

export function goPreviewHistory(options: {
  index: number;
  history: string[];
  surface: "browser" | "api" | "none";
  setHistIndex: (v: number) => void;
  setAddress: (v: string) => void;
  setApiPath: (v: string) => void;
}): void {
  const url = options.history[options.index];
  if (!url) return;
  options.setHistIndex(options.index);
  options.setAddress(url);
  if (options.surface === "api") {
    options.setApiPath(pathFromPreviewUrl(url));
  }
}
