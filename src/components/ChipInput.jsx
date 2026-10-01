import { useId, useRef, useState } from "react";
import Icon from "./Icon";
import styles from "./ChipInput.module.css";

// Enter (ou vírgula) adiciona · × remove · Backspace com o campo vazio remove o último.
// Duplicatas são ignoradas sem diferenciar maiúsculas.
export default function ChipInput({ label, hint, chips, onChange, placeholder }) {
  const id = useId();
  const inputRef = useRef(null);
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim().replace(/,+$/, "").trim();
    if (value && !chips.some((c) => c.toLowerCase() === value.toLowerCase())) {
      onChange([...chips, value]);
    }
    setDraft("");
  };

  const remove = (chip) => {
    onChange(chips.filter((c) => c !== chip));
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && draft === "" && chips.length) {
      e.preventDefault();
      onChange(chips.slice(0, -1));
    }
  };

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {hint && <span className={styles.hint}>{hint}</span>}
      </label>
      {/* clicar em qualquer parte da caixa foca o input */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className={styles.box} onClick={(e) => e.target === e.currentTarget && inputRef.current?.focus()}>
        <ul className={styles.chips} aria-label={`${label}: itens`}>
          {chips.map((chip) => (
            <li key={chip} className={styles.chip}>
              {chip}
              <button type="button" className={styles.remove} aria-label={`Remover ${chip}`} onClick={() => remove(chip)}>
                <Icon name="x" size={13} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
        <input
          ref={inputRef}
          id={id}
          className={styles.input}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
