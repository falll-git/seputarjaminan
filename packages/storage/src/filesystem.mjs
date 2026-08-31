import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { mkdir, open, rename, stat, statfs, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { resolveInsideRoot } from "./logical-key.mjs";

function toReadable(body) {
  if (Buffer.isBuffer(body) || typeof body === "string") {
    return Readable.from([body]);
  }
  if (body && typeof body.pipe === "function") {
    return body;
  }
  throw new TypeError("Body storage harus Buffer, string, atau readable stream.");
}

export class FilesystemStorageAdapter {
  constructor({ root, stopFreeBytes = 0 }) {
    if (!path.isAbsolute(root)) {
      throw new TypeError("Filesystem storage root harus absolute path.");
    }
    this.root = path.resolve(root);
    this.stopFreeBytes = stopFreeBytes;
  }

  async assertWritableCapacity() {
    await mkdir(this.root, { recursive: true });
    if (!this.stopFreeBytes) return;
    const info = await statfs(this.root);
    const availableBytes = Number(info.bavail) * Number(info.bsize);
    if (availableBytes <= this.stopFreeBytes) {
      const error = new Error("Storage tidak memiliki ruang aman untuk upload baru.");
      error.code = "STORAGE_CAPACITY_GUARD";
      throw error;
    }
  }

  async putObject(logicalKey, body, { maxBytes, expectedSha256 } = {}) {
    await this.assertWritableCapacity();
    const target = resolveInsideRoot(this.root, logicalKey);
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = target + ".upload-" + randomUUID();
    const hash = createHash("sha256");
    let sizeBytes = 0;
    const guard = new Transform({
      transform(chunk, encoding, callback) {
        sizeBytes += chunk.length;
        if (maxBytes && sizeBytes > maxBytes) {
          const error = new Error("Ukuran media melebihi batas sesi upload.");
          error.code = "MEDIA_TOO_LARGE";
          callback(error);
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    try {
      const handle = await open(temporary, "wx", 0o600);
      await handle.close();
      await pipeline(toReadable(body), guard, fs.createWriteStream(temporary, { flags: "r+" }));
      const sha256 = hash.digest("hex");
      if (expectedSha256 && sha256 !== expectedSha256) {
        const error = new Error("Checksum media tidak sesuai sesi upload.");
        error.code = "MEDIA_CHECKSUM_MISMATCH";
        throw error;
      }
      await rename(temporary, target);
      return { logicalKey, sizeBytes, sha256 };
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  async readObject(logicalKey) {
    const target = resolveInsideRoot(this.root, logicalKey);
    const metadata = await stat(target);
    return {
      body: fs.createReadStream(target),
      sizeBytes: metadata.size,
      lastModified: metadata.mtime,
    };
  }

  async objectExists(logicalKey) {
    const target = resolveInsideRoot(this.root, logicalKey);
    try {
      const metadata = await stat(target);
      return metadata.isFile();
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }

  async moveObject(sourceKey, destinationKey) {
    const source = resolveInsideRoot(this.root, sourceKey);
    const destination = resolveInsideRoot(this.root, destinationKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(source, destination);
  }

  async deleteTemporaryObject(logicalKey) {
    if (!logicalKey.includes("/temporary/") && !logicalKey.includes("/failed/")) {
      throw new Error("Penghapusan otomatis hanya diizinkan untuk object temporary atau failed.");
    }
    await unlink(resolveInsideRoot(this.root, logicalKey));
  }
}
