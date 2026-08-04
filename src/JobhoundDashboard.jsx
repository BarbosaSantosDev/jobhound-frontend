import { useState, useEffect, useMemo, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────
// jobhound · dashboard v6 (sidebar: Vagas + Perfil + Novo perfil)
// Rotas do backend FastAPI:
//   GET  /api/v1/matches?filter=all|apply|review&limit=N
//   GET  /api/v1/stats
//   POST /api/v1/pipeline/run          → 202 | 409
//   POST /api/v1/profiles              → 201 (registra perfil novo) | 409 (slug já existe)
//   GET  /api/v1/profiles/{slug}       → 200 | 404
//   PUT  /api/v1/profiles/{slug}       → 200 | 404
// Tema dark/light no rodapé da sidebar.
//
// v6 — perfis agora têm slug (suporte a múltiplos perfis no backend):
//   • Novo perfil é uma tela própria (registro), sem afetar o que já está carregado
//   • Perfil (edição) guarda o slug atual no localStorage e permite trocar de perfil
//   • Os dois formulários compartilham os mesmos campos (ProfileFormFields)
//
// v5 — o perfil é o "faro de referência" do cão:
//   • Perfil ganha um preview vivo (plano de caça) do que será farejado
//   • layout de 2 colunas com preview fixo + barra de salvar que acompanha
//   • Vagas: relatório de trilha no lugar do grid de números
//   • cards com hierarquia (aplicar salta / descartada recua) + medidor de faro
// ─────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:8000";
const API = `${API_BASE}/api/v1`;
const BACKGROUND_POLL_MS = 3_000;

// Janela entre o clique e o backend confirmar `running: true`. Sem isso, um
// poll que caia no meio do POST leria running:false e fecharia a tela na cara
// do usuário antes do pipeline sequer aparecer.
const START_GRACE_MS = 8_000;

const EMPTY_PIPELINE = {
  running: false,
  stage: null,
  started_at: null,
  finished_at: null,
  last_error: null,
};

// ── animação do cão (LottieFiles) ────────────────────────────
// Cole aqui a URL do **Lottie JSON** de uma animação de cão farejando.
// Como pegar: lottiefiles.com → busque "dog sniffing" / "hound" / "dog walk"
// → abra a animação → botão "Use in web" (ou Download) → copie a URL do JSON
// (algo como https://lottie.host/xxxx/xxxx.json).
//
// Importante: use o .json, não o .lottie — o lottie-web só lê JSON.
// Enquanto isso estiver vazio (ou se a URL falhar), o dashboard cai no
// HoundSVG abaixo, que é desenhado à mão e não depende de rede.
const LOTTIE_HOUND_URL = "";
const LOTTIE_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js";

// O backend reporta o estágio real e ele ALTERNA conforme processa cada vaga
// (extract → score → persist → extract...). Não é progresso linear, então a UI
// mostra "o que está fazendo agora" — nada de checklist acumulando ✓.
const PIPELINE_STEPS = [
  { key: "fetch", label: "coletar vagas nas fontes" },
  { key: "extract", label: "ler a vaga com o modelo local" },
  { key: "score", label: "pontuar contra o seu perfil" },
  { key: "persist", label: "gravar na trilha" },
];

const STAGE_HEADLINE = {
  fetch: "farejando as fontes",
  extract: "lendo uma vaga",
  score: "pesando contra o seu perfil",
  persist: "marcando a trilha",
};

const THEMES = {
  dark: {
    bg: "#0E1116",
    scrim: "rgba(10,12,16,0.88)",
    panel: "#151A21",
    panelHover: "#1A202A",
    lift: "#1B222C",
    border: "#232B36",
    track: "#1E2631",
    text: "#E6E1D6",
    dim: "#7A8290",
    faint: "#4A5361",
    amber: "#E8A33D",
    amberSoft: "rgba(232,163,61,0.12)",
    amberText: "#0E1116",
    green: "#5FB57A",
    greenSoft: "rgba(95,181,122,0.10)",
    red: "#D96C5F",
    redSoft: "rgba(217,108,95,0.12)",
    sourceGupy: "#7AA5D6",
    sourceNerdin: "#B58FD6",
    sourceRemoteok: "#6BC5B8",
  },
  light: {
    bg: "#F5F2EA",
    scrim: "rgba(232,227,214,0.9)",
    panel: "#FDFBF5",
    panelHover: "#F2EDE0",
    lift: "#FFFFFF",
    border: "#DCD5C4",
    track: "#E7E0CF",
    text: "#2A2A24",
    dim: "#6E6A5E",
    faint: "#A39D8D",
    amber: "#B87514",
    amberSoft: "rgba(184,117,20,0.10)",
    amberText: "#FDFBF5",
    green: "#2E7D4F",
    greenSoft: "rgba(46,125,79,0.08)",
    red: "#B3472F",
    redSoft: "rgba(179,71,47,0.08)",
    sourceGupy: "#3D6FA8",
    sourceNerdin: "#7A4FA8",
    sourceRemoteok: "#2E7D74",
  },
};

const FONT_MONO = "'JetBrains Mono', 'Fira Code', ui-monospace, monospace";
const FONT_DISPLAY = "'Space Grotesk', 'Inter', system-ui, sans-serif";

const EMPTY_STATS = {
  fetched: 0,
  matched: 0,
  manual_review: 0,
  errors: 0,
  last_run: null,
};

const EMPTY_PROFILE_FORM = {
  name: "",
  headline: "",
  seniority: "pleno",
  primary_stack: [],
  secondary_stack: [],
  preferred_locations: [],
  accepts_remote: true,
  summary: "",
};

const PROFILE_SLUG_STORAGE_KEY = "jobhound.profileSlug";

// ── helpers ──────────────────────────────────────────────────

function scentBlocks(score) {
  const filled = Math.round(score / 20);
  return "▰".repeat(filled) + "▱".repeat(5 - filled);
}

function scoreColor(result, T) {
  if (result.red_flags?.length) return T.red;
  if (result.score >= 70) return T.green;
  if (result.score >= 50) return T.amber;
  return T.dim;
}

function statusOf(result) {
  if (result.red_flags?.length) return { key: "descartada", label: "descartada" };
  if (result.is_worth_applying) return { key: "apply", label: "vale aplicar" };
  if (result.needs_manual_review) return { key: "review", label: "revisar" };
  return { key: "low", label: "baixo faro" };
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

const FLAG_LABELS = {
  stack_incompatible: "stack incompatível",
  seniority_mismatch: "senioridade incompatível",
};

// ── componentes compartilhados ───────────────────────────────

function FilterTab({ active, onClick, children, count, dot, T }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FONT_MONO,
        fontSize: 13,
        padding: "8px 14px",
        borderRadius: 6,
        border: `1px solid ${active ? T.amber : T.border}`,
        background: active ? T.amberSoft : "transparent",
        color: active ? T.amber : T.dim,
        cursor: "pointer",
        transition: "all 120ms ease",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {dot && <span style={{ color: dot, fontSize: 10, lineHeight: 1 }}>●</span>}
      {children}
      {count !== undefined && (
        <span
          style={{
            fontSize: 11,
            padding: "1px 6px",
            borderRadius: 4,
            background: active ? T.amber : T.border,
            color: active ? T.amberText : T.dim,
            fontWeight: 700,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SourceBadge({ source, T }) {
  const colors = {
    gupy: T.sourceGupy,
    nerdin: T.sourceNerdin,
    remoteok: T.sourceRemoteok,
  };
  const color = colors[source] || T.dim;
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10.5,
        padding: "1px 7px",
        borderRadius: 4,
        border: `1px solid ${color}`,
        color,
        letterSpacing: "0.04em",
      }}
    >
      {source}
    </span>
  );
}

function Toast({ message, tone, onDismiss, T }) {
  if (!message) return null;
  const color = tone === "error" ? T.red : T.green;
  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        fontFamily: FONT_MONO,
        fontSize: 13,
        padding: "10px 18px",
        borderRadius: 6,
        background: T.panel,
        border: `1px solid ${color}`,
        color,
        cursor: "pointer",
        zIndex: 50,
        maxWidth: "90vw",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      }}
    >
      {message}
    </div>
  );
}

function SectionTitle({ children, T }) {
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 13,
        color: T.text,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ color: T.faint }}>#</span>
      {children}
    </span>
  );
}

