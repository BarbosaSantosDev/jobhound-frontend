// Rotas do backend FastAPI (repositório jobhound):
//   GET  /api/v1/matches?filter=all&limit=N
//   GET  /api/v1/stats
//   GET  /api/v1/pipeline/status
//   POST /api/v1/pipeline/run          → 202 | 409 (já rodando)
//   POST /api/v1/profiles              → 201 | 409 (slug já existe)
//   GET  /api/v1/profiles/{slug}       → 200 | 404
//   PUT  /api/v1/profiles/{slug}       → 200 | 404

export const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:8000").replace(/\/+$/, "");
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

export const api = {
  matches: () => request("/matches?filter=all&limit=200"),
  stats: () => request("/stats"),
  pipelineStatus: () => request("/pipeline/status"),
  // 409 não é erro: já tem execução de pé, é só acompanhar.
  runPipeline: async () => {
    try {
      await request("/pipeline/run", { method: "POST" });
      return "started";
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return "already-running";
      throw err;
    }
  },
  getProfile: (slug) => request(`/profiles/${encodeURIComponent(slug)}`),
  createProfile: (body) => request("/profiles", { method: "POST", body }),
  updateProfile: (slug, body) =>
    request(`/profiles/${encodeURIComponent(slug)}`, { method: "PUT", body }),
};
