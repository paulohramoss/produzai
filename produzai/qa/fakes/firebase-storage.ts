// Dublê de `firebase/storage` — upload de avatar e foto de progresso.
export function getStorage() { return { qa: true } }
export function ref(_s: unknown, path: string) { return { path } }
export async function uploadBytes() { return {} }
export async function getDownloadURL() {
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E'
}
export async function deleteObject() {}
