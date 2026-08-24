# The Rise Plan — guia para agentes

App web (PWA dark) de performance pessoal — treino, dieta, hábitos, mental — com
um Coach IA que lê o histórico real do usuário antes de responder. React 19 +
Vite + TypeScript, Firebase (Auth/Firestore/Storage) no cliente, funções
serverless na Vercel.

## Comandos

Tudo roda de dentro de `produzai/` — a raiz do repositório não tem `package.json`.

```bash
npm run dev          # Vite em localhost:5173 (sem /api/*)
npm run dev:vercel   # vercel dev na porta 3000 — única forma de exercitar /api/*
npm run build        # tsc -b && vite build → dist/
npm run lint         # eslint . (só .ts/.tsx; api/*.js NÃO é lintado)
npm test             # node --test em api/**/*.test.mjs (regra do placar do desafio)
npm run qa           # cenários de navegador com dublês do Firebase
```

QA: `.claude/skills/qa/SKILL.md` é o guia completo (rodar, escrever cenário,
limites). Não duplicar aquilo aqui.

## Onde as coisas moram

```
vercel.json, cors.json     raiz do repo — o vercel.json DA RAIZ é o que a Vercel usa
produzai/                  o app inteiro
  api/ai/*                 proxy da Anthropic (stream.js, completion.js, _prompts.js, _auth.js)
  api/challenge/sync.js    único escritor do placar; api/push/*  cron + envio
  challenge.json           desafio em cartaz — lido pelo app E pelo servidor
  src/lib/                 db.ts (Firestore), firebase.ts, anthropic.ts, date.ts, domínio
  src/store/               Zustand: auth, workout, webDiet, habits, plan, coach, cycle
  src/rise/                UI: data.ts (C/T), primitives.tsx, RisePlan.tsx, pages/, components/
  firestore.rules + storage.rules; qa/ (runner, fakes/, scenarios/NN-nome.mjs)
```

## Convenções deste repo

- **Estilo é inline com o design system.** `C.*` (cores) e `T.*` (space/radius/
  text/weight) de `src/rise/data.ts`, aplicados em `style={{}}` — ~1600 usos
  contra ~100 `className`. Tailwind existe e está configurado, mas só para os
  utilitários de `src/index.css`; não migrar telas para classes.
  Tokens espelhados em três arquivos: `src/index.css` (canônico),
  `src/rise/data.ts` e `tailwind.config.js`. Mudou um, mude os três.
- **Toda chamada de IA passa por `/api/ai/*`.** `ANTHROPIC_API_KEY` é server-side,
  sem prefixo `VITE_`, e o system prompt (com o conhecimento de treino) é montado
  no servidor. Nada com prefixo `VITE_` é segredo — vai para o bundle.
- **Firestore só via `src/lib/db.ts`.** Nenhum componente ou store importa
  `firebase/firestore` (só `firebase/storage` e `firebase/auth` escapam, no
  upload de foto e no auth store). O uid é global no módulo, via `setDbUid()`.
- **Zustand com `persist` + `userStorage`.** As chaves do localStorage são
  prefixadas por UID (`${uid}:manual_workouts`). Sem uid, `userStorage` não lê
  nem escreve — de propósito.
- **Português no domínio.** Comentários, nomes de página (`Treino`, `Hoje`),
  tipos de treino e rótulos de UI em português; helpers técnicos podem ficar em
  inglês. Comentários daqui explicam *por que*, não *o quê* — manter o tom.

## Armadilhas (todas já quebraram algo aqui)

- **Data em UTC.** Nunca `toISOString().slice(0,10)`. Use `src/lib/date.ts` —
  no Brasil o "hoje" virava amanhã às 21h e furava a sequência do usuário.
- **`undefined` no Firestore lança erro.** Campo opcional apagado tem que sumir
  do objeto (ver `stripUndefined` em `useWorkoutStore.ts`).
- **Ordem no logout.** Soltar o uid *antes* de limpar as stores; `persist` grava
  a cada `setState` e o estado vazio ia por cima do histórico salvo.
- **Escrita offline não resolve.** `db.ts` dispara e loga (`fireWrite`) — não
  transformar em `await`.
- **Dois `vercel.json` e dois `cors.json`** (raiz e `produzai/`), com conteúdo
  divergente. Editar o **da raiz** — o de dentro é sobra.
- **Placar e clube não se escrevem do cliente.** `firestore.rules` nega; a porta
  é `POST /api/challenge/sync`. Mudança de regra só vale após
  `firebase deploy --only firestore:rules`, e o QA não avalia as regras.
- **Service worker.** `version.json` é o único arquivo fora do precache — é como
  o app percebe build nova. Não colocar no cache.

## Fechamento de tarefa

Nada é "pronto" sem os três verdes, rodados de `produzai/`:

```bash
npm run lint && npm run build && npm run qa
```

Feature nova ganha checks no QA, e os prints em `qa/artifacts/` do que você mexeu
precisam ser olhados. Relate o resultado do QA explicitamente.
