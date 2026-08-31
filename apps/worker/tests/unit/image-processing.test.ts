import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { MediaValidationError, streamToLimitedBuffer, transformPublicImage } from "../../src/image-processing.js";

test("gambar sintetis diubah menjadi WebP tanpa metadata dan maksimal 2560px", async () => {
  const source = await sharp({
    create: { width: 3000, height: 1800, channels: 3, background: "#4455ff" },
  }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const output = await transformPublicImage(source);
  assert.equal(output.mime, "image/webp");
  assert.equal(output.width, 1536);
  assert.equal(output.height, 2560);
  const metadata = await sharp(output.bytes).metadata();
  assert.equal(metadata.exif, undefined);
  assert.ok(Math.max(output.width, output.height) <= 2560);
});

test("file non-gambar dan stream berlebih ditolak", async () => {
  await assert.rejects(
    transformPublicImage(Buffer.from("bukan gambar")),
    (error) => error instanceof MediaValidationError && error.code === "MEDIA_DECODE_FAILED",
  );
  async function* chunks() {
    yield Buffer.alloc(5);
    yield Buffer.alloc(6);
  }
  await assert.rejects(
    streamToLimitedBuffer(chunks(), 10),
    (error) => error instanceof MediaValidationError && error.code === "MEDIA_TOO_LARGE",
  );
});
