import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const ignored = new Set(["node_modules", ".next", ".env", ".DS_Store"]);
async function files(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(item.name) || item.name.endsWith(".tsbuildinfo")) continue;
    const target = path.join(directory, item.name);
    if (item.isDirectory()) result.push(...(await files(target)));
    else if (item.isFile()) result.push(path.relative(root, target));
  }
  return result;
}
const rootFiles = [
  "package.json",
  "package-lock.json",
  "README.md",
  ".gitignore",
];
const base = path.join(root, ".sitecraft-backups");
await mkdir(base, { recursive: true });
const latestPath = path.join(base, "latest-ui.json");
if (process.argv.includes("--finalize")) {
  const latest = JSON.parse(await readFile(latestPath, "utf8"));
  const manifest = JSON.parse(
    await readFile(path.join(latest.directory, "manifest.json"), "utf8"),
  );
  const current = [...(await files(path.join(root, "frontend"))), ...rootFiles];
  manifest.createdFiles = current.filter(
    (file) => !manifest.files.includes(file),
  );
  manifest.finalizedAt = new Date().toISOString();
  await writeFile(
    path.join(latest.directory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log(`Rollback finalized: ${latest.directory}`);
} else {
  const directory = path.join(base, `ui-${Date.now()}`);
  await mkdir(directory);
  const sourceFiles = [
    ...(await files(path.join(root, "frontend"))),
    ...rootFiles,
  ];
  const hashes = {};
  for (const file of sourceFiles) {
    const destination = path.join(directory, "files", file);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(root, file), destination);
    hashes[file] = createHash("sha256")
      .update(await readFile(destination))
      .digest("hex");
  }
  await writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        files: sourceFiles,
        hashes,
        createdFiles: [],
      },
      null,
      2,
    ),
  );
  await writeFile(latestPath, JSON.stringify({ directory }, null, 2));
  console.log(
    JSON.stringify({
      rollbackDirectory: directory,
      originalFiles: sourceFiles.length,
      secretsExcluded: true,
    }),
  );
}
