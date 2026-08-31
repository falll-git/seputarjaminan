import { randomBytes, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client.ts";
import { encryptSecret, generateTotpSecret } from "../src/ops-crypto.js";
import { hashOpsSecret } from "../src/ops-auth.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi secara eksplisit.`);
  return value;
}

const databaseUrl = required("SJ_OPS_DATABASE_URL");
const email = required("SJ_BOOTSTRAP_OPS_EMAIL").toLowerCase();
const displayName = required("SJ_BOOTSTRAP_OPS_DISPLAY_NAME");
const password = required("SJ_BOOTSTRAP_OPS_PASSWORD");
const encryptionKey = required("SJ_OPS_ENCRYPTION_KEY_BASE64");
if (password.length < 16) throw new Error("SJ_BOOTSTRAP_OPS_PASSWORD minimal 16 karakter.");

const client = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl, options: "-c timezone=UTC" }),
});
try {
  const existing = await client.opsUser.findUnique({ where: { emailNormalized: email } });
  if (existing) throw new Error("Akun ops dengan email tersebut sudah ada; bootstrap tidak dijalankan ulang.");

  const totpSecret = generateTotpSecret();
  const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(8).toString("hex").toUpperCase());
  const [passwordHash, ...recoveryHashes] = await Promise.all([
    hashOpsSecret(password),
    ...recoveryCodes.map((code) => hashOpsSecret(code)),
  ]);
  const requestId = randomUUID();
  await client.$transaction(async (transaction) => {
    const user = await transaction.opsUser.create({
      data: { emailNormalized: email, displayName, passwordHash, state: "ACTIVE" },
    });
    await transaction.opsMfaFactor.create({
      data: {
        opsUserId: user.id,
        encryptedSecret: encryptSecret(totpSecret, encryptionKey),
        verifiedAt: new Date(),
      },
    });
    await transaction.opsRecoveryCode.createMany({
      data: recoveryHashes.map((codeHash) => ({ opsUserId: user.id, codeHash })),
    });
    await transaction.opsAuditLog.create({
      data: {
        opsUserId: user.id,
        action: "OPS_USER_BOOTSTRAPPED",
        subjectType: "OPS_USER",
        subjectId: user.id,
        requestId,
      },
    });
  });

  const issuer = encodeURIComponent("Seputar Jaminan by ruwang");
  const account = encodeURIComponent(email);
  process.stdout.write(JSON.stringify({
    email,
    totp_uri: `otpauth://totp/${issuer}:${account}?secret=${totpSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
    recovery_codes: recoveryCodes,
    notice: "Simpan sekali di password manager. Data ini tidak dapat ditampilkan kembali.",
  }, null, 2) + "\n");
} finally {
  await client.$disconnect();
}
