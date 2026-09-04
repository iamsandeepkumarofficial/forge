import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";


export const SESSION_ACTIVITY_TOUCH_MS = 2 * 60 * 1000;

const lastTouch = new Map<string, number>();

export function resetSessionActivityTouches(): void {
  lastTouch.clear();
}

export async function touchSessionActivity(
  sessionId: string,
  options?: { force?: boolean; now?: number }
): Promise<boolean> {
  const id = sessionId.trim();
  if (!id) return false;
  const now = options?.now ?? Date.now();
  if (!options?.force) {
    const prev = lastTouch.get(id) ?? 0;
    if (now - prev < SESSION_ACTIVITY_TOUCH_MS) return false;
  }
  lastTouch.set(id, now);
  const repo = new ChatFeatureRepository();
  const chat = await repo.getBySessionId(id);
  if (!chat) return false;
  await repo.updateLastActivity(chat.id);
  return true;
}
