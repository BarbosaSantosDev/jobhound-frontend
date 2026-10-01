import { forwardRef } from "react";
import { timeAgo } from "../lib/format";
import ScoreBar from "./ScoreBar";
import styles from "./JobListItem.module.css";

export function jobPlace(job) {
  return [job.company || "empresa não informada", job.workMode || job.location].filter(Boolean).join(" · ");
}

// Item do listbox de vagas. A navegação por ↑ ↓ fica na tela (atalhos globais).
const JobListItem = forwardRef(function JobListItem({ job, selected, onSelect }, ref) {
  return (
    <li
      ref={ref}
      id={`job-${job.id}`}
      role="option"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className={`${styles.item} ${selected ? styles.selected : ""}`}
      onClick={() => onSelect(job.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(job.id, { open: true });
        }
      }}
    >
      <ScoreBar score={job.score} />
      <span className={styles.body}>
        <span className={styles.title}>{job.title}</span>
        <span className={styles.place}>{jobPlace(job)}</span>
        <span className={`mono ${styles.meta}`}>
          {job.source} · {timeAgo(job.fetchedAt)}
        </span>
      </span>
    </li>
  );
});

export default JobListItem;
