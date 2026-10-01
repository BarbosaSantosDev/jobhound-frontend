# jobhound — dashboard

Dashboard React do **jobhound** — um assistente pessoal de busca de vagas que
usa um LLM pra extrair fatos objetivos de cada vaga e pontua o match contra o
seu perfil com lógica determinística (o LLM não decide se a vaga é boa, só
extrai o que está escrito).

Esse repositório é só o frontend. O backend (API FastAPI + pipeline) fica em
um repositório separado — veja o `ARQUITETURA.md` de lá pra entender o fluxo
completo (perfil → busca nas fontes → extração via LLM → pontuação → matches).

## O que tem aqui

- **Vagas** — caixa de triagem: busca (`/`), abas por etapa, filtros, lista
  com score e detalhe com o match e o porquê. Atalhos: `S` salvar,
  `C` candidatei, `X` descartar, `↑ ↓` navegam.
- **Perfil de caça** — quem sou, stack, onde e fontes, com uma prévia ao vivo
  do comando de faro e um checklist. O mesmo formulário registra um perfil
  novo ("+ Novo perfil" no seletor da sidebar).
- Tema claro/escuro: segue o sistema na primeira visita; depois vale a escolha
  salva no navegador.
- Atualização em segundo plano: a tela consulta a API a cada poucos segundos,
  então vagas/matches novos aparecem sozinhos, sem precisar recarregar.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # aponte REACT_APP_API_URL se o backend não estiver em localhost:8000
npm start
```

Abre em `http://localhost:3000`. Precisa do backend rodando (veja o README do
repositório da API).

## Testes e lint

```bash
npm test                 # Jest + Testing Library
npx eslint --ext .js,.jsx src
```

## Build de produção

```bash
npm run build
```

## Stack

Create React App (react-scripts 5), React 19, sem bibliotecas de UI externas.
Identidade "Âmbar fósforo": tokens em `src/theme/tokens.css` (aplicados via
`data-theme="claro|escuro"` no `<html>`), CSS Modules por componente,
Bricolage Grotesque + JetBrains Mono self-hosted via `@fontsource` e ícones
em SVG inline.

```
src/
├── api/         # cliente HTTP (REACT_APP_API_URL) e adaptadores da API
├── components/  # Button, ChipInput, Segmented, Switch, SourceCard, JobListItem, JobDetail, Logo...
├── layout/      # AppShell: sidebar fixa / drawer abaixo de 900px
├── lib/         # funções puras e hooks (prévia do faro, atalhos, formatação)
├── theme/       # tokens, CSS global e useTheme
└── views/       # JobsView e ProfileView
```
