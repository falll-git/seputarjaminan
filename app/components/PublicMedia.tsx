"use client";

import { Buildings, ImageBroken } from "@phosphor-icons/react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { publicMediaIdFromUrl } from "@/app/lib/public-media";

type MediaState = "loading" | "ready" | "invalid-source" | "invalid-alt" | "invalid-ratio" | "load-error";

type PublicMediaProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  kind?: "asset" | "logo";
  fit?: "cover" | "contain";
  sizes: string;
  preload?: boolean;
  decorative?: boolean;
  compact?: boolean;
  initials?: string;
  className?: string;
};

function hasUsableAltText(value: string) {
  const normalized = value.normalize("NFKC");
  if (normalized.trim().length < 1) return false;
  return !Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 8 || codePoint === 11 || codePoint === 12 || (codePoint >= 14 && codePoint <= 31) || codePoint === 127;
  });
}

function initialState(src: string, alt: string, decorative: boolean) : MediaState {
  if (!src.startsWith("/media/") || !publicMediaIdFromUrl(src)) return "invalid-source";
  if (!decorative && !hasUsableAltText(alt)) return "invalid-alt";
  return "loading";
}

function fallbackMessage(state: MediaState, kind: "asset" | "logo") {
  if (kind === "logo") return "Logo BPRS belum dapat dimuat";
  if (state === "invalid-alt") return "Keterangan foto perlu diperbaiki";
  if (state === "invalid-ratio") return "Proporsi foto perlu diperbaiki";
  return "Foto aset belum dapat dimuat";
}

export default function PublicMedia({
  src,
  alt,
  width,
  height,
  kind = "asset",
  fit = kind === "logo" ? "contain" : "cover",
  sizes,
  preload = false,
  decorative = false,
  compact = false,
  initials,
  className = "",
}: PublicMediaProps) {
  const baseState = useMemo(() => initialState(src, alt, decorative), [alt, decorative, src]);
  const mediaKey = `${src}\n${alt}\n${decorative ? "decorative" : "informative"}`;
  const [recordedState, setRecordedState] = useState<{ key: string; value: MediaState }>({
    key: mediaKey,
    value: baseState,
  });
  const state = recordedState.key === mediaKey ? recordedState.value : baseState;
  const setState = (value: MediaState) => setRecordedState({ key: mediaKey, value });

  const isFallback = state !== "loading" && state !== "ready";
  const message = fallbackMessage(state, kind);

  return (
    <span
      className={`public-media public-media--${kind}${compact ? " public-media--compact" : ""}${className ? ` ${className}` : ""}`}
      data-media-state={state}
    >
      {state === "loading" && <span className="public-media-skeleton" aria-hidden="true" />}

      {!isFallback && (
        <Image
          src={src}
          alt={decorative ? "" : alt.trim()}
          fill
          sizes={sizes}
          preload={preload}
          unoptimized
          style={{ objectFit: fit }}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (
              kind === "asset"
              && width !== undefined
              && height !== undefined
              && (image.naturalWidth !== width || image.naturalHeight !== height)
            ) {
              setState("invalid-ratio");
              return;
            }
            setState("ready");
          }}
          onError={() => setState("load-error")}
        />
      )}

      {isFallback && (
        <span
          className="public-media-fallback"
          role={decorative ? undefined : "img"}
          aria-hidden={decorative || undefined}
          aria-label={decorative ? undefined : message}
        >
          {kind === "logo" ? (
            <>
              <Buildings aria-hidden="true" />
              {initials && <strong aria-hidden="true">{initials}</strong>}
            </>
          ) : (
            <ImageBroken aria-hidden="true" />
          )}
          {kind === "asset" && !compact && <span>{message}</span>}
        </span>
      )}
    </span>
  );
}
