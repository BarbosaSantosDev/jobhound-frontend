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

// Hoje o backend não deixa ligar/desligar fonte: cada uma fica ativa quando a
// stack gera termos de busca para ela (ver build_sources em src/container.py e
// SearchPreferences.derive no backend). Isto espelha essa regra para a UI.
export function derivedActiveSources({ primary_stack, secondary_stack }) {
  const hasPrimary = primary_stack.length > 0;
  const hasAny = hasPrimary || secondary_stack.length > 0;
  return SOURCES.filter((s) => (s.id === "remoteok" ? hasAny : hasPrimary)).map((s) => s.id);
}
