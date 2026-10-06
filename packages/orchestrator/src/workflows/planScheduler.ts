import {
  MAX_AGENTS_PER_INSTANCE,
  MAX_AGENTS_PER_RUN,
  readyTaskIds
} from "@forge/core";

export type SchedulableTask = {
  id: string;
  dependencies?: string[];
  status: string;
};

export type ScheduleDecision = {
  toStart: string[];
  blocked: string[];
  pendingExtra: string[];
  runSlotsUsed: number;
  instanceSlotsUsed: number;
};

export function scheduleReadyTasks(opts: {
  tasks: SchedulableTask[];
  completed: Set<string>;
  runningCount: number;
  instanceRunningCount: number;
  maxPerRun?: number;
  maxPerInstance?: number;
}): ScheduleDecision {
  const maxPerRun = opts.maxPerRun ?? MAX_AGENTS_PER_RUN;
  const maxPerInstance = opts.maxPerInstance ?? MAX_AGENTS_PER_INSTANCE;
  const ready = readyTaskIds(opts.tasks, opts.completed);
  const runSlots = Math.max(0, maxPerRun - opts.runningCount);
  const instanceSlots = Math.max(0, maxPerInstance - opts.instanceRunningCount);
  const slots = Math.min(runSlots, instanceSlots);
  const toStart = ready.slice(0, slots);
  const pendingExtra = ready.slice(slots);
  const blocked = opts.tasks
    .filter((t) => t.status === "pending" && !ready.includes(t.id))
    .map((t) => t.id);
  return {
    toStart,
    blocked,
    pendingExtra,
    runSlotsUsed: opts.runningCount + toStart.length,
    instanceSlotsUsed: opts.instanceRunningCount + toStart.length
  };
}
