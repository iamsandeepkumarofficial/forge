import type { User } from "@forge/db";
import { CatalogRepository } from "./repository.js";

/** Single-user local identity (RFC 0004). */
export const LOCAL_USER_EMAIL = "local@forge";

const catalog = new CatalogRepository();
let cached: User | null = null;

export async function getLocalUser(): Promise<User> {
  if (cached) {
    return cached;
  }
  cached = await catalog.getOrCreateUser(LOCAL_USER_EMAIL);
  return cached;
}

/** Test helper — clear cached singleton between tests. */
export function resetLocalUserCache(): void {
  cached = null;
}
