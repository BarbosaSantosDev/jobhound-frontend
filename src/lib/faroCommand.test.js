import { faroCommand, faroCommandLines } from "./faroCommand";

const base = {
  seniority: "pleno",
  primary_stack: ["Python", "FastAPI", "PostgreSQL"],
  preferred_locations: ["São Paulo"],
  accepts_remote: true,
  sources: ["gupy", "nerdin"],
};

describe("faroCommand", () => {
  it("gera o comando do exemplo da identidade, com quebras estilo shell", () => {
    expect(faroCommandLines(base)).toEqual([
      "farejar --perfil pleno \\",
      "--stack python,fastapi,postgresql \\",
      '--onde "são paulo" --remoto \\',
      "--fontes gupy,nerdin",
    ]);
    expect(faroCommand(base)).toBe(
      'farejar --perfil pleno \\\n  --stack python,fastapi,postgresql \\\n  --onde "são paulo" --remoto \\\n  --fontes gupy,nerdin',
    );
  });

  it("omite grupos vazios e a última linha nunca termina com barra", () => {
    const lines = faroCommandLines({
      ...base,
      primary_stack: [],
      preferred_locations: [],
      accepts_remote: false,
      sources: [],
    });
    expect(lines).toEqual(["farejar --perfil pleno"]);
  });

  it("mantém --remoto sem cidades e só põe aspas quando há espaço", () => {
    const lines = faroCommandLines({ ...base, preferred_locations: [], seniority: "senior" });
    expect(lines[0]).toBe("farejar --perfil senior \\");
    expect(lines[2]).toBe("--remoto \\");
  });

  it("junta várias cidades num único valor entre aspas e escapa aspas", () => {
    const lines = faroCommandLines({
      ...base,
      preferred_locations: ["Santos", "Rio de Janeiro"],
      primary_stack: ['Go "lang"'],
    });
    expect(lines[1]).toBe('--stack "go \\"lang\\"" \\');
    expect(lines[2]).toBe('--onde "santos,rio de janeiro" --remoto \\');
  });
});
