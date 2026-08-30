export type LeftPaneMode = "chat" | "files" | "changes" | "run";

export type WorkbenchTurnStatus = "idle" | "thinking" | "running" | "waiting";

export type SandboxStatus = "starting" | "ready" | "error";

export type WorkbenchChrome = {
  turnStatus: WorkbenchTurnStatus;
};

export interface FileTab {
  id: string;
  kind: "diff" | "file";
  repo?: string;
  path: string;
}

export type ViewerState = {
  title: string;
  kind: "diff" | "file";
  content: string;
  loading: boolean;
  error?: string;
};
