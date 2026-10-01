import styles from "./Tabs.module.css";

// tabs: [{ id, label, count, disabled, title }]. Setas ←/→ trocam de aba.
export default function Tabs({ label, tabs, value, onChange, panelId }) {
  const enabled = tabs.filter((t) => !t.disabled);

  const onKeyDown = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = enabled.findIndex((t) => t.id === value);
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = enabled[(i + step + enabled.length) % enabled.length];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={styles.tabs} onKeyDown={onKeyDown}>
      {tabs.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            disabled={t.disabled}
            title={t.title}
            className={`${styles.tab} ${selected ? styles.selected : ""}`}
            onClick={() => onChange(t.id)}
          >
            {t.label}
            <span className={`mono ${styles.count}`}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}
