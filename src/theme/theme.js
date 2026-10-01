import { useCallback, useEffect, useState } from "react";

// Mesma chave lida pelo script inline em public/index.html, que aplica o tema
// antes do React montar (evita piscar o tema errado no primeiro paint).
export const THEME_STORAGE_KEY = "jobhound.theme";
export const THEMES = ["claro", "escuro"];

function readStored() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "claro" : "escuro";
}

// Primeira visita segue o sistema; depois disso vale a escolha salva.
export function initialTheme() {
  return readStored() ?? systemTheme();
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState(initialTheme);

  useEffect(() => applyTheme(theme), [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage bloqueado (aba privada etc.): o tema vale só nesta sessão
    }
  }, []);

  return [theme, setTheme];
}
