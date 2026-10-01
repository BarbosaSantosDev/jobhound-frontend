import { formatScore, initials, slugify, timeAgo } from "./format";

describe("format", () => {
  it("slugify espelha o backend (acentos, espaços, símbolos)", () => {
    expect(slugify("João Vitor Barbosa dos Santos")).toBe("joao-vitor-barbosa-dos-santos");
    expect(slugify("  Ana & Zé!! ")).toBe("ana-ze");
    expect(slugify("")).toBe("");
  });

  it("initials usa primeiro e segundo nome", () => {
    expect(initials("João Vitor Barbosa dos Santos")).toBe("JV");
    expect(initials("ana")).toBe("A");
    expect(initials("")).toBe("?");
  });

  it("formatScore mostra duas casas", () => {
    expect(formatScore(0.9)).toBe("0.90");
    expect(formatScore(1)).toBe("1.00");
  });

  it("timeAgo conta dias de calendário", () => {
    const now = new Date(2026, 9, 1, 10, 0);
    expect(timeAgo(new Date(2026, 9, 1, 0, 5).toISOString(), now)).toBe("hoje");
    expect(timeAgo(new Date(2026, 8, 30, 23, 59).toISOString(), now)).toBe("ontem");
    expect(timeAgo(new Date(2026, 8, 28, 12, 0).toISOString(), now)).toBe("há 3 dias");
    expect(timeAgo(null, now)).toBe("—");
  });
});
