import Icon from "./Icon";
import styles from "./Toast.module.css";

// Região aria-live sempre montada: leitores de tela anunciam cada mensagem nova.
export default function Toast({ toast, onDismiss }) {
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toast && (
        <div className={`${styles.toast} ${toast.tone === "error" ? styles.error : ""}`}>
          {toast.tone === "error" && <Icon name="alert" />}
          <span>{toast.message}</span>
          <button type="button" className={styles.close} aria-label="Fechar aviso" onClick={onDismiss}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
