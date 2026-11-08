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

test("decoded image must match declared MIME and dimensions", async () => {
  const source = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#445566' } }).png().toBuffer();
  await assert.rejects(transformPublicImage(source, { mime: 'image/jpeg', width: 80, height: 60 }), /format/i);
  await assert.rejects(transformPublicImage(source, { mime: 'image/png', width: 81, height: 60 }), /dimensi/i);
});

test("supported JPEG PNG WebP decode to safe public bytes; truncated raster is rejected", async () => {
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    const source = await sharp({ create: { width: 128, height: 96, channels: 3, background: '#343f72' } }).toFormat(format).toBuffer();
    const result = await transformPublicImage(source, { mime: `image/${format}`, width: 128, height: 96 });
    assert.equal(result.mime, 'image/webp'); assert.equal(result.width, 128); assert.equal(result.height, 96);
    await assert.rejects(transformPublicImage(source.subarray(0, Math.floor(source.length / 2))), MediaValidationError);
  }
});

test("card and thumbnail preserve aspect; transparent logo stays lossless and metadata-free", async () => {
  const source = await sharp({ create: { width: 1200, height: 800, channels: 4, background: { r: 52, g: 63, b: 114, alpha: 0.7 } } }).png().withMetadata().toBuffer();
  for (const [size, height] of [[960, 640], [320, 213]] as const) {
    const image = await transformPublicImage(source, undefined, { size, logo: true });
    assert.equal(image.width, size); assert.equal(image.height, height);
    const metadata = await sharp(image.bytes).metadata();
    assert.equal(metadata.hasAlpha, true); assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined);
  }
  const tiny = await sharp({ create: { width: 20, height: 10, channels: 4, background: { r: 52, g: 63, b: 114, alpha: 0.7 } } }).png().toBuffer();
  const output = await transformPublicImage(tiny, undefined, { size: 320, logo: true });
  assert.equal(output.width, 20); assert.equal(output.height, 10);
  assert.deepEqual(await sharp(output.bytes).raw().toBuffer(), await sharp(tiny).raw().toBuffer());
});
