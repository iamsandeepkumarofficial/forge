import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";
import { ParameterRepository } from "../catalog/parameterRepository.js";
import { isLikelySecretKey } from "../projects/repoFacts.js";
import { emitSetupAgentEval } from "../services/eval/phoenix.js";

const KEY_RE = /^[A-Z][A-Z0-9_]*$/;

type ParameterItem = { key: string; value: string; secret?: boolean };

function parseParameterItems(
  args: Record<string, unknown>
): ParameterItem[] | { error: string } {
  const rawItems = args.items;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const items: ParameterItem[] = [];
    for (const raw of rawItems) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return { error: "each items[] entry must be { key, value, secret? }." };
      }
      const rec = raw as Record<string, unknown>;
      const key = typeof rec.key === "string" ? rec.key.trim() : "";
      const value = typeof rec.value === "string" ? rec.value : "";
      items.push({
        key,
        value,
        ...(typeof rec.secret === "boolean" ? { secret: rec.secret } : {})
      });
    }
    return items;
  }
  const key = typeof args.key === "string" ? args.key.trim() : "";
  if (!key) {
    return {
      error:
        "Provide key+value or a non-empty items array of { key, value, secret? }."
    };
  }
  return [
    {
      key,
      value: typeof args.value === "string" ? args.value : "",
      ...(typeof args.secret === "boolean" ? { secret: args.secret } : {})
    }
  ];
}

export async function executeUpsertWorkspaceParameter(options: {
  sessionId: string;
  args: Record<string, unknown>;
}): Promise<{
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
}> {
  const parsed = parseParameterItems(options.args);
  if ("error" in parsed) {
    return { success: false, output: parsed.error };
  }
  const invalid = parsed.find((item) => !item.key || !KEY_RE.test(item.key));
  if (invalid) {
    return {
      success: false,
      output: `key must be a non-empty ENV-style identifier (e.g. JWT_SECRET). Got \`${invalid.key || "(empty)"}\`.`
    };
  }
  const chatRepo = new ChatFeatureRepository();
  const chat = await chatRepo.getBySessionId(options.sessionId);
  if (!chat?.workspaceId) {
    return {
      success: false,
      output:
        "upsert_workspace_parameter is only available on workspace sessions."
    };
  }
  const paramRepo = new ParameterRepository();
  const upserted: Array<{ key: string; secret: boolean }> = [];
  for (const item of parsed) {
    const secret =
      typeof item.secret === "boolean"
        ? item.secret
        : isLikelySecretKey(item.key);
    await paramRepo.upsertWorkspaceParameter({
      workspaceId: chat.workspaceId,
      key: item.key,
      value: item.value,
      secret
    });
    upserted.push({ key: item.key, secret });
  }
  const keys = upserted.map((u) => u.key);
  void emitSetupAgentEval({
    sessionId: options.sessionId,
    workspaceId: chat.workspaceId,
    paramsUpserted: keys
  }).catch(() => undefined);
  const listed = keys.map((k) => `\`${k}\``).join(", ");
  const first = upserted[0]!;
  return {
    success: true,
    output:
      keys.length === 1
        ? `Upserted workspace parameter ${listed} (secret=${first.secret}). Value is injected on the next sandbox env refresh / new container.`
        : `Upserted ${keys.length} workspace parameters (${listed}). Values are injected on the next sandbox env refresh / new container.`,
    metadata: {
      key: first.key,
      secret: first.secret,
      keys
    }
  };
}
