import "server-only";

import { PrismaClient } from "@prisma/client";

/**
 * Next dev mode reloads modules on every edit; without this global cache each
 * reload would open a new pool of SQLite connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
