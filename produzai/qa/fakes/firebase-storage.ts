// Dublê de `firebase/storage` — upload de avatar e foto de progresso.
//
// Guarda o que foi enviado em `window.__qaUploads`. Sem isso não dá para testar
// a única coisa que importa aqui: que o app REDUZ a imagem antes de enviar, em
// vez de recusar a foto do celular por tamanho.

interface QaUpload { path: string; bytes: number; type: string }

declare global {
  interface Window { __qaUploads?: QaUpload[] }
}

// O app lê `storage.app.options.storageBucket` ao registrar uma falha de envio.
// O dublê precisa ter o mesmo formato, ou o diagnóstico quebraria justamente no
// caminho de erro que ele existe para explicar.
export function getStorage() {
  return { qa: true, app: { options: { storageBucket: 'qa-fake.firebasestorage.app' } } }
}

export function ref(_s: unknown, path: string) { return { path } }

export async function uploadBytes(
  r: { path: string },
  data: Blob,
  meta?: { contentType?: string },
) {
  window.__qaUploads ??= []
  window.__qaUploads.push({
    path: r.path,
    bytes: data?.size ?? 0,
    type: meta?.contentType ?? data?.type ?? '',
  })
  return {}
}

export async function getDownloadURL() {
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E'
}

export async function deleteObject() {}