// ── tela: Vagas ──────────────────────────────────────────────

// Assinatura da tela: medidor de faro (intensidade de rastro).
function ScentMeter({ result, T }) {
  const color = scoreColor(result, T);
  return (
    <div style={{ textAlign: "right", flexShrink: 0 }}>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 18,
          color,
          letterSpacing: 3,
          lineHeight: 1,
        }}
        title={`faro: ${result.score}/100`}
      >
        {scentBlocks(result.score)}
      </div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          color: T.faint,
          marginTop: 6,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        faro <span style={{ color, fontWeight: 700 }}>{result.score}</span>
      </div>
    </div>
  );
}

function StatusPill({ status, T }) {
  const map = {
    apply: { color: T.green, soft: T.greenSoft, glyph: "▸" },
    review: { color: T.amber, soft: T.amberSoft, glyph: "?" },
    descartada: { color: T.red, soft: T.redSoft, glyph: "✕" },
    low: { color: T.dim, soft: "transparent", glyph: "·" },
  };
  const s = map[status.key] || map.low;
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        padding: "2px 9px",
        borderRadius: 999,
        background: s.soft,
        color: s.color,
        border: `1px solid ${s.color}`,
        whiteSpace: "nowrap",
      }}
    >
      {s.glyph} {status.label}
    </span>
  );
}

