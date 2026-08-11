---
name: qa
description: Valida features do The Rise Plan rodando o app de verdade no navegador. Use ao terminar de implementar qualquer feature ou correção de interface, quando pedirem para "validar", "testar", "rodar o QA", ou antes de dar uma tarefa por concluída. Também explica como escrever um cenário novo para a feature que acabou de nascer.
---

# QA do The Rise Plan

A suíte roda o app REAL no Chrome, com o SDK do Firebase trocado por dublês em
memória. Não existe `.env` no projeto: sem os dublês o app não sai da tela de
login e nada pode ser validado.

## Rodar

```bash
cd produzai
npm run qa                    # todos os cenários
npm run qa -- treino ciclo    # só os que casam com o filtro (nome do arquivo)
npm run qa -- --headed        # abrindo o navegador para assistir
```

Sai com código 0 se tudo passou. Prints e `report.json` vão para
`qa/artifacts/` (fora do git).

**Sempre olhe os prints do que você mexeu.** Check verde não prova que a tela
está legível: a escala de dor do treino passava em todos os checks enquanto
quebrava linha e deixava "Muito forte" órfã. Foi o print que denunciou.

## Regra de ouro

**Toda feature entregue ganha checks.** Se a feature é nova, ou o cenário é
novo, ou os checks entram num cenário existente. Uma feature sem cobertura é
uma feature que ninguém vai perceber quando quebrar.

Nunca dê uma implementação por concluída sem `npm run qa` passando.

## Anatomia

```
qa/
  run.mjs              runner: sobe o Vite em processo, roda cenários, relata
  fakes/               dublês de firebase/{app,auth,firestore,storage}
  lib/browser.mjs      Chrome do sistema + dev server com os aliases
  lib/app.mjs          vocabulário do app: openSession, seededUser, navegação
  lib/report.mjs       check(), resumo, código de saída
  lib/dates.mjs        chaves de data no fuso local
  scenarios/NN-nome.mjs
```

## Escrever um cenário

Arquivo novo em `qa/scenarios/`, prefixo numérico para ordenar:

```js
import { openSession } from '../lib/app.mjs'

export default {
  name: 'O que esta feature promete ao usuário',

  async run({ browser, baseUrl, slug, track, check }) {
    // `track` registra a sessão para o runner fechar e varrer erros de console.
    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug }))
    const { page } = s

    await s.open('Treino')            // clica no menu lateral
    await s.openProfile()             // atalho para o Perfil
    await s.shot('01-estado')         // print em qa/artifacts/<slug>/
    const db = await s.db()           // o que o app REALMENTE gravou

    check('descrição na voz do usuário', condicao, 'detalhe quando útil')
  },
}
```

`openSession` entra logado e com onboarding concluído. Para testar a porta de
entrada, passe `user: null` e use `signUpThroughUi`. Para uma página pública,
`openAnonymousSession(browser, { db })` — sem sessão, enxergando o mesmo banco.

Semear estado inicial:

```js
const user = seededUser({ email: 'x@qa.dev', name: 'Atleta QA' })
user.db[`users/${user.uid}/data/workouts`] = { items: [ /* ... */ ] }
const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug, user }))
```

## O que faz um check valer alguma coisa

- **Verifique o que foi gravado, não só o que foi pintado.** `await s.db()` pega
  o bug em que a tela mostra certo e o banco guarda errado.
- **Nomeie na voz do usuário.** "edição não duplica o treino", não
  "update() preserva length".
- **Cubra o caminho destrutivo.** Desligar o ciclo apaga as datas? Revogar o
  link mata o link mesmo? É onde mora o dano real.
- **Em feature de privacidade, afirme a ausência.** O resumo do treinador tem
  checks de que NÃO aparecem ciclo, e-mail e uid.
- **Sem fallback em seletor.** Se `getByLabel` falhar, o rótulo se desassociou
  do campo — isso é defeito de acessibilidade para reprovar, não para
  contornar com `.catch()`. Foi assim que o QA achou os inputs sem rótulo do
  card de ciclo.

## Limites — diga ao usuário quando importarem

- **`firestore.rules` não é avaliado.** Os dublês ignoram as regras. Qualquer
  mudança em permissão (ex.: leitura pública de `coachShares/{token}`) só é
  validada de fato após `firebase deploy --only firestore:rules`.
- **`/api/*` não sobe.** Coach (Anthropic) e push respondem erro de
  rede; o app trata isso, mas cenários não podem depender dessas rotas.
- **Sem CI.** Roda quando alguém pede. Depois de `npm run qa`, relate o
  resultado — não deixe implícito.
