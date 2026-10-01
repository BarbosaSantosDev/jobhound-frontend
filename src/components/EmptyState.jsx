import { HoundSymbol } from "./Logo";
import styles from "./EmptyState.module.css";

// Cão em tons apagados; só o nariz e os traços de faro ficam em âmbar.
export default function EmptyState({ title, children, action }) {
  return (
    <div className={styles.empty}>
      <HoundSymbol size={72} traces head="var(--subtle)" ear="var(--line)" eye="var(--bg)" />
      <h2 className={styles.title}>{title}</h2>
      {children && <p className={styles.text}>{children}</p>}
      {action}
    </div>
  );
}
