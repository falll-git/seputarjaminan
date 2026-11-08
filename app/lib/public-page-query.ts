/** URL controls must never silently become a different search. No server imports. */
export class PublicQueryError extends Error {
  constructor() { super("Parameter pencarian tidak valid. Atur ulang pencarian untuk melanjutkan."); }
}
type Params = Record<string, string | string[] | undefined>;
export function parsePublicPageQuery(params: Params, kind: "catalog" | "directory" | "picker") {
  const allowed = kind === "catalog" ? ["q", "category", "province", "bprs", "sort", "cursor"] : ["q", "province", "cursor"];
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(params)) {
    if (!allowed.includes(key) || typeof raw !== "string" || raw.length > (key === "cursor" ? 1000 : 100)) throw new PublicQueryError();
    // Native home/directory GET forms submit blank optional controls. Omit only
    // those fields; malformed cursors, duplicates and picker input stay strict.
    const optionalFormField = (kind === "catalog" && key === "q") || (kind === "directory" && (key === "q" || key === "province"));
    if (optionalFormField && !raw.trim()) continue;
    if (!raw.trim()) throw new PublicQueryError();
    result[key] = key === "province" ? raw.normalize("NFKC").trim().replace(/\s+/gu, " ") : raw.trim();
  }
  if (result.category && !["tanah", "bangunan", "mesin-peralatan", "kendaraan"].includes(result.category)) throw new PublicQueryError();
  if (result.sort && !["terbaru", "terlama"].includes(result.sort)) throw new PublicQueryError();
  if (result.bprs && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(result.bprs)) throw new PublicQueryError();
  if (result.cursor && !/^[A-Za-z0-9_-]+$/u.test(result.cursor)) throw new PublicQueryError();
  return result;
}

export function searchParamsRecord(params: URLSearchParams): Params {
  return Object.fromEntries([...new Set(params.keys())].map(key => {
    const values = params.getAll(key);
    return [key, values.length === 1 ? values[0] : values];
  }));
}
