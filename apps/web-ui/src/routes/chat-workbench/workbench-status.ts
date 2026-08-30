import type { WorkbenchTurnStatus } from "./types.js";

export function deriveTurnStatus(options: {
  status: "ready" | "submitted" | "streaming" | "error";
  pendingAskUser: boolean;
}): WorkbenchTurnStatus {
  if (options.pendingAskUser) return "waiting";
  if (options.status === "submitted") return "thinking";
  if (options.status === "streaming") return "running";
  return "idle";
}
