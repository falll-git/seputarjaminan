import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties } from "react";
import type { BprsProfile } from "@/app/data/catalog";
import BprsMark from "./BprsMark";
import EditorialRevealSection from "./EditorialRevealSection";

function MarqueeList({ profiles, duplicate = false }: { profiles: BprsProfile[]; duplicate?: boolean }) {
  return (
    <ul className="bprs-marquee-list" aria-hidden={duplicate || undefined}>
      {profiles.map((profile) => (
          <li key={`${profile.slug}-${duplicate ? "copy" : "source"}`}>
            <a href={`/bprs/${profile.slug}`} tabIndex={duplicate ? -1 : undefined}>
              <BprsMark profile={profile} compact />
              <span className="bprs-marquee-name">{profile.name}</span>
              <span className="bprs-marquee-count">{profile.publishedAssetCount} aset</span>
            </a>
          </li>
      ))}
    </ul>
  );
}

export default function BprsMarquee({ profiles }: { profiles: BprsProfile[] }) {
  const rail = profiles.length >= 4;
  const staticColumns = { "--bprs-count": Math.max(profiles.length, 1) } as CSSProperties;

  return (
    <EditorialRevealSection className="bprs-marquee-section" labelledBy="bprs-marquee-title">
      <div className="site-frame bprs-marquee-heading">
        <div>
          <p className="section-kicker">Jaringan penerbit</p>
          <h2 id="bprs-marquee-title">BPRS yang terhubung</h2>
        </div>
        <a className="editorial-link" href="/bprs">
          <span>Lihat direktori penerbit</span>
          <ArrowUpRight aria-hidden="true" />
        </a>
      </div>

      <div
        className={`bprs-marquee-viewport ${rail ? "is-rail" : "is-static"}`}
        aria-label="Daftar BPRS penerbit aktif"
        data-layout={rail ? "rail" : "static"}
        style={rail ? undefined : staticColumns}
      >
        <div className="bprs-marquee-track">
          <MarqueeList profiles={profiles} />
          {rail ? <MarqueeList profiles={profiles} duplicate /> : null}
        </div>
      </div>
      <p className="site-frame bprs-marquee-note">
        Logo dan jumlah aset mengikuti informasi publikasi aktif dari masing-masing BPRS.
      </p>
    </EditorialRevealSection>
  );
}
