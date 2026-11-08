"use client";

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { requestCatalogRestore, safeCatalogReturn } from "../lib/catalog-navigation";

export default function CatalogReturnLink({ returnTo }: { returnTo?: string }) {
  const href = safeCatalogReturn(returnTo);
  return <Link className="asset-detail-back" href={href} scroll={false} prefetch={false} onNavigate={() => requestCatalogRestore(href)}><ArrowLeft aria-hidden="true" />Kembali ke katalog</Link>;
}
