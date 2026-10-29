import "server-only";
import { Pool } from "pg";

// Reuse the pool during development reloads.
// Each deployed server instance has its own pool.
const globalForDb = globalThis as typeof globalThis & {
    paycheckPool?: Pool;
};

/** Return the server's reusable Postgres pool; schema changes belong in migrations. */
export function getDb(): Pool {
    if (!globalForDb.paycheckPool) {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            throw new Error("DATABASE_URL is not configured.");
        }

        const pool = new Pool({
            connectionString,
            max: 2,
            connectionTimeoutMillis: 10_000,
            idleTimeoutMillis: 30_000,
        });

        pool.on("error", () => {
            console.error("An idle database connection failed.");
        });

        globalForDb.paycheckPool = pool;
    }

    return globalForDb.paycheckPool;
}
