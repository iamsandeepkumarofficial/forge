import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { ParameterRepository } from "../catalog/parameterRepository.js";
import { isLikelySecretKey } from "../projects/repoFacts.js";
import { emitSetupAgentEval } from "../services/eval/phoenix.js";

export async function executeUpsertWorkspaceParameter(options: {
  sessionId: string;
  args: Record<string, unknown>;
}): Promise<{ success: boolean; output: string; metadata?: Record<string, unknown> }> {
  const key = typeof options.args.key === "string" ? options.args.key.trim() : "";
  const value =
    typeof options.args.value === "string" ? options.args.value : "";
  if (!key || !/^[A-Z][A-Z0-9_]*$/.test(key)) {
    return {
      success: false,
      output: "key must be a non-empty ENV-style identifier (e.g. JWT_SECRET)."
    };
  }
  const chatRepo = new ChatFeatureRepository();
  const chat = await chatRepo.getBySessionId(options.sessionId);
  if (!chat?.workspaceId) {
    return {
      success: false,
      output: "upsert_workspace_parameter is only available on workspace sessions."
    };
  }
  const secret =
    typeof options.args.secret === "boolean"
      ? options.args.secret
      : isLikelySecretKey(key);
  const paramRepo = new ParameterRepository();
  await paramRepo.upsertWorkspaceParameter({
    workspaceId: chat.workspaceId,
    key,
    value,
    secret
  });
  void emitSetupAgentEval({
    sessionId: options.sessionId,
    workspaceId: chat.workspaceId,
    paramsUpserted: [key]
  }).catch(() => undefined);
  return {
    success: true,
    output: `Upserted workspace parameter \`${key}\` (secret=${secret}). Value is injected on the next sandbox env refresh / new container.`,
    metadata: { key, secret }
  };
}