function MatchCard({ job, result, T }) {
  const [open, setOpen] = useState(false);
  const color = scoreColor(result, T);
  const status = statusOf(result);
  const isApply = status.key === "apply";
  const isDiscarded = status.key === "descartada";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
      onFocus={(e) => (e.currentTarget.style.outline = `2px solid ${T.amber}`)}
      onBlur={(e) => (e.currentTarget.style.outline = "none")}
      style={{
        background: isApply ? T.lift : T.panel,
        border: `1px solid ${isApply ? color : T.border}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        padding: "16px 20px",
        cursor: "pointer",
        opacity: isDiscarded && !open ? 0.62 : 1,
        transition: "background 120ms ease, opacity 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = T.panelHover;
        e.currentTarget.style.opacity = 1;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isApply ? T.lift : T.panel;
        e.currentTarget.style.opacity = isDiscarded && !open ? 0.62 : 1;
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 16,
                fontWeight: 600,
                color: T.text,
              }}
            >
              {job.title}
            </span>
            <SourceBadge source={job.source} T={T} />
            <StatusPill status={status} T={T} />
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              color: T.dim,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span>{job.company || "—"}</span>
            <span style={{ color: T.faint }}>·</span>
            <span>{job.location || "—"}</span>
            <span style={{ color: T.faint }}>·</span>
            <span style={{ color: T.faint }}>{timeAgo(job.fetched_at)}</span>
          </div>
        </div>

        <ScentMeter result={result} T={T} />
      </div>

      {open && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <ul
            style={{
              margin: 0,
              paddingLeft: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            {result.reasons.map((r, i) => (
              <li
                key={i}
                style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: T.dim }}
              >
                <span style={{ color: T.faint, marginRight: 8 }}>→</span>
                {r}
              </li>
            ))}
          </ul>

          {result.red_flags?.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {result.red_flags.map((f) => (
                <span
                  key={f}
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: T.redSoft,
                    color: T.red,
                    border: `1px solid ${T.red}`,
                  }}
                >
                  ⚑ {FLAG_LABELS[f] || f}
                </span>
              ))}
            </div>
          )}

          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={
              isApply
                ? {
                    alignSelf: "flex-start",
                    fontFamily: FONT_MONO,
                    fontSize: 13,
                    fontWeight: 700,
                    color: T.amberText,
                    background: T.green,
                    padding: "8px 16px",
                    borderRadius: 6,
                    textDecoration: "none",
                  }
                : {
                    alignSelf: "flex-start",
                    fontFamily: FONT_MONO,
                    fontSize: 12.5,
                    color: T.amber,
                    textDecoration: "none",
                    borderBottom: `1px dashed ${T.amber}`,
                    paddingBottom: 1,
                  }
            }
          >
            {isApply ? "abrir vaga e aplicar ↗" : "abrir vaga ↗"}
          </a>
        </div>
      )}
    </div>
  );
}

// Relatório de trilha: resumo legível + barra de sinal (aproveitamento).
function TrailReport({ stats, T }) {
  const total = Math.max(stats.fetched, 1);
  const pctMatch = Math.min(100, (stats.matched / total) * 100);
  const pctReview = Math.min(100 - pctMatch, (stats.manual_review / total) * 100);
  const signal = Math.round(((stats.matched + stats.manual_review) / total) * 100);

  const Figure = ({ n, label, color }) => (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 22,
          fontWeight: 700,
          color: color || T.text,
          lineHeight: 1,
        }}
      >
        {n}
      </span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.dim }}>
        {label}
      </span>
    </span>
  );

  return (
    <section
      style={{
        background: T.panel,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: T.faint,
          }}
        >
          a trilha
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.dim }}>
          último faro {timeAgo(stats.last_run)}
        </span>
      </div>

      <div
        style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "baseline" }}
      >
        <Figure n={stats.fetched} label="farejadas" />
        <Figure n={stats.matched} label="na trilha" color={T.green} />
        <Figure n={stats.manual_review} label="revisar" color={T.amber} />
        <Figure
          n={stats.errors}
          label="erros"
          color={stats.errors > 0 ? T.red : T.faint}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            background: T.track,
            overflow: "hidden",
            display: "flex",
          }}
          title={`${stats.matched} para aplicar · ${stats.manual_review} para revisar de ${stats.fetched}`}
        >
          <div style={{ width: `${pctMatch}%`, background: T.green }} />
          <div style={{ width: `${pctReview}%`, background: T.amber }} />
        </div>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: T.dim,
            whiteSpace: "nowrap",
          }}
        >
          sinal {signal}%
        </span>
      </div>
    </section>
  );
}

function MatchesView({ matches, stats, loading, T }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      all: matches.length,
      apply: matches.filter((m) => m.result.is_worth_applying).length,
      review: matches.filter((m) => m.result.needs_manual_review).length,
    }),
    [matches],
  );

  const visible = useMemo(() => {
    let list = matches;
    if (filter === "apply")
      list = list.filter((m) => m.result.is_worth_applying);
    if (filter === "review")
      list = list.filter((m) => m.result.needs_manual_review);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.job.title.toLowerCase().includes(q) ||
          m.job.company.toLowerCase().includes(q) ||
          m.job.location.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => b.result.score - a.result.score);
  }, [matches, filter, query]);

  return (
    <>
      <TrailReport stats={stats} T={T} />

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <FilterTab
          active={filter === "all"}
          onClick={() => setFilter("all")}
          count={counts.all}
          T={T}
        >
          todas
        </FilterTab>
        <FilterTab
          active={filter === "apply"}
          onClick={() => setFilter("apply")}
          count={counts.apply}
          dot={T.green}
          T={T}
        >
          na trilha
        </FilterTab>
        <FilterTab
          active={filter === "review"}
          onClick={() => setFilter("review")}
          count={counts.review}
          dot={T.amber}
          T={T}
        >
          revisar
        </FilterTab>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filtrar por cargo, empresa ou cidade"
          style={{
            flex: 1,
            minWidth: 220,
            fontFamily: FONT_MONO,
            fontSize: 13,
            padding: "9px 14px",
            borderRadius: 6,
            border: `1px solid ${T.border}`,
            background: T.panel,
            color: T.text,
            outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = T.amber)}
          onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 13,
              color: T.faint,
              textAlign: "center",
              padding: "48px 0",
            }}
          >
            farejando vagas…
          </div>
        ) : visible.length === 0 ? (
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 13,
              color: T.faint,
              textAlign: "center",
              padding: "48px 0",
              border: `1px dashed ${T.border}`,
              borderRadius: 10,
            }}
          >
            {query
              ? `nenhuma vaga na trilha combina com "${query}"`
              : "trilha vazia — rode o pipeline para farejar novas vagas."}
          </div>
        ) : (
          visible.map((m) => (
            <MatchCard key={m.job.id} job={m.job} result={m.result} T={T} />
          ))
        )}
      </div>

      {visible.some((m) => m.job.source === "remoteok") && (
        <p
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: T.faint,
            marginTop: 24,
            textAlign: "center",
          }}
        >
          Vagas remotas via{" "}
          <a
            href="https://remoteok.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: T.dim }}
          >
            Remote OK
          </a>
        </p>
      )}
    </>
  );
}

// ── tela: Perfil ─────────────────────────────────────────────

function FieldLabel({ children, hint, T }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: T.dim,
        }}
      >
        {children}
      </span>
      {hint && (
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: T.faint,
            marginLeft: 10,
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

function TextInput({ value, onChange, T, ...rest }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        fontFamily: FONT_MONO,
        fontSize: 13,
        padding: "10px 14px",
        borderRadius: 6,
        border: `1px solid ${T.border}`,
        background: T.panel,
        color: T.text,
        outline: "none",
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = T.amber)}
      onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
      {...rest}
    />
  );
}

function TagEditor({ tags, onChange, placeholder, T }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      onChange([...tags, value]);
    }
    setDraft("");
  };

  const remove = (tag) => onChange(tags.filter((t) => t !== tag));

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: 10,
        borderRadius: 6,
        border: `1px solid ${T.border}`,
        background: T.panel,
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12.5,
            padding: "4px 10px",
            borderRadius: 4,
            background: T.amberSoft,
            color: T.amber,
            border: `1px solid ${T.amber}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {tag}
          <button
            onClick={() => remove(tag)}
            aria-label={`Remover ${tag}`}
            style={{
              border: "none",
              background: "none",
              color: T.amber,
              cursor: "pointer",
              padding: 0,
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={tags.length ? "" : placeholder}
        style={{
          flex: 1,
          minWidth: 140,
          fontFamily: FONT_MONO,
          fontSize: 13,
          border: "none",
          background: "transparent",
          color: T.text,
          outline: "none",
          padding: "4px 2px",
        }}
      />
    </div>
  );
}

// Preview vivo: o "faro de referência" traduzido no que o pipeline vai buscar.
// Espelha a derivação feita no backend (SearchPreferences.derive) só pra preview —
// o usuário não edita isso, é calculado a partir da stack.
function deriveSearchPreview(primaryStack, secondaryStack) {
  return {
    gupy_terms: primaryStack.map((s) => s.toLowerCase()),
    nerdin_platforms: primaryStack,
    remoteok_tags: [...primaryStack, ...secondaryStack].map((s) => s.toLowerCase()),
  };
}

function HuntPlan({ form, T }) {
  const preview = deriveSearchPreview(form.primary_stack, form.secondary_stack);
  const sources = [
    { id: "gupy", label: "Gupy", terms: preview.gupy_terms, color: T.sourceGupy },
    {
      id: "nerdin",
      label: "Nerdin",
      terms: preview.nerdin_platforms,
      color: T.sourceNerdin,
    },
    {
      id: "remoteok",
      label: "Remote OK",
      terms: preview.remoteok_tags,
      color: T.sourceRemoteok,
    },
  ];
  const active = sources.filter((s) => s.terms.length > 0);

  const line = (label, value) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10.5,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: T.faint,
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: T.text }}>
        {value}
      </span>
    </div>
  );

  return (
    <aside
      className="jh-hunt"
      style={{
        background: T.panel,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <SectionTitle T={T}>plano de caça</SectionTitle>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.faint }}>
          o que o jobhound vai farejar no próximo run
        </span>
      </div>

      {line(
        "procura",
        `vagas ${form.seniority} de ${
          form.primary_stack.length ? form.primary_stack.join(", ") : "—"
        }`,
      )}
      {line(
        "onde",
        `${
          form.preferred_locations.length
            ? form.preferred_locations.join(", ")
            : "qualquer lugar"
        }${form.accepts_remote ? " · aceita remoto" : ""}`,
      )}

      <div style={{ height: 1, background: T.border }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sources.map((s) => {
          const on = s.terms.length > 0;
          return (
            <div key={s.id} style={{ opacity: on ? 1 : 0.4 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span style={{ color: on ? s.color : T.faint, fontSize: 10 }}>
                  {on ? "●" : "○"}
                </span>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 12,
                    color: on ? T.text : T.faint,
                  }}
                >
                  {s.label}
                </span>
                {!on && (
                  <span
                    style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.faint }}
                  >
                    ignorada
                  </span>
                )}
              </div>
              {on && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {s.terms.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: 4,
                        border: `1px solid ${s.color}`,
                        color: s.color,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          color: active.length ? T.green : T.red,
          borderTop: `1px solid ${T.border}`,
          paddingTop: 12,
        }}
      >
        {active.length
          ? `${active.length} ${active.length === 1 ? "fonte ativa" : "fontes ativas"}`
          : "nenhuma fonte ativa — o run não vai encontrar vagas"}
      </div>
    </aside>
  );
}

// Campos do formulário de perfil, compartilhados entre "editar" e "registrar".
function ProfileFormFields({ form, set, T }) {
  const sectionStyle = {
    background: T.panel,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: "22px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  };

  return (
    <div className="jh-profile-grid">
      {/* coluna do formulário */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
        <section style={sectionStyle}>
          <SectionTitle T={T}>quem sou</SectionTitle>
          <div>
            <FieldLabel T={T}>Nome</FieldLabel>
            <TextInput value={form.name} onChange={(v) => set("name", v)} T={T} />
          </div>
          <div>
            <FieldLabel T={T}>Headline</FieldLabel>
            <TextInput
              value={form.headline}
              onChange={(v) => set("headline", v)}
              T={T}
            />
          </div>
          <div>
            <FieldLabel T={T}>Senioridade</FieldLabel>
            <div style={{ display: "flex", gap: 10 }}>
              {["junior", "pleno", "senior"].map((level) => (
                <FilterTab
                  key={level}
                  active={form.seniority === level}
                  onClick={() => set("seniority", level)}
                  T={T}
                >
                  {level}
                </FilterTab>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel T={T} hint="Enter adiciona · × remove">
              Stack principal
            </FieldLabel>
            <TagEditor
              tags={form.primary_stack}
              onChange={(v) => set("primary_stack", v)}
              placeholder="ex: Python"
              T={T}
            />
          </div>
          <div>
            <FieldLabel T={T}>Stack secundária</FieldLabel>
            <TagEditor
              tags={form.secondary_stack}
              onChange={(v) => set("secondary_stack", v)}
              placeholder="ex: Kubernetes"
              T={T}
            />
          </div>
          <div>
            <FieldLabel T={T}>Localizações preferidas</FieldLabel>
            <TagEditor
              tags={form.preferred_locations}
              onChange={(v) => set("preferred_locations", v)}
              placeholder="ex: Santos"
              T={T}
            />
          </div>
          <div>
            <FieldLabel T={T}>Trabalho remoto</FieldLabel>
            <div style={{ display: "flex", gap: 10 }}>
              <FilterTab
                active={form.accepts_remote}
                onClick={() => set("accepts_remote", true)}
                T={T}
              >
                aceito remoto
              </FilterTab>
              <FilterTab
                active={!form.accepts_remote}
                onClick={() => set("accepts_remote", false)}
                T={T}
              >
                somente local
              </FilterTab>
            </div>
          </div>
          <div>
            <FieldLabel T={T} hint="usado no prompt de extração do LLM">
              Resumo
            </FieldLabel>
            <textarea
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              rows={5}
              style={{
                width: "100%",
                fontFamily: FONT_MONO,
                fontSize: 13,
                padding: "10px 14px",
                borderRadius: 6,
                border: `1px solid ${T.border}`,
                background: T.panel,
                color: T.text,
                outline: "none",
                resize: "vertical",
                lineHeight: 1.6,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = T.amber)}
              onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>
        </section>
      </div>

      {/* coluna do preview (fixa no scroll em telas largas) — o que buscar é
          derivado da stack, o usuário não edita isso diretamente */}
      <HuntPlan form={form} T={T} />
    </div>
  );
}

// Troca/carrega um perfil por slug — não há endpoint de listagem ainda,
// então o slug de quem você quer editar precisa ser digitado ou vem do registro.
function ProfileSlugBar({ slug, onLoad, T }) {
  const [draft, setDraft] = useState("");

  const load = () => {
    if (!draft.trim()) return;
    onLoad(draft.trim());
    setDraft("");
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.dim }}>
        perfil atual:{" "}
        <span style={{ color: T.amber }}>{slug || "nenhum carregado"}</span>
      </span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && load()}
        placeholder="carregar perfil por slug"
        style={{
          fontFamily: FONT_MONO,
          fontSize: 12,
          padding: "6px 10px",
          borderRadius: 6,
          border: `1px solid ${T.border}`,
          background: T.panel,
          color: T.text,
          outline: "none",
          minWidth: 200,
        }}
      />
      <button
        onClick={load}
        style={{
          fontFamily: FONT_MONO,
          fontSize: 12,
          padding: "7px 12px",
          borderRadius: 6,
          border: `1px solid ${T.border}`,
          background: "transparent",
          color: T.dim,
          cursor: "pointer",
        }}
      >
        carregar
      </button>
    </div>
  );
}

function ProfileView({ profile, slug, noProfileYet, onSave, onLoadSlug, onGoRegister, saving, T }) {
  const [form, setForm] = useState(profile);
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(profile),
    [form, profile],
  );

  useEffect(() => setForm(profile), [profile]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  if (noProfileYet) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "56px 24px",
          border: `1px dashed ${T.border}`,
          borderRadius: 10,
        }}
      >
        <p style={{ fontFamily: FONT_MONO, fontSize: 13, color: T.faint, marginBottom: 18 }}>
          nenhum perfil carregado ainda — registre um ou carregue por slug.
        </p>
        <button
          onClick={onGoRegister}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 13,
            fontWeight: 700,
            padding: "10px 18px",
            borderRadius: 6,
            border: "none",
            background: T.amber,
            color: T.amberText,
            cursor: "pointer",
          }}
        >
          + registrar perfil
        </button>
        <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
          <ProfileSlugBar slug={slug} onLoad={onLoadSlug} T={T} />
        </div>
      </div>
    );
  }

  return (
    <>
      <ProfileSlugBar slug={slug} onLoad={onLoadSlug} T={T} />

      <ProfileFormFields form={form} set={set} T={T} />

      {/* barra de salvar que acompanha o scroll */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: 24,
          padding: "16px 0",
          background: T.bg,
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <button
          onClick={() => onSave(form)}
          disabled={!dirty || saving}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 13,
            fontWeight: 700,
            padding: "11px 22px",
            borderRadius: 6,
            border: "none",
            background: !dirty || saving ? T.border : T.amber,
            color: !dirty || saving ? T.dim : T.amberText,
            cursor: !dirty || saving ? "default" : "pointer",
            transition: "all 120ms ease",
          }}
        >
          {saving ? "salvando…" : "salvar perfil"}
        </button>
        {dirty && !saving ? (
          <button
            onClick={() => setForm(profile)}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 13,
              padding: "11px 18px",
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              background: "transparent",
              color: T.dim,
              cursor: "pointer",
            }}
          >
            descartar mudanças
          </button>
        ) : (
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.faint }}>
            {saving ? "" : "sem alterações"}
          </span>
        )}
        {dirty && !saving && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              color: T.amber,
              marginLeft: "auto",
            }}
          >
            ● alterações não salvas
          </span>
        )}
      </div>
    </>
  );
}

