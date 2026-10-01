import { useEffect, useId, useMemo, useState } from "react";
import { EMPTY_PROFILE_FORM, toProfileForm } from "../api/adapters";
import Button from "../components/Button";
import ChipInput from "../components/ChipInput";
import Icon from "../components/Icon";
import Segmented from "../components/Segmented";
import SourceCard from "../components/SourceCard";
import Switch from "../components/Switch";
import { faroCommandLines } from "../lib/faroCommand";
import { slugify } from "../lib/format";
import { activeSources as computeActiveSources, SOURCES, sourcesWithTerms } from "../lib/sources";
import styles from "./ProfileView.module.css";

const SENIORITY = ["junior", "pleno", "senior"].map((v) => ({ value: v, label: v }));

export function checklist(form, activeSources) {
  const stack = form.primary_stack.length;
  return [
    { ok: form.name.trim().length > 0, text: form.name.trim() ? "Nome preenchido" : "Preencha o nome" },
    {
      ok: stack > 0,
      text: stack > 0 ? `Stack principal com ${stack} ${stack === 1 ? "tecnologia" : "tecnologias"}` : "Adicione ao menos 1 tecnologia na stack principal",
    },
    {
      ok: activeSources.length > 0,
      text: activeSources.length > 0 ? `${activeSources.length} de ${SOURCES.length} fontes ativas` : "Nenhuma fonte ativa",
    },
  ];
}

