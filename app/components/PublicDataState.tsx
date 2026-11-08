"use client";

import { ArrowClockwise } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import StateIllustration, { type StateScene } from "./StateIllustration";
import styles from "./PublicDataState.module.css";

export type PublicDataStateKind = "empty" | "error" | "no-results" | "offline" | "timeout" | "invalid-query";

type PublicDataStateProps = {
  kind: PublicDataStateKind;
  title: string;
  message: string;
  compact?: boolean;
  headingLevel?: 1 | 2;
  scene?: StateScene;
  children?: ReactNode;
};

const stateDetails = {
  "invalid-query": { label: "Periksa pencarian", scene: "search" },
  empty: { label: "Ruang untuk publikasi berikutnya", scene: "catalog" },
  error: { label: "Layanan sedang terganggu", scene: "error" },
  "no-results": { label: "Coba pencarian lain", scene: "search" },
  offline: { label: "Koneksi terputus", scene: "offline" },
  timeout: { label: "Waktu tunggu habis", scene: "timeout" },
} as const;

export default function PublicDataState({ kind, title, message, compact = false, headingLevel = 2, scene, children }: PublicDataStateProps) {
  const details = stateDetails[kind];
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const retryable = kind === "error" || kind === "offline" || kind === "timeout";

  return (
    <section
      className={`${styles.state} ${compact ? styles.compact : ""}`}
      data-public-state={kind}
      role={retryable ? "status" : undefined}
      aria-live={retryable ? "polite" : undefined}
    >
      <StateIllustration scene={retryable ? details.scene : scene ?? details.scene} />
      <div className={styles.copy}>
        <p className={styles.label}>{details.label}</p>
        <Heading>{title}</Heading>
        <p className={styles.message}>{message}</p>
        {(retryable || children) && <div className={styles.actions}>
          {retryable && <button className="ui-button ui-button-secondary" type="button" onClick={() => window.location.reload()}>Coba muat ulang<ArrowClockwise aria-hidden="true" /></button>}
          {children}
        </div>}
      </div>
    </section>
  );
}
