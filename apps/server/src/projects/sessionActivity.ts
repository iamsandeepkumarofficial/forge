import { ChatFeatureRepository } from "../catalog/chatFeatureRepository.js";

const N_2 = 2;
const N_60 = 60;
const N_1000 = 1000;

export const SESSION_ACTIVITY_TOUCH_MS = N_2 * N_60 * N_1000;

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
