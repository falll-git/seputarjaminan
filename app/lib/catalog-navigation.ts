/** Accept only a local catalogue route and its supported public query fields. */
export function safeCatalogReturn(value?: string): string {
  if (!value || value.length > 3000 || !/^\/katalog(?:\?|$)/.test(value)) return "/katalog";
  try {
    const url = new URL(value, "https://catalog.invalid");
    if (url.origin !== "https://catalog.invalid" || url.pathname !== "/katalog") return "/katalog";
    const query = new URLSearchParams();
    for (const key of ["q", "category", "province", "bprs", "sort", "cursor"]) {
      const entry = url.searchParams.get(key)?.trim();
      if (entry) query.set(key, entry.slice(0, key === "cursor" ? 1000 : 100));
    }
    return `/katalog${query.size ? `?${query}` : ""}`;
  } catch { return "/katalog"; }
}

const storageKey = "sj-catalog-position";
export function rememberCatalogPosition(url: string) {
  try { sessionStorage.setItem(storageKey, JSON.stringify({ url: safeCatalogReturn(url), y: window.scrollY, at: Date.now() })); } catch { /* Storage is optional. URL context still works. */ }
}
export function requestCatalogRestore(url: string) {
  try { sessionStorage.setItem("sj-catalog-restore", safeCatalogReturn(url)); } catch { /* No persistent storage required. */ }
}
export function restoreCatalogPosition(url: string) {
  try {
    const expected = safeCatalogReturn(url);
    if (sessionStorage.getItem("sj-catalog-restore") !== expected) return;
    sessionStorage.removeItem("sj-catalog-restore");
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (saved?.url === expected && Number.isFinite(saved.y) && saved.y >= 0 && Date.now() - saved.at < 30 * 60_000) {
      window.scrollTo({ top: saved.y, behavior: "instant" });
    }
  } catch { /* Invalid/blocked storage must not break navigation. */ }
}
