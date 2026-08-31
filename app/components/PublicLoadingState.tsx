type PublicLoadingVariant = "catalog" | "detail" | "directory" | "home";

type PublicLoadingStateProps = {
  variant: PublicLoadingVariant;
};

const loadingCopy: Record<PublicLoadingVariant, { index: string; label: string; title: string }> = {
  home: { index: "01", label: "Menyiapkan beranda", title: "Mengambil publikasi terbaru." },
  catalog: { index: "02", label: "Menyiapkan katalog", title: "Menyusun aset dan filter." },
  detail: { index: "03", label: "Menyiapkan detail", title: "Mengambil informasi aset." },
  directory: { index: "04", label: "Menyiapkan direktori", title: "Mengambil BPRS penerbit." },
};

export default function PublicLoadingState({ variant }: PublicLoadingStateProps) {
  const copy = loadingCopy[variant];

  return (
    <main className={`public-loading public-loading--${variant}`} aria-busy="true" aria-live="polite">
      <header className="site-frame public-loading-heading">
        <span className="public-loading-index" aria-hidden="true">{copy.index}</span>
        <div>
          <p>{copy.label}</p>
          <h1>{copy.title}</h1>
          <span>Mohon tunggu sebentar. Informasi sedang diminta dari sumber publik.</span>
        </div>
      </header>

      <section className="site-frame public-loading-composition" aria-hidden="true">
        <div className="public-loading-primary">
          <i className="loading-block loading-block--media" />
          <i className="loading-line loading-line--wide" />
          <i className="loading-line loading-line--medium" />
        </div>
        <div className="public-loading-secondary">
          <i className="loading-line loading-line--short" />
          <i className="loading-line loading-line--wide" />
          <i className="loading-line loading-line--medium" />
          <i className="loading-block loading-block--row" />
          <i className="loading-block loading-block--row" />
          <i className="loading-block loading-block--row" />
        </div>
      </section>
    </main>
  );
}