// ── tela: Novo perfil (registro) ─────────────────────────────

function RegisterProfileView({ onRegister, registering, T }) {
  const [form, setForm] = useState(EMPTY_PROFILE_FORM);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const canSubmit =
    form.name.trim().length > 0 && form.primary_stack.length > 0 && !registering;

  const submit = async () => {
    if (!canSubmit) return;
    const created = await onRegister(form);
    if (created) setForm(EMPTY_PROFILE_FORM);
  };

  return (
    <>
      <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.faint, marginBottom: 20 }}>
        cria um perfil novo (identificado por um slug derivado do nome) sem afetar o
        perfil que já está carregado na aba "perfil".
      </p>

      <ProfileFormFields form={form} set={set} T={T} />

      <div
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: 24,
          padding: "16px 0",
          background: T.bg,
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 13,
            fontWeight: 700,
            padding: "11px 22px",
            borderRadius: 6,
            border: "none",
            background: !canSubmit ? T.border : T.amber,
            color: !canSubmit ? T.dim : T.amberText,
            cursor: !canSubmit ? "default" : "pointer",
            transition: "all 120ms ease",
          }}
        >
          {registering ? "registrando…" : "+ registrar perfil"}
        </button>
        {!form.name.trim() && (
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.faint }}>
            informe ao menos o nome e a stack principal
          </span>
        )}
      </div>
    </>
  );
}

