import path from "node:path";

const LOGICAL_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9/_-]*[a-zA-Z0-9]$/;

export function assertLogicalObjectKey(value) {
  if (typeof value !== "string" || value.length < 3 || value.length > 512) {
    throw new TypeError("Logical object key tidak valid.");
  }
  if (
    !LOGICAL_KEY_PATTERN.test(value)
    || value.includes("//")
    || value.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new TypeError("Logical object key mengandung karakter atau segment terlarang.");
  }
  return value;
}

export function resolveInsideRoot(root, logicalKey) {
  const validated = assertLogicalObjectKey(logicalKey);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...validated.split("/"));
  if (resolved === resolvedRoot || !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new Error("Logical object key keluar dari storage root.");
  }
  return resolved;
}
