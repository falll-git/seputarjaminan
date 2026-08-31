import { createHash } from "node:crypto";
import sharp from "sharp";

export class MediaValidationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MediaValidationError";
    this.code = code;
  }
}

export async function transformPublicImage(input: Buffer) {
  let metadata;
  try {
    metadata = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new MediaValidationError("MEDIA_DECODE_FAILED", "File tidak dapat dibaca sebagai gambar.");
  }
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
    throw new MediaValidationError("MEDIA_FORMAT_REJECTED", "Format gambar tidak didukung.");
  }
  if (!metadata.width || !metadata.height || (metadata.pages && metadata.pages > 1)) {
    throw new MediaValidationError("MEDIA_STRUCTURE_REJECTED", "Struktur gambar tidak didukung.");
  }
  const output = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000 })
    .rotate()
    .resize({
      width: 2560,
      height: 2560,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  return {
    bytes: output.data,
    mime: "image/webp",
    width: output.info.width,
    height: output.info.height,
    sizeBytes: output.info.size,
    sha256: createHash("sha256").update(output.data).digest("hex"),
    sourceFormat: metadata.format,
  };
}

export async function streamToLimitedBuffer(stream: AsyncIterable<Buffer | Uint8Array>, maxBytes: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > maxBytes) {
      throw new MediaValidationError("MEDIA_TOO_LARGE", "Ukuran media melampaui batas pemrosesan.");
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}
