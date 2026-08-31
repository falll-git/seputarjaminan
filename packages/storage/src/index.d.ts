import type { Readable } from "node:stream";

export type StoredObject = {
  body: Readable;
  sizeBytes?: number;
  lastModified?: Date;
  contentType?: string;
};

export interface StorageAdapter {
  putObject(logicalKey: string, body: Buffer | Readable, options?: {
    maxBytes?: number;
    expectedSha256?: string;
    contentType?: string;
  }): Promise<{ logicalKey: string; sizeBytes?: number; sha256?: string }>;
  readObject(logicalKey: string): Promise<StoredObject>;
  objectExists(logicalKey: string): Promise<boolean>;
  moveObject(sourceKey: string, destinationKey: string): Promise<void>;
  deleteTemporaryObject(logicalKey: string): Promise<void>;
  createPresignedUpload?(input: {
    logicalKey: string;
    contentType: string;
    checksumSha256: string;
    expiresSeconds: number;
  }): Promise<string>;
}

export class FilesystemStorageAdapter implements StorageAdapter {
  constructor(config: { root: string; stopFreeBytes?: number });
  putObject: StorageAdapter["putObject"];
  readObject: StorageAdapter["readObject"];
  objectExists: StorageAdapter["objectExists"];
  moveObject: StorageAdapter["moveObject"];
  deleteTemporaryObject: StorageAdapter["deleteTemporaryObject"];
}

export class S3CompatibleStorageAdapter implements StorageAdapter {
  constructor(config: Record<string, unknown>);
  putObject: StorageAdapter["putObject"];
  readObject: StorageAdapter["readObject"];
  objectExists: StorageAdapter["objectExists"];
  moveObject: StorageAdapter["moveObject"];
  deleteTemporaryObject: StorageAdapter["deleteTemporaryObject"];
  createPresignedUpload: NonNullable<StorageAdapter["createPresignedUpload"]>;
}

export function createStorageAdapter(config: any): StorageAdapter;
export function assertLogicalObjectKey(value: string): string;
export function resolveInsideRoot(root: string, logicalKey: string): string;
