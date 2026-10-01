// Converte o que a API entrega no formato que as telas usam. Campos que a API
// ainda não tem chegam como null/[] e a UI esconde o bloco correspondente —
// nada aqui inventa dado.

const BLOCKING_FLAGS = {
  stack_incompatible: "stack incompatível",
  seniority_mismatch: "senioridade incompatível",
};

export const STAGES = ["new", "saved", "applied", "discarded"];

function verdictOf(result) {
  const blocking = (result.red_flags || []).filter((f) => f in BLOCKING_FLAGS);
  if (blocking.length) {
    return { key: "off", label: `fora do perfil: ${blocking.map((f) => BLOCKING_FLAGS[f]).join(", ")}` };
  }
  if (result.is_worth_applying) return { key: "trail", label: "na trilha" };
  if (result.needs_manual_review) return { key: "review", label: "revisar" };
  return { key: "low", label: "baixo faro" };
}

// Motivos estruturados ({kind, text}) viram prós/contras; motivos em texto
// puro (formato atual da API) não têm polaridade e ficam como observações.
function splitReasons(reasons = []) {
  const pros = [];
  const cons = [];
  const notes = [];
  for (const r of reasons) {
    if (typeof r === "string") notes.push(r);
    else if (r?.kind === "pro") pros.push(r.text);
    else if (r?.kind === "con") cons.push(r.text);
    else if (r?.text) notes.push(r.text);
  }
  return { pros, cons, notes };
}

export function adaptMatch({ job, result }) {
  return {
    id: job.id,
    title: job.title,
    company: job.company || "",
    location: job.location || "",
    source: job.source,
    url: job.url,
    fetchedAt: job.fetched_at,
    workMode: job.work_mode ?? null,
    summary: job.summary ?? null,
    stage: STAGES.includes(result.stage ?? job.stage) ? (result.stage ?? job.stage) : null,
    score: result.score / 100,
    verdict: verdictOf(result),
    ...splitReasons(result.reasons),
  };
}

export const EMPTY_PROFILE_FORM = {
  name: "",
  headline: "",
  seniority: "pleno",
  summary: "",
  primary_stack: [],
  secondary_stack: [],
  preferred_locations: [],
  accepts_remote: true,
};

export function toProfileForm(profile) {
  return {
    name: profile.name ?? "",
    headline: profile.headline ?? "",
    seniority: profile.seniority ?? "pleno",
    summary: profile.summary ?? "",
    primary_stack: profile.primary_stack ?? [],
    secondary_stack: profile.secondary_stack ?? [],
    preferred_locations: profile.preferred_locations ?? [],
    accepts_remote: profile.accepts_remote ?? true,
  };
}

// Corpo de POST/PUT: exatamente o ProfileWriteSchema do backend.
export function toProfileBody(form) {
  return {
    ...toProfileForm(form),
    name: form.name.trim(),
    headline: form.headline.trim(),
  };
}
