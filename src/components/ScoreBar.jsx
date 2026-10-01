import { formatScore } from "../lib/format";
import styles from "./ScoreBar.module.css";

export const HIGH_MATCH = 0.8;

export default function ScoreBar({ score }) {
  const high = score >= HIGH_MATCH;
  return (
    <span className={`${styles.wrap} ${high ? styles.high : ""}`}>
      <span className={`mono ${styles.value}`}>{formatScore(score)}</span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ width: `${Math.round(score * 100)}%` }} />
      </span>
    </span>
  );
}
