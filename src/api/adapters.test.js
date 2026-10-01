import { adaptMatch, toProfileBody } from "./adapters";

const apiMatch = (result = {}, job = {}) => ({
  job: { id: "j1", title: "Dev", company: "X", location: "", source: "gupy", url: "u", fetched_at: "2026-10-01T10:00:00Z", summary: "Resumo.", ...job },
  result: {
    score: 91,
    reasons: [
      { kind: "pro", text: "Vaga remota" },
      { kind: "con", text: "Pede AWS" },
      { kind: "info", text: "Senioridade não informada" },
    ],
    red_flags: [],
    is_worth_applying: true,
    needs_manual_review: false,
    stage: "saved",
    work_mode: "hybrid",
    ...result,
  },
});

describe("adaptMatch", () => {
  it("separa motivos por polaridade e converte o score para 0–1", () => {
    const m = adaptMatch(apiMatch());
    expect(m.pros).toEqual(["Vaga remota"]);
    expect(m.cons).toEqual(["Pede AWS"]);
    expect(m.notes).toEqual(["Senioridade não informada"]);
    expect(m.score).toBeCloseTo(0.91);
    expect(m.summary).toBe("Resumo.");
  });

  it("traduz a modalidade e esconde a não informada", () => {
    expect(adaptMatch(apiMatch({ work_mode: "remote" })).workMode).toBe("remoto");
    expect(adaptMatch(apiMatch({ work_mode: "hybrid" })).workMode).toBe("híbrido");
    expect(adaptMatch(apiMatch({ work_mode: "onsite" })).workMode).toBe("presencial");
    expect(adaptMatch(apiMatch({ work_mode: "not_informed" })).workMode).toBeNull();
    expect(adaptMatch(apiMatch({ work_mode: null })).workMode).toBeNull();
  });

  it("aceita só etapas conhecidas", () => {
    expect(adaptMatch(apiMatch({ stage: "applied" })).stage).toBe("applied");
    expect(adaptMatch(apiMatch({ stage: "arquivada" })).stage).toBeNull();
  });

  it("motivos em texto puro (API antiga) viram observações", () => {
    const m = adaptMatch(apiMatch({ reasons: ["Vaga remota"] }));
    expect(m.notes).toEqual(["Vaga remota"]);
    expect(m.pros).toEqual([]);
  });

  it("red flag bloqueante vira veredito 'fora do perfil'", () => {
    const m = adaptMatch(apiMatch({ red_flags: ["seniority_mismatch"], is_worth_applying: false }));
    expect(m.verdict).toEqual({ key: "off", label: "fora do perfil: senioridade incompatível" });
  });
});

describe("toProfileBody", () => {
  it("manda as fontes ligadas e apara nome e headline", () => {
    const body = toProfileBody({
      name: "  Ana ",
      headline: " Dev ",
      seniority: "pleno",
      summary: "",
      primary_stack: ["Python"],
      secondary_stack: [],
      preferred_locations: [],
      accepts_remote: true,
      enabled_sources: ["gupy"],
    });
    expect(body).toMatchObject({ name: "Ana", headline: "Dev", enabled_sources: ["gupy"] });
  });
});
