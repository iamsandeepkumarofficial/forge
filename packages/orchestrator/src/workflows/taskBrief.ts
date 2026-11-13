const OUTPUT_SCHEMA_INSTRUCTIONS = [
  "When finished (after any tool use), you MUST produce a JSON object that is INSTANCE DATA matching this output schema.",
  "Do NOT return the schema itself. Do NOT include keys like schemaVersion, type, properties, required, or additionalProperties.",
  "Do NOT invent extra keys. Fill every required property with real values."
].join("\n");

const OPENING = {
  inline:
    "Continue this plan as the same agent — complete the next task inline.",
  child: "Complete this plan task as a focused sub-agent.",
  task: "Complete this plan task."
} as const;

export type TaskBriefVoice = keyof typeof OPENING;

export function buildTaskBrief(opts: {
  voice: TaskBriefVoice;
  goal?: string;
  sections?: Array<{ title: string; body: string }>;
  taskId?: string;
  description: string;
  rationale?: string;
  input?: unknown;
  outputSchema?: unknown;
}): string {
  const lines: string[] = [OPENING[opts.voice]];
  if (opts.goal) {
    lines.push(`Goal: ${opts.goal}`);
  }
  for (const section of opts.sections ?? []) {
    lines.push(`${section.title}: ${section.body}`);
  }
  if (opts.taskId) {
    lines.push(`Task id: ${opts.taskId}`);
  }
  lines.push(`Task: ${opts.description}`);
  if (opts.rationale) {
    lines.push(`Rationale: ${opts.rationale}`);
  }
  lines.push(`Input (JSON): ${JSON.stringify(opts.input ?? {})}`);
  if (opts.outputSchema) {
    lines.push(
      `${OUTPUT_SCHEMA_INSTRUCTIONS}\noutputSchema:\n${JSON.stringify(opts.outputSchema)}`
    );
  }
  return lines.join("\n\n");
}
