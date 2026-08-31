"use client";

import {
  ArrowClockwise,
  ClockCountdown,
  Info,
  MagnifyingGlassMinus,
  WifiSlash,
} from "@phosphor-icons/react";

export type PublicDataStateKind = "empty" | "error" | "no-results" | "offline" | "timeout";

type PublicDataStateProps = {
  kind: PublicDataStateKind;
  title: string;
  message: string;
  compact?: boolean;
};

const stateDetails = {
  empty: { code: "00", label: "Belum ada publikasi", icon: Info },
  error: { code: "!", label: "Layanan sedang terganggu", icon: ArrowClockwise },
  "no-results": { code: "00", label: "Tidak ada hasil", icon: MagnifyingGlassMinus },
  offline: { code: "—", label: "Koneksi terputus", icon: WifiSlash },
  timeout: { code: "…", label: "Waktu tunggu habis", icon: ClockCountdown },
} as const;

export default function PublicDataState({ kind, title, message, compact = false }: PublicDataStateProps) {
  const details = stateDetails[kind];
  const Icon = details.icon;
  const retryable = kind === "error" || kind === "offline" || kind === "timeout";

  return (
    <section
      className={`public-data-state public-data-state--${kind}${compact ? " public-data-state--compact" : ""}`}
      role={retryable ? "status" : undefined}
      aria-live={retryable ? "polite" : undefined}
    >
      <span className="public-data-state-index" aria-hidden="true">{details.code}</span>
      <Icon aria-hidden="true" />
      <div>
        <p>{details.label}</p>
        <h2>{title}</h2>
        <span>{message}</span>
      </div>
      {retryable && (
        <button type="button" onClick={() => window.location.reload()}>
          <span>Coba muat ulang</span>
          <ArrowClockwise aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
