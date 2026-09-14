export function liveMessagePrefix<T extends { id: string }>(
  liveRows: T[],
  fromMessageId: string
): T[] | null {
  const idx = liveRows.findIndex((row) => row.id === fromMessageId);
  if (idx < 0) return null;
  return liveRows.slice(0, idx);
}

export function idsFromMessageOnward<T extends { id: string }>(
  liveRows: T[],
  fromMessageId: string
): string[] | null {
  const idx = liveRows.findIndex((row) => row.id === fromMessageId);
  if (idx < 0) return null;
  return liveRows.slice(idx).map((row) => row.id);
}
