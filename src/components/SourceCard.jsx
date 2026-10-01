import { useId } from "react";
import Icon from "./Icon";
import styles from "./SourceCard.module.css";

// Card de fonte: o card inteiro é o <label> do checkbox. `status` é o rótulo
// mono do rodapé; por padrão, ATIVA/DESLIGADA conforme `checked`.
export default function SourceCard({ name, description, checked, onChange, disabled = false, status }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`${styles.card} ${checked ? styles.active : ""} ${disabled ? styles.disabled : ""}`}
    >
      <span className={styles.head}>
        <span className={styles.name}>{name}</span>
        <input
          id={id}
          type="checkbox"
          className={styles.input}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className={styles.box} aria-hidden="true">
          {checked && <Icon name="check" size={16} strokeWidth={2.5} />}
        </span>
      </span>
      <span className={styles.description}>{description}</span>
      <span className={`mono ${styles.status}`}>{status ?? (checked ? "ATIVA" : "DESLIGADA")}</span>
    </label>
  );
}
