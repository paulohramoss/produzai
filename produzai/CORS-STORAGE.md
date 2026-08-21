# CORS do Firebase Storage

O envio de foto (avatar e galeria) sai do navegador direto para o bucket. O
navegador só entrega a resposta se a ORIGEM do site estiver na configuração de
CORS do bucket — e essa configuração **não** mora no `firebase deploy`. É estado
do bucket no Google Cloud, aplicado à parte.

Quando falta a origem, o SDK não recebe status nenhum e desiste por tentativa
esgotada: o app mostra "Não foi possível falar com o Storage" e o console traz
`storage/retry-limit-exceeded` ou `storage/unknown`.

## Aplicar

```bash
gcloud storage buckets update gs://produzai-ab8ad.firebasestorage.app --cors-file=cors.json
# ou, com o gsutil antigo:
gsutil cors set cors.json gs://produzai-ab8ad.firebasestorage.app
```

## Conferir o que está valendo agora

```bash
gcloud storage buckets describe gs://produzai-ab8ad.firebasestorage.app --format="value(cors_config)"
```

## O que precisa estar na lista

Toda origem de onde o app é aberto:

- `https://therisepln.com.br` e `https://www.therisepln.com.br` — produção
- os domínios `*.web.app` / `*.firebaseapp.com` — Firebase Hosting
- `http://localhost:5173` (vite), `4173` (preview), `3000` (`vercel dev`)

**As URLs de preview da Vercel mudam a cada deploy** (`<projeto>-<hash>.vercel.app`)
e o CORS do Google Cloud não aceita curinga de subdomínio — só origem exata ou
`"*"`. Enviar foto a partir de um preview vai falhar até a URL daquele deploy
entrar na lista. Se o domínio de produção da Vercel for fixo, acrescente-o aqui.

## Não confundir com as regras

`storage.rules` decide QUEM pode escrever; o CORS decide DE ONDE o navegador
pode falar. Regra negada aparece como `storage/unauthorized` — outro código,
outra correção (`firebase deploy --only storage`).
