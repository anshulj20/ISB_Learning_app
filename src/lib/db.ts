import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Local-first: SQLite via the better-sqlite3 driver adapter (Prisma 7
// requires an adapter for runtime queries even though the CLI's own
// migrate/generate commands work off the plain `url` in prisma.config.ts).
// See PROJECT_SPEC.md — "Tech stack & architecture" for why SQLite over
// Postgres here (single-user, fully local, no server to run).

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

// Reuse a single client across Next.js dev-server hot reloads so we don't
// open a fresh SQLite connection (and file handle) on every edit.
export const db = globalThis.prismaGlobal ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = db;
}
