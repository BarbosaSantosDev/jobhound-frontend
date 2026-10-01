import Icon from "./Icon";
import styles from "./Segmented.module.css";

// Controle segmentado: um grupo de botões com aria-pressed (escolha única).
export default function Segmented({ label, options, value, onChange, className = "" }) {
  return (
    <div role="group" aria-label={label} className={`${styles.group} ${className}`}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            className={`${styles.option} ${selected ? styles.selected : ""}`}
            onClick={() => !selected && onChange(opt.value)}
          >
            {opt.icon && <Icon name={opt.icon} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
