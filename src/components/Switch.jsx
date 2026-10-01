import { useId } from "react";
import Icon from "./Icon";
import styles from "./Switch.module.css";

// Linha inteira clicável (label + input reais). role="switch" anuncia liga/desliga.
export default function Switch({ label, description, checked, onChange }) {
  const id = useId();
  return (
    <label className={styles.row} htmlFor={id}>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.box} aria-hidden="true">
        {checked && <Icon name="check" size={16} strokeWidth={2.5} />}
      </span>
    </label>
  );
}
