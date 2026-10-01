import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adaptMatch, toProfileBody } from "./api/adapters";
import { api, ApiError } from "./api/client";
import Toast from "./components/Toast";
import AppShell from "./layout/AppShell";
import { useTheme } from "./theme/theme";
import JobsView from "./views/JobsView";
import ProfileView from "./views/ProfileView";

const POLL_MS = 3_000;
// Janela entre o clique e o backend confirmar `running: true`. Sem ela, um poll
// no meio do POST leria running:false e daria o faro por encerrado cedo demais.
const START_GRACE_MS = 8_000;
const SLUG_KEY = "jobhound.profileSlug";
const KNOWN_KEY = "jobhound.knownProfiles";

const EMPTY_PIPELINE = { running: false, stage: null, started_at: null, finished_at: null, last_error: null };

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage indisponível: segue só em memória
  }
}

function describeError(err) {
  if (err instanceof ApiError) return err.status === 404 ? "perfil não encontrado" : `a API respondeu ${err.status}`;
  return "a API não respondeu";
}

function profileSummary(p) {
  return { slug: p.slug, name: p.name, seniority: p.seniority, primary_stack: p.primary_stack };
}

function latest(...isoDates) {
  const valid = isoDates.filter(Boolean);
  if (!valid.length) return null;
  return valid.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
}

