import styles from "./StateIllustration.module.css";

export type StateScene = "catalog" | "search" | "directory" | "profile" | "photo" | "offline" | "error" | "timeout" | "missing";

/** Decorative editorial artwork, never a publication, bank logo or loading indicator. */
export default function StateIllustration({ scene = "catalog", small = false }: { scene?: StateScene; small?: boolean }) {
  const building = scene === "directory" || scene === "profile";
  const issue = scene === "error" || scene === "timeout" || scene === "offline";
  return <span className={`${styles.art} ${small ? styles.small : ""}`} data-state-art={scene} aria-hidden="true">
    <svg viewBox="0 0 260 190" fill="none" focusable="false">
      <ellipse className={styles.shadow} cx="132" cy="165" rx="98" ry="12" />
      <path className={styles.wash} d="M37 119C19 85 40 37 89 31C116 28 132 47 162 33C207 13 242 62 226 105C214 141 177 156 129 154C86 153 53 149 37 119Z" />
      <g className={styles.back} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        {building ? <><path className={styles.sage} d="M39 77L85 51L110 63V153H39Z" /><path d="M85 51V150M51 88V100M65 81V94M51 113V126M65 108V121" /></> : <rect className={styles.sage} x="46" y="43" width="113" height="111" rx="8" transform="rotate(-9 46 43)" />}
      </g>
      <g className={styles.front} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {building ? <>
          <path className={styles.paper} d="M93 64L169 39L207 60V154H93Z" />
          <path d="M169 39V153M93 81L169 56L207 76" />
          <path className={styles.sage} d="M119 120L144 112V154H119Z" />
          <path d="M107 90V102M124 84V96M144 77V90M181 88V103M194 93V108M181 116V132M194 122V138" />
          {scene === "profile" && <><rect className={styles.paper} x="49" y="105" width="61" height="54" rx="5" transform="rotate(-6 49 105)" /><path d="M61 120L93 117M63 130L86 128M64 140L78 139" /></>}
        </> : <>
          <path className={styles.paper} d="M80 37H164L189 62V147C189 152 186 155 181 155H80C75 155 72 152 72 147V45C72 40 75 37 80 37Z" />
          <path className={styles.sage} d="M164 37V62H189" />
          {scene === "photo" ? <><rect x="87" y="76" width="87" height="61" rx="4" /><circle className={styles.sage} cx="107" cy="92" r="7" /><path d="M88 126L110 106L126 120L143 97L173 127M130 76L124 88L132 98" /></> : scene === "catalog" ? <><path className={styles.sage} d="M97 107L121 86L145 107V132H97Z" /><path d="M90 107L121 80L152 107M115 132V115H129V132M154 123L172 106V133H154" /><path d="M92 66H130M92 73H114" /></> : scene === "search" ? <><path className={styles.sage} d="M87 79L111 71L141 83L174 72V128L142 140L111 128L87 135Z" /><path d="M111 71V128M141 83V140M97 98L116 105L146 96L162 104" /></> : scene === "missing" ? <><rect className={styles.wash} x="91" y="81" width="62" height="50" rx="4" strokeDasharray="4 5" /><path className={styles.sage} d="M144 91L188 78L201 121L158 134Z" /><path d="M156 101L181 94M159 111L175 106" /></> : <><path d="M91 71H139M91 84H161M91 98H145" /><rect className={styles.wash} x="91" y="113" width="54" height="21" rx="4" /></>}
        </>}
        {scene === "search" && <g><circle className={styles.paper} cx="177" cy="130" r="25" /><circle cx="177" cy="130" r="17" /><path strokeWidth="7" d="M195 149L215 168" /></g>}
        {issue && <g><circle className={styles.paper} cx="183" cy="134" r="30" />
          {scene === "timeout" ? <><circle cx="183" cy="134" r="20" /><path d="M183 121V135L193 141M180 107H186" /></> : scene === "offline" ? <><path d="M164 128Q183 111 202 128M171 136Q178 129 185 132M179 144L183 148M164 113L202 154" /></> : <><path className={styles.sage} d="M183 116L202 149H164Z" /><path d="M183 128V137M183 142V143" /></>}
        </g>}
        {scene === "catalog" && <path d="M38 156H213M49 156V163M201 156V163" />}
      </g>
      <g className={styles.detail} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M32 60H42M37 55V65M215 34H223M219 30V38" /><circle cx="228" cy="125" r="3" /></g>
    </svg>
  </span>;
}
