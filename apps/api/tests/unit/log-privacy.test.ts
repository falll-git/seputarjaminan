import assert from "node:assert/strict";
import test from "node:test";
import { Writable } from "node:stream";
import pino from "pino";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { AllowAllRateLimiter } from "../../src/rate-limit.js";

test("request/error logs exclude credentials, arbitrary headers, query strings and rejected payloads", async () => {
  let output = "";
  const logger = pino({ level: "info" }, new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } }));
  const app = createApp({ config: { security: { eventBodyMaxBytes: 262144 }, rateLimit: { publicPerMinute: 600 }, flags: {} }, databases: {} as any, storage: {}, ingestLimiter: new AllowAllRateLimiter(), publicLimiter: new AllowAllRateLimiter(), logger });
  await request(app).get('/missing?password=PRIVATE_QUERY_SENTINEL').set('Authorization','Bearer PRIVATE_AUTH_SENTINEL').set('X-CSRF-Token','PRIVATE_CSRF_SENTINEL').set('X-Internal','PRIVATE_HEADER_SENTINEL');
  await request(app).post('/missing').send({ nik: 'PRIVATE_BODY_SENTINEL', password: 'PRIVATE_PASSWORD_SENTINEL' });
  const malformed = await request(app).post('/missing').set('Content-Type', 'application/json').send('{"password":"PRIVATE_PARSE_SENTINEL",');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.retryable, false);
  assert.doesNotMatch(JSON.stringify(malformed.body), /PRIVATE_[A-Z_]+_SENTINEL/);
  assert.doesNotMatch(output, /PRIVATE_[A-Z_]+_SENTINEL/);
  assert.ok(output.includes('404'));
});
