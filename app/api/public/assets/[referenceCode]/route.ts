import { NextResponse } from "next/server";
import { getPublicAsset, PublicApiError, publicAssetForBrowser } from "@/app/lib/public-api";

type RouteContext = { params: Promise<{ referenceCode: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { referenceCode } = await context.params;
  try {
    const detail = await getPublicAsset(referenceCode.toLocaleUpperCase("en-US"));
    return NextResponse.json(publicAssetForBrowser(detail), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status = error instanceof PublicApiError && error.status === 404 ? 404 : 503;
    return NextResponse.json(
      {
        code: status === 404 ? "ASSET_NOT_FOUND" : "PUBLIC_API_UNAVAILABLE",
        message: status === 404
          ? "Aset tidak tersedia."
          : "Detail aset sedang tidak dapat dimuat. Silakan coba kembali.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
