import { useCallback, useEffect, useRef, useState } from "react";
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

const EMPTY_PIPELINE = {
  running: false,
  profile: null,
  stage: null,
  started_at: null,
  finished_at: null,
  last_error: null,
  last_run: null,
};

function readSlug() {
  try {
    return JSON.parse(window.localStorage.getItem(SLUG_KEY));
  } catch {
    return null;
  }
}

function writeSlug(slug) {
  try {
    window.localStorage.setItem(SLUG_KEY, JSON.stringify(slug));
  } catch {
    // storage indisponível: o perfil ativo vale só nesta sessão
  }
}

function describeError(err) {
  if (err instanceof ApiError) return err.status === 404 ? "perfil não encontrado" : `a API respondeu ${err.status}`;
  return "a API não respondeu";
}

export default function App() {
  const [theme, setTheme] = useTheme();

  const [view, setView] = useState("jobs");
  const [profileMode, setProfileMode] = useState("edit");
  // status: loading | ok | error | none (nenhum perfil cadastrado)
  const [profileState, setProfileState] = useState({ status: "loading", slug: readSlug(), data: null });
  const [profiles, setProfiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const [jobsState, setJobsState] = useState({ status: "loading", jobs: [], error: null });
  const [stats, setStats] = useState(null);
  const [pipeline, setPipeline] = useState(EMPTY_PIPELINE);
  const [starting, setStarting] = useState(false);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const profileDirty = useRef(false);
  const runRef = useRef({ startedAt: null, sawRunning: false });
  // Etapas mudadas aqui e ainda não refletidas por um poll: jobId → {stage, settledAt}.
  // Um poll que saiu ANTES do PATCH terminar traz o estado velho; sem isto, a
  // vaga "pularia de volta" de aba até o poll seguinte.
  const pendingStages = useRef(new Map());

  // Vagas, stats e faro são sempre do perfil ativo. Sem perfil carregado
  // (ainda carregando, erro ou nenhum cadastrado), não há escopo para pedir.
  const activeSlug = profileState.status === "ok" ? profileState.slug : null;
  const activeSlugRef = useRef(activeSlug);
  activeSlugRef.current = activeSlug;

  const notify = useCallback((message, tone = "ok") => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ── perfis ────────────────────────────────────────────────
  const refreshProfiles = useCallback(async () => {
    try {
      const list = await api.listProfiles();
      setProfiles(list);
      return list;
    } catch {
      return null;
    }
  }, []);

  const loadProfile = useCallback(async (slug) => {
    setProfileState({ status: "loading", slug, data: null });
    try {
      const data = await api.getProfile(slug);
      setProfileState({ status: "ok", slug: data.slug, data });
      writeSlug(data.slug);
    } catch (err) {
      setProfileState({ status: "error", slug, data: null, error: describeError(err) });
    }
  }, []);

  // Abre no perfil salvo neste navegador; senão, no editado por último (o mesmo
  // que o backend usa por padrão). Sem nenhum perfil, vai direto para "novo".
  useEffect(() => {
    (async () => {
      const list = await refreshProfiles();
      const stored = readSlug();
      if (list === null) {
        if (stored) loadProfile(stored);
        else setProfileState({ status: "error", slug: null, data: null, error: describeError(null) });
        return;
      }
      const slug = list.some((p) => p.slug === stored) ? stored : list[0]?.slug;
      if (slug) {
        loadProfile(slug);
      } else {
        setProfileState({ status: "none", slug: null, data: null });
        setProfileMode("new");
      }
    })();
  }, [refreshProfiles, loadProfile]);

  const saveProfile = async (form) => {
    setSaving(true);
    try {
      const data = await api.updateProfile(profileState.slug, toProfileBody(form));
      setProfileState({ status: "ok", slug: data.slug, data });
      refreshProfiles();
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
      writeSlug(data.slug);
      refreshProfiles();
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
    if (slug !== profileState.slug || profileState.status !== "ok") {
      setJobsState({ status: "loading", jobs: [], error: null });
      loadProfile(slug);
    }
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
    const slug = activeSlugRef.current;
    if (!slug) return;
    const requestedAt = Date.now();
    try {
      const [matches, s] = await Promise.all([api.matches(slug), api.stats(slug)]);
      if (activeSlugRef.current !== slug) return; // trocou de perfil no meio
      const pending = pendingStages.current;
      const jobs = matches.map((m) => {
        const job = adaptMatch(m);
        const p = pending.get(job.id);
        if (!p) return job;
        if (p.settledAt !== null && requestedAt >= p.settledAt) {
          pending.delete(job.id); // este poll já viu o PATCH aplicado
          return job;
        }
        return { ...job, stage: p.stage };
      });
      setJobsState({ status: "ok", jobs, error: null });
      setStats(s);
    } catch (err) {
      // Depois do primeiro sucesso, uma falha de poll não apaga a lista.
      setJobsState((prev) =>
        prev.status === "ok" ? prev : { status: "error", jobs: [], error: `Erro: ${describeError(err)}.` },
      );
    }
  }, []);

  // Sem perfil, a tela de vagas não fica presa no skeleton.
  useEffect(() => {
    if (profileState.status === "none") setJobsState({ status: "ok", jobs: [], error: null });
    if (profileState.status === "error") {
      setJobsState({ status: "error", jobs: [], error: `Não consegui carregar o perfil: ${profileState.error}.` });
    }
    if (activeSlug) loadJobs();
  }, [activeSlug, profileState.status, profileState.error, loadJobs]);

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
      status = await api.pipelineStatus(activeSlugRef.current);
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
    if (busy || !activeSlug) return;
    runRef.current = { startedAt: Date.now(), sawRunning: false };
    setStarting(true);
    try {
      const result = await api.runPipeline(activeSlug);
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

  // Triagem otimista: a vaga muda de aba na hora; se a API recusar, volta.
  const changeStage = async (jobId, stage) => {
    const previous = jobsState.jobs.find((j) => j.id === jobId)?.stage;
    const apply = (to) =>
      setJobsState((s) => ({ ...s, jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, stage: to } : j)) }));
    const pending = pendingStages.current;
    pending.set(jobId, { stage, settledAt: null });
    apply(stage);
    try {
      await api.setStage(jobId, stage, activeSlug);
      if (pending.get(jobId)?.stage === stage) pending.set(jobId, { stage, settledAt: Date.now() });
    } catch (err) {
      if (pending.get(jobId)?.stage === stage) pending.delete(jobId);
      apply(previous);
      notify(`Não foi possível mover a vaga: ${describeError(err)}.`, "error");
    }
  };

  // ── derivados ─────────────────────────────────────────────
  const newCount = jobsState.jobs.filter((j) => j.stage === "new").length;
  const activeProfile = profileState.status === "ok" ? profileState.data : null;
  const lastRun = pipeline.last_run;

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
          profiles,
          onSelect: switchProfile,
          onNew: startNewProfile,
        }}
      >
        <main>
          {view === "jobs" ? (
            <JobsView
              jobsState={jobsState}
              pipeline={pipeline}
              lastRun={lastRun}
              lastRunAt={lastRun?.finished_at ?? stats?.last_run ?? null}
              busy={busy}
              onRun={runPipeline}
              onRetry={() => {
                setJobsState({ status: "loading", jobs: [], error: null });
                if (profileState.status === "error") loadProfile(profileState.slug);
                else loadJobs();
              }}
              onStage={changeStage}
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
