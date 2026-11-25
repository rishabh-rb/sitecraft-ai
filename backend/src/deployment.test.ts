import test from "node:test";
import assert from "node:assert/strict";
import { deployToVercel } from "./deployment/vercel.js";
import { deployToNetlify } from "./deployment/netlify.js";

test("returns configuration guidance when VERCEL_TOKEN is missing", async () => {
  const result = await deployToVercel("Test Project", [{ path: "index.html", content: "<h1>Hello</h1>" }], "");
  assert.equal(result.success, false);
  assert.equal(result.status, "ERROR");
  assert.match(result.error || "", /Vercel deployment is not configured/i);
});

test("handles Vercel API deployment successfully when configured", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    id: "dpl_12345",
    url: "test-project.vercel.app",
    readyState: "READY"
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

  try {
    const result = await deployToVercel(
      "Test Project",
      [{ path: "index.html", content: "<h1>Hello</h1>" }],
      "fake-vercel-token"
    );
    assert.equal(result.success, true);
    assert.equal(result.status, "READY");
    assert.equal(result.deploymentId, "dpl_12345");
    assert.equal(result.deploymentUrl, "https://test-project.vercel.app");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns configuration guidance when Netlify site settings are missing", async () => {
  const originalToken = process.env.NETLIFY_AUTH_TOKEN;
  const originalSiteId = process.env.NETLIFY_SITE_ID;
  delete process.env.NETLIFY_AUTH_TOKEN;
  delete process.env.NETLIFY_SITE_ID;
  try {
    const result = await deployToNetlify("Test Project", [{ path: "index.html", content: "<h1>Hello</h1>" }]);
    assert.equal(result.success, false);
    assert.equal(result.status, "ERROR");
    assert.match(result.error || "", /NETLIFY_AUTH_TOKEN/i);
  } finally {
    if (originalToken === undefined) delete process.env.NETLIFY_AUTH_TOKEN;
    else process.env.NETLIFY_AUTH_TOKEN = originalToken;
    if (originalSiteId === undefined) delete process.env.NETLIFY_SITE_ID;
    else process.env.NETLIFY_SITE_ID = originalSiteId;
  }
});

test("handles Netlify API deployment successfully when configured", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.NETLIFY_AUTH_TOKEN;
  const originalSiteId = process.env.NETLIFY_SITE_ID;
  process.env.NETLIFY_AUTH_TOKEN = "fake-netlify-token";
  process.env.NETLIFY_SITE_ID = "site_12345";
  globalThis.fetch = (async (_input, init) => {
    assert.equal(init?.method, "POST");
    assert.equal(init?.headers && (init.headers as Record<string, string>)["Content-Type"], "application/zip");
    assert.ok(init?.body);
    return new Response(JSON.stringify({
      id: "netlify_dpl_12345",
      state: "ready",
      ssl_url: "https://test-project.netlify.app"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const result = await deployToNetlify("Test Project", [{ path: "index.html", content: "<h1>Hello</h1>" }]);
    assert.equal(result.success, true);
    assert.equal(result.status, "READY");
    assert.equal(result.deploymentId, "netlify_dpl_12345");
    assert.equal(result.deploymentUrl, "https://test-project.netlify.app");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.NETLIFY_AUTH_TOKEN;
    else process.env.NETLIFY_AUTH_TOKEN = originalToken;
    if (originalSiteId === undefined) delete process.env.NETLIFY_SITE_ID;
    else process.env.NETLIFY_SITE_ID = originalSiteId;
  }
});
