# The Rise Plan

**Pare de treinar no escuro.** Todo app registra treino; poucos fazem algo com o
registro. O The Rise Plan transforma histórico em decisão: qual carga puxar hoje,
o que comprar no mercado no sábado e quando o corpo está pedindo descanso.

Web app dark, PWA, com persistência em Firestore e coach de IA que leu o seu
histórico inteiro antes de responder.

---

## O que o atleta ganha

| | Promessa |
|---|---|
| **Treino** | Sua próxima carga não é um chute — a progressão sai do que você levantou de verdade |
| **Dieta** | Você já sabe o que comer; aqui vira **lista de compras da semana**, agrupada por setor do mercado |
| **Hoje** | Um lugar só para o dia de hoje: hábitos, foco e sequência, sem abrir mais nada |
| **Coach IA** | Um treinador que cruza sono, dor e carga antes de mandar você treinar pesado |
| **Desafio** | Temporada com data para acabar e prêmio de parceiro — placar que reinicia para todo mundo |
| **Clube** | Grupo fechado com meta coletiva do mês. Sem feed, sem estranho |

<details>
<summary>Todos os módulos</summary>

| Módulo | O que faz |
|---|---|
| **Dashboard** | KPIs, desafio da temporada, clube, ranking global e widgets de treino e dieta |
| **Hoje** | Check-in diário de hábitos customizáveis, foco do dia e resumo de refeições |
| **Treino** | Registro de atividades com templates, progressão de carga, estatísticas e diário |
| **Dieta** | Plano alimentar com macros, refeições, check-in e lista de compras gerada |
| **Agenda** | Calendário de compromissos e tarefas |
| **Projetos** | Gestão de projetos pessoais com progresso e prioridade |
| **Mental** | Diário de humor, energia, gratidão e notas diárias com histórico |
| **Biblioteca** | Tracker de leitura com status, rating e progresso por página |
| **Insights** | Padrões cruzados entre treino, dieta, sono e humor |
| **Galeria** | Fotos de progresso no Firebase Storage com comparação lado a lado |

A barra lateral mostra só **Início, Hoje, Treino, Dieta e Coach**; o resto vive
atrás de "Mais" — profundidade é recompensa por ficar, não pedágio para entrar.

</details>

**Recursos transversais:** landing pública com Open Graph · atribuição de origem
(UTM + link de indicação) · onboarding de 3 telas · PWA com push · toasts ·
lembretes no navegador · exportação CSV · link read-only para o treinador

---

---

## Stack

- **React 19** + **TypeScript** + **Vite 8**
- **Firebase 12** — Auth, Firestore, Storage, Hosting
- **Zustand 5** — estado global com `persist` namespaced por UID
- **Anthropic API** — Claude Haiku 4.5 via streaming SSE direto do browser
- Inline styles + design system próprio (`C.*`) — zero CSS em runtime externo

---

## Pré-requisitos

- Node.js 18+
- Projeto Firebase com **Authentication**, **Firestore** e **Storage** habilitados
- Conta Anthropic para o Coach IA (opcional, mas recomendado)

---

## Instalação

```bash
git clone <repo>
cd produzai
npm install
```

Copie o arquivo de variáveis de ambiente:

```bash
cp .env.example .env
```

Preencha o `.env`:

```env
# Coach IA — console.anthropic.com/api-keys
VITE_ANTHROPIC_API_KEY=sk-ant-...

# Firebase — console.firebase.google.com → Configurações do projeto → Seus apps
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
VITE_FIREBASE_APP_ID=...
```

```bash
npm run dev
```

---

## Configuração Firebase

### 1. Ativar os serviços no console

