// Rotas do backend FastAPI (repositório jobhound). `?profile=<slug>` escopa
// vagas, etapas, stats e faro ao perfil ativo.
//   GET   /api/v1/matches?limit=N&profile=
//   PATCH /api/v1/matches/{job_id}/stage?profile=   → 200 | 404
//   GET   /api/v1/stats?profile=
//   GET   /api/v1/pipeline/status?profile=          (inclui last_run)
//   POST  /api/v1/pipeline/run?profile=             → 202 | 409 (já rodando)
//   GET   /api/v1/profiles
//   POST  /api/v1/profiles                          → 201 | 409 (slug já existe)
//   GET   /api/v1/profiles/{slug}                   → 200 | 404
//   PUT   /api/v1/profiles/{slug}                   → 200 | 404

// Vazio = mesma origem: em desenvolvimento o proxy do CRA (src/setupProxy.js)
// encaminha /api para o backend. Defina REACT_APP_API_URL só quando o build
// for servido num host diferente da API.
export const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");
const API = `${API_BASE}/api/v1`;

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `status ${status}`);
    this.status = status;
  }
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = null;
    try {
      detail = (await res.json())?.detail;
    } catch {
      // corpo sem JSON: fica só o status
    }
    throw new ApiError(res.status, typeof detail === "string" ? detail : null);
  }
  return res.status === 204 ? null : res.json();
}

function withProfile(path, slug) {
  if (!slug) return path;
  return `${path}${path.includes("?") ? "&" : "?"}profile=${encodeURIComponent(slug)}`;
}

export const api = {
  matches: (slug) => request(withProfile("/matches?limit=200", slug)),
  stats: (slug) => request(withProfile("/stats", slug)),
  pipelineStatus: (slug) => request(withProfile("/pipeline/status", slug)),
  setStage: (jobId, stage, slug) =>
    request(withProfile(`/matches/${encodeURIComponent(jobId)}/stage`, slug), {
      method: "PATCH",
      body: { stage },
    }),
  // 409 não é erro: já tem execução de pé, é só acompanhar.
  runPipeline: async (slug) => {
    try {
      await request(withProfile("/pipeline/run", slug), { method: "POST" });
      return "started";
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return "already-running";
      throw err;
    }
  },
  listProfiles: () => request("/profiles"),
  getProfile: (slug) => request(`/profiles/${encodeURIComponent(slug)}`),
  createProfile: (body) => request("/profiles", { method: "POST", body }),
  updateProfile: (slug, body) =>
    request(`/profiles/${encodeURIComponent(slug)}`, { method: "PUT", body }),
};
