import type { BprsSummary } from "@/app/data/catalog";
import { initialsFor } from "@/app/data/catalog";
import PublicMedia from "./PublicMedia";

type BprsMarkProps = {
  profile: BprsSummary;
  compact?: boolean;
  inverted?: boolean;
};

export default function BprsMark({ profile, compact = false, inverted = false }: BprsMarkProps) {
  return (
    <span
      className={`bprs-mark${compact ? " bprs-mark--compact" : ""}${inverted ? " bprs-mark--inverted" : ""}`}
      aria-label={`Logo ${profile.name}`}
      title={`Logo ${profile.name}`}
    >
      <PublicMedia
        src={profile.markUrl}
        alt={`Logo ${profile.name}`}
        kind="logo"
        fit="contain"
        sizes={compact ? "46px" : "120px"}
        decorative
        compact={compact}
        initials={initialsFor(profile.name)}
      />
    </span>
  );
}
