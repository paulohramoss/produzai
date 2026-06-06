# The Rise Plan

Plataforma web de performance pessoal — treino, dieta, hábitos, saúde mental e desenvolvimento. Interface dark com design system próprio, persistência em Firestore e Coach IA com streaming via Claude.

---

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Dashboard** | Visão geral com KPIs, ranking global ao vivo e widgets de treino e dieta |
| **Hoje** | Check-in diário de hábitos customizáveis, foco do dia e resumo de refeições |
| **Treino** | Registro manual de atividades com templates, estatísticas semanais e mensais |
| **Dieta** | Plano alimentar com macros, refeições, check-in e templates prontos |
| **Agenda** | Calendário de compromissos e tarefas |
| **Projetos** | Gestão de projetos pessoais com progresso e prioridade |
| **Mental** | Diário de humor, energia, gratidão e notas diárias com histórico |
| **Biblioteca** | Tracker de leitura com status, rating e progresso por página |
| **Coach IA** | Chat com streaming usando Claude — analisa dados reais do usuário e exporta CSV |
| **Galeria** | Upload de fotos de progresso para Firebase Storage com comparação lado a lado |

**Recursos transversais:** onboarding wizard · sidebar mobile com overlay · toast notifications · hábitos customizáveis · notificações de lembrete (browser) · ranking global via Firestore · exportação CSV

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

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em `localhost:5173` |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Preview local do build |
| `npm run lint` | Lint com ESLint + TypeScript |

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_ANTHROPIC_API_KEY` | Coach IA | Chave da API Anthropic (`sk-ant-...`) |
| `VITE_FIREBASE_API_KEY` | Sim | Chave pública do Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Sim | `projeto.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Sim | ID do projeto Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Galeria | `projeto.firebasestorage.app` |
| `VITE_FIREBASE_APP_ID` | Sim | App ID do Firebase |
