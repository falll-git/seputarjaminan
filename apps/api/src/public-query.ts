import { createHash } from "node:crypto";
import { ApiError } from "./errors.js";

export function assertQueryKeys(query: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(query).some(key => !allowed.includes(key))) {
    throw new ApiError(400, "FILTER_INVALID", "Parameter pencarian tidak dikenali.");
  }
}

export function normalizeLocation(value?: string) {
  return value?.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

// Cursor is an opaque position, not authorization. Bind it to the normalized
// filters and ordering, but not page size (profile -> catalogue can change it).
export function cursorScope(values: unknown[]) {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

export function encodePublicCursor(scope: string, position: Record<string, string>) {
  return Buffer.from(JSON.stringify({ v: 1, scope, ...position })).toString("base64url");
}

export function decodePublicCursor(value: string | undefined, scope: string, kind: "asset" | "institution") {
  if (!value) return null;
  try {
    if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error();
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) throw new Error();
    const parsed = JSON.parse(bytes.toString("utf8"));
    const keys = kind === "asset" ? ["v", "scope", "updated_at", "id"] : ["v", "scope", "public_slug"];
    if (!parsed || Array.isArray(parsed) || Object.keys(parsed).length !== keys.length ||
      Object.keys(parsed).some(key => !keys.includes(key)) || parsed.v !== 1 || parsed.scope !== scope) throw new Error();
    if (kind === "asset") {
      if (typeof parsed.id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(parsed.id) ||
        typeof parsed.updated_at !== "string" || new Date(parsed.updated_at).toISOString() !== parsed.updated_at) throw new Error();
    } else if (typeof parsed.public_slug !== "string" || parsed.public_slug.length > 100 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(parsed.public_slug)) throw new Error();
    return parsed as { id: string; updated_at: string; public_slug: string };
  } catch {
    throw new ApiError(400, "CURSOR_INVALID", "Halaman tidak sesuai pencarian. Silakan kembali ke halaman pertama.");
  }
}
