import type { AppStatus } from "../../lib/tool-runner.js";
import {
  goPreviewHistory,
  submitPreviewAddress
} from "./preview-history-mutations.js";

export function previewHistoryActions(options: {
  address: string;
  appUrl: string;
  active: AppStatus | undefined;
  surface: "browser" | "api" | "none";
  history: string[];
  histIndex: number;
  setAddress: (v: string) => void;
  setHistory: (v: string[] | ((s: string[]) => string[])) => void;
  setHistIndex: (v: number) => void;
  setApiPath: (v: string) => void;
}) {
  return {
    submitAddress: (typed = options.address) =>
      submitPreviewAddress({ ...options, typed }),
    goHistory: (index: number) =>
      goPreviewHistory({
        index,
        history: options.history,
        surface: options.surface,
        setHistIndex: options.setHistIndex,
        setAddress: options.setAddress,
        setApiPath: options.setApiPath
      })
  };
}