export default function App() {
  const [theme, setTheme] = useTheme();
  const initialSlug = useMemo(() => readStorage(SLUG_KEY, null), []);

  const [view, setView] = useState("jobs");
  const [profileMode, setProfileMode] = useState(initialSlug ? "edit" : "new");
  const [profileState, setProfileState] = useState(
    initialSlug ? { status: "loading", slug: initialSlug, data: null } : { status: "none", slug: null, data: null },
  );
  const [knownProfiles, setKnownProfiles] = useState(() => readStorage(KNOWN_KEY, []));
  const [saving, setSaving] = useState(false);

  const [jobsState, setJobsState] = useState({ status: "loading", jobs: [], error: null });
  const [stats, setStats] = useState(null);
  const [pipeline, setPipeline] = useState(EMPTY_PIPELINE);
  const [starting, setStarting] = useState(false);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const profileDirty = useRef(false);
  const runRef = useRef({ startedAt: null, sawRunning: false });

  const notify = useCallback((message, tone = "ok") => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const rememberProfile = useCallback((p) => {
    setKnownProfiles((list) => {
      const next = [profileSummary(p), ...list.filter((x) => x.slug !== p.slug)];
      writeStorage(KNOWN_KEY, next);
      return next;
    });
  }, []);

  const forgetProfile = useCallback((slug) => {
    setKnownProfiles((list) => {
      const next = list.filter((x) => x.slug !== slug);
      writeStorage(KNOWN_KEY, next);
      return next;
    });
  }, []);

  // ── perfil ────────────────────────────────────────────────
  const loadProfile = useCallback(
    async (slug) => {
      setProfileState({ status: "loading", slug, data: null });
      try {
        const data = await api.getProfile(slug);
        setProfileState({ status: "ok", slug: data.slug, data });
        writeStorage(SLUG_KEY, data.slug);
        rememberProfile(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) forgetProfile(slug);
        setProfileState({ status: "error", slug, data: null, error: describeError(err) });
      }
    },
    [rememberProfile, forgetProfile],
  );

  useEffect(() => {
    if (initialSlug) loadProfile(initialSlug);
  }, [initialSlug, loadProfile]);

  const saveProfile = async (form) => {
    setSaving(true);
    try {
      const data = await api.updateProfile(profileState.slug, toProfileBody(form));
      setProfileState({ status: "ok", slug: data.slug, data });
      rememberProfile(data);
      notify("Perfil salvo. O próximo faro já usa as novas preferências.");
      return true;
    } catch (err) {
      notify(`Não foi possível salvar: ${describeError(err)}.`, "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const createProfile = async (form) => {
    setSaving(true);
    try {
      const data = await api.createProfile(toProfileBody(form));
      profileDirty.current = false;
      setProfileState({ status: "ok", slug: data.slug, data });
      writeStorage(SLUG_KEY, data.slug);
      rememberProfile(data);
      setProfileMode("edit");
      notify(`Perfil ${data.slug} registrado.`);
    } catch (err) {
      const conflict = err instanceof ApiError && err.status === 409;
      notify(
        conflict
          ? "Já existe um perfil com esse nome. Mude o nome e tente de novo."
          : `Não foi possível registrar: ${describeError(err)}.`,
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  // ── navegação (com aviso de alterações não salvas) ────────
  const confirmLeave = () =>
    !profileDirty.current || window.confirm("Há alterações não salvas no perfil. Sair mesmo assim?");

  const navigate = (next) => {
    if (next === view) return;
    if (view === "profile" && !confirmLeave()) return;
    setView(next);
  };

  const startNewProfile = () => {
    if (view === "profile" && profileMode === "new") return;
    if (view === "profile" && !confirmLeave()) return;
    setProfileMode("new");
    setView("profile");
  };

  const switchProfile = (slug) => {
    if (view === "profile" && !confirmLeave()) return;
    setProfileMode("edit");
    if (slug !== profileState.slug || profileState.status !== "ok") loadProfile(slug);
  };

  const goToProfile = () => {
    if (view === "profile") return;
    setProfileMode(profileState.status === "none" ? "new" : "edit");
    setView("profile");
  };

  const onDirtyChange = useCallback((dirty) => {
    profileDirty.current = dirty;
  }, []);

  // ── vagas + pipeline ──────────────────────────────────────
  const loadJobs = useCallback(async () => {
    try {
      const [matches, s] = await Promise.all([api.matches(), api.stats()]);
      setJobsState({ status: "ok", jobs: matches.map(adaptMatch), error: null });
      setStats(s);
    } catch (err) {
      // Depois do primeiro sucesso, uma falha de poll não apaga a lista.
      setJobsState((prev) =>
        prev.status === "ok" ? prev : { status: "error", jobs: [], error: `Erro: ${describeError(err)}.` },
      );
    }
  }, []);

  const finishRun = useCallback(
    (status) => {
      runRef.current = { startedAt: null, sawRunning: false };
      setStarting(false);
      if (status.last_error) notify(`O faro falhou: ${status.last_error}`, "error");
      else notify("Faro concluído. As vagas novas já estão na lista.");
      loadJobs();
    },
    [notify, loadJobs],
  );

  const poll = useCallback(async () => {
    loadJobs();
    let status;
    try {
      status = await api.pipelineStatus();
    } catch {
      return;
    }
    setPipeline(status);
    const run = runRef.current;
    if (status.running) {
      run.sawRunning = true;
      setStarting(false);
      return;
    }
    if (run.sawRunning) {
      finishRun(status);
      return;
    }
    if (run.startedAt) {
      // Faro curto que terminou entre dois polls: finished_at depois do clique.
      const finishedAfterClick =
        status.finished_at && new Date(status.finished_at).getTime() >= run.startedAt - 1000;
      if (finishedAfterClick) {
        finishRun(status);
      } else if (Date.now() - run.startedAt > START_GRACE_MS) {
        runRef.current = { startedAt: null, sawRunning: false };
        setStarting(false);
      }
    }
  }, [loadJobs, finishRun]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const busy = pipeline.running || starting;

  const runPipeline = async () => {
    if (busy) return;
    runRef.current = { startedAt: Date.now(), sawRunning: false };
    setStarting(true);
    try {
      const result = await api.runPipeline();
      if (result === "already-running") {
        runRef.current.sawRunning = true;
        notify("Já tinha um faro em andamento. Acompanhando daqui.");
      }
    } catch (err) {
      runRef.current = { startedAt: null, sawRunning: false };
      setStarting(false);
      notify(`Não foi possível farejar: ${describeError(err)}.`, "error");
    }
  };

  // ── derivados ─────────────────────────────────────────────
  const jobs = jobsState.jobs;
  const newCount = useMemo(() => {
    if (jobs.some((j) => j.stage != null)) return jobs.filter((j) => j.stage === "new").length;
    if (!pipeline.started_at) return 0;
    const since = new Date(pipeline.started_at).getTime();
    return jobs.filter((j) => new Date(j.fetchedAt).getTime() >= since).length;
  }, [jobs, pipeline.started_at]);

  const activeProfile = profileState.status === "ok" ? profileState.data : null;

  return (
    <>
      <AppShell
        view={view}
        onNavigate={(next) => (next === "profile" ? goToProfile() : navigate(next))}
        newCount={newCount}
        theme={theme}
        onThemeChange={setTheme}
        switcher={{
          active: activeProfile,
          profiles: knownProfiles,
          onSelect: switchProfile,
          onNew: startNewProfile,
          onLoadSlug: switchProfile,
        }}
      >
        <main>
          {view === "jobs" ? (
            <JobsView
              jobsState={jobsState}
              pipeline={pipeline}
              lastRunAt={latest(pipeline.finished_at, stats?.last_run)}
              busy={busy}
              onRun={runPipeline}
              onRetry={() => {
                setJobsState({ status: "loading", jobs: [], error: null });
                loadJobs();
              }}
              onStage={null /* PATCH de etapa ainda não existe na API */}
              hasProfile={Boolean(activeProfile)}
              onGoProfile={goToProfile}
            />
          ) : (
            <ProfileView
              key={profileMode === "new" ? "new" : profileState.slug}
              mode={profileMode === "new" || profileState.status === "none" ? "new" : "edit"}
              profileState={profileState}
              saving={saving}
              onSave={saveProfile}
              onCreate={createProfile}
              onNew={startNewProfile}
              onRetry={() => loadProfile(profileState.slug)}
              onDirtyChange={onDirtyChange}
            />
          )}
        </main>
      </AppShell>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
