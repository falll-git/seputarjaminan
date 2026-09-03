import assert from "node:assert/strict";
import { test } from "node:test";
import { hashOpsSecret } from "../../src/ops-auth.js";
import { decryptSecret, encryptSecret, generateTotpSecret, totpCode, verifyTotp } from "../../src/ops-crypto.js";
import { verify } from "@node-rs/argon2";

test("TOTP mengikuti vektor RFC dan menerima drift paling banyak satu langkah", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // gitleaks:allow -- RFC 6238 test vector
  assert.equal(totpCode(secret, 59_000), "287082");
  assert.equal(verifyTotp(secret, "287082", 59_000), true);
  assert.equal(verifyTotp(secret, "287082", 59_000 + 60_000), false);
  assert.equal(verifyTotp(secret, "12345", 59_000), false);
});

test("secret MFA dienkripsi AES-256-GCM dan manipulasi ciphertext ditolak", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const secret = generateTotpSecret();
  const encrypted = encryptSecret(secret, key);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptSecret(encrypted, key), secret);
  const parts = encrypted.split(".");
  const tamperedCiphertext = Buffer.from(parts[3]!, "base64url");
  tamperedCiphertext[0] = tamperedCiphertext[0]! ^ 0xff;
  parts[3] = tamperedCiphertext.toString("base64url");
  assert.throws(() => decryptSecret(parts.join("."), key));

  const truncatedTag = encrypted.split(".");
  truncatedTag[2] = Buffer.from(truncatedTag[2]!, "base64url").subarray(0, 12).toString("base64url");
  assert.throws(() => decryptSecret(truncatedTag.join("."), key), /Format secret terenkripsi tidak valid/u);
});

test("password dan recovery secret memakai Argon2id terverifikasi", async () => {
  const hashed = await hashOpsSecret("kata-sandi-uji-yang-kuat");
  assert.match(hashed, /^\$argon2id\$/u);
  assert.equal(await verify(hashed, "kata-sandi-uji-yang-kuat"), true);
  assert.equal(await verify(hashed, "salah"), false);
});
