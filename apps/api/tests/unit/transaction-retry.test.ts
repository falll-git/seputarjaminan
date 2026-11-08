import assert from "node:assert/strict";
import test from "node:test";
import { retryTransaction } from "../../src/transaction-retry.js";

test("transaction retry is bounded and never retries business or transport errors", async () => {
  let attempts = 0;
  assert.equal(await retryTransaction(async () => {
    if (++attempts < 3) throw Object.assign(new Error("rollback"), { code: "P2034" });
    return "committed";
  }), "committed");
  assert.equal(attempts, 3);
  for (const code of ["P2034", "P2002", "SIGNATURE_INVALID", "ECONNRESET"]) {
    attempts = 0;
    await assert.rejects(retryTransaction(async () => { attempts++; throw Object.assign(new Error("test"), { code }); }),
      (e: any) => e.code === (code === "P2034" ? "TRANSACTION_BUSY" : code === "P2002" ? "EVENT_CONFLICT" : code));
    assert.equal(attempts, ["P2034", "P2002"].includes(code) ? 4 : 1);
  }
});
