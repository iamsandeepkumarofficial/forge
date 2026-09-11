export type ChatTurnSummary = {
  rounds: number;
  toolCallCount: number;
  toolNames: string[];
  hitRoundCap: boolean;
};

function isNonNegInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function parseChatTurnSummary(
  raw: unknown
): ChatTurnSummary | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const row = raw as Record<string, unknown>;
  if (!isNonNegInt(row.rounds) || !isNonNegInt(row.toolCallCount)) {
    return undefined;
  }
  if (
    !Array.isArray(row.toolNames) ||
    !row.toolNames.every((name) => typeof name === "string")
  ) {
    return undefined;
  }
  if (typeof row.hitRoundCap !== "boolean") return undefined;
  return {
    rounds: row.rounds,
    toolCallCount: row.toolCallCount,
    toolNames: row.toolNames,
    hitRoundCap: row.hitRoundCap
  };
}
