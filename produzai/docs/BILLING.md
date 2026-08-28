# Cobrança — o app pago do começo ao fim

O The Rise Plan é **pago antes do uso**: quem cria conta cai no paywall e só
entra depois que o pagamento é confirmado. As contas internas (equipe e testes)
passam direto, por allowlist.

- **Preço:** R$ 20,00/mês, recorrente, sem fidelidade
- **Meio de pagamento:** Asaas — PIX, cartão de crédito e boleto na mesma fatura
- **Sem trial.** Não há período gratuito; para dar acesso a alguém, use a allowlist.

---

## 1. Como o bloqueio funciona (e por que em quatro camadas)

| Camada | Arquivo | O que faz |
| --- | --- | --- |
| Tela | `src/rise/components/Paywall.tsx` | Bloqueia a interface e oferece a assinatura |
| Regras do Firestore | `firestore.rules` | Nega **escrita** de dados sem assinatura em dia |
| Endpoints de IA | `api/ai/*`, `api/challenge/sync.js` | Respondem `402` a quem não pagou |
| Fonte da verdade | `billing/{uid}` | Documento escrito **só pelo servidor** |

O paywall da tela sozinho não vale nada: o SDK do Firestore fala direto com o
banco a partir do navegador, e os endpoints respondem a qualquer `fetch`. As
outras três camadas leem a mesma verdade — o documento `billing/{uid}`, que o
cliente **não pode escrever** (`allow write: if false`).

A conta de "está em dia" é uma só, em dois lugares que precisam concordar:

- `api/_entitlement.js` → `getEntitlement()`
- `firestore.rules` → `entitled()`

**Mexeu em uma, confira a outra.**

### O que a assinatura vencida NÃO tira

Leitura e exportação dos dados continuam liberadas — a LGPD (art. 18) garante
acesso e portabilidade, e cortar isso transformaria atraso de pagamento em
sequestro de dados. Também continuam graváveis os documentos de conta
(`profile`, `friends`, `club`), porque o cadastro precisa escrevê-los **antes**
de existir pagamento.

---

## 2. Variáveis de ambiente

Todas na Vercel (Project → Settings → Environment Variables). Nenhuma leva
prefixo `VITE_` — `VITE_` vai para o bundle do navegador e vira pública.

| Variável | Obrigatória | O que é |
| --- | --- | --- |
| `ASAAS_API_KEY` | sim | Chave do Asaas. Produção começa com `$aact_prod_` |
| `ASAAS_ENV` | sim em produção | `sandbox` (padrão) ou `production` |
| `ASAAS_WEBHOOK_TOKEN` | sim | Segredo que você inventa e repete no painel do Asaas |
| `PLAN_VALUE_BRL` | não (padrão 20) | Preço mensal |
| `BILLING_GRACE_DAYS` | não (padrão 3) | Tolerância após o vencimento |
| `FREE_ACCESS_UIDS` | não | UIDs com acesso liberado, separados por vírgula |
| `FREE_ACCESS_EMAILS` | não | E-mails com acesso liberado, separados por vírgula |
| `FIREBASE_SERVICE_ACCOUNT_B64` | sim | Já existia (cron e placar). Agora também escreve `billing/` |
| `FIREBASE_API_KEY` | sim | Já existia. Valida o token de quem chama |

> `ASAAS_ENV` tem `sandbox` como padrão de propósito: esquecer de configurar não
> pode virar cobrança real no cartão de alguém.

---

## 3. Colocar no ar — passo a passo

### 3.1 Rotacionar a chave do Asaas

Se a chave já circulou por chat, e-mail ou captura de tela, **gere outra**:
Asaas → Configurações → Integrações → *Gerar nova chave*. A anterior deixa de
valer. Nunca coloque a chave em arquivo versionado.

### 3.2 Descobrir os UIDs das contas internas

Firebase Console → Authentication → coluna **UID do usuário**. Copie os três
UIDs completos (o console trunca na tela; clique para copiar inteiro) e ponha em
`FREE_ACCESS_UIDS`. Os e-mails em `FREE_ACCESS_EMAILS` funcionam como rede de
segurança, mas o UID é a checagem forte.

### 3.3 Publicar as regras do Firestore

```bash
npx firebase-tools deploy --only firestore:rules
```

O deploy valida a sintaxe. **Sem este passo o paywall só existe na tela** — e o
navegador continuaria gravando dados sem assinatura.

### 3.4 Marcar as contas internas

```bash
npm run billing:free-access:dry   # mostra o que faria
npm run billing:free-access       # grava billing/{uid} com freeAccess: true
```

