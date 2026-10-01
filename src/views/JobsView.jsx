import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import FilterChip from "../components/FilterChip";
import Icon from "../components/Icon";
import JobDetail from "../components/JobDetail";
import JobListItem from "../components/JobListItem";
import Kbd from "../components/Kbd";
import { HIGH_MATCH } from "../components/ScoreBar";
import Tabs from "../components/Tabs";
import { formatDateTime } from "../lib/format";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useShortcuts } from "../lib/useShortcuts";
import styles from "./JobsView.module.css";

const TABS = [
  { id: "new", label: "Novas" },
  { id: "saved", label: "Salvas" },
  { id: "applied", label: "Candidatei" },
  { id: "discarded", label: "Descartadas" },
];

const MIN_OPTIONS = [
  { value: "0", label: "qualquer" },
  { value: "0.5", label: "≥ 0.5" },
  { value: "0.6", label: "≥ 0.6" },
  { value: "0.7", label: "≥ 0.7" },
  { value: "0.8", label: "≥ 0.8" },
];

const SORT_OPTIONS = [
  { value: "score", label: "maior match" },
  { value: "recent", label: "mais recentes" },
];

const STAGE_LABEL = {
  fetch: "coletando nas fontes",
  extract: "lendo vagas",
  score: "pontuando",
  persist: "gravando",
};

const DEFAULT_FILTERS = { source: "all", mode: "all", min: "0", sort: "score" };

function stageOf(job) {
  return job.stage ?? "new";
}

