import dotenv from "dotenv";
import path from "node:path";
import { createDatabaseClient, databaseConnection, describeDatabaseFailure } from "./database-connection.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
async function main() {
  let client: ReturnType<typeof createDatabaseClient> = null;
  try {
    const connection = databaseConnection();
    if (!connection) throw new Error("DATABASE_URL must be configured.");
    console.log(`Checking ${connection.host}/${connection.database} using ${connection.transport === "neon" ? "Neon secure WebSockets (443)" : "PostgreSQL TCP"}.`);
    client = createDatabaseClient();
    const rows = await client!.$queryRaw<Array<{ read_only: string }>>`SELECT current_setting('transaction_read_only') AS read_only`;
    if (rows[0]?.read_only === "on") throw new Error("Database is read-only.");
    console.log("Database reachable, credentials accepted, session is not read-only.");
  } catch (error) {
    console.error(describeDatabaseFailure(error));
    process.exitCode = 1;
  } finally {
    await client?.$disconnect();
  }
}

void main();
