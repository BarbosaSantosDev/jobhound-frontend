import { fireEvent, render, screen } from "@testing-library/react";
import { mockMatchMedia } from "../test/mockMatchMedia";
import { THEME_STORAGE_KEY, useTheme } from "../theme/theme";
import ThemeToggle from "./ThemeToggle";

function ThemedApp() {
  const [theme, setTheme] = useTheme();
  return <ThemeToggle theme={theme} onChange={setTheme} />;
}

const claro = () => screen.getByRole("button", { name: /claro/i });
const escuro = () => screen.getByRole("button", { name: /escuro/i });

describe("ThemeToggle", () => {
  it("marca a opção ativa com aria-pressed e chama onChange ao trocar", () => {
    const onChange = jest.fn();
    render(<ThemeToggle theme="escuro" onChange={onChange} />);

    expect(escuro()).toHaveAttribute("aria-pressed", "true");
    expect(claro()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(claro());
    expect(onChange).toHaveBeenCalledWith("claro");
  });

  it("não chama onChange ao clicar na opção já ativa", () => {
    const onChange = jest.fn();
    render(<ThemeToggle theme="claro" onChange={onChange} />);
    fireEvent.click(claro());
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("useTheme + ThemeToggle", () => {
  it("na primeira visita segue prefers-color-scheme: light → claro", () => {
    mockMatchMedia(true);
    render(<ThemedApp />);
    expect(claro()).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.theme).toBe("claro");
  });

  it("na primeira visita segue prefers-color-scheme: dark → escuro", () => {
    render(<ThemedApp />);
    expect(escuro()).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.theme).toBe("escuro");
  });

  it("salva a escolha no localStorage e aplica no <html>", () => {
    render(<ThemedApp />);
    fireEvent.click(claro());
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("claro");
    expect(document.documentElement.dataset.theme).toBe("claro");
  });

  it("a escolha salva vence a preferência do sistema", () => {
    mockMatchMedia(true); // sistema claro
    window.localStorage.setItem(THEME_STORAGE_KEY, "escuro");
    render(<ThemedApp />);
    expect(escuro()).toHaveAttribute("aria-pressed", "true");
  });

  it("ignora valor inválido no storage", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "roxo");
    render(<ThemedApp />);
    expect(escuro()).toHaveAttribute("aria-pressed", "true");
  });
});
