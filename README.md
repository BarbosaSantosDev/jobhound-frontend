# jobhound — dashboard

Dashboard React do **jobhound** — um assistente pessoal de busca de vagas que
usa um LLM pra extrair fatos objetivos de cada vaga e pontua o match contra o
seu perfil com lógica determinística (o LLM não decide se a vaga é boa, só
extrai o que está escrito).

Esse repositório é só o frontend. O backend (API FastAPI + pipeline) fica em
um repositório separado — veja o `ARQUITETURA.md` de lá pra entender o fluxo
completo (perfil → busca nas fontes → extração via LLM → pontuação → matches).

## O que tem aqui

- **Vagas** — lista das vagas farejadas, com score, motivos e filtro
  (todas / na trilha / revisar).
- **Perfil** — edição do perfil (stack, senioridade, localização, aceita
  remoto). Os termos de busca em cada fonte são derivados automaticamente da
  sua stack — não é um campo editável.
- **Novo perfil** — registro de um perfil novo, sem afetar o que já está
  carregado.
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

## Build de produção

```bash
npm run build
```

## Stack

Create React App (react-scripts 5), React 19, sem bibliotecas de UI externas
— tudo em CSS-in-JS inline, com tema dark/light.
