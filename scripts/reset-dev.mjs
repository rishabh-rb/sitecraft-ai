import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const directory = new URL("../frontend/.next/dev/", import.meta.url);
try {
  const lock = JSON.parse(await readFile(new URL("lock", directory), "utf8"));
  if (Number.isSafeInteger(lock.pid) && lock.pid > 0) {
    try {
      process.kill(lock.pid, 0);
      console.error(`SiteCraft frontend is running (PID ${lock.pid}). Stop it with Ctrl+C before running npm run dev:clean. Its active cache was left intact.`);
      process.exit(1);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
} catch (error) {
  if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
}

for (const port of [3000, 4000]) {
  const available = await new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
  if (!available) {
    console.error(`Port ${port} is still in use. Stop the current dev server before cleaning its output.`);
    process.exit(1);
  }
}

await rm(directory, { recursive: true, force: true });
console.log(`Cleared development output: ${fileURLToPath(directory)}`);
