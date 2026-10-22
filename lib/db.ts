/**
 * db.ts
 * PostgreSQL client for jev-chess.
 * Single pooled connection shared across the server (Next.js App Router).
 * Falls back gracefully if DATABASE_URL is not set (local dev without DB).
 */

import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      // eslint-disable-next-line no-console
      console.warn("[jev-chess] DATABASE_URL not set — database disabled (dev mode)");
      pool = new Pool({ connectionString: "" }) as unknown as Pool;
    } else {
      pool = new Pool({
        connectionString: url,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      pool.on("error", (err: Error) => {
        // eslint-disable-next-line no-console
        console.error("[jev-chess] unexpected postgres client error", err);
      });
    }
  }
  return pool;
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const p = getPool();
  const client = await p.connect();
  try {
    const res = await client.query(text, params);
    return res.rows as unknown as T[];
  } finally {
    client.release();
  }
}

export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
