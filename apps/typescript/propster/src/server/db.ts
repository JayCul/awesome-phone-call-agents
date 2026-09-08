import "server-only";

import { PrismaClient } from "@prisma/client";

/**
 * Connection errors that mean "the database is asleep", not "the query is
 * wrong". Serverless Postgres scales its compute to zero when idle, and the
 * first request after that can arrive before it has finished waking.
 */
const WAKING_UP = /P1001|P1017|Can't reach database server|Connection terminated|ECONNRESET/i;

/** Back-off between attempts while the compute resumes. */
const RETRY_DELAYS_MS = [250, 750, 1500, 3000];

/**
 * Build the client, retrying queries that fail only because the database was
 * still waking.
 *
 * Neon suspends an idle compute and takes a moment to resume, so the first
 * query after a quiet period fails outright. Without this a visitor arriving at
 * a cold deployment sees an error page, which for a demo is the worst possible
 * moment. Only connection failures are retried: a genuine query error is raised
 * immediately rather than being tried four more times.
 */
function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        for (let attempt = 0; ; attempt += 1) {
          try {
            return await query(args);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const code = typeof error === "object" && error !== null && "code" in error
              ? String((error as { code: unknown }).code)
              : "";

            const isWaking = WAKING_UP.test(message) || WAKING_UP.test(code);
            const delay = RETRY_DELAYS_MS[attempt];
            if (!isWaking || delay === undefined) throw error;

            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      },
    },
  });
}

/**
 * Next dev mode reloads modules on every edit; without this global cache each
 * reload would open a new pool of connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
