// "Prévia do faro": traduz o formulário de perfil num comando estilo shell.
// É só leitura — ajuda a enxergar o que o próximo faro vai buscar.

function shellValue(values) {
  const joined = values.map((v) => v.trim().toLowerCase().replace(/"/g, '\\"')).join(",");
  return /\s/.test(joined) ? `"${joined}"` : joined;
}

// Cada grupo vira uma linha no preview; grupos vazios somem.
export function faroCommandGroups({ seniority, primary_stack, preferred_locations, accepts_remote, sources }) {
  const where = [];
  if (preferred_locations.length) where.push(`--onde ${shellValue(preferred_locations)}`);
  if (accepts_remote) where.push("--remoto");

  return [
    ["farejar", `--perfil ${seniority}`],
    primary_stack.length ? [`--stack ${shellValue(primary_stack)}`] : [],
    where,
    sources.length ? [`--fontes ${sources.join(",")}`] : [],
  ].filter((group) => group.length > 0);
}

// Linhas prontas para exibir, com a continuação de linha do shell (" \").
export function faroCommandLines(form) {
  const groups = faroCommandGroups(form);
  return groups.map((group, i) => {
    const text = group.join(" ");
    return i < groups.length - 1 ? `${text} \\` : text;
  });
}

export function faroCommand(form) {
  return faroCommandLines(form).join("\n  ");
}
