import { emptyObjectSchema, type WorkflowPlanDraft } from "@forge/core";

const schema = emptyObjectSchema();

export function withSchemas(
  draft: Omit<WorkflowPlanDraft, "tasks"> & {
    tasks: Array<
      Omit<WorkflowPlanDraft["tasks"][number], "inputSchema" | "outputSchema"> &
        Partial<
          Pick<
            WorkflowPlanDraft["tasks"][number],
            "inputSchema" | "outputSchema" | "inputMappings"
          >
        >
    >;
  }
): WorkflowPlanDraft {
  return {
    ...draft,
    tasks: draft.tasks.map((t) => ({
      ...t,
      inputSchema: t.inputSchema ?? schema,
      outputSchema: t.outputSchema ?? schema
    }))
  };
}
