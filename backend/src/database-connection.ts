import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

export type DatabaseTransport = "tcp" | "neon";

export function databaseConnection(env: NodeJS.ProcessEnv = process.env) {
  if (!env.DATABASE_URL?.trim()) return null;
  const url = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error("DATABASE_URL must be a PostgreSQL connection string.");
  const requested = env.DATABASE_TRANSPORT?.trim().toLowerCase() || "auto";
  if (!["auto", "tcp", "neon"].includes(requested)) throw new Error("DATABASE_TRANSPORT must be auto, tcp or neon.");
  const isNeon = url.hostname.endsWith(".neon.tech");
  if (requested === "neon" && !isNeon) throw new Error("The Neon transport requires a Neon database hostname.");
  const transport: DatabaseTransport = requested === "neon" || (requested === "auto" && isNeon) ? "neon" : "tcp";
  if (transport === "tcp") {
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "10");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "10");
  }
  return { url: url.href, host: url.hostname, database: decodeURIComponent(url.pathname.slice(1)), transport };
}

export function createDatabaseClient(env: NodeJS.ProcessEnv = process.env): PrismaClient | null {
  const connection = databaseConnection(env);
  if (!connection) return null;
  if (connection.transport === "neon") {
    // Neon uses encrypted WebSockets on 443 rather than blocked PostgreSQL TCP.
    return new PrismaClient({ adapter: new PrismaNeon({
      connectionString: connection.url,
      connectionTimeoutMillis: 10_000,
      query_timeout: 10_000,
      max: 5,
    }) });
  }
  return new PrismaClient({ datasources: { db: { url: connection.url } } });
}

export function describeDatabaseFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/DATABASE_URL must|DATABASE_TRANSPORT must|Neon transport requires|Invalid URL/i.test(message)) {
    return "Database connection settings are invalid. Check DATABASE_URL and DATABASE_TRANSPORT in the root .env.";
  }
  if (/password authentication|authentication failed|P1000|28P01|credentials.*not valid/i.test(message)) {
    return "Database credentials were rejected. Replace DATABASE_URL in the root .env with a fresh Neon Connect string, then restart the backend.";
  }
  if (/read.only|25006/i.test(message)) {
    return "The database is read-only. Use a writable primary database connection.";
  }
  if (/P2021|P2022|does not exist|relation.*missing/i.test(message)) {
    return "Database schema is not ready. Check Prisma migration status and apply the missing migrations.";
  }
  return "Database connection failed or timed out. Check the endpoint, credentials and network; local fallback storage is active.";
}
