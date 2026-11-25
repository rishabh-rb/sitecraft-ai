import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createProvider, ProviderError } from "@sitecraft/ml";

test("surfaces Gemini model errors with configuration guidance", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404 })) as typeof fetch;
  try {
    const provider = createProvider({ GEMINI_API_KEY: "gemini-key", AI_MODEL: "missing-model", AI_PROVIDER: "gemini" });
    await assert.rejects(() => provider.generateJson("{}", "planner"), (error: unknown) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.code, "MODEL_UNAVAILABLE");
      assert.match(error.message, /missing-model/);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("surfaces malformed Gemini responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "not-json" }] } }] }), { status: 200 })) as typeof fetch;
  try {
    const provider = createProvider({ GEMINI_API_KEY: "gemini-key", AI_PROVIDER: "gemini" });
    await assert.rejects(() => provider.generateJson("{}", "planner"), (error: unknown) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.code, "MALFORMED_RESPONSE");
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a generation run skips rejected and timed-out keys in later stages", async (t) => {
  const calls: string[] = [];
  let routerCalls = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const host = new URL(String(input)).hostname;
    calls.push(host);
    if (host === "openrouter.ai") {
      const stop = ++routerCalls > 2;
      return Response.json({
        choices: [{ finish_reason: stop ? "stop" : "length", message: { content: stop ? '{"ready":true}' : '{"ready":' } }]
      });
    }
    if (host === "router.bynara.id") return Response.json({ error: { message: "Unauthorized" } }, { status: 401 });
    await delay(2000, undefined, { signal: init?.signal ?? undefined });
    throw new Error("The Gemini timeout should have aborted this request");
  });
  const provider = createProvider({
    OPENROUTER_API_KEY: "test-openrouter",
    BYNARA_API_KEY: "test-bynara",
    GEMINI_API_KEY: "test-gemini"
  }, { budgetMs: 1_500, attemptTimeoutMs: 40 });

  await assert.rejects(provider.generateJson("{}", "planner"), { code: "TIMEOUT", provider: "gemini" });
  assert.deepEqual(await provider.generateJson("{}", "content"), { ready: true });
  assert.deepEqual(calls, ["openrouter.ai", "openrouter.ai", "router.bynara.id", "generativelanguage.googleapis.com", "openrouter.ai"]);
});

test("provider budget applies across every stage and credential in a run", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    await delay(2000, undefined, { signal: init?.signal ?? undefined });
    throw new Error("The combined deadline should abort the request");
  });
  const provider = createProvider({
    GEMINI_API_KEY: "test-gemini",
    GEMINI_API_KEYS: "test-backup"
  }, { budgetMs: 30, attemptTimeoutMs: 1_000 });

  await assert.rejects(provider.generateJson("{}", "planner"), { code: "TIMEOUT" });
  assert.equal(await provider.generateJson("{}", "content"), null);
  assert.equal(fetch.mock.callCount(), 1);
});

test("stops requesting a model that repeatedly returns malformed JSON in one run", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({
    choices: [{ finish_reason: "stop", message: { content: '{"incomplete":' } }]
  }));
  const provider = createProvider({ OPENROUTER_API_KEY: "test-openrouter" }, {
    budgetMs: 1_500, attemptTimeoutMs: 100
  });
  await assert.rejects(provider.generateJson("{}", "planner"), { code: "MALFORMED_RESPONSE" });
  await assert.rejects(provider.generateJson("{}", "content"), { code: "MALFORMED_RESPONSE" });
  assert.equal(await provider.generateJson("{}", "ui"), null);
  assert.equal(fetch.mock.callCount(), 2);
});
