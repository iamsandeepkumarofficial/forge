export type LeftTab = "chat" | "files" | "changes" | "run";
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