function matchesQuery(job, q) {
  if (!q) return true;
  const hay = `${job.title} ${job.company} ${job.location}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((term) => hay.includes(term));
}

function summaryLine(jobs, pipeline) {
  const high = jobs.filter((j) => j.score >= HIGH_MATCH).length;
  const highText = `${high} com match alto`;
  // "desde o último faro" só quando a API informa quando ele começou.
  if (pipeline.started_at) {
    const since = new Date(pipeline.started_at).getTime();
    const fresh = jobs.filter((j) => new Date(j.fetchedAt).getTime() >= since).length;
    return `${fresh} ${fresh === 1 ? "nova" : "novas"} desde o último faro, ${highText}`;
  }
  return `${jobs.length} ${jobs.length === 1 ? "vaga farejada" : "vagas farejadas"}, ${highText}`;
}

export default function JobsView({ jobsState, pipeline, lastRunAt, busy, onRun, onRetry, onStage, hasProfile, onGoProfile }) {
  const { status, jobs } = jobsState;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("new");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState(null);
  const [showDetailMobile, setShowDetailMobile] = useState(false);
  const narrow = useMediaQuery("(max-width: 899px)");
  const searchRef = useRef(null);
  const optionRefs = useRef(new Map());
  const detailHeadingRef = useRef(null);

  const stageSupported = jobs.some((j) => j.stage != null);
  const canStage = stageSupported && typeof onStage === "function";

  const counts = useMemo(() => {
    const c = { new: 0, saved: 0, applied: 0, discarded: 0 };
    for (const j of jobs) c[stageOf(j)] += 1;
    return c;
  }, [jobs]);

  const tabs = TABS.map((t) => {
    const unsupported = !stageSupported && t.id !== "new";
    return {
      ...t,
      count: unsupported ? "—" : counts[t.id],
      disabled: unsupported,
      title: unsupported ? "Etapas da vaga ainda não existem na API" : undefined,
    };
  });

  const sourceOptions = useMemo(
    () => [{ value: "all", label: "todas" }, ...[...new Set(jobs.map((j) => j.source))].sort().map((s) => ({ value: s, label: s }))],
    [jobs],
  );
  const modeValues = useMemo(() => [...new Set(jobs.map((j) => j.workMode).filter(Boolean))].sort(), [jobs]);

  const visible = useMemo(() => {
    const min = Number(filters.min);
    const list = jobs.filter(
      (j) =>
        stageOf(j) === tab &&
        matchesQuery(j, query.trim()) &&
        (filters.source === "all" || j.source === filters.source) &&
        (filters.mode === "all" || j.workMode === filters.mode) &&
        j.score >= min,
    );
    return list.sort((a, b) =>
      filters.sort === "recent" ? new Date(b.fetchedAt) - new Date(a.fetchedAt) : b.score - a.score,
    );
  }, [jobs, tab, query, filters]);

  // Mantém sempre uma vaga selecionada entre as visíveis.
  useEffect(() => {
    if (!visible.some((j) => j.id === selectedId)) setSelectedId(visible[0]?.id ?? null);
  }, [visible, selectedId]);

  const selected = visible.find((j) => j.id === selectedId) ?? null;

  const select = (id, { open = false } = {}) => {
    setSelectedId(id);
    if (narrow && open) {
      setShowDetailMobile(true);
      requestAnimationFrame(() => detailHeadingRef.current?.focus());
    }
  };

  const move = (step) => {
    if (!visible.length) return;
    const i = visible.findIndex((j) => j.id === selectedId);
    const next = visible[Math.min(Math.max(i + step, 0), visible.length - 1)];
    setSelectedId(next.id);
    const el = optionRefs.current.get(next.id);
    el?.scrollIntoView({ block: "nearest" });
    if (el && document.activeElement?.getAttribute("role") === "option") el.focus();
  };

  const stage = (to) => selected && canStage && onStage(selected.id, selected.stage === to ? "new" : to);

  useShortcuts(
    {
      "/": () => searchRef.current?.focus(),
      s: () => stage("saved"),
      c: () => stage("applied"),
      x: () => stage("discarded"),
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
    },
    { enabled: status === "ok" },
  );

  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const filtersActive = query || JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.search}>
          <span className={`mono ${styles.prompt}`} aria-hidden="true">
            $
          </span>
          <label htmlFor="job-search" className="sr-only">
            Buscar vaga, empresa ou cidade (Esc limpa)
          </label>
          <input
            id="job-search"
            ref={searchRef}
            type="search"
            className={styles.searchInput}
            placeholder="buscar vaga, empresa ou cidade"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              if (query) setQuery("");
              else e.currentTarget.blur();
            }}
            autoComplete="off"
          />
          <Kbd>/</Kbd>
        </div>

        <div className={styles.run}>
          <div className={`mono ${styles.lastRun}`} aria-live="polite">
            <span className={styles.lastRunLabel}>{busy ? "farejando" : "último faro"}</span>
            <span>
              {busy
                ? STAGE_LABEL[pipeline.stage] ?? "começando…"
                : lastRunAt
                  ? formatDateTime(lastRunAt)
                  : "nunca"}
              {!busy && pipeline.last_error && <span className={styles.failed}> · falhou</span>}
            </span>
          </div>
          <Button variant="primary" icon="play" loading={busy} disabled={busy || !hasProfile} onClick={onRun}>
            {busy ? "Farejando…" : "Farejar agora"}
          </Button>
        </div>
      </div>

      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Vagas</h1>
          {status === "ok" && jobs.length > 0 && <p className={styles.summary}>{summaryLine(jobs, pipeline)}</p>}
        </div>
        <Tabs label="Etapas" tabs={tabs} value={tab} onChange={setTab} panelId="jobs-panel" />
        <div className={styles.filters}>
          <FilterChip label="fonte" value={filters.source} options={sourceOptions} onChange={setFilter("source")} />
          {modeValues.length > 0 && (
            <FilterChip
              label="modalidade"
              value={filters.mode}
              options={[{ value: "all", label: "todas" }, ...modeValues.map((m) => ({ value: m, label: m }))]}
              onChange={setFilter("mode")}
            />
          )}
          <FilterChip label="match" value={filters.min} options={MIN_OPTIONS} onChange={setFilter("min")} />
          <FilterChip label="ordenar" value={filters.sort} options={SORT_OPTIONS} onChange={setFilter("sort")} />
        </div>
      </header>

      <div id="jobs-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className={styles.panel}>
        {status === "loading" && <LoadingState />}

        {status === "error" && (
          <div className={styles.error} role="alert">
            <Icon name="alert" size={22} />
            <div>
              <h2 className={styles.errorTitle}>Não consegui falar com a API</h2>
              <p className={styles.errorText}>{jobsState.error || "Verifique se o backend está no ar."}</p>
            </div>
            <Button icon="refresh" onClick={onRetry}>
              Tentar de novo
            </Button>
          </div>
        )}

        {status === "ok" && jobs.length === 0 && (
          <EmptyState
            title="Nada farejado ainda"
            action={
              hasProfile ? (
                <Button variant="primary" icon="play" loading={busy} disabled={busy} onClick={onRun}>
                  {busy ? "Farejando…" : "Farejar agora"}
                </Button>
              ) : (
                <Button variant="primary" icon="target" onClick={onGoProfile}>
                  Criar perfil de caça
                </Button>
              )
            }
          >
            {hasProfile
              ? "Solte o cão: ele busca nas fontes e traz só as vagas que combinam com o seu perfil."
              : "Antes do primeiro faro, diga ao cão o que procurar."}
          </EmptyState>
        )}

        {status === "ok" && jobs.length > 0 && visible.length === 0 && (
          <div className={styles.noResults}>
            <p>Nenhuma vaga nesta aba com esses filtros.</p>
            {filtersActive && (
              <Button
                onClick={() => {
                  setQuery("");
                  setFilters(DEFAULT_FILTERS);
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {status === "ok" && visible.length > 0 && (
          <div className={`${styles.split} ${narrow && showDetailMobile ? styles.showDetail : ""}`}>
            <ul role="listbox" aria-label="Vagas" className={styles.list}>
              {visible.map((job) => (
                <JobListItem
                  key={job.id}
                  ref={(el) => (el ? optionRefs.current.set(job.id, el) : optionRefs.current.delete(job.id))}
                  job={job}
                  selected={job.id === selectedId}
                  onSelect={(id) => select(id, { open: true })}
                />
              ))}
            </ul>
            <div className={styles.detail}>
              {narrow && (
                <button type="button" className={styles.back} onClick={() => setShowDetailMobile(false)}>
                  <Icon name="arrowLeft" /> Voltar para a lista
                </button>
              )}
              {selected && <JobDetail job={selected} onStage={canStage ? onStage : null} headingRef={detailHeadingRef} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className={styles.split} aria-busy="true" aria-label="Carregando vagas">
      <div className={styles.list}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.skeletonItem}>
            <span className={styles.skeleton} style={{ width: 44, height: 18 }} />
            <span className={styles.skeletonLines}>
              <span className={styles.skeleton} style={{ width: "80%", height: 16 }} />
              <span className={styles.skeleton} style={{ width: "55%", height: 12 }} />
              <span className={styles.skeleton} style={{ width: "35%", height: 10 }} />
            </span>
          </div>
        ))}
      </div>
      <div className={styles.detail}>
        <span className={styles.skeleton} style={{ width: 120, height: 12 }} />
        <span className={styles.skeleton} style={{ width: "70%", height: 34, marginTop: 12 }} />
        <span className={styles.skeleton} style={{ width: "40%", height: 16, marginTop: 10 }} />
        <span className={styles.skeleton} style={{ width: "100%", height: 160, marginTop: 28, borderRadius: 16 }} />
      </div>
    </div>
  );
}
