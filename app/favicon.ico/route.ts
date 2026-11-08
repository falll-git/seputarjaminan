// Some browsers request this legacy path before streamed icon metadata arrives.
// Keep the existing brand asset as the single source; do not invent a second logo.
export function GET() {
  return new Response(null, {
    status: 307,
    headers: { Location: "/icon.svg", "Cache-Control": "public, max-age=86400" },
  });
}
