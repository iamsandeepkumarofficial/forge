import { upsertWorkspaceParameter } from "./workspaces-api.js";
import { isWorkspaceParamFieldId, type AskUserField } from "./ask-user.js";

export async function applyAskUserFormToWorkspaceParams(options: {
  workspaceId: string;
  fields: AskUserField[];
  values: Record<string, string>;
}): Promise<string[]> {
  const saved: string[] = [];
  for (const field of options.fields) {
    if (!isWorkspaceParamFieldId(field.id)) continue;
    const value = (options.values[field.id] ?? "").trim();
    if (!value) continue;
    await upsertWorkspaceParameter(options.workspaceId, {
      key: field.id,
      value,
      secret: field.secret === true
    });
    saved.push(field.id);
  }
  return saved;
}
