import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  rm,
  realpath,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = path.join(root, ".sitecraft-backups");
const { directory } = JSON.parse(
  await readFile(path.join(base, "latest-ui.json"), "utf8"),
);
if (!(await realpath(directory)).startsWith((await realpath(base)) + path.sep))
  throw new Error("The backup must be inside this project's backup directory.");
const manifest = JSON.parse(
  await readFile(path.join(directory, "manifest.json"), "utf8"),
);
for (const file of [...manifest.files, ...manifest.createdFiles]) {
  if (
    path.isAbsolute(file) ||
    file.split(/[/\\]/).includes("..") ||
    path.basename(file).startsWith(".env")
  )
    throw new Error("Rollback contains an unsafe path.");
  if (
    !(
      file.startsWith("frontend/") ||
      ["package.json", "package-lock.json", "README.md", ".gitignore"].includes(
        file,
      )
    )
  )
    throw new Error("Rollback contains an unexpected path.");
}
for (const file of manifest.files) {
  const hash = createHash("sha256")
    .update(await readFile(path.join(directory, "files", file)))
    .digest("hex");
  if (hash !== manifest.hashes[file])
    throw new Error(`Backup integrity check failed: ${file}`);
}
if (!process.argv.includes("--apply")) {
  console.log(
    JSON.stringify({
      backup: directory,
      restore: manifest.files.length,
      removeUpgradeFiles: manifest.createdFiles.length,
      backendUntouched: true,
    }),
  );
} else {
  const rescue = path.join(base, `before-restore-${Date.now()}`);
  for (const file of [...manifest.files, ...manifest.createdFiles]) {
    try {
      await mkdir(path.dirname(path.join(rescue, file)), { recursive: true });
      await copyFile(path.join(root, file), path.join(rescue, file));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  for (const file of manifest.createdFiles)
    await rm(path.join(root, file), { force: true });
  for (const file of manifest.files) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await copyFile(path.join(directory, "files", file), path.join(root, file));
  }
  await writeFile(
    path.join(rescue, "restored-from.json"),
    JSON.stringify({ directory }),
  );
  console.log(
    `Original frontend restored. Backend, database settings and stored data were not modified. Current UI was saved in ${rescue}. Restart the dev server to refresh its cache.`,
  );
}
