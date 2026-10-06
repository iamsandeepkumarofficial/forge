export type LeftPaneMode = "chat" | "files" | "changes" | "run" | "help";

export type WorkbenchTurnStatus = "idle" | "thinking" | "running" | "waiting";

export type SandboxStatus = "starting" | "ready" | "error";

export type WorkbenchChrome = {
  turnStatus: WorkbenchTurnStatus;
};

export type FileTab =
  | { id: string; kind: "file"; path: string; repo?: string }
  | { id: string; kind: "diff"; path: string; repo?: string }
  | { id: string; kind: "plan"; path: string; repo?: string };

export type ViewerState = {
  title: string;
  kind: "diff" | "file";
  content: string;
  loading: boolean;
  error?: string;
};
