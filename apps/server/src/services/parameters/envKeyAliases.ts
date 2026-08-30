/** Env keys that commonly mean the same connection in app configs. */
const ENV_KEY_ALIASES: Record<string, readonly string[]> = {
  MONGODB_URL: ["MONGODB_URI"],
  MONGODB_URI: ["MONGODB_URL"],
  DATABASE_URL: ["POSTGRESDB_URL", "POSTGRES_URL"],
  POSTGRESDB_URL: ["DATABASE_URL", "POSTGRES_URL"],
  POSTGRES_URL: ["DATABASE_URL", "POSTGRESDB_URL"]
};

export function envKeyAliases(key: string): readonly string[] {
  return ENV_KEY_ALIASES[key] ?? [];
}

/** True if `key` or any known alias is present in `availableKeys`. */
export function envKeySatisfied(
  availableKeys: ReadonlySet<string>,
  key: string
): boolean {
  if (availableKeys.has(key)) return true;
  return envKeyAliases(key).some((alias) => availableKeys.has(alias));
}
