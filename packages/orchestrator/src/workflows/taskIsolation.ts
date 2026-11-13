import type { TaskIsolation } from "@forge/core";
import type { TaskState } from "./agentWorkflowModel.js";

export function userRequestsSubAgents(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\bsub[-\s]?agents?\b/.test(t) ||
    /\bparallel agents?\b/.test(t) ||
    /\buse sub[-\s]?agent/.test(t) ||
    /\bfan[-\s]?out\b/.test(t)
  );
}

export function effectiveIsolation(opts: {
  task: Pick<TaskState, "executor" | "isolation">;
  forceChildIsolation?: boolean;
}): TaskIsolation {
  if (opts.task.executor !== "agent") {
    return "inline";
  }
  if (opts.task.isolation === "child" || opts.task.isolation === "inline") {
    return opts.task.isolation;
  }
  return opts.forceChildIsolation ? "child" : "inline";
}
