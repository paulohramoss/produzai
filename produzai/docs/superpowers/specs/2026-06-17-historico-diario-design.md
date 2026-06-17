# Histórico diário — design

Data: 2026-06-17

## Problema

O usuário preenche hábitos e foco do dia na página "Hoje" ([Hoje.tsx](../../../src/rise/pages/Hoje.tsx)), mas essa página só lê/grava a data de hoje (`todayKey = new Date().toISOString().slice(0, 10)`, fixo). Quando o usuário esquece de preencher um dia, não há como voltar e completar aquele dia retroativamente. Os dados já existem por data no Firestore (`getDaily`/`saveDaily` em [lib/db.ts](../../../src/lib/db.ts)), incluindo uma função de leitura em lote já otimizada (`getDailyHistory`), mas não existe nenhuma UI de calendário/histórico — `Insights.tsx` só consome esses dados para agregados, não para edição.

## Escopo

- Cobre apenas **hábitos + foco do dia** (o que hoje vive em `DailyData` / página "Hoje"). A página "Mental" (humor/energia/gratidão/notas) fica fora deste escopo.
- Nova página dedicada **"Histórico"**, com item próprio no menu (grupo `INÍCIO`, ao lado de "Hoje"), navegação sem limite de meses para o passado.
- Permite reabrir e editar qualquer dia passado (ou hoje) com a mesma interação de marcar hábitos/editar foco que já existe em "Hoje".

## Arquitetura

### Novo tipo de página

Em [src/rise/data.ts](../../../src/rise/data.ts):
- `Page` ganha o literal `'historico'`.
- `NAV_GROUPS` grupo `INÍCIO` ganha um `NavItem` `{ id: 'historico', icon: <ícone de calendário, ex. CalendarDays ou History>, label: 'Histórico' }`.

### Componente compartilhado `DailyChecklist`

Novo arquivo `src/rise/components/DailyChecklist.tsx`, extraído do bloco de estado/UI hoje embutido em `Hoje.tsx` (carregamento de hábitos+foco, toggle, persistência, cálculo de score).

Interface proposta:

```ts
interface DailyChecklistProps {
  date: string                  // 'YYYY-MM-DD'
  editable: boolean              // false para dias futuros (não deveria nem ser montado, mas defensivo)
}
```

Responsabilidades movidas de `Hoje.tsx` para `DailyChecklist`:
- Estado `habits`, `focus`, `loaded`.
- `useEffect` de carga: mescla `habitDefs` (do `useHabitsStore`, sempre os hábitos *atuais* — não há versionamento histórico de definições de hábito) com o estado salvo (`getDaily(date)`); fallback de `localStorage` **apenas quando `date` é a data de hoje** (dias passados não têm cache local e não devem criar um, para não conflitar com o registro real de "hoje" salvo sob a mesma chave de localStorage).
- `toggleHabit`, `toggleFocus`, `updateFocus`, `persistDaily` — idênticos à lógica atual, mas usando `date` em vez de `todayKey` fechado no escopo do componente.
- Cálculo de `doneHabits`, `totalFocus`, `doneFocus`, `score` (fórmula 60% hábitos + 40% foco, igual à atual).
- Renderiza os dois cards "🎯 Foco do dia" e "✅ Hábitos" (incluindo o botão "⚙ Editar" que abre `HabitosModal`, que já é global/independente de data).

O que **permanece** em `Hoje.tsx` (não migra para o componente compartilhado): header com saudação/data, "Uma coisa" (`OneThingMode`), lembrete do que ficou pra depois ontem, cards de Treino/Refeições/Score/Notificações. `Hoje.tsx` passa a montar `<DailyChecklist date={todayKey} editable />` no lugar do bloco que hoje tem inline, e continua lendo `habits`/`focus` resultantes via um callback ou hook compartilhado apenas onde precisar deles fora do componente (ex.: o card de Score usa `doneHabits`/`totalFocus`/`score` — ver "Interface de saída" abaixo).

**Interface de saída:** como `Hoje.tsx` precisa do `score`/contadores para o card "⚡ Score do dia" e para `nextThing()` (modo "Uma coisa"), `DailyChecklist` expõe esse estado via callback `onStateChange?: (s: { habits: Habit[]; focus: FocusItem[] }) => void` chamado a cada mudança — `Hoje.tsx` guarda esse retorno em estado local para alimentar os cards que ficaram fora do componente. `Historico.tsx` não precisa desse callback (o painel do dia não tem cards externos dependendo do estado).

### Página `Historico.tsx`

Novo arquivo `src/rise/pages/Historico.tsx`.

