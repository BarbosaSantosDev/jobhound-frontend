export const SOURCES = [
  {
    id: "gupy",
    name: "Gupy",
    description: "Vagas de empresas brasileiras com processo pela Gupy.",
  },
  {
    id: "nerdin",
    name: "Nerdin",
    description: "Vagas de tecnologia no Brasil, CLT e PJ.",
  },
  {
    id: "remoteok",
    name: "RemoteOK",
    description: "Vagas remotas internacionais, quase todas em inglês.",
  },
];

// Fonte com termo de busca: Gupy e Nerdin usam a stack principal; RemoteOK,
// principal + secundária (SearchPreferences.derive no backend).
export function sourcesWithTerms({ primary_stack, secondary_stack }) {
  const hasPrimary = primary_stack.length > 0;
  const hasAny = hasPrimary || secondary_stack.length > 0;
  return SOURCES.filter((s) => (s.id === "remoteok" ? hasAny : hasPrimary)).map((s) => s.id);
}

// Espelha Profile.active_sources(): ligada pelo candidato E com termo de busca.
// É só para a prévia ao vivo; quem decide de verdade é o backend.
export function activeSources(form) {
  return sourcesWithTerms(form).filter((id) => form.enabled_sources.includes(id));
}
