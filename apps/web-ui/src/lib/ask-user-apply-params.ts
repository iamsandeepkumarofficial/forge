import { upsertWorkspaceParameter } from "./workspaces-api.js";
import {
  isWorkspaceParamFieldId,
  type AskUserField
} from "./ask-user.js";

/**
 * Persist ENV-shaped ask_user form fields to the workspace parameter store.
 * Action fields like provision_mongo are skipped (agent handles those).
 */
export async function applyAskUserFormToWorkspaceParams(
  workspaceId: string,
  fields: AskUserField[],
  values: Record<string, string>
): Promise<string[]> {
  const saved: string[] = [];
  for (const field of fields) {
    if (!isWorkspaceParamFieldId(field.id)) continue;
    const value = (values[field.id] ?? "").trim();
    if (!value) continue;
    await upsertWorkspaceParameter(workspaceId, {
      key: field.id,
      value,
      secret: field.secret === true
    });
    saved.push(field.id);
  }
  return saved;
}
