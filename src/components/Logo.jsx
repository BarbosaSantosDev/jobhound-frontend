import styles from "./Logo.module.css";

// Símbolo do sabujo, redesenhado em vetor a partir do brand book.
// Regras da marca: nariz sempre âmbar, cão sempre olhando para a direita.
const HEAD = "M9.5 31.25 33.75 9.25h35l17.5 17 35 8.75 3 23.75-24.25 5-23.75 2.5L64.5 86.25l4.25 30H19.5l-8.25-40z";
const EAR = "M23.75 21.75h27.5l5 15.25-9.5 53c-2.5 9-10 11-14.25 9.25L16.25 86.25l-2-40z";
const TRACES = "M141.25 28.75 156.75 23.75M143.75 45.25h25.5M141.25 61.25l15.5 5.5";

export function HoundSymbol({
  size = 32,
  head = "var(--text)",
  ear = "var(--logo-ear)",
  eye = "var(--bg)",
  nose = "var(--accent)",
  traces = false,
  title,
  className,
}) {
  // viewBox recortado no cão; com os traços de faro ele cresce para a direita
  const width = traces ? 172 : 130;
  return (
    <svg
      className={className}
      viewBox={`4 4 ${width} 116`}
      height={size}
      width={(size * width) / 116}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path fill={head} d={HEAD} />
      <path fill={ear} d={EAR} />
      <circle cx="69" cy="29" r="6" fill={eye} />
      <circle cx="122.5" cy="44" r="8.5" fill={nose} />
      {traces && <path d={TRACES} fill="none" stroke={nose} strokeWidth="5.5" strokeLinecap="round" />}
    </svg>
  );
}

// Wordmark em minúsculas com o cursor de bloco âmbar depois do "d".
export function Wordmark({ cursor = true }) {
  return (
    <span className={styles.wordmark}>
      jobhound
      {cursor && <span className={styles.cursor} aria-hidden="true" />}
    </span>
  );
}

export default function Logo({ eye = "var(--side)" }) {
  return (
    <span className={styles.logo} aria-label="jobhound" role="img">
      <HoundSymbol size={26} eye={eye} />
      <Wordmark />
    </span>
  );
}
