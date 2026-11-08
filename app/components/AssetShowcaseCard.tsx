"use client";

import type { Asset, AssetSpec } from "../data/catalog";
import AssetCard from "./AssetCard";

/** Expressive home display card in the same visual family as catalogue cards. */
export default function AssetShowcaseCard({ asset, priority = false, size = "standard", specs }: { asset: Asset; priority?: boolean; size?: "standard" | "wide" | "tall"; specs?: AssetSpec[] }) {
  return <AssetCard asset={asset} priority={priority} size={size} variant="display" specs={specs} />;
}
