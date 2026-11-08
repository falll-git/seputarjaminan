import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerHeartbeat } from "../../src/heartbeat.js";

test("heartbeat worker menulis status kemajuan dengan TTL dan menghapus hanya nilai miliknya", async () => {
  const calls: unknown[][] = [];
  const redis = {
    status: "wait",
    async connect() { this.status = "ready"; calls.push(["connect"]); },
    async set(...args: unknown[]) { calls.push(["set", ...args]); },
    async eval(...args: unknown[]) { calls.push(["eval", ...args]); },
    async quit() { calls.push(["quit"]); },
    disconnect() { calls.push(["disconnect"]); },
  };
  let scheduled: (() => void) | undefined;
  const timer = { unref() {} } as unknown as ReturnType<typeof setInterval>;
  const heartbeat = createWorkerHeartbeat({ redisUrl: "redis://not-used", key: "sj:worker:test", intervalMs: 5000, ttlMs: 15000 }, {
    redis,
    ready: async () => true,
    now: () => new Date("2026-09-10T10:00:00.000Z"),
    setIntervalFn: ((callback: () => void) => { scheduled = callback; return timer; }) as typeof setInterval,
    clearIntervalFn: (() => undefined) as typeof clearInterval,
  });
  await heartbeat.start();
  assert.deepEqual(calls[0], ["connect"]);
  assert.match(String(calls[1][1]), /^sj:worker:test:alive:/);
  assert.equal(calls[2][1], "sj:worker:test");
  assert.deepEqual(calls[2].slice(3), ["PX", 15000]);
  assert.equal(JSON.parse(String(calls[2][2])).status, "PROCESSING_CAPABLE");
  assert.equal(typeof scheduled, "function");
  await heartbeat.stop();
  assert.equal(calls.at(-3)?.[0], "eval");
  assert.match(String(calls.at(-3)?.[1]), /GET.*ARGV\[1\].*DEL/);
  assert.deepEqual(calls.at(-1), ["quit"]);
  assert.doesNotMatch(JSON.stringify(calls), /redis:\/\//);
});

test("liveness alone does not claim readiness and shutdown preserves another worker", async () => {
  const values = new Map<string,string>();let ready=false;let tick:()=>void=()=>{};
  const heartbeat=createWorkerHeartbeat({redisUrl:'redis://unused',key:'test',intervalMs:5,ttlMs:15},{
    redis:{status:'ready',connect:async()=>{},set:async(k,v)=>{values.set(k,v);},eval:async(_s,_n,k,v)=>{if(values.get(k)===v)values.delete(k);},quit:async()=>{},disconnect(){}},
    ready:async()=>ready,setIntervalFn:((fn:()=>void)=>{tick=fn;return {unref(){}};}) as any,clearIntervalFn:(()=>{}) as any,
  });
  await heartbeat.start();assert.equal(values.has('test'),false);assert.equal(values.size,1);
  ready=true;tick();await new Promise(resolve=>setImmediate(resolve));assert.equal(JSON.parse(values.get('test')!).status,'PROCESSING_CAPABLE');
  values.set('test','new owner');await heartbeat.stop();assert.equal(values.get('test'),'new owner');assert.equal(values.size,1);
});

test("Redis outage is handled and a later beat recovers", async () => {
  let down=true,calls=0;let tick:()=>void=()=>{};
  const heartbeat=createWorkerHeartbeat({redisUrl:'redis://unused',key:'test',intervalMs:5,ttlMs:15},{
    redis:{status:'ready',connect:async()=>{},set:async()=>{if(down)throw new Error('offline');calls++;},eval:async()=>{},quit:async()=>{},disconnect(){}},
    ready:async()=>true,setIntervalFn:((fn:()=>void)=>{tick=fn;return {unref(){}};}) as any,clearIntervalFn:(()=>{}) as any,
  });
  await heartbeat.start();assert.equal(calls,0);down=false;tick();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);await heartbeat.stop();
});
