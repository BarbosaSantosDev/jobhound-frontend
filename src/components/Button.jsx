import Icon from "./Icon";
import Kbd from "./Kbd";
import styles from "./Button.module.css";

// variant: "primary" (âmbar) | "ghost" (contorno). Com `href` vira <a>.
export default function Button({
  variant = "ghost",
  icon,
  iconAfter,
  kbd,
  loading = false,
  href,
  className = "",
  children,
  ...rest
}) {
  const cls = [styles.button, styles[variant], loading ? styles.loading : "", className].join(" ");
  const content = (
    <>
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon && <Icon name={icon} />}
      <span>{children}</span>
      {iconAfter && <Icon name={iconAfter} />}
      {kbd && <Kbd>{kbd}</Kbd>}
    </>
  );

  if (href) {
    return (
      <a className={cls} href={href} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={cls} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}
