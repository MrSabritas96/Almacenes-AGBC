import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Conexión única a PostgreSQL con pool.
 * En desarrollo (HMR) se cachea en globalThis para no agotar conexiones.
 */
const globalForDb = globalThis as unknown as {
  __pgPool?: Pool;
};

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida. Copia .env.example a .env");
  }
  return new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export const pool = globalForDb.__pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__pgPool = pool;

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

export { schema };
export type DB = typeof db;
