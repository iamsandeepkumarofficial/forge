export function livePrefixThrough<T extends { id: string }>(
  rows: T[],
  untilMessageId: string
): T[] | null {
  const idx = rows.findIndex((row) => row.id === untilMessageId);
  if (idx < 0) return null;
  return rows.slice(0, idx + 1);
}

export function orderedTurnIds(
  rows: Array<{ turnId?: string | null }>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const id = row.turnId?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function mappedTurnId(
  turnId: string | null | undefined,
  map: ReadonlyMap<string, string>
): string | null {
  if (!turnId) return null;
  return map.get(turnId) ?? null;
}
