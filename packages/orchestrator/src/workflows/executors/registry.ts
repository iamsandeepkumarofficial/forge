import type { TaskExecutor as TaskExecutorKind } from "@forge/core";
import type { TaskExecutor } from "./types.js";

export class ExecutorRegistry {
  private readonly executors = new Map<string, TaskExecutor>();

  register(kind: TaskExecutorKind | string, executor: TaskExecutor): this {
    this.executors.set(kind, executor);
    return this;
  }

  get(kind: string): TaskExecutor | undefined {
    return this.executors.get(kind);
  }

  has(kind: string): boolean {
    return this.executors.has(kind);
  }
}
