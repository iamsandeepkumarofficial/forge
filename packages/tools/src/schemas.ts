import { z } from "zod";
import { AGENT_MODE_IDS } from "@forge/core";

const N_8 = 8;

export const createSubtaskInputSchema = z.object({
  title: z.string(),
  type: z.enum(["feature", "bug", "refactor"]).optional()
});
export type CreateSubtaskInput = z.infer<typeof createSubtaskInputSchema>;

export const readFileInputSchema = z.object({ path: z.string() });
export type ReadFileInput = z.infer<typeof readFileInputSchema>;

const MAX_FILE_TOOL_BATCH = 20;

export const writeFileEntrySchema = z.object({
  path: z.string(),
  content: z.string()
});
export const writeFileInputSchema = z.object({
  files: z.array(writeFileEntrySchema).min(1).max(MAX_FILE_TOOL_BATCH)
});
export type WriteFileInput = z.infer<typeof writeFileInputSchema>;

export const editFileEntrySchema = z.object({
  path: z.string(),
  oldString: z.string(),
  newString: z.string(),
  replaceAll: z.boolean().optional()
});
export const editFileInputSchema = z.object({
  files: z.array(editFileEntrySchema).min(1).max(MAX_FILE_TOOL_BATCH)
});
export type EditFileInput = z.infer<typeof editFileInputSchema>;

export const deleteFilesInputSchema = z.object({
  paths: z.array(z.string()).min(1).max(MAX_FILE_TOOL_BATCH)
});
export type DeleteFilesInput = z.infer<typeof deleteFilesInputSchema>;

export const moveFilesInputSchema = z.object({
  moves: z
    .array(z.object({ from: z.string(), to: z.string() }))
    .min(1)
    .max(MAX_FILE_TOOL_BATCH)
});
export type MoveFilesInput = z.infer<typeof moveFilesInputSchema>;

export const listFilesInputSchema = z.object({});
export type ListFilesInput = z.infer<typeof listFilesInputSchema>;

export const searchCodebaseInputSchema = z.object({ pattern: z.string() });
export type SearchCodebaseInput = z.infer<typeof searchCodebaseInputSchema>;

export const runTerminalInputSchema = z.object({
  command: z.string().optional(),
  workingDirectory: z.string().optional(),
  background: z.boolean().optional(),
  jobName: z.string().optional(),
  action: z.enum(["run", "logs", "status", "stop"]).optional(),
  tail: z.number().optional()
});
export type RunTerminalInput = z.infer<typeof runTerminalInputSchema>;

export const previewStartInputSchema = z.object({
  name: z.string().optional()
});
export type PreviewStartInput = z.infer<typeof previewStartInputSchema>;

export const previewStopInputSchema = z.object({ name: z.string() });
export type PreviewStopInput = z.infer<typeof previewStopInputSchema>;

export const previewLogsInputSchema = z.object({
  name: z.string().optional(),
  tail: z.number().optional()
});
export type PreviewLogsInput = z.infer<typeof previewLogsInputSchema>;

export const previewStatusInputSchema = z.object({
  name: z.string().optional()
});
export type PreviewStatusInput = z.infer<typeof previewStatusInputSchema>;

export const upsertLaunchAppInputSchema = z.object({
  name: z.string(),
  cwd: z
    .string()
    .describe(
      "App working directory. In workspaces, start with the member repo (e.g. bp-frontend or bp-frontend/apps/web)."
    ),
  command: z.string(),
  type: z.enum(["web", "api", "worker"]),
  repo: z
    .string()
    .optional()
    .describe(
      "Workspace member repo name (optional if cwd starts with the member name)."
    ),
  port: z
    .number()
    .optional()
    .describe(
      "Container listen port. Must be 3000–3009 (only those are published). Prefer 3000 for the first web app."
    )
});
export type UpsertLaunchAppInput = z.infer<typeof upsertLaunchAppInputSchema>;

export const listSkillsInputSchema = z.object({});
export type ListSkillsInput = z.infer<typeof listSkillsInputSchema>;

export const invokeSkillInputSchema = z.object({ skillId: z.string() });
export type InvokeSkillInput = z.infer<typeof invokeSkillInputSchema>;

export const upsertWorkspaceParameterItemSchema = z.object({
  key: z.string().describe("ENV-style key, e.g. JWT_SECRET"),
  value: z.string(),
  secret: z.boolean().optional()
});

export const upsertWorkspaceParameterInputSchema = z
  .object({
    key: z.string().optional(),
    value: z.string().optional(),
    secret: z.boolean().optional(),
    items: z.array(upsertWorkspaceParameterItemSchema).min(1).optional()
  })
  .superRefine((val, ctx) => {
    const hasItems = Array.isArray(val.items) && val.items.length > 0;
    const hasSingle =
      typeof val.key === "string" &&
      val.key.length > 0 &&
      typeof val.value === "string";
    if (hasItems === hasSingle) {
      ctx.addIssue({
        code: "custom",
        message:
          "Provide either key+value or a non-empty items array, not both."
      });
    }
  });
export type UpsertWorkspaceParameterInput = z.infer<
  typeof upsertWorkspaceParameterInputSchema
>;

export const getWorkspaceHealthInputSchema = z.object({});
export type GetWorkspaceHealthInput = z.infer<
  typeof getWorkspaceHealthInputSchema
>;

export const setupProjectInfraInputSchema = z.object({
  engineId: z.enum(["postgres", "mongo"]),
  userApproved: z
    .boolean()
    .describe("Must be true only after the user explicitly approved.")
});
export type SetupProjectInfraInput = z.infer<
  typeof setupProjectInfraInputSchema
>;

export const installProjectInfraInputSchema = z.object({
  dependencyId: z
    .string()
    .describe(
      "Installable dependency id from the adapter registry (e.g. node, mongo, postgres). Use node + version for Node — never node-20."
    ),
  userApproved: z
    .boolean()
    .describe("Must be true only after the user explicitly approved."),
  version: z
    .string()
    .optional()
    .describe(
      "Optional version or major (e.g. 20, 20.20.2, or an engines range). Required for toolchain pins."
    )
});
export type InstallProjectInfraInput = z.infer<
  typeof installProjectInfraInputSchema
>;

export const dockerImageLookupInputSchema = z.object({
  query: z.string().optional(),
  engineId: z.enum(["postgres", "mongo"]).optional()
});
export type DockerImageLookupInput = z.infer<
  typeof dockerImageLookupInputSchema
>;

export const webSearchInputSchema = z.object({
  query: z.string(),
  maxResults: z.number().int().min(1).max(N_8).optional()
});
export type WebSearchInput = z.infer<typeof webSearchInputSchema>;

export const webFetchInputSchema = z.object({ url: z.string() });
export type WebFetchInput = z.infer<typeof webFetchInputSchema>;

export const switchModeInputSchema = z.object({
  target: z.enum(AGENT_MODE_IDS)
});
export type SwitchModeInput = z.infer<typeof switchModeInputSchema>;

export const askUserOptionSchema = z.object({
  id: z.string(),
  label: z.string()
});
export const askUserFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  secret: z.boolean().optional(),
  placeholder: z.string().optional(),
  value: z.string().optional(),
  group: z.string().optional(),
  type: z.enum(["text", "secret", "boolean"]).optional()
});
export const askUserInputSchema = z.object({
  kind: z.enum(["mcq", "form"]),
  prompt: z.string(),
  options: z.array(askUserOptionSchema).optional(),
  fields: z.array(askUserFieldSchema).optional()
});
export type AskUserInput = z.infer<typeof askUserInputSchema>;
