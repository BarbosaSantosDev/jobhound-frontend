import { useEffect, useId, useRef, useState } from "react";
import { initials } from "../lib/format";
import Icon from "./Icon";
import styles from "./ProfileSwitcher.module.css";

function shortName(name) {
  return (name || "").trim().split(/\s+/).slice(0, 2).join(" ");
}

function subtitle(p) {
  return [p.seniority, p.primary_stack?.[0]?.toLowerCase()].filter(Boolean).join(" · ");
}

// profiles: perfis conhecidos. Enquanto a API não lista perfis, são os que
// este navegador já carregou ou registrou. onLoadSlug cobre o resto.
export default function ProfileSwitcher({ active, profiles, onSelect, onNew, onLoadSlug }) {
  const [open, setOpen] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();
  const slugId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = (fn) => (...args) => {
    setOpen(false);
    fn(...args);
  };

  const submitSlug = (e) => {
    e.preventDefault();
    const slug = slugDraft.trim();
    if (!slug) return;
    setSlugDraft("");
    close(onLoadSlug)(slug);
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {active ? initials(active.name) : "?"}
        </span>
        <span className={styles.who}>
          <span className={styles.name}>{active ? shortName(active.name) : "Nenhum perfil"}</span>
          <span className={`mono ${styles.sub}`}>{active ? subtitle(active) : "registre um perfil"}</span>
        </span>
        <span className="sr-only">: trocar perfil</span>
        <Icon name="chevronDown" size={14} className={styles.chevron} />
      </button>

      {open && (
        <div id={menuId} className={styles.menu}>
          {profiles.length > 0 && (
            <ul className={styles.list} aria-label="Perfis">
              {profiles.map((p) => (
                <li key={p.slug}>
                  <button
                    type="button"
                    className={styles.option}
                    aria-current={p.slug === active?.slug ? "true" : undefined}
                    onClick={close(() => onSelect(p.slug))}
                  >
                    <span className={styles.avatarSm} aria-hidden="true">
                      {initials(p.name)}
                    </span>
                    <span className={styles.who}>
                      <span className={styles.name}>{shortName(p.name)}</span>
                      <span className={`mono ${styles.sub}`}>{p.slug}</span>
                    </span>
                    {p.slug === active?.slug && <Icon name="check" className={styles.check} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={`${styles.option} ${styles.new}`} onClick={close(onNew)}>
            <Icon name="plus" />
            Novo perfil
          </button>
          <form className={styles.slugForm} onSubmit={submitSlug}>
            <label htmlFor={slugId} className={`mono ${styles.slugLabel}`}>
              carregar por slug
            </label>
            <input
              id={slugId}
              className={`mono ${styles.slugInput}`}
              value={slugDraft}
              onChange={(e) => setSlugDraft(e.target.value)}
              placeholder="slug-do-perfil"
              autoComplete="off"
            />
          </form>
        </div>
      )}
    </div>
  );
}
