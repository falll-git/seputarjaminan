import { PublicApiError, requestPublicMedia } from "@/app/lib/public-api";
import { isPublicMediaId } from "@/app/lib/public-media";

type RouteContext = { params: Promise<{ mediaId: string }> };

const MAX_PUBLIC_MEDIA_BYTES = 10_485_760;
const MEDIA_RESPONSE_HEADERS = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
  "Content-Disposition": "inline; filename=\"media.webp\"",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
} as const;

function emptyMediaResponse(status: number) {
  return new Response(null, {
    status,
    headers: {
      ...MEDIA_RESPONSE_HEADERS,
      "Cache-Control": "no-store",
    },
  });
}

function limitedBody(body: ReadableStream<Uint8Array>, maximumBytes: number) {
  const reader = body.getReader();
  let receivedBytes = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          controller.close();
          return;
        }
        receivedBytes += chunk.value.byteLength;
        if (receivedBytes > maximumBytes) {
          await reader.cancel("public_media_limit_exceeded");
          controller.error(new Error("Ukuran media publik melampaui batas aman."));
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const { mediaId } = await context.params;
  if (!isPublicMediaId(mediaId)) return emptyMediaResponse(404);

  try {
    const upstream = await requestPublicMedia(mediaId);
    if (!upstream.ok || !upstream.body) return emptyMediaResponse(upstream.status === 404 ? 404 : 502);

    const contentType = upstream.headers.get("content-type")?.split(";", 1)[0]?.trim().toLocaleLowerCase("en-US");
    if (contentType !== "image/webp") {
      await upstream.body.cancel("public_media_type_rejected");
      return emptyMediaResponse(502);
    }

    const contentLengthHeader = upstream.headers.get("content-length");
    const contentLength = contentLengthHeader && /^\d+$/u.test(contentLengthHeader) ? Number(contentLengthHeader) : null;
    if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > MAX_PUBLIC_MEDIA_BYTES)) {
      await upstream.body.cancel("public_media_size_rejected");
      return emptyMediaResponse(502);
    }

    const headers = new Headers(MEDIA_RESPONSE_HEADERS);
    headers.set("Content-Type", "image/webp");
    if (contentLength !== null) headers.set("Content-Length", String(contentLength));
    const etag = upstream.headers.get("etag");
    if (etag) headers.set("ETag", etag);
    const lastModified = upstream.headers.get("last-modified");
    if (lastModified) headers.set("Last-Modified", lastModified);

    return new Response(limitedBody(upstream.body, MAX_PUBLIC_MEDIA_BYTES), { status: 200, headers });
  } catch (error) {
    const status = error instanceof PublicApiError && error.status === 404 ? 404 : 503;
    return emptyMediaResponse(status);
  }
}
