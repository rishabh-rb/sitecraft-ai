import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { databaseConnection, describeDatabaseFailure } from "./database-connection.js";
import { DatabaseHealthMonitor } from "./database-health.js";

test("Neon connections use secure WebSockets by default while other PostgreSQL connections keep TCP", () => {
  const neon = databaseConnection({ DATABASE_URL: "postgresql://owner:synthetic@ep-demo-pooler.us-east-1.aws.neon.tech/sitecraft?sslmode=require&channel_binding=require" });
  assert.equal(neon?.transport, "neon");
  assert.equal(neon?.database, "sitecraft");
  assert.equal(new URL(neon!.url).searchParams.get("channel_binding"), "require");
  const postgres = databaseConnection({ DATABASE_URL: "postgresql://owner:synthetic@localhost:5432/sitecraft" });
  assert.equal(postgres?.transport, "tcp");
  assert.equal(new URL(postgres!.url).searchParams.get("connect_timeout"), "10");
  assert.equal(new URL(postgres!.url).searchParams.get("pool_timeout"), "10");
});

test("explicit TCP remains available and invalid transport configurations are rejected", () => {
  const url = "postgresql://owner:synthetic@ep-demo.us-east-1.aws.neon.tech/sitecraft?connect_timeout=7";
  const connection = databaseConnection({ DATABASE_URL: url, DATABASE_TRANSPORT: "tcp" });
  assert.equal(connection?.transport, "tcp");
  assert.equal(new URL(connection!.url).searchParams.get("connect_timeout"), "7");
  assert.equal(databaseConnection({}), null);
  assert.throws(() => databaseConnection({ DATABASE_URL: "https://example.com" }), /PostgreSQL/);
  assert.throws(() => databaseConnection({ DATABASE_URL: url, DATABASE_TRANSPORT: "unknown" }), /DATABASE_TRANSPORT/);
  assert.throws(() => databaseConnection({ DATABASE_URL: "postgresql://u:p@neon.tech.example.com/db", DATABASE_TRANSPORT: "neon" }), /Neon database hostname/);
});

test("database failure messages distinguish rejected credentials, read-only databases and missing tables without exposing secrets", () => {
  assert.match(describeDatabaseFailure(new Error("password authentication failed for user")), /credentials were rejected/);
  assert.match(describeDatabaseFailure(new Error("Code: 28P01")), /credentials were rejected/);
  assert.match(describeDatabaseFailure(new Error("cannot execute CREATE TABLE in a read-only transaction")), /read-only/);
  assert.match(describeDatabaseFailure(new Error('relation "User" does not exist')), /schema is not ready/);
  const message = describeDatabaseFailure(new Error("Could not reach postgresql://owner:PRIVATE_PASSWORD@example.com/db"));
  assert.doesNotMatch(message, /PRIVATE_PASSWORD|postgresql:\/\//);
});

test("concurrent database status requests share one probe", async () => {
  let resolve!: () => void;
  let calls = 0;
  const monitor = new DatabaseHealthMonitor(() => {
    calls += 1;
    return new Promise<void>((done) => { resolve = done; });
  }, { timeoutMs: 200, retryIntervalMs: 100 });
  const first = monitor.check();
  const second = monitor.check();
  assert.equal(first, second);
  resolve();
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(calls, 1);
});

test("failed database probes are cached and retried after cooldown", async () => {
  let now = 0;
  let calls = 0;
  const monitor = new DatabaseHealthMonitor(async () => {
    if (++calls === 1) throw new Error("Network unavailable");
  }, { timeoutMs: 200, retryIntervalMs: 100, now: () => now });
  assert.equal(await monitor.check(), false);
  now = 99;
  assert.equal(await monitor.check(), false);
  assert.equal(calls, 1);
  now = 100;
  assert.equal(await monitor.check(), true);
  assert.equal(calls, 2);
  // Passing the refresh interval alone must not switch auth storage to local.
  now = 300;
  assert.equal(monitor.connected, true);
});

test("successful database probes clear their timeout timers", async () => {
  let failures = 0;
  const monitor = new DatabaseHealthMonitor(async () => {}, {
    timeoutMs: 10, retryIntervalMs: 100, onFailure: () => { failures += 1; }
  });
  assert.equal(await monitor.check(), true);
  await delay(25);
  assert.equal(failures, 0);
  assert.equal(monitor.connected, true);
});

test("a timed-out probe cannot mark the database healthy when it finishes late", async () => {
  let finish!: () => void;
  const monitor = new DatabaseHealthMonitor(() => new Promise<void>((resolve) => { finish = resolve; }), { timeoutMs: 10, retryIntervalMs: 100 });
  assert.equal(await monitor.check(), false);
  finish();
  await delay(1);
  assert.equal(monitor.connected, false);
  assert.match(String(monitor.error), /timed out/);
});

test("a newer database operation failure wins over an older successful health probe", async () => {
  let finish!: () => void;
  const monitor = new DatabaseHealthMonitor(() => new Promise<void>((resolve) => { finish = resolve; }), { timeoutMs: 200, retryIntervalMs: 100 });
  const pending = monitor.check();
  monitor.fail(new Error("Table query failed"));
  finish();
  assert.equal(await pending, false);
  assert.equal(monitor.connected, false);
  assert.match(String(monitor.error), /Table query failed/);
});
