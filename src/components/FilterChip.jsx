import { useId } from "react";
import Icon from "./Icon";
import styles from "./FilterChip.module.css";

// Chip de filtro com dropdown. Por baixo é um <select> nativo: acessível e
// funciona igual em teclado, leitor de tela e celular.
export default function FilterChip({ label, value, options, onChange }) {
  const id = useId();
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <div className={styles.chip}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <span className={styles.value} aria-hidden="true">
        {current.label}
      </span>
      <Icon name="chevronDown" size={14} className={styles.chevron} />
      <select id={id} className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