function Card({ number, title, description, children }) {
  const id = useId();
  return (
    <section className={styles.card} aria-labelledby={id}>
      <header className={styles.cardHeader}>
        <span className={`mono ${styles.cardNumber}`} aria-hidden="true">
          {number}
        </span>
        <div>
          <h2 id={id} className={styles.cardTitle}>
            {title}
          </h2>
          <p className={styles.cardDescription}>{description}</p>
        </div>
      </header>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

function TextField({ label, value, onChange, placeholder, multiline = false, hint }) {
  const id = useId();
  const Tag = multiline ? "textarea" : "input";
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {hint && <span className={styles.hint}>{hint}</span>}
      </label>
      <Tag
        id={id}
        className={`${styles.input} ${multiline ? styles.textarea : ""}`}
        value={value}
        placeholder={placeholder}
        rows={multiline ? 4 : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// mode: "edit" (perfil ativo) | "new" (registro). O mesmo formulário serve aos dois.
export default function ProfileView({ mode, profileState, saving, onSave, onCreate, onNew, onRetry, onDirtyChange }) {
  const isNew = mode === "new";
  const baseline = useMemo(
    () => (isNew || !profileState.data ? EMPTY_PROFILE_FORM : toProfileForm(profileState.data)),
    [isNew, profileState.data],
  );
  const [form, setForm] = useState(baseline);
  const [saved, setSaved] = useState(false);
  const seniorityId = useId();

  // Perfil novo carregado (ou salvo) → o formulário passa a refletir a API.
  useEffect(() => {
    setForm(baseline);
  }, [baseline]);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const activeSources = computeActiveSources(form);
  const withTerms = sourcesWithTerms(form);
  const checks = checklist(form, activeSources);
  const ready = checks.every((c) => c.ok);
  const commandLines = faroCommandLines({ ...form, sources: activeSources });

  useEffect(() => {
    onDirtyChange?.(dirty);
    if (dirty) setSaved(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Aviso do navegador ao fechar/recarregar com alterações pendentes.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  // Mantém a ordem canônica das fontes: ligar e desligar de volta não deixa o
  // formulário "sujo" só por mudar a ordem.
  const toggleSource = (id) => (on) =>
    setForm((f) => ({
      ...f,
      enabled_sources: SOURCES.map((s) => s.id).filter((s) => (s === id ? on : f.enabled_sources.includes(s))),
    }));

  const sourceStatus = (id) => {
    if (!form.enabled_sources.includes(id)) return "DESLIGADA";
    return withTerms.includes(id) ? "ATIVA" : "SEM STACK";
  };

  const submit = async (e) => {
    e.preventDefault();
    if (isNew) {
      if (ready) await onCreate(form);
    } else if (dirty && (await onSave(form))) {
      setSaved(true);
    }
  };

  if (!isNew && profileState.status === "loading") {
    return (
      <div className={styles.page} aria-busy="true">
        <p className={`mono ${styles.slugLine}`}>carregando perfil…</p>
      </div>
    );
  }

  // Falha ao carregar NÃO mostra formulário vazio (era o bug: slug na tela,
  // campos em branco). Mostra o erro e deixa tentar de novo.
  if (!isNew && profileState.status === "error") {
    return (
      <div className={styles.page}>
        <div className={styles.loadError} role="alert">
          <Icon name="alert" size={22} />
          <div>
            <h1 className={styles.loadErrorTitle}>Não consegui carregar o perfil</h1>
            <p className={styles.loadErrorText}>
              <span className="mono">{profileState.slug}</span>: {profileState.error}
            </p>
          </div>
          <Button icon="refresh" onClick={onRetry}>
            Tentar de novo
          </Button>
          <Button icon="plus" onClick={onNew}>
            Novo perfil
          </Button>
        </div>
      </div>
    );
  }

  const status = isNew
    ? ready
      ? `será registrado como ${slugify(form.name) || "—"}`
      : "complete o checklist para registrar"
    : saving
      ? "salvando…"
      : dirty
        ? "alterações não salvas"
        : saved
          ? "salvo"
          : "sem alterações";

  return (
    <form className={styles.page} onSubmit={submit} noValidate>
      <header className={styles.header}>
        <div>
          <p className={`mono ${styles.slugLine}`}>
            {isNew ? "novo perfil" : "perfil ativo"} · {isNew ? slugify(form.name) || "slug gerado do nome" : profileState.data.slug}
          </p>
          <h1 className={styles.title}>{isNew ? "Novo perfil de caça" : "Perfil de caça"}</h1>
          <p className={styles.subtitle}>Diga quem você é e onde procurar. O jobhound usa isso em cada faro.</p>
        </div>
        {!isNew && (
          <Button icon="plus" onClick={onNew}>
            Novo perfil
          </Button>
        )}
      </header>

      <div className={styles.grid}>
        <div className={styles.main}>
          <Card number="01" title="Quem sou" description="Como você aparece para o agente na hora de avaliar uma vaga.">
            <div className={styles.row}>
              <TextField label="Nome" value={form.name} onChange={set("name")} placeholder="seu nome completo" />
              <TextField label="Headline" value={form.headline} onChange={set("headline")} placeholder="ex.: Backend Python Developer" />
            </div>
            <div className={styles.field}>
              <span className={styles.label} id={seniorityId}>
                Senioridade
              </span>
              <Segmented labelledBy={seniorityId} options={SENIORITY} value={form.seniority} onChange={set("seniority")} />
            </div>
            <TextField
              label="Resumo"
              hint="vai no prompt do agente"
              multiline
              value={form.summary}
              onChange={set("summary")}
              placeholder="Um resumo curto de quem você é."
            />
          </Card>

          <Card number="02" title="Stack" description="O que você quer usar no dia a dia.">
            <ChipInput
              label="Stack principal"
              hint="enter adiciona"
              chips={form.primary_stack}
              onChange={set("primary_stack")}
              placeholder="adicionar tecnologia"
            />
            <ChipInput
              label="Stack secundária"
              hint="complementa a principal"
              chips={form.secondary_stack}
              onChange={set("secondary_stack")}
              placeholder="adicionar tecnologia"
            />
          </Card>

          <Card number="03" title="Onde" description="Cidades e modalidade aceitas.">
            <ChipInput label="Cidades" chips={form.preferred_locations} onChange={set("preferred_locations")} placeholder="adicionar cidade" />
            <Switch
              label="Aceito vagas remotas"
              description="inclui vagas 100% remotas além das cidades acima"
              checked={form.accepts_remote}
              onChange={set("accepts_remote")}
            />
          </Card>

          <Card number="04" title="Fontes" description="Onde o jobhound vai farejar.">
            <div className={styles.sources}>
              {SOURCES.map((s) => (
                <SourceCard
                  key={s.id}
                  name={s.name}
                  description={s.description}
                  checked={form.enabled_sources.includes(s.id)}
                  onChange={toggleSource(s.id)}
                  status={sourceStatus(s.id)}
                />
              ))}
            </div>
            <p className={styles.note}>
              Os termos de busca de cada fonte vêm da stack. Fonte ligada sem stack que a alimente fica de fora do faro.
            </p>
          </Card>
        </div>

        <aside className={styles.side} aria-label="Resumo do faro">
          <section className={styles.preview} aria-labelledby="faro-preview-title">
            <h2 id="faro-preview-title" className={`mono ${styles.previewTitle}`}>
              PRÉVIA DO FARO
            </h2>
            <pre className={styles.command} aria-live="polite">
              <code>
                {commandLines.map((line, i) => (
                  <span key={i} className={styles.commandLine}>
                    {i === 0 ? <span className={styles.dollar}>$ </span> : "  "}
                    {line}
                    {"\n"}
                  </span>
                ))}
              </code>
            </pre>
          </section>

          <section className={styles.checklist} aria-labelledby="checklist-title">
            <h2 id="checklist-title" className={styles.checklistTitle}>
              {ready ? "Pronto para farejar" : "Falta pouco"}
            </h2>
            <ul>
              {checks.map((c) => (
                <li key={c.text} className={c.ok ? styles.ok : styles.fail}>
                  <Icon name={c.ok ? "check" : "alert"} size={15} strokeWidth={2.25} />
                  <span>
                    <span className="sr-only">{c.ok ? "ok: " : "pendente: "}</span>
                    {c.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <footer className={styles.footer}>
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          disabled={saving || (isNew ? !ready : !dirty)}
        >
          {isNew ? "Registrar perfil" : "Salvar perfil"}
        </Button>
        <Button disabled={!dirty || saving} onClick={() => setForm(baseline)}>
          Descartar alterações
        </Button>
        <span className={`${styles.status} ${dirty && !isNew ? styles.statusDirty : ""}`} aria-live="polite">
          {status}
        </span>
      </footer>
    </form>
  );
}
