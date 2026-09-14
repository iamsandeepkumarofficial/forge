import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;
export async function connectPostgres(): Promise<void> {
  if (pool) {
    return;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const nextPool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
  nextPool.on("error", (err) => {
    console.error("Unexpected database error:", err);
  });
  try {
    
    await nextPool.query("select 1");
  } catch (err) {
    await nextPool.end().catch(() => {});
    const nested =
      err instanceof AggregateError
        ? err.errors
            .map((e) => (e instanceof Error ? e.message : String(e)))
            .filter(Boolean)
            .join("; ")
        : "";
    const message =
      (err instanceof Error ? err.message.trim() : "") ||
      nested ||
      (err instanceof Error && "code" in err
        ? String((err as { code?: string }).code)
        : "connection failed");
    throw new Error(`PostgreSQL connect failed: ${message}`, { cause: err });
  }
  pool = nextPool;
  db = drizzle(pool, { schema });
}
export function getDb() {
  if (!db) {
    throw new Error(
      "PostgreSQL not initialized. Call connectPostgres() first."
    );
  }
  return db;
}
export async function closePostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