Estado local:
- `viewMonth: Date` — mês/ano exibido (inicial: mês atual).
- `selectedDate: string | null` — dia selecionado para edição (inicial: hoje, se visível no mês atual; senão `null`).
- `monthData: Record<string, DailyData>` — resultado de `getDailyHistory(diasDoMesVisivel)`, recarregado a cada troca de mês.

Cálculo de cor por dia, usando a mesma fórmula de score de `DailyChecklist`/`Hoje.tsx` (hábitos 60% + foco 40%), com `habitDefs` atuais como denominador:
- Sem entrada em `monthData[date]` → cinza neutro (`C.card2`), sem borda de destaque (estado "vazio").
- Entrada existe, score === 100 → verde (`C.green`).
- Entrada existe, score < 100 (inclusive 0) → laranja (`C.orange`).
- Dia futuro (`date > hoje`) → renderizado apagado (opacidade reduzida, sem cor de score), `pointer-events: none`, não selecionável.
- Dia igual a hoje → borda adicional (2px) para diferenciar visualmente, independente da cor de fundo.

Header do calendário: nome do mês em pt-BR + setas ‹ › (`viewMonth` -1/+1 mês). Sem limite inferior; o botão › fica desabilitado quando `viewMonth` já é o mês atual (não navega para o futuro).

Layout:
- Desktop (`!isMobile`): grid `1fr 1fr` — calendário à esquerda, painel à direita. Painel mostra `<DailyChecklist date={selectedDate} editable={selectedDate <= hoje} />` ou um placeholder "Selecione um dia" se `selectedDate` for `null`.
- Mobile (`isMobile`): calendário em coluna única, largura cheia; ao selecionar um dia, o painel aparece abaixo do calendário na mesma página (sem modal/bottom-sheet).

### Reuso de `getDailyHistory`

Sem mudanças em `lib/db.ts` — `getDailyHistory(dates)` já agrega por mês (1-2 leituras), então trocar de mês no calendário dispara uma chamada com as datas daquele mês (até 31 strings), batida internamente em 1 leitura na maioria dos casos.

## Fluxo de dados

1. `Historico.tsx` monta → calcula dias do `viewMonth` → `getDailyHistory(dias)` → preenche `monthData` → renderiza grade colorida.
2. Usuário clica numa célula de dia passado/hoje → `setSelectedDate(date)`.
3. Painel renderiza `<DailyChecklist date={selectedDate} editable />`, que faz seu próprio `getDaily(date)` (fonte de verdade para edição; pode estar mais atualizado que `monthData` se o usuário editou e voltou no mesmo carregamento) e permite marcar hábitos / editar foco normalmente, persistindo via `saveDaily(date, ...)` como hoje.
4. Ao salvar uma alteração no painel, `Historico.tsx` deve atualizar a célula correspondente em `monthData` (sem novo round-trip ao Firestore) para refletir a nova cor imediatamente — via o callback `onStateChange` de `DailyChecklist` (recalcula score local e atualiza `monthData[selectedDate]`).

## Casos de borda

- **Dia sem nenhum hábito definido** (`habitDefs` vazio): score considera só o foco (mesma regra de divisão por zero que `Hoje.tsx` já trata implicitamente — `habits.length` pode ser 0; replicar guarda existente ou usar `habits.length > 0 ? ... : 0`).
- **Usuário deslogado**: `Historico.tsx` segue o padrão das outras páginas que dependem de nuvem — mostra mensagem pedindo login em vez do calendário (sem fallback de localStorage para histórico de outros dias, já que localStorage só guarda o dia atual).
- **Navegação para o mês corrente após editar um dia futuro por engano**: não é possível — dias futuros não são clicáveis.
- **Definições de hábito mudaram desde o dia editado**: ao abrir um dia antigo, hábitos criados depois daquele dia aparecem como pendentes (mesmo comportamento que `Hoje.tsx` já tem ao misturar `habitDefs` atuais com o estado salvo) — comportamento aceito, sem versionamento de hábitos neste escopo.

## Testes

- Manual: criar/editar hábitos e foco em 2-3 dias diferentes via "Hoje", abrir "Histórico", confirmar cores corretas (verde/laranja/cinza) no mês atual e em um mês anterior sem dados.
- Manual: editar um dia passado direto no painel do "Histórico" e confirmar que a alteração persiste (reabrir a página) e que a célula do calendário atualiza a cor sem reload.
- Manual: testar fluxo mobile (calendário + painel empilhado) e confirmar que dias futuros não são clicáveis.
- Sem testes automatizados novos — confirmado que o projeto não tem script `test` nem arquivos `*.test.*`/`*.spec.*`; validação é manual conforme os passos acima.
