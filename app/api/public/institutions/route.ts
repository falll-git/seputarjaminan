import { listPublicInstitutions, PublicApiError } from "@/app/lib/public-api";
import { parsePublicPageQuery, PublicQueryError, searchParamsRecord } from "@/app/lib/public-page-query";
import { toBprsProfile } from "@/app/data/catalog";

/** Bounded public BFF; no credentials, arbitrary upstream URLs, or enumeration. */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const query = parsePublicPageQuery(searchParamsRecord(new URL(request.url).searchParams), "picker");
    const page = await listPublicInstitutions({ ...query, limit: 20 });
    return Response.json({ items: page.items.map(toBprsProfile), next_cursor: page.next_cursor }, { headers });
  } catch (error) {
    const invalid = error instanceof PublicQueryError || error instanceof PublicApiError && error.status === 400;
    return Response.json({ code: invalid ? "FILTER_INVALID" : "PUBLIC_API_UNAVAILABLE" }, { status: invalid ? 400 : 503, headers });
  }
}
