export default function BrandLockup({ inverted = false }: { inverted?: boolean }) {
  return (
    <a className={`brand-lockup${inverted ? " is-inverted" : ""}`} href="/" aria-label="Seputarjaminan by ruwang, kembali ke beranda">
      <span className="brand-type">
        <strong>seputarjaminan</strong>
        <span className="brand-signature">
          <small>by</small>
          <span>ruwang</span>
        </span>
      </span>
    </a>
  );
}
