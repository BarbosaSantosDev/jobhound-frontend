import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import ProfileSwitcher from "../components/ProfileSwitcher";
import ThemeToggle from "../components/ThemeToggle";
import styles from "./AppShell.module.css";

const NAV = [
  { id: "jobs", label: "Vagas", icon: "list" },
  { id: "profile", label: "Perfil de caça", icon: "target" },
];

// Sidebar fixa; abaixo de 900px vira drawer aberto pelo botão de menu.
export default function AppShell({ view, onNavigate, newCount, theme, onThemeChange, switcher, children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const go = (id) => {
    setDrawerOpen(false);
    onNavigate(id);
  };

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.menuButton}
          aria-label="Abrir menu"
          aria-expanded={drawerOpen}
          aria-controls="sidebar"
          onClick={() => setDrawerOpen(true)}
        >
          <Icon name="menu" size={20} />
        </button>
        <Logo eye="var(--bg)" />
      </header>

      {drawerOpen && <div className={styles.backdrop} onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <aside id="sidebar" className={`${styles.sidebar} ${drawerOpen ? styles.open : ""}`} aria-label="Navegação">
        <div className={styles.brand}>
          <Logo />
          {drawerOpen && (
            <button type="button" className={styles.closeButton} aria-label="Fechar menu" onClick={() => setDrawerOpen(false)}>
              <Icon name="x" size={18} />
            </button>
          )}
        </div>

        <ProfileSwitcher
          {...switcher}
          onSelect={(slug) => {
            setDrawerOpen(false);
            switcher.onSelect(slug);
          }}
          onNew={() => {
            setDrawerOpen(false);
            switcher.onNew();
          }}
        />

        <nav aria-label="Principal">
          <ul className={styles.nav}>
            {NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`${styles.navItem} ${view === item.id ? styles.current : ""}`}
                  aria-current={view === item.id ? "page" : undefined}
                  onClick={() => go(item.id)}
                >
                  <Icon name={item.icon} size={18} className={styles.navIcon} />
                  <span>{item.label}</span>
                  {item.id === "jobs" && newCount > 0 && (
                    <span className={`mono ${styles.badge}`}>{newCount} novas</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.footer}>
          <span className={`mono ${styles.footerLabel}`}>tema</span>
          <ThemeToggle theme={theme} onChange={onThemeChange} />
        </div>
      </aside>

      <div className={styles.main}>{children}</div>
    </div>
  );
}