// ── app shell ────────────────────────────────────────────────

// ── tela de carregamento do pipeline ─────────────────────────

// Cão desenhado à mão: é o fallback quando não há Lottie configurado ou
// quando a rede falha. Mesma linguagem do resto (âmbar + traço fino).
function HoundSVG({ T, size = 220 }) {
  const line = T.amber;
  return (
    <svg
      viewBox="0 0 240 130"
      width={size}
      height={(size * 130) / 240}
      role="img"
      aria-label="cão farejando uma trilha"
      style={{ display: "block" }}
    >
      {/* a trilha */}
      <path
        className="jh-trail"
        d="M4 112 C56 112 68 105 108 105 C152 105 176 110 236 110"
        fill="none"
        stroke={T.faint}
        strokeWidth="1.5"
        strokeDasharray="6 9"
      />

      {/* pegadas já deixadas para trás */}
      {[18, 44, 70].map((x, i) => (
        <g key={x} className="jh-paw" style={{ animationDelay: `${i * 0.35}s` }}>
          <ellipse cx={x} cy={118} rx={3.2} ry={2.4} fill={T.faint} />
          <ellipse cx={x + 9} cy={121} rx={3.2} ry={2.4} fill={T.faint} />
        </g>
      ))}

      {/* faro subindo do focinho */}
      {[0, 0.55, 1.1].map((d, i) => (
        <circle
          key={i}
          className="jh-scent"
          cx={190}
          cy={88}
          r={2.6 + i * 0.5}
          fill={line}
          style={{ animationDelay: `${d}s` }}
        />
      ))}

      <g className="jh-hound">
        {/* rabo */}
        <path
          className="jh-tail"
          d="M78 56 C66 48 66 36 77 31"
          fill="none"
          stroke={line}
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* patas */}
        {[
          [90, 76],
          [102, 76],
          [124, 74],
          [136, 74],
        ].map(([x, y]) => (
          <line
            key={x}
            x1={x}
            y1={y}
            x2={x + 2}
            y2={104}
            stroke={line}
            strokeWidth="5"
            strokeLinecap="round"
          />
        ))}

        {/* corpo */}
        <ellipse cx={110} cy={62} rx={35} ry={17} fill={line} />

        {/* cabeça abaixada, farejando */}
        <g transform="rotate(34 152 70)">
          <circle cx={152} cy={70} r={14} fill={line} />
          <ellipse cx={172} cy={70} rx={13} ry={7.5} fill={line} />
          <circle cx={185} cy={70} r={3.4} fill={T.bg} />
          <circle cx={155} cy={64} r={1.9} fill={T.bg} />
        </g>

        {/* orelha caída de cão de caça */}
        <path
          className="jh-ear"
          d="M147 60 C134 66 132 86 141 99 C152 90 155 72 156 62 Z"
          fill={line}
          opacity="0.82"
        />
      </g>
    </svg>
  );
}

let lottieScriptPromise = null;

function loadLottieScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.lottie) return Promise.resolve(window.lottie);
  if (!lottieScriptPromise) {
    lottieScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = LOTTIE_CDN;
      script.async = true;
      script.onload = () => resolve(window.lottie);
      script.onerror = () => reject(new Error("lottie-web não carregou"));
      document.head.appendChild(script);
    });
  }
  return lottieScriptPromise;
}

