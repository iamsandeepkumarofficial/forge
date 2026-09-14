import type { AppStatus } from "../../lib/tool-runner.js";
import type { PreviewPick } from "./preview-nav.js";
import type { ShotRect } from "./preview-overflow.js";
import type {
  PreviewNavInfo,
  PreviewPickResult
} from "../../lib/desktop-preview.js";
import type { RefObject } from "react";

export type WebPreviewContentProps = {
  sessionId: string;
  apps: AppStatus[];
  active: AppStatus | undefined;
  surface: "browser" | "api" | "none";
  webRunningNoUrl: AppStatus[];
  appUrl: string;
  apiPath: string;
  setApiPath: (path: string) => void;
  onOpenRun?: () => void;
  iframeBoxRef: RefObject<HTMLDivElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  pick: PreviewPick | null;
  electron: boolean;
  loadedUrl: string;
  zoom: number;
  reloadNonce: number;
  cacheBust: number;
  commenting: boolean;
  showBrowser: boolean;
  cropping: boolean;
  iframeSrc: string;
  committedUrl: string;
  onPreviewNavigated: (info: PreviewNavInfo) => void;
  onPreviewPick: (result: PreviewPickResult) => void;
  setCropping: (v: boolean) => void;
  takeShot: (rect?: ShotRect) => Promise<void>;
};
