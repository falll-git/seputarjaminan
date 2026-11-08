import styles from "./PublicLoadingState.module.css";

type Variant = "catalog" | "detail" | "directory" | "home" | "profile";
const copy = {
  home: ["Menyiapkan beranda", "Menyiapkan beranda"],
  catalog: ["Katalog aset", "Menyiapkan katalog"],
  detail: ["Memuat detail aset", "Menyiapkan detail"],
  directory: ["Daftar BPRS", "Menyiapkan direktori"],
  profile: ["Memuat profil BPRS", "Menyiapkan profil"],
};
const Line = ({ className = "" }: { className?: string }) => <i className={`loading-line ${className}`} />;
const Block = ({ className = "" }: { className?: string }) => <i className={`loading-block ${className}`} />;
function CardSkeleton() {
  return <div className={styles.card}><Block className={styles.photo}/><Line className="loading-line--short"/><Line className={styles.title}/><Line className="loading-line--medium"/><Block className={styles.identity}/></div>;
}
export default function PublicLoadingState({ variant }: { variant: Variant }) {
  const heading = <header className={styles.heading}><h1>{copy[variant][0]}</h1><p>{copy[variant][1]}. Mohon tunggu sebentar.</p></header>;
  const toolbar = <div className={styles.toolbar} aria-hidden="true"><Block className={styles.control}/>{variant === "catalog" && <Block className={styles.submit}/>}<Block className={styles.control}/></div>;
  return <main className={`public-loading ${styles.loading}`} data-loading-variant={variant} aria-busy="true" aria-live="polite">
    <div className="site-frame">
      {variant === "home" ? <div className={styles.home}>
        {heading}<div className={styles.homeRail} aria-hidden="true"><CardSkeleton/><CardSkeleton/></div>
        <div className={styles.categories} aria-hidden="true">{[0,1,2,3].map(i=><Block className={styles.category} key={i}/>)}</div>
      </div> : variant === "detail" ? <>
        <div aria-hidden="true"><Line className="loading-line--short"/></div>
        <div className={styles.detail}>{heading}<div className={styles.gallery} aria-hidden="true"><Block className={styles.photo}/><Line className="loading-line--medium"/><div className={styles.thumbs}>{[0,1,2].map(i=><Block key={i}/>)}</div></div>
          <div className={styles.information} aria-hidden="true"><Block className={styles.contact}/><Line/><Line/><Line className="loading-line--medium"/></div>
        </div>
      </> : variant === "profile" ? <>
        <div className={styles.profile}><div aria-hidden="true"><Block className={styles.logo}/></div>{heading}</div>
        <div className={styles.grid} aria-hidden="true">{[0,1].map(i=><CardSkeleton key={i}/>)}</div>
      </> : <>{heading}{toolbar}{variant === "catalog" ? <div className={styles.catalog} aria-hidden="true">
        <div className={styles.filters}>{[0,1,2].map(i=><Block className={styles.filter} key={i}/>)}</div>
        <div><Line className={styles.count}/><div className={styles.grid}>{[0,1,2,3].map(i=><CardSkeleton key={i}/>)}</div></div>
      </div> : <div className={styles.directory} aria-hidden="true">{[0,1,2].map(i=><div className={styles.row} key={i}><Block className={styles.logo}/><div className={styles.copy}><Line className={styles.title}/><Line className="loading-line--medium"/></div><Line/></div>)}</div>}</>}
    </div>
  </main>;
}