// Carrega o Lottie por CDN para não travar o build em mais uma dependência.
// Se preferir bundlar: `npm i lottie-react` e troque este componente por
// <Lottie animationData={hound} loop />. O fallback continua valendo a pena.
function HoundAnimation({ T, size = 220 }) {
  const hostRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!LOTTIE_HOUND_URL) return;
    let cancelled = false;
    let anim = null;

    loadLottieScript()
      .then((lottie) => {
        if (cancelled || !hostRef.current) return;
        anim = lottie.loadAnimation({
          container: hostRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          path: LOTTIE_HOUND_URL,
        });
        anim.addEventListener("DOMLoaded", () => !cancelled && setReady(true));
        anim.addEventListener("data_failed", () => !cancelled && setReady(false));
      })
      .catch(() => !cancelled && setReady(false));

    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, []);

  return (
    <div style={{ height: (size * 130) / 240, display: "grid" }}>
      <div
        ref={hostRef}
        aria-hidden={!ready}
        style={{
          gridArea: "1 / 1",
          width: size,
          height: (size * 130) / 240,
          opacity: ready ? 1 : 0,
          transition: "opacity 200ms ease",
        }}
      />
      {!ready && (
        <div style={{ gridArea: "1 / 1" }}>
          <HoundSVG T={T} size={size} />
        </div>
      )}
    </div>
  );
}

function formatElapsed(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function PipelineOverlay({ open, startedAt, stats, live, stage = null, onDismiss, T }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!open || !startedAt) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, startedAt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onDismiss();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onDismiss]);

  if (!open) return null;

  const slow = elapsed > 300;
  const headline = (stage && STAGE_HEADLINE[stage]) || "o cão está na trilha";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="pipeline em execução"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: T.scrim,
        backdropFilter: "blur(6px)",
        animation: "jh-fade-in 180ms ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: T.panel,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: "28px 28px 24px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          animation: "jh-pop 240ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
          <HoundAnimation T={T} size={230} />
        </div>

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: T.text,
              margin: "0 0 6px",
            }}
          >
            {headline}
          </h2>
          <p
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12.5,
              color: T.dim,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {live
              ? "isto leva alguns minutos. pode fechar — a lista atualiza sozinha."
              : "sem resposta da API — o pipeline pode seguir rodando no backend."}
          </p>
        </div>

        {/* barra indeterminada: ritmo, não progresso falso */}
        <div
          style={{
            height: 4,
            borderRadius: 999,
            background: T.track,
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          <div
            className="jh-sweep"
            style={{
              width: "34%",
              height: "100%",
              borderRadius: 999,
              background: `linear-gradient(90deg, transparent, ${T.amber}, transparent)`,
            }}
          />
        </div>

        <ul
          style={{
            listStyle: "none",
            margin: "0 0 20px",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 9,
          }}
        >
          {PIPELINE_STEPS.map((step) => {
            const active = step.key === stage;
            return (
              <li
                key={step.key}
                aria-current={active ? "step" : undefined}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 12.5,
                  color: active ? T.amber : T.faint,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  transition: "color 200ms ease",
                }}
              >
                <span aria-hidden style={{ width: 12 }}>
                  {active ? "▸" : "·"}
                </span>
                {step.label}
              </li>
            );
          })}
        </ul>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            paddingTop: 16,
            borderTop: `1px solid ${T.border}`,
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: T.dim,
            flexWrap: "wrap",
          }}
        >
          <span aria-live="polite">
            <span style={{ color: T.faint }}>tempo </span>
            <span style={{ color: T.text }}>{formatElapsed(elapsed)}</span>
          </span>
          <span style={{ color: T.faint }}>
            trilha anterior: {stats.fetched} farejadas · {stats.matched} na trilha
          </span>
        </div>

        {slow && (
          <p
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11.5,
              color: T.faint,
              margin: "14px 0 0",
              lineHeight: 1.6,
            }}
          >
            passou de 5 minutos. o modelo local costuma ser o gargalo — pode
            fechar esta tela, o resultado aparece sozinho.
          </p>
        )}

        <button
          onClick={onDismiss}
          style={{
            width: "100%",
            marginTop: 18,
            fontFamily: FONT_MONO,
            fontSize: 12.5,
            padding: "10px 14px",
            borderRadius: 6,
            border: `1px solid ${T.border}`,
            background: "transparent",
            color: T.dim,
            cursor: "pointer",
            transition: "all 120ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = T.amber;
            e.currentTarget.style.color = T.amber;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = T.border;
            e.currentTarget.style.color = T.dim;
          }}
        >
          acompanhar em segundo plano
          <span style={{ color: T.faint, marginLeft: 8 }}>esc</span>
        </button>
      </div>
    </div>
  );
}

function Sidebar({ view, setView, mode, setMode, live, T }) {
  const NavItem = ({ id, icon, label }) => {
    const active = view === id;
    return (
      <button
        onClick={() => setView(id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          fontFamily: FONT_MONO,
          fontSize: 13,
          padding: "11px 14px",
          borderRadius: 6,
          border: "none",
          borderLeft: `3px solid ${active ? T.amber : "transparent"}`,
          background: active ? T.amberSoft : "transparent",
          color: active ? T.amber : T.dim,
          cursor: "pointer",
          textAlign: "left",
          transition: "all 120ms ease",
        }}
      >
        <span aria-hidden style={{ width: 16 }}>
          {icon}
        </span>
        {label}
      </button>
    );
  };

  return (
    <aside
      className="jh-sidebar"
      style={{
        width: 210,
        flexShrink: 0,
        borderRight: `1px solid ${T.border}`,
        padding: "20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div
        className="jh-sidebar-brand"
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          padding: "0 14px 18px",
        }}
      >
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: T.text,
          }}
        >
          jobhound
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            color: live ? T.green : T.faint,
          }}
          title={live ? "conectado ao backend" : "backend offline"}
        >
          {live ? "●" : "○"}
        </span>
      </div>

      <NavItem id="matches" icon="▤" label="vagas" />
      <NavItem id="profile" icon="⚙" label="perfil" />
      <NavItem id="register" icon="+" label="novo perfil" />

      <div className="jh-sidebar-theme" style={{ marginTop: "auto", padding: "0 4px" }}>
        <button
          onClick={() => setMode(mode === "dark" ? "light" : "dark")}
          style={{
            width: "100%",
            fontFamily: FONT_MONO,
            fontSize: 12.5,
            padding: "9px 12px",
            borderRadius: 6,
            border: `1px solid ${T.border}`,
            background: "transparent",
            color: T.dim,
            cursor: "pointer",
            transition: "all 120ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = T.amber;
            e.currentTarget.style.color = T.amber;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = T.border;
            e.currentTarget.style.color = T.dim;
          }}
        >
          {mode === "dark" ? "☀ tema claro" : "☾ tema escuro"}
        </button>
      </div>
    </aside>
  );
}

