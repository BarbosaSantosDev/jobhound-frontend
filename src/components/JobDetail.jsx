import { formatScore, timeAgo } from "../lib/format";
import Button from "./Button";
import { jobPlace } from "./JobListItem";
import { HIGH_MATCH } from "./ScoreBar";
import styles from "./JobDetail.module.css";

const STAGE_ACTIONS = [
  { stage: "saved", label: "Salvar", icon: "bookmark", kbd: "S" },
  { stage: "applied", label: "Candidatei", icon: "check", kbd: "C" },
  { stage: "discarded", label: "Descartar", icon: "x", kbd: "X" },
];

const STAGE_UNAVAILABLE = "Etapas da vaga ainda não existem na API";

export default function JobDetail({ job, onStage, headingRef }) {
  const high = job.score >= HIGH_MATCH;
  const hasWhy = job.pros.length + job.cons.length + job.notes.length > 0;

  return (
    <article className={styles.detail} aria-labelledby="job-detail-title">
      <p className={`mono ${styles.meta}`}>
        via {job.source} · {timeAgo(job.fetchedAt)}
      </p>
      <h2 id="job-detail-title" className={styles.title} ref={headingRef} tabIndex={-1}>
        {job.title}
      </h2>
      <p className={styles.place}>{jobPlace(job)}</p>

      <div className={styles.actions}>
        <Button variant="primary" href={job.url} target="_blank" rel="noreferrer" iconAfter="external">
          Abrir vaga
          <span className="sr-only"> (abre em nova aba)</span>
        </Button>
        {STAGE_ACTIONS.map((a) => (
          <Button
            key={a.stage}
            icon={a.icon}
            kbd={a.kbd}
            aria-pressed={job.stage === a.stage}
            disabled={!onStage}
            title={onStage ? undefined : STAGE_UNAVAILABLE}
            onClick={() => onStage?.(job.id, a.stage)}
          >
            {a.label}
          </Button>
        ))}
      </div>

      <section className={styles.match} aria-label="Match">
        <div className={styles.score}>
          <span className={`mono ${styles.label}`}>MATCH</span>
          <span className={`mono ${styles.scoreValue} ${high ? styles.high : ""}`}>{formatScore(job.score)}</span>
          <span className={styles.verdict}>{job.verdict.label}</span>
        </div>

        {hasWhy && (
          <div className={styles.why}>
            <span className={`mono ${styles.label}`}>POR QUE</span>
            <ul className={styles.reasons}>
              {job.pros.map((r) => (
                <li key={`pro-${r}`}>
                  <span className={`mono ${styles.pro}`} aria-label="a favor">+</span>
                  {r}
                </li>
              ))}
              {job.cons.map((r) => (
                <li key={`con-${r}`}>
                  <span className={`mono ${styles.con}`} aria-label="contra">−</span>
                  {r}
                </li>
              ))}
              {job.notes.map((r) => (
                <li key={`note-${r}`}>
                  <span className={`mono ${styles.note}`} aria-hidden="true">·</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {job.summary && (
        <section className={styles.summary} aria-labelledby="job-summary-label">
          <h3 id="job-summary-label" className={`mono ${styles.label}`}>
            RESUMO DA VAGA
          </h3>
          <p>{job.summary}</p>
        </section>
      )}
    </article>
  );
}
