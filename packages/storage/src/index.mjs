export { FilesystemStorageAdapter } from "./filesystem.mjs";
export { assertLogicalObjectKey, resolveInsideRoot } from "./logical-key.mjs";
export { S3CompatibleStorageAdapter } from "./s3-compatible.mjs";

import { FilesystemStorageAdapter } from "./filesystem.mjs";
import { S3CompatibleStorageAdapter } from "./s3-compatible.mjs";

export function createStorageAdapter(storageConfig) {
  if (storageConfig.provider === "FILESYSTEM") {
    return new FilesystemStorageAdapter({
      root: storageConfig.root,
      stopFreeBytes: storageConfig.stopFreeBytes,
    });
  }
  if (storageConfig.provider === "S3_COMPATIBLE") {
    return new S3CompatibleStorageAdapter(storageConfig.s3);
  }
  throw new TypeError("Storage provider tidak dikenali.");
}
