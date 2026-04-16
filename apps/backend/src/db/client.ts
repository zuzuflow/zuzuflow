import { PrismaClient } from "@prisma/client";
import { config } from "../config";

// =============================================================================
// Singleton PrismaClient
// In development, reuse the instance across hot reloads to avoid exhausting
// the connection pool.
// =============================================================================

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      config.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    datasources: {
      db: { url: config.DATABASE_URL },
    },
  });
}

export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (config.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

// Graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