Precisa de `FIREBASE_SERVICE_ACCOUNT_B64`, `FREE_ACCESS_UIDS` e
`FREE_ACCESS_EMAILS` no ambiente (um `.env.local` de `vercel env pull` serve).

Isto é conveniência, não obrigação: `GET /api/billing/subscription` grava o mesmo
documento na primeira vez que a conta abre o app. Rodar o script garante que a
marca já esteja lá **antes** da primeira escrita.

### 3.5 Configurar o webhook no Asaas

Asaas → Configurações → **Integrações → Webhooks** → *Adicionar*:

- **URL:** `https://SEU-DOMINIO/api/billing/webhook`
- **Token de autenticação:** o mesmo valor de `ASAAS_WEBHOOK_TOKEN`
- **Versão da API:** v3
- **Eventos:** todos os de *Cobrança* e de *Assinatura*. No mínimo:
  `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`,
  `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_DELETED`,
  `SUBSCRIPTION_DELETED`

Gere o token com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Sem `ASAAS_WEBHOOK_TOKEN` o endpoint responde `503` para tudo. É deliberado:
> um webhook aberto seria um botão de "liberar acesso de graça" exposto na
> internet.

### 3.6 TTL no Firestore (opcional, recomendado)

Firestore → **TTL** → criar política no campo `expiresAt` para a coleção
`billingEvents` (registro de idempotência do webhook, 90 dias) — e, se ainda não
existir, para `rateLimits`. Sem isso as coleções só crescem.

---

## 4. Testar antes de cobrar de verdade

Com `ASAAS_ENV=sandbox` e a chave de sandbox:

1. Crie uma conta nova no app → deve cair no paywall.
2. Preencha nome e CPF → *Assinar* → abre a fatura do Asaas.
3. Pague no sandbox (o painel do Asaas permite confirmar manualmente).
4. Volte ao app → em até ~5 s o paywall some sozinho (a tela fica consultando).
5. Confira `billing/{uid}` no Firestore: `status: 'active'`, `activeUntil` no futuro.
6. Abra o Coach → deve responder. Com a assinatura vencida, deve dar `402`.
7. Perfil → *Cancelar assinatura* → status vira `canceled`, acesso segue até o fim.

**Teste também o caminho torto:** entre com uma conta sem assinatura e tente
gravar um treino direto pelo console do navegador. As regras têm de negar. Se
gravar, o passo 3.3 não foi feito.

Depois disso, troque `ASAAS_ENV` para `production` e a chave para a de produção.

---

## 5. Rotina e problemas comuns

**"Paguei e o app não liberou."**
A tela tem o botão *Já paguei — verificar agora*. Ele chama
`GET /api/billing/subscription`, que consulta o Asaas direto quando não há
acesso (`reconcile()` em `api/billing/subscription.js`) — funciona mesmo com o
webhook fora do ar. Se ainda assim não liberar, veja `billing/{uid}` no Firestore
e os logs da função na Vercel.

**Liberar alguém manualmente.**
Adicione o UID em `FREE_ACCESS_UIDS`, faça o redeploy e rode
`npm run billing:free-access`. Ou escreva `billing/{uid}` direto no console do
Firebase com `freeAccess: true`.

**Estender o acesso de alguém sem cobrar.**
Edite `activeUntil` (milissegundos) em `billing/{uid}`.

**Mudar o preço.**
`PLAN_VALUE_BRL` vale para assinaturas **novas**. As já criadas mantêm o valor
no Asaas — alterar o preço de quem já assina se faz no painel do Asaas, e exige
aviso prévio ao assinante.

**Reembolso / chargeback.**
Cai como `PAYMENT_REFUNDED` ou `PAYMENT_CHARGEBACK_REQUESTED` e derruba o acesso
na hora (`activeUntil: 0`) — diferente do simples atraso, que só marca `overdue`
e deixa a tolerância correr.

---

## 6. Mapa dos arquivos

```
api/_asaas.js                      cliente HTTP do Asaas (a chave vive só aqui)
api/_entitlement.js                "pode usar?" — a conta canônica
api/billing/subscription.js        GET status · POST assinar · DELETE cancelar
api/billing/webhook.js             o Asaas avisando que algo mudou
api/billing/billing.test.mjs       testes sem rede (npm test)
scripts/free-access.mjs            marca as contas internas

src/lib/billing.ts                 ponte do app para os endpoints
src/store/useBillingStore.ts       estado da assinatura na interface
src/rise/components/Paywall.tsx    a tela de bloqueio
src/rise/components/SubscriptionCard.tsx   Perfil → Assinatura (cancelar)

firestore.rules                    entitled() — a mesma regra, no banco
```
