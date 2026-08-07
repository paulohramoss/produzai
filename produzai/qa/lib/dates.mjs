// Chaves de data para os cenários — no fuso LOCAL, igual ao src/lib/date.ts.
// Usar UTC aqui faria os cenários falharem à noite no Brasil, exatamente o bug
// que o app já corrigiu uma vez.

const pad = n => String(n).padStart(2, '0')

export function toIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayIso() {
  return toIso(new Date())
}

export function isoDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toIso(d)
}
