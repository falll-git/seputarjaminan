const MEDIA_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UPSTREAM_MEDIA_PATH_PATTERN = /^\/v1\/public\/media\/([0-9a-f-]+)$/iu;
const SAME_ORIGIN_MEDIA_PATH_PATTERN = /^\/media\/([0-9a-f-]+)$/iu;

export function isPublicMediaId(value: string) {
  return MEDIA_ID_PATTERN.test(value);
}

export function publicMediaIdFromUrl(value: string) {
  const localMatch = SAME_ORIGIN_MEDIA_PATH_PATTERN.exec(value);
  if (localMatch?.[1] && isPublicMediaId(localMatch[1])) return localMatch[1].toLocaleLowerCase("en-US");

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (!/^https?:$/u.test(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  const upstreamMatch = UPSTREAM_MEDIA_PATH_PATTERN.exec(parsed.pathname);
  return upstreamMatch?.[1] && isPublicMediaId(upstreamMatch[1])
    ? upstreamMatch[1].toLocaleLowerCase("en-US")
    : null;
}

export function toSameOriginPublicMediaUrl(value: string) {
  const mediaId = publicMediaIdFromUrl(value);
  if (!mediaId) throw new Error("Alamat media publik tidak valid.");
  return `/media/${mediaId}`;
}