export default function JobhoundDashboard() {
  const prefersLight =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: light)").matches;
  const [mode, setMode] = useState(prefersLight ? "light" : "dark");
  const T = THEMES[mode];

  const [view, setView] = useState("matches");
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [profile, setProfile] = useState(EMPTY_PROFILE_FORM);
  const [profileSlug, setProfileSlug] = useState(() =>
    typeof window !== "undefined"
      ? window.localStorage.getItem(PROFILE_SLUG_STORAGE_KEY)
      : null,
  );
  // Estado do pipeline: o backend é a fonte da verdade, não este componente.
  const [pipeline, setPipeline] = useState(EMPTY_PIPELINE);
  const [starting, setStarting] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const startedAtRef = useRef(null);
  const startingRef = useRef(false);
  const overlayOpenRef = useRef(false);

  useEffect(() => {
    startingRef.current = starting;
  }, [starting]);
  useEffect(() => {
    overlayOpenRef.current = overlayOpen;
  }, [overlayOpen]);

  const notify = useCallback((message, tone = "ok") => {
    clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const loadData = useCallback(async () => {
    try {
      const [mRes, sRes] = await Promise.all([
        fetch(`${API}/matches?filter=all&limit=200`),
        fetch(`${API}/stats`),
      ]);
      if (!mRes.ok || !sRes.ok) throw new Error("backend error");
      const [m, s] = await Promise.all([mRes.json(), sRes.json()]);
      setMatches(m);
      setStats(s);
      setLive(true);
      return { stats: s, matches: m };
    } catch {
      setLive(false);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Erro de rede aqui é "não consigo falar com a API" — diferente de
  // last_error, que é "a API respondeu e a última execução falhou".
  const fetchPipelineStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/pipeline/status`);
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data?.running === "boolean" ? data : null;
    } catch {
      return null;
    }
  }, []);

  const loadProfile = useCallback(
    async (slug) => {
      if (!slug) return;
      try {
        const res = await fetch(`${API}/profiles/${encodeURIComponent(slug)}`);
        if (res.status === 404) {
          notify(`Perfil "${slug}" não encontrado`, "error");
          setProfileSlug(null);
          window.localStorage.removeItem(PROFILE_SLUG_STORAGE_KEY);
          return;
        }
        if (!res.ok) throw new Error();
        const p = await res.json();
        setProfile(p);
        setProfileSlug(p.slug);
        window.localStorage.setItem(PROFILE_SLUG_STORAGE_KEY, p.slug);
      } catch {
        notify(`Não foi possível carregar o perfil "${slug}" — verifique a API`, "error");
      }
    },
    [notify],
  );

  useEffect(() => {
    loadData();
    if (profileSlug) loadProfile(profileSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  const closeRun = useCallback(() => {
    startingRef.current = false;
    startedAtRef.current = null;
    setStarting(false);
    setOverlayOpen(false);
    setRunStartedAt(null);
  }, []);

  // Um loop só, sempre ligado: atualiza a lista e lê o estado do pipeline.
  // `running` do backend é a única coisa que decide se a tela de carregamento
  // continua de pé — nada de comparar last_run nem de contar o tempo.
  useEffect(() => {
    const id = setInterval(async () => {
      const [data, status] = await Promise.all([loadData(), fetchPipelineStatus()]);

      // API fora do ar: mantém a última leitura e deixa o `live` sinalizar.
      if (!status) return;
      setPipeline(status);

      if (status.running) {
        startingRef.current = false;
        setStarting(false);
        return;
      }

      // running === false a partir daqui.

      // Ainda na janela entre o clique e o backend registrar a execução.
      const startedAt = startedAtRef.current;
      if (startingRef.current && startedAt && Date.now() - startedAt < START_GRACE_MS) {
        return;
      }

      if (!overlayOpenRef.current && !startingRef.current) return;

      closeRun();

      if (status.last_error) {
        notify(`O pipeline falhou: ${status.last_error}`, "error");
        return;
      }

      const s = data?.stats;
      notify(
        s
          ? `Trilha fechada: ${s.matched} para aplicar, ${s.manual_review} para revisar`
          : "Trilha fechada",
      );
      loadData();
    }, BACKGROUND_POLL_MS);
    return () => clearInterval(id);
  }, [loadData, fetchPipelineStatus, notify, closeRun]);

  // Verdadeiro tanto para execução confirmada pelo backend quanto para a
  // janela curta logo após o clique, para o botão não piscar.
  const busy = pipeline.running || starting;

  const runPipeline = async () => {
    // já rodando: o botão vira "reabrir a tela de acompanhamento"
    if (pipeline.running || starting) {
      setOverlayOpen(true);
      return;
    }

    const startedAt = Date.now();
    startedAtRef.current = startedAt;
    startingRef.current = true;
    setStarting(true);
    setRunStartedAt(startedAt);
    setOverlayOpen(true);

    try {
      const res = await fetch(`${API}/pipeline/run`, { method: "POST" });
      // 409 não é erro do usuário: já tem execução de pé, é só acompanhar.
      if (res.status === 202) {
        notify("Cão solto — as vagas aparecem aqui quando ele voltar");
      } else if (res.status === 409) {
        notify("O pipeline já estava rodando — acompanhando daqui");
      } else {
        throw new Error(`status ${res.status}`);
      }
      const status = await fetchPipelineStatus();
      if (status) setPipeline(status);
    } catch {
      closeRun();
      notify("Não foi possível iniciar o pipeline — verifique a API", "error");
    }
  };

  const saveProfile = async (form) => {
    if (!profileSlug) {
      notify("Nenhum perfil carregado para salvar — registre um primeiro", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/profiles/${encodeURIComponent(profileSlug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setProfile(await res.json());
      notify("Perfil salvo — o próximo run já usa as novas preferências");
    } catch {
      notify("Não foi possível salvar o perfil — verifique a API", "error");
    } finally {
      setSaving(false);
    }
  };

  const registerProfile = async (form) => {
    setRegistering(true);
    try {
      const res = await fetch(`${API}/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.status === 409) {
        notify("Já existe um perfil com esse nome — mude o nome e tente de novo", "error");
        return null;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      const created = await res.json();
      setProfile(created);
      setProfileSlug(created.slug);
      window.localStorage.setItem(PROFILE_SLUG_STORAGE_KEY, created.slug);
      notify(`Perfil "${created.slug}" registrado`);
      setView("profile");
      return created;
    } catch {
      notify("Não foi possível registrar o perfil — verifique a API", "error");
      return null;
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div
      className="jh-shell"
      style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
        display: "flex",
        transition: "background 200ms ease, color 200ms ease",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes jh-blink { 50% { opacity: 0; } }
        @keyframes jh-sniff { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes jh-dots {
          0% { content: ""; } 25% { content: "."; }
          50% { content: ".."; } 75% { content: "..."; } 100% { content: ""; }
        }
        .jh-dots::after { content: ""; animation: jh-dots 1.4s steps(1) infinite; }
        .jh-profile-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 24px;
          align-items: start;
        }
        .jh-hunt { position: sticky; top: 24px; }

        /* tela de carregamento do pipeline */
        @keyframes jh-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes jh-pop {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes jh-sweep {
          0%   { transform: translateX(-110%); }
          100% { transform: translateX(400%); }
        }
        .jh-sweep { animation: jh-sweep 1.5s cubic-bezier(0.4,0,0.2,1) infinite; }

        /* o cão desenhado à mão */
        @keyframes jh-hound-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2.5px); }
        }
        @keyframes jh-ear-sway {
          0%, 100% { transform: rotate(-4deg); }
          50%      { transform: rotate(5deg); }
        }
        @keyframes jh-tail-wag {
          0%, 100% { transform: rotate(-15deg); }
          50%      { transform: rotate(15deg); }
        }
        @keyframes jh-trail-run { to { stroke-dashoffset: -30; } }
        @keyframes jh-scent-rise {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
          35%  { opacity: 0.85; }
          100% { opacity: 0; transform: translate(11px, -30px) scale(1.2); }
        }
        @keyframes jh-paw-fade {
          0%, 100% { opacity: 0.16; }
          50%      { opacity: 0.6; }
        }
        .jh-hound { animation: jh-hound-bob 1.1s ease-in-out infinite; }
        .jh-ear {
          transform-box: fill-box; transform-origin: 50% 4%;
          animation: jh-ear-sway 1.1s ease-in-out infinite;
        }
        .jh-tail {
          transform-box: fill-box; transform-origin: 100% 100%;
          animation: jh-tail-wag 0.55s ease-in-out infinite;
        }
        .jh-trail { animation: jh-trail-run 1.2s linear infinite; }
        .jh-scent {
          transform-box: fill-box;
          animation: jh-scent-rise 1.8s ease-out infinite;
        }
        .jh-paw { animation: jh-paw-fade 1.6s ease-in-out infinite; }

        @media (max-width: 900px) {
          .jh-profile-grid { grid-template-columns: 1fr; }
          .jh-hunt { position: static; order: -1; }
        }
        @media (max-width: 720px) {
          .jh-shell { flex-direction: column; }
          .jh-sidebar {
            width: 100% !important;
            height: auto !important;
            position: static !important;
            flex-direction: row !important;
            align-items: center;
            flex-wrap: wrap;
            border-right: none !important;
            border-bottom: 1px solid ${T.border};
            padding: 12px 14px !important;
          }
          .jh-sidebar-brand { padding: 0 12px 0 0 !important; }
          .jh-sidebar button { width: auto !important; }
          .jh-sidebar-theme { margin-top: 0 !important; margin-left: auto; }
          .jh-main { padding: 20px 16px 48px !important; }
          .jh-header { padding: 14px 16px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, .jh-dots::after { animation: none !important; transition: none !important; }
          .jh-dots::after { content: "…"; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        input::placeholder, textarea::placeholder { color: ${T.faint}; }
      `}</style>

      <Sidebar
        view={view}
        setView={setView}
        mode={mode}
        setMode={setMode}
        live={live}
        T={T}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* topo da área de conteúdo: o console persistente */}
        <header
          className="jh-header"
          style={{
            borderBottom: `1px solid ${T.border}`,
            padding: "18px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 13,
              color: T.dim,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: T.green }}>joao@jobhound</span>
            <span style={{ color: T.faint }}>~</span>
            <span style={{ color: T.amber }}>$</span>
            <span style={{ color: T.text }}>
              {view === "matches"
                ? "farejar --perfil pleno --stack python,fastapi"
                : view === "register"
                  ? "registrar novo perfil"
                  : "editar perfil"}
            </span>
            {view === "matches" && busy ? (
              <span
                style={{
                  color: T.amber,
                  animation: "jh-sniff 1.4s ease-in-out infinite",
                }}
              >
                farejando<span className="jh-dots" />
              </span>
            ) : (
              <span
                style={{
                  width: 8,
                  height: 15,
                  background: T.amber,
                  display: "inline-block",
                  animation: "jh-blink 1.1s steps(1) infinite",
                }}
              />
            )}
          </div>

          {view === "matches" && (
            <button
              onClick={runPipeline}
              title={busy ? "ver a tela de acompanhamento" : "rodar o pipeline"}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 13,
                fontWeight: 700,
                padding: "10px 18px",
                borderRadius: 6,
                border: "none",
                background: busy ? T.border : T.amber,
                color: busy ? T.dim : T.amberText,
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
            >
              {busy ? "◱ acompanhar" : "▸ farejar"}
            </button>
          )}
        </header>

        <main
          className="jh-main"
          style={{ maxWidth: 920, margin: "0 auto", padding: "28px 28px 64px" }}
        >
          {view === "matches" ? (
            <MatchesView matches={matches} stats={stats} loading={loading} T={T} />
          ) : view === "register" ? (
            <RegisterProfileView
              onRegister={registerProfile}
              registering={registering}
              T={T}
            />
          ) : (
            <ProfileView
              profile={profile}
              slug={profileSlug}
              noProfileYet={live && !profileSlug}
              onSave={saveProfile}
              onLoadSlug={loadProfile}
              onGoRegister={() => setView("register")}
              saving={saving}
              T={T}
            />
          )}
        </main>
      </div>

      <PipelineOverlay
        open={overlayOpen && busy}
        startedAt={runStartedAt}
        stats={stats}
        live={live}
        stage={pipeline.stage}
        onDismiss={() => setOverlayOpen(false)}
        T={T}
      />

      <Toast
        message={toast?.message}
        tone={toast?.tone}
        onDismiss={() => setToast(null)}
        T={T}
      />
    </div>
  );
}