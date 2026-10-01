import { useEffect, useRef } from "react";

const TEXT_INPUT_TYPES = new Set(["checkbox", "radio", "button", "submit", "reset", "range"]);

// Atalhos não disparam enquanto a pessoa digita.
export function isEditableTarget(el) {
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return !TEXT_INPUT_TYPES.has((el.type || "text").toLowerCase());
  return false;
}

// bindings: { s: fn, "/": fn, ArrowDown: fn, ... } — letras sem diferenciar
// maiúscula. Teclas com Ctrl/Cmd/Alt passam direto (não brigam com o navegador).
export function useShortcuts(bindings, { enabled = true } = {}) {
  const ref = useRef(bindings);
  ref.current = bindings;

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const handler = ref.current[key];
      if (!handler) return;
      e.preventDefault();
      handler(e);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
