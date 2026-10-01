import { activeSources, sourcesWithTerms } from "./sources";

const form = (primary, secondary, enabled = ["gupy", "nerdin", "remoteok"]) => ({
  primary_stack: primary,
  secondary_stack: secondary,
  enabled_sources: enabled,
});

describe("fontes (espelha Profile.active_sources do backend)", () => {
  it("com stack principal, todas as fontes ligadas ficam ativas", () => {
    expect(activeSources(form(["Python"], []))).toEqual(["gupy", "nerdin", "remoteok"]);
  });

  it("fonte desligada fica de fora", () => {
    expect(activeSources(form(["Python"], [], ["gupy", "remoteok"]))).toEqual(["gupy", "remoteok"]);
  });

  it("só stack secundária alimenta apenas o RemoteOK", () => {
    expect(sourcesWithTerms(form([], ["Docker"]))).toEqual(["remoteok"]);
    expect(activeSources(form([], ["Docker"]))).toEqual(["remoteok"]);
  });

  it("sem stack nenhuma fonte fica ativa", () => {
    expect(activeSources(form([], []))).toEqual([]);
  });
});
