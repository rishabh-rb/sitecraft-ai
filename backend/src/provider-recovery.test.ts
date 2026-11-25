import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createProvider, qaPrompt } from "@sitecraft/ml";

type ChatBody = { max_tokens: number; messages: { role: string; content: string }[] };
const complete = () => Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"ready":true}' } }] });
const truncated = () => Response.json({ choices: [{ finish_reason: "length", message: { content: '{"ready":' } }] });

test("recovers truncated JSON once on the same provider with a larger output allowance", async (t) => {
  const bodies: ChatBody[] = [];
  t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return bodies.length === 1 ? truncated() : complete();
  });
  const provider = createProvider({ OPENROUTER_API_KEY: "recovery-router" }, { budgetMs: 1000, attemptTimeoutMs: 100 });
  assert.deepEqual(await provider.generateJson("website brief", "planner"), { ready: true });
  assert.equal(bodies.length, 2);
  assert.ok(bodies[1].max_tokens > bodies[0].max_tokens);
  assert.ok(bodies[1].max_tokens <= provider.config.maxTokens);
  assert.match(bodies[1].messages[0].content, /previous response was truncated/);
  assert.equal(bodies[1].messages.at(-1)?.content, "website brief");
});

test("bounds output retries and keeps a large code failure from disabling small QA requests", async (t) => {
  const bodies: ChatBody[] = [];
  t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as ChatBody;
    bodies.push(body);
    return body.messages.at(-1)?.content === "generate code" ? truncated() : complete();
  });
  const provider = createProvider({ OPENROUTER_API_KEY: "capped-router", AI_MAX_TOKENS: "2000", OPENROUTER_MAX_TOKENS: "1500" }, {
    budgetMs: 1000, attemptTimeoutMs: 100
  });
  await assert.rejects(provider.generateJson("generate code", "code"), { code: "OUTPUT_LIMIT" });
  assert.equal(await provider.generateJson("generate code", "code"), null);
  assert.deepEqual(await provider.generateJson("check the site", "qa"), { ready: true });
  assert.equal(bodies.length, 3);
  assert.ok(bodies.every((body) => body.max_tokens <= 1500));
  assert.match(bodies[1].messages[0].content, /shorter complete response/);
});

test("recognises Gemini token limits and ignores thought text while parsing JSON", async (t) => {
  const bodies: { generationConfig: { maxOutputTokens: number } }[] = [];
  t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ candidates: [{
      finishReason: bodies.length === 1 ? "MAX_TOKENS" : "STOP",
      content: { parts: [{ thought: true, text: "Internal draft that is not JSON" }, { text: bodies.length === 1 ? '{"ready":' : '{"ready":true}' }] }
    }] });
  });
  const provider = createProvider({ GEMINI_API_KEY: "recovery-gemini" }, { budgetMs: 1000, attemptTimeoutMs: 100 });
  assert.deepEqual(await provider.generateJson("{}", "planner"), { ready: true });
  assert.equal(bodies.length, 2);
  assert.ok(bodies[1].generationConfig.maxOutputTokens > bodies[0].generationConfig.maxOutputTokens);
});

test("recovers Bynara token truncation instead of treating it as an invalid key", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => ++calls === 1 ? truncated() : complete());
  const provider = createProvider({ BYNARA_API_KEY: "recovery-bynara" }, { budgetMs: 1000, attemptTimeoutMs: 100 });
  assert.deepEqual(await provider.generateJson("{}", "planner"), { ready: true });
  assert.equal(calls, 2);
});

test("a rejected credential is skipped across new projects but a replacement key is tried", async (t) => {
  const authorizations: string[] = [];
  t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    const authorization = new Headers(init?.headers).get("authorization") ?? "";
    authorizations.push(authorization);
    return authorization.endsWith("expired-bynara")
      ? Response.json({ error: { message: "A valid API key is required" } }, { status: 401 }) : complete();
  });
  const env = { BYNARA_API_KEY: "expired-bynara" };
  await assert.rejects(createProvider(env).generateJson("{}", "planner"), { code: "INVALID_API_KEY" });
  assert.equal(await createProvider(env).generateJson("{}", "planner"), null);
  assert.deepEqual(await createProvider({ BYNARA_API_KEY: "replacement-bynara" }).generateJson("{}", "planner"), { ready: true });
  assert.deepEqual(authorizations, ["Bearer expired-bynara", "Bearer replacement-bynara"]);
});

test("code requests get their own timeout while the overall deadline still wins", async (t) => {
  t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    await delay(60, undefined, { signal: init?.signal ?? undefined });
    return complete();
  });
  const limits = { budgetMs: 1000, attemptTimeoutMs: 20, codeAttemptTimeoutMs: 250 };
  await assert.rejects(createProvider({ OPENROUTER_API_KEY: "timeout-small" }, limits).generateJson("{}", "planner"), { code: "TIMEOUT" });
  assert.deepEqual(await createProvider({ OPENROUTER_API_KEY: "timeout-code" }, limits).generateJson("{}", "code"), { ready: true });
  await assert.rejects(createProvider({ OPENROUTER_API_KEY: "deadline-code" }, { ...limits, budgetMs: 20 }).generateJson("{}", "code"), { code: "TIMEOUT" });
});

test("code can use the full default output budget and invalid ceilings do not produce NaN requests", async (t) => {
  const budgets: number[] = [];
  t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    budgets.push(JSON.parse(String(init?.body)).max_tokens);
    return complete();
  });
  const provider = createProvider({ OPENROUTER_API_KEY: "budgets-router", AI_MAX_TOKENS: "invalid", OPENROUTER_MAX_TOKENS: "-1" });
  await provider.generateJson("{}", "code");
  await provider.generateJson("{}", "qa");
  assert.equal(budgets[0], 8192);
  assert.ok(budgets[1] < budgets[0]);
  assert.ok(budgets.every((budget) => Number.isInteger(budget) && budget > 0));
});

test("an explicit provider preference controls the actual request with several keys present", async (t) => {
  const hosts: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    hosts.push(new URL(String(input)).hostname);
    return complete();
  });
  const provider = createProvider({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "preferred-gemini", OPENROUTER_API_KEY: "secondary-router" });
  assert.equal(provider.config.provider, "gemini");
  assert.deepEqual(await provider.generateJson("{}", "planner"), { ready: true });
  assert.deepEqual(hosts, ["generativelanguage.googleapis.com"]);
});

test("a disabled optional Bynara key is never requested", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Disabled provider was requested"); });
  const provider = createProvider({ AI_PROVIDER: "bynara", BYNARA_API_KEY: "disabled-bynara", BYNARA_ENABLED: "false" });
  assert.equal(provider.config.configured, false);
  assert.equal(provider.config.provider, "local");
  assert.equal(await provider.generateJson("{}", "planner"), null);
  assert.equal(fetch.mock.callCount(), 0);
});

test("QA receives HTML and file inventory without duplicating all generated source code", () => {
  const prompt = qaPrompt({
    html: '<main aria-label="Preview">Site</main>',
    plan: { siteName: "Site" },
    files: [{ path: "src/App.tsx", language: "tsx", content: "DUPLICATED_SOURCE_SENTINEL" }]
  }, "Check this website");
  assert.match(prompt, /aria-label/);
  assert.match(prompt, /src\/App\.tsx/);
  assert.doesNotMatch(prompt, /DUPLICATED_SOURCE_SENTINEL/);
});
