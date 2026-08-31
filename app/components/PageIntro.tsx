import type { ReactNode } from "react";

export default function PageIntro({ index, eyebrow, title, description, aside }: { index: string; eyebrow: string; title: string; description: string; aside?: ReactNode }) {
  return (
    <section className="page-intro site-frame">
      <div className="page-intro-index" aria-hidden="true">{index}</div>
      <div className="page-intro-copy">
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <div className="page-intro-bottom">
          <p>{description}</p>
          {aside && <div className="page-intro-aside">{aside}</div>}
        </div>
      </div>
    </section>
  );
}
