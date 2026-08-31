import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertLogicalObjectKey } from "./logical-key.mjs";

export class S3CompatibleStorageAdapter {
  constructor({ endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle }) {
    this.bucket = bucket;
    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async createPresignedUpload({ logicalKey, contentType, checksumSha256, expiresSeconds }) {
    const key = assertLogicalObjectKey(logicalKey);
    const checksumBase64 = Buffer.from(checksumSha256, "hex").toString("base64");
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ChecksumSHA256: checksumBase64,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresSeconds });
  }

  async putObject(logicalKey, body, { contentType, expectedSha256 } = {}) {
    const key = assertLogicalObjectKey(logicalKey);
    const checksumBase64 = expectedSha256
      ? Buffer.from(expectedSha256, "hex").toString("base64")
      : undefined;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ChecksumSHA256: checksumBase64,
      }),
    );
    return { logicalKey: key, sha256: expectedSha256 };
  }

  async readObject(logicalKey) {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: assertLogicalObjectKey(logicalKey) }),
    );
    return {
      body: result.Body,
      sizeBytes: result.ContentLength,
      lastModified: result.LastModified,
      contentType: result.ContentType,
    };
  }

  async objectExists(logicalKey) {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: assertLogicalObjectKey(logicalKey) }),
      );
      return true;
    } catch (error) {
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }

  async moveObject(sourceKey, destinationKey) {
    const source = assertLogicalObjectKey(sourceKey);
    const destination = assertLogicalObjectKey(destinationKey);
    const before = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: source }));
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: encodeURIComponent(this.bucket + "/" + source),
        Key: destination,
      }),
    );
    const after = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: destination }));
    if (before.ContentLength !== after.ContentLength) {
      throw new Error("Verifikasi copy object S3-compatible gagal; sumber tidak dihapus.");
    }
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: source }));
  }

  async deleteTemporaryObject(logicalKey) {
    const key = assertLogicalObjectKey(logicalKey);
    if (!key.includes("/temporary/") && !key.includes("/failed/")) {
      throw new Error("Penghapusan otomatis hanya diizinkan untuk object temporary atau failed.");
    }
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
