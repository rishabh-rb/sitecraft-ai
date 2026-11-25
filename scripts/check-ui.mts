import assert from "node:assert/strict";
import { Script } from "node:vm";
import { gunzipSync } from "node:zlib";
import { snapshotUrl, readSnapshot } from "../frontend/lib/studio.ts";
import {
  inferTemplate,
  templates,
  templateWebsite,
} from "../frontend/lib/templates.ts";

Object.defineProperty(globalThis, "location", {
  value: new URL("http://localhost:3000"),
});
let checks = 0;
for (const template of templates) {
  assert.equal(
    inferTemplate(template.prompt).id,
    template.id,
    "Each starter prompt should select its own industry",
  );
  const website = templateWebsite(template);
  for (const match of website.html.matchAll(/<script>([\s\S]*?)<\/script>/g))
    new Script(match[1]);
  website.html = website.html
    .replace("</h1>", " · नमस्ते & hola</h1>")
    .replaceAll(template.accent, "#315c9e");
  const link = await snapshotUrl(website);
  const restored = await readSnapshot(new URL(link).hash.slice(1));
  assert.equal(
    restored.html,
    website.html,
    "Edited snapshot must preserve every HTML character",
  );
  assert.equal(restored.name, website.plan.siteName);
  assert.ok(
    link.length < 2200,
    "Template snapshots should fit the supported QR budget",
  );
  checks++;
}
const generic = {
  ...templateWebsite(templates[0]),
  html: "<!doctype html><html lang='en'><title>Custom</title><body><h1>A different website</h1></body></html>",
};
assert.equal(
  (await readSnapshot(new URL(await snapshotUrl(generic)).hash.slice(1))).html,
  generic.html,
);
checks++;
await assert.rejects(() => readSnapshot("invalid-gzip"));
checks++;
await assert.rejects(() =>
  snapshotUrl({ ...generic, html: "x".repeat(1200001) }),
);
checks++;
async function packed(payload: object) {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const bytes = Buffer.from(
    await new Response(
      new Blob([data]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
  return bytes.toString("base64url");
}
await assert.rejects(async () =>
  readSnapshot(
    await packed({
      name: "Unsafe",
      template: "restaurant",
      fingerprint: "wrong",
      parts: [[0, 9999999]],
    }),
  ),
);
checks++;
await assert.rejects(async () =>
  readSnapshot(await packed({ name: 42, html: "invalid" })),
);
checks++;
const valid = JSON.parse(
  gunzipSync(
    Buffer.from(
      new URL(await snapshotUrl(templateWebsite(templates[0]))).hash.slice(1),
      "base64url",
    ),
  ).toString(),
);
await assert.rejects(async () =>
  readSnapshot(await packed({ ...valid, parts: [[0, 1200001]] })),
);
checks++;
console.log(
  `Passed ${checks} UI snapshot, QR budget, script syntax and malformed-input checks. No database or provider requests made.`,
);
