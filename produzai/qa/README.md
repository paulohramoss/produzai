# QA — o app de verdade, no navegador

```bash
npm run qa                    # todos os cenários
npm run qa -- treino ciclo    # filtra pelo nome do arquivo
npm run qa -- --headed        # assistindo
```

Prints e `report.json` em `qa/artifacts/` (fora do git).

## Por que existe um Firebase falso

O projeto não versiona `.env`. Sem as chaves do Firebase o app não passa da
tela de login — nada de interface pode ser validado. Então `qa/fakes/` substitui
`firebase/{app,auth,firestore,storage}` por dublês em memória, ligados por alias
do Vite em `qa/lib/browser.mjs`. **Todo o resto é o código de produção**: mesmos
componentes, mesmas stores, mesmo `src/lib/db.ts`.

Os dublês imitam de propósito dois comportamentos que já causaram bug aqui:

- `setDoc(..., { merge: true })` faz merge **profundo** — é disso que
  `saveDaily` depende para gravar água sem apagar os hábitos do mesmo dia.
- gravar `undefined` **lança erro**, como o Firestore real.

## O que não é coberto

| Fora do alcance | Como validar de verdade |
|---|---|
| `firestore.rules` | `firebase deploy --only firestore:rules` e testar com conta real |
| `/api/*` (Coach, Strava, push) | ambiente com as chaves, `npm run dev:vercel` |
| Aparência no iOS/Safari | o navegador aqui é Chrome; `06-responsividade` cobre largura, fonte de campo e altura de modal, mas não o render do Safari |

Layout mobile **é** coberto: `06-responsividade` roda em 320×568 e 390×844. Os
demais cenários rodam em 1400×1000 — passe `viewport` para mudar.

## Escrever um cenário

Ver `.claude/skills/qa/SKILL.md` — é o guia completo, e é o que os agentes leem.
Em resumo: arquivo em `qa/scenarios/NN-nome.mjs` exportando
`{ name, async run({ browser, baseUrl, slug, track, check }) }`.
