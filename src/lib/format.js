// Score da API é inteiro 0–100; a identidade mostra 0.00–1.00.
export function formatScore(score) {
  return score.toFixed(2);
}

const DAY_MS = 86_400_000;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Idade em dias de calendário: "hoje", "ontem", "há 3 dias".
export function timeAgo(iso, now = new Date()) {
  if (!iso) return "—";
  const days = Math.round((startOfDay(now) - startOfDay(iso)) / DAY_MS);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 14) return `há ${days} dias`;
  return `há ${Math.floor(days / 7)} semanas`;
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(iso) {
  if (!iso) return "—";
  return dateTime.format(new Date(iso)).replace(",", " ·");
}

export function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  // primeiro e segundo nome, como no seletor de perfil ("João Vitor" → JV)
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

// Espelha Profile._slugify do backend — só para mostrar o slug que será gerado
// no registro. Quem decide o slug de verdade é a API.
export function slugify(name) {
  return (name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