Acesse [console.firebase.google.com](https://console.firebase.google.com) e habilite em sequência:

1. **Authentication** → E-mail/senha
2. **Firestore Database** → Criar banco (modo produção)
3. **Storage** → Get Started (qualquer região)

### 2. Deploy das regras de segurança

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,storage --project SEU_PROJETO_ID
```

As regras em `firestore.rules` garantem isolamento total entre usuários. O leaderboard é legível por todos os usuários autenticados.

### 3. CORS para upload de fotos (Galeria)

O upload direto do browser exige configuração de CORS no Storage. Requer o [Google Cloud CLI](https://cloud.google.com/sdk/docs/install):

```bash
gsutil cors set cors.json gs://SEU_PROJETO.firebasestorage.app
```

O arquivo `cors.json` já inclui `localhost:5173` e os domínios do Firebase Hosting.

### 4. Deploy de produção

```bash
npm run build
firebase deploy --only hosting --project SEU_PROJETO_ID
```

---

## Estrutura do projeto

```
src/
├── lib/
│   ├── anthropic.ts      # Streaming Claude API + builder de system prompt com dados reais
│   ├── db.ts             # CRUD Firestore (workouts, diet, daily, mental, leaderboard...)
│   ├── exportData.ts     # Geração e download de CSV
│   ├── firebase.ts       # Inicialização App, Auth, Firestore, Storage
│   ├── notifications.ts  # Browser Notifications API + agendamento diário
│   ├── toast.ts          # Zustand store de toasts com auto-dismiss
│   └── userStorage.ts    # localStorage namespaced por UID
│
├── store/
│   ├── useAuthStore.ts    # Auth Firebase + carregamento inicial do Firestore
│   ├── useHabitsStore.ts  # Hábitos customizáveis + sync na nuvem
│   ├── useWebDietStore.ts # Dieta, refeições e macros + sync Firestore
│   └── useWorkoutStore.ts # Histórico de treinos + sync Firestore
│
└── rise/
    ├── data.ts            # Paleta de cores (C.*), tipos de Page, navegação
    ├── data/
    │   └── templates.ts   # 10 templates de treino + 4 templates de dieta
    ├── primitives.tsx     # Card, Bar, Ring, Tag — componentes base
    ├── LayoutContext.ts   # isMobile + menuOpen via React context
    ├── RisePlan.tsx       # Shell: sidebar, mobile overlay, roteamento de páginas
    ├── DietaModal.tsx     # Modal do plano alimentar com templates
    ├── components/
    │   ├── HabitosModal.tsx  # CRUD de hábitos com emoji picker
    │   └── Toaster.tsx       # UI de toasts com animação slide-in
    └── pages/
        ├── Dashboard.tsx  # KPIs + leaderboard ao vivo
        ├── Hoje.tsx       # Hábitos, foco do dia, refeições, lembretes
        ├── Treino.tsx     # Registro de atividades com templates
        ├── Dieta.tsx      # Plano alimentar e macros
        ├── Agenda.tsx
        ├── Projetos.tsx
        ├── Mental.tsx     # Diário de bem-estar com histórico
        ├── Biblioteca.tsx # Tracker de livros
        ├── Coach.tsx      # Chat IA com streaming Claude
        ├── Galeria.tsx    # Fotos de progresso com comparação
        ├── Login.tsx      # Autenticação (login + cadastro)
        └── Onboarding.tsx # Wizard inicial (meta, macros, hábitos)
```

---

## Persistência de dados

Toda escrita vai simultaneamente para **localStorage** (offline/instantâneo) e **Firestore** (sincronização entre dispositivos). Na autenticação, o Firestore tem prioridade; se não houver dados na nuvem, o localStorage é o fallback.

```
Firestore
└── users/{uid}/
    ├── data/profile        # onboardingDone, createdAt
    ├── data/workouts       # { items: ManualWorkout[] }
    ├── data/diet           # WebDietData (goals + meals)
    ├── data/projects       # { items: Project[] }
    ├── data/books          # { items: Book[] }
    ├── data/habitDefs      # { items: HabitDef[] }
    ├── data/progress       # { items: ProgressPhoto[] } (URLs do Storage)
    ├── daily/{YYYY-MM-DD}  # { habits, focus }
    └── mental/{YYYY-MM-DD} # { mood, energy, gratitude, note }

leaderboard/{uid}           # xp, displayName, weeklyWorkouts, updatedAt
```

---

## Coach IA

O chat usa **Claude Haiku 4.5** com streaming SSE. O system prompt é construído dinamicamente com os dados reais do usuário (treinos da semana, % calórico, hábitos configurados) para que as respostas sejam personalizadas.

A chave Anthropic é enviada diretamente do browser com o header `anthropic-dangerous-direct-browser-access: true`. Para um SaaS com múltiplos usuários, mova a chamada para uma Firebase Function para proteger a chave.

---

## Operar um desafio

O desafio é a única parte do app que o dono liga e desliga na mão — de propósito:
data, prêmio e parceiro são decisão de negócio, não configuração de usuário.

Para abrir uma temporada nova, edite **`produzai/challenge.json`**. É um arquivo
só: o app (`src/lib/challenge.ts`) e o servidor que confere o placar
(`api/challenge/sync.js`) leem o mesmo. Trocar o `id` zera o placar sem apagar o
anterior — a coleção `challenges/{id}/entries` da temporada antiga fica para
consulta.

Depois, publique as regras uma vez: `firebase deploy --only firestore:rules`.

### Como o placar resiste a fraude

O cliente **não escreve** no placar; as regras negam. A única porta é
`POST /api/challenge/sync`, e ele aplica duas travas:

1. **Janela** — um dia só é confirmado se estiver a no máximo um dia do "hoje"
   do servidor. Registrar agora um treino de cinco dias atrás não pontua, nunca.
2. **Um por dia de servidor** — em cada data do relógio do servidor entra no
   máximo um dia de desafio. Sem isso a folga de fuso (necessária, porque a data
   do treino é local e o servidor só tem UTC) viraria brecha para reivindicar
   hoje e amanhã na mesma visita.

O efeito prático: para fechar 21 dias é preciso voltar ao app em 21 datas
diferentes de calendário. Mover só o *cálculo* para o servidor não teria feito
nada — os treinos moram em `users/{uid}/data/workouts`, documento do próprio
usuário, que ele pode preencher com o que quiser. O que separa treino de
invenção é o **momento** em que o registro chegou.

O que isso **não** resolve: quem abre o app todo dia e registra um treino que não
fez continua pontuando. Num app de registro manual esse é o teto — fechar mais
exigiria prova externa (importação do Strava, foto com carimbo de tempo).

Os ataques acima estão travados por teste: `npm test` roda
`api/challenge/sync.test.mjs` sem precisar de rede nem Firestore.

**Configuração obrigatória** para o placar funcionar em produção:
`FIREBASE_SERVICE_ACCOUNT_B64` (a mesma do cron de push) e `FIREBASE_API_KEY`.
Sem elas o endpoint responde 503 e o app mostra a contagem local rotulada como
*não confirmada* — nunca um número que finge ser oficial.

---

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em `localhost:5173` |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Preview local do build |
| `npm run lint` | Lint com ESLint + TypeScript |
| `npm test` | Testes de unidade das funções serverless (`node --test`) — hoje, a regra do placar do desafio |
| `npm run qa` | Cenários de navegador com os dublês do Firebase (`qa/`); `-- --headed` para assistir |

---

## Variáveis de ambiente

Tudo com prefixo `VITE_` **vai para o bundle e é público** — só configuração,
nunca segredo. As chaves de verdade ficam sem prefixo, no ambiente do servidor.

### Cliente (públicas, entram no bundle)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Sim | Chave pública do Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Sim | `projeto.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Sim | ID do projeto Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Galeria | `projeto.firebasestorage.app` |
| `VITE_FIREBASE_APP_ID` | Sim | App ID do Firebase |
| `VITE_SITE_URL` | Compartilhamento | Origem publicada (`https://...`) — vira URL absoluta das tags Open Graph |
| `VITE_VAPID_PUBLIC_KEY` | Push | Chave pública VAPID, usada pelo navegador para se inscrever |

### Servidor (segredos — configure no dashboard da Vercel)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ANTHROPIC_API_KEY` | Coach IA | Chave da API Anthropic (`sk-ant-...`). **Sem prefixo `VITE_`** |
| `FIREBASE_API_KEY` | Sim | Mesmo valor de `VITE_FIREBASE_API_KEY`, sem prefixo — valida os tokens em `api/*`. Sem ela toda chamada autenticada é rejeitada |
| `FIREBASE_SERVICE_ACCOUNT_B64` | Desafio, push | Conta de serviço em base64. Sem ela o placar do desafio fica em 503 e o cron de push não envia |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Push | Par gerado por `npx web-push generate-vapid-keys` |
| `VAPID_EMAIL` | Push | `mailto:seu@email.com` |
| `CRON_SECRET` | Push | Segredo que a Vercel envia nas execuções agendadas |
