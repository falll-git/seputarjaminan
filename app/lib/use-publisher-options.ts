"use client";
import { useEffect, useRef, useState } from "react";
import type { BprsProfile } from "../data/catalog";

/** One bounded request per search/page; no automatic traversal of the directory. */
export function usePublisherOptions(seed: BprsProfile[], initialCursor?: string | null, unavailable?: boolean) {
  const [page, setPage] = useState({ items: seed, cursor: initialCursor ?? null });
  const [request, setRequest] = useState({ q: "", cursor: "", revision: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(Boolean(unavailable));
  const generation = useRef(0);
  const search = (q: string) => {
    generation.current++;
    setLoading(true);
    setRequest({ q: q.trim(), cursor: "", revision: generation.current });
  };
  const loadMore = () => {
    generation.current++;
    setLoading(true);
    setRequest(current => ({ ...current, cursor: error ? current.cursor : page.cursor ?? "", revision: generation.current }));
  };
  useEffect(() => {
    if (!request.revision) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams();
        if (request.q) query.set("q", request.q);
        if (request.cursor) query.set("cursor", request.cursor);
        const response = await fetch(`/api/public/institutions?${query}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]), cache: "no-store",
        });
        if (!response.ok) throw new Error("picker unavailable");
        const result = await response.json() as { items: BprsProfile[]; next_cursor: string | null };
        if (!Array.isArray(result.items) || result.items.length > 20 || (result.next_cursor !== null && typeof result.next_cursor !== "string") ||
          (request.cursor && result.next_cursor === request.cursor)) throw new Error("invalid picker page");
        if (controller.signal.aborted || generation.current !== request.revision) return;
        setPage(previous => ({
          items: request.cursor ? [...new Map([...previous.items, ...result.items].map(item => [item.slug, item])).values()] : result.items,
          cursor: result.next_cursor,
        }));
        setError(false);
      } catch {
        if (!controller.signal.aborted && generation.current === request.revision) setError(true);
      } finally {
        if (!controller.signal.aborted && generation.current === request.revision) setLoading(false);
      }
    }, request.cursor ? 0 : 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [request]);
  return { ...page, loading, error, search, loadMore };
}
