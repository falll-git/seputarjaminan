// Finite unit doubles. Real disposable database regressions are recorded separately.
import test from "node:test";
import assert from "node:assert/strict";
import type { SqlDriverAdapterFactory } from "@prisma/driver-adapter-utils";
import { serializeAdapterTransactions } from "../../../../shared/serialized-pg.ts";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

function fixture() {
  const events: string[] = [];
  const options = { usePhantomQuery: false };
  const gates = new Map<string, ReturnType<typeof deferred<unknown>>>();
  let active = 0, maximum = 0;
  const wire = async (name: string) => {
    active++; maximum = Math.max(maximum, active); events.push("begin:" + name);
    try { return gates.has(name) ? await gates.get(name)!.promise : name; }
    finally { events.push("end:" + name); active--; }
  };
  class Transaction {
    #receiver = "transaction";
    provider = "postgres";
    adapterName = "@prisma/adapter-pg";
    options = options;
    async queryRaw(name: string): Promise<unknown> {
      assert.equal(this.#receiver, "transaction");
      const result = await wire(name);
      if (name === "UDT") return this.queryRaw("UDT-parser-query");
      return result;
    }
    async executeRaw(name: string) { assert.equal(this.#receiver, "transaction"); return wire(name); }
    async createSavepoint(name: string) { return this.executeRaw("SAVEPOINT " + name); }
    async rollbackToSavepoint(name: string) { return this.executeRaw("ROLLBACK TO " + name); }
    async releaseSavepoint(name: string) { return this.executeRaw("RELEASE " + name); }
    async commit() { assert.equal(this.#receiver, "transaction"); events.push("release:commit"); }
    async rollback() { assert.equal(this.#receiver, "transaction"); events.push("release:rollback"); }
  }
  class Adapter {
    #receiver = "adapter";
    provider = "postgres";
    adapterName = "@prisma/adapter-pg";
    async startTransaction(isolation: string) {
      assert.equal(this.#receiver, "adapter"); events.push("isolation:" + isolation);
      return new Transaction();
    }
    queryRaw(name: string) { assert.equal(this.#receiver, "adapter"); return wire("pool:" + name); }
    executeRaw(name: string) { assert.equal(this.#receiver, "adapter"); return wire("pool:" + name); }
    executeScript(sql: string) { assert.equal(this.#receiver, "adapter"); events.push(sql); }
    getConnectionInfo() { assert.equal(this.#receiver, "adapter"); return { schemaName: "public", supportsRelationJoins: true }; }
    underlyingDriver() { assert.equal(this.#receiver, "adapter"); return "same-driver"; }
    async dispose() { assert.equal(this.#receiver, "adapter"); events.push("dispose"); }
  }
  const adapter = new Adapter();
  class Factory {
    #receiver = "factory";
    provider = "postgres";
    adapterName = "@prisma/adapter-pg";
    async connect() { assert.equal(this.#receiver, "factory"); return adapter; }
    async connectToShadowDb() { assert.equal(this.#receiver, "factory"); return adapter; }
  }
  const stock = new Factory();
  // Deliberate structural test double: production entry accepts the public
  // Prisma factory interface; these tests use simple named operations, not SQL.
  const factory = serializeAdapterTransactions(stock as unknown as SqlDriverAdapterFactory) as unknown as Factory;
  return { factory, stock, adapter, events, options, gates,
    get maximum() { return maximum; }, get active() { return active; } };
}

test("preserves metadata, private receivers, options and non-transaction methods", async () => {
  const f = fixture();
  assert.equal(f.factory.provider, f.stock.provider);
  assert.equal(f.factory.adapterName, f.stock.adapterName);
  assert.equal(f.factory.connect, f.factory.connect);
  const adapter = await f.factory.connect();
  assert.deepEqual(adapter.getConnectionInfo(), { schemaName: "public", supportsRelationJoins: true });
  assert.equal(adapter.underlyingDriver(), "same-driver");
  adapter.executeScript("script"); await adapter.dispose();
  const tx = await adapter.startTransaction("RepeatableRead");
  assert.equal(tx.options, f.options); assert.equal(tx.provider, "postgres");
  assert.equal(tx.queryRaw, tx.queryRaw);
  assert(f.events.includes("isolation:RepeatableRead"));
  assert(f.events.includes("script")); assert(f.events.includes("dispose"));
});

test("FIFO serializes mixed transaction I/O with one active operation", async () => {
  const f = fixture(), tx = await (await f.factory.connect()).startTransaction("ReadCommitted");
  const gate = deferred<unknown>(); f.gates.set("one", gate);
  const a = tx.queryRaw("one"), b = tx.executeRaw("two"), c = tx.queryRaw("three");
  await tick(); assert.equal(f.active, 1); assert(!f.events.includes("begin:two"));
  gate.resolve({ exact: "result" });
  assert.deepEqual(await Promise.all([a, b, c]), [{ exact: "result" }, "two", "three"]);
  assert.equal(f.maximum, 1);
  assert.deepEqual(f.events.slice(1), ["begin:one", "end:one", "begin:two", "end:two", "begin:three", "end:three"]);
});

test("query rejection is preserved while scheduling tail permits rollback", async () => {
  const f = fixture(), tx = await (await f.factory.connect()).startTransaction("ReadCommitted");
  const failure = Object.assign(new Error("expected"), { code: "original-code" });
  const gate = deferred<unknown>(); f.gates.set("bad", gate);
  const bad = tx.queryRaw("bad");
  const observed = assert.rejects(bad, error => error === failure);
  const rollbackSql = tx.executeRaw("ROLLBACK"), close = tx.rollback();
  gate.reject(failure); await observed; await rollbackSql; await close;
  assert.deepEqual(f.events.slice(1), ["begin:bad", "end:bad", "begin:ROLLBACK", "end:ROLLBACK", "release:rollback"]);
});

test("ordinary query failure does not poison subsequent queued result", async () => {
  const f = fixture(), tx = await (await f.factory.connect()).startTransaction("ReadCommitted");
  const gate = deferred<unknown>(); f.gates.set("bad", gate);
  const bad = tx.queryRaw("bad"), observed = assert.rejects(bad, /expected/);
  const later = tx.queryRaw("later"); gate.reject(new Error("expected"));
  await observed; assert.equal(await later, "later");
});

test("savepoint methods run original nested executeRaw without self-deadlock", { timeout: 2000 }, async () => {
  const f = fixture(), tx = await (await f.factory.connect()).startTransaction("ReadCommitted");
  await Promise.all([tx.createSavepoint("s1"), tx.rollbackToSavepoint("s1"), tx.releaseSavepoint("s1")]);
  assert.equal(f.maximum, 1);
  assert.deepEqual(f.events.slice(1), ["begin:SAVEPOINT s1", "end:SAVEPOINT s1", "begin:ROLLBACK TO s1", "end:ROLLBACK TO s1", "begin:RELEASE s1", "end:RELEASE s1"]);
});

test("UDT-style original-queryable nested call completes before waiting sibling", { timeout: 2000 }, async () => {
  const f = fixture(), tx = await (await f.factory.connect()).startTransaction("ReadCommitted");
  assert.deepEqual(await Promise.all([tx.queryRaw("UDT"), tx.queryRaw("sibling")]), ["UDT-parser-query", "sibling"]);
  assert.equal(f.maximum, 1);
  assert.deepEqual(f.events.slice(1), ["begin:UDT", "end:UDT", "begin:UDT-parser-query", "end:UDT-parser-query", "begin:sibling", "end:sibling"]);
});

for (const terminal of ["commit", "rollback"] as const) {
  test(terminal + " waits for earlier I/O and rejects later admission and double release", async () => {
    const f = fixture(), tx = await (await f.factory.connect()).startTransaction("ReadCommitted");
    const gate = deferred<unknown>(); f.gates.set("pending", gate);
    const pending = tx.queryRaw("pending"), end = tx[terminal]();
    await assert.rejects(tx.queryRaw("late"), /ALREADY_FINALIZING/);
    await assert.rejects(tx[terminal](), /ALREADY_FINALIZING/);
    await tick(); assert(!f.events.includes("release:" + terminal));
    gate.resolve("done"); await pending; await end;
    assert.equal(f.events.at(-1), "release:" + terminal);
    assert(!f.events.includes("begin:late"));
  });
}

test("pool-level queries remain parallel", async () => {
  const f = fixture(), adapter = await f.factory.connect();
  const one = deferred<unknown>(), two = deferred<unknown>(); f.gates.set("pool:one", one); f.gates.set("pool:two", two);
  const a = adapter.queryRaw("one"), b = adapter.executeRaw("two");
  await tick(); assert.equal(f.active, 2); one.resolve(1); two.resolve(2);
  assert.deepEqual(await Promise.all([a, b]), [1, 2]);
});

for (const terminal of ["commit", "rollback"] as const) {
  test(terminal + " failure preserves the error and keeps admission closed", async () => {
    const f = fixture(), original = await f.adapter.startTransaction("ReadCommitted");
    const failure = new Error("terminal release failed");
    original[terminal] = async () => { throw failure; };
    f.adapter.startTransaction = async () => original;
    const tx = await (await f.factory.connect()).startTransaction("ReadCommitted");
    await assert.rejects(tx[terminal](), error => error === failure);
    await assert.rejects(tx.queryRaw("after-failed-release"), /ALREADY_FINALIZING/);
    await assert.rejects(tx[terminal](), /ALREADY_FINALIZING/);
    assert(!f.events.includes("begin:after-failed-release"));
  });
}

test("different transactions do not share a global queue", async () => {
  const f = fixture(), adapter = await f.factory.connect();
  const a = await adapter.startTransaction("ReadCommitted"), b = await adapter.startTransaction("ReadCommitted");
  const one = deferred<unknown>(), two = deferred<unknown>(); f.gates.set("one", one); f.gates.set("two", two);
  const pa = a.queryRaw("one"), pb = b.queryRaw("two"); await tick(); assert.equal(f.active, 2);
  one.resolve(1); two.resolve(2); assert.deepEqual(await Promise.all([pa, pb]), [1, 2]);
});

test("shadow factory connection receives the same transaction policy", async () => {
  const f = fixture(), tx = await (await f.factory.connectToShadowDb()).startTransaction("ReadCommitted");
  await tx.queryRaw("one"); await tx.commit(); await assert.rejects(tx.executeRaw("late"), /ALREADY_FINALIZING/);
});

test("invalid factories fail before connecting", () => {
  assert.throws(() => serializeAdapterTransactions(null as unknown as SqlDriverAdapterFactory), /OBJECT_REQUIRED/);
  assert.throws(() => serializeAdapterTransactions({} as SqlDriverAdapterFactory), /CONNECT_REQUIRED/);
});
