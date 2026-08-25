import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;
export async function connectPostgres(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (pool) {
      resolve();
      return;
    }
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      reject(new Error("DATABASE_URL environment variable is not set"));
      return;
    }
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    pool.on("error", (err) => {
      console.error("Unexpected database error:", err);
    });
    db = drizzle(pool, { schema });
    resolve();
  });
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
