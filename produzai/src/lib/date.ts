// Chaves de data ("YYYY-MM-DD") — SEMPRE no fuso local do usuário.
//
// `new Date().toISOString().slice(0, 10)` devolve a data em UTC. No Brasil
// (UTC-3) isso faz o "hoje" virar o dia seguinte às 21:00: o atleta que treina
// à noite marcava o hábito no dia errado, perdia a sequência e furava o
// histórico. Todo lugar que precisa de uma chave de dia usa este módulo.

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Converte um Date para a chave "YYYY-MM-DD" do dia local que ele representa. */
export function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Chave do dia de hoje no fuso local. */
export function todayKey(): string {
  return toLocalISO(new Date())
}

/** Chave de um dia deslocado a partir de hoje (`-1` = ontem, `1` = amanhã). */
export function dayKeyOffset(days: number, from: Date = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return toLocalISO(d)
}

/** Chave do dia de ontem no fuso local. */
export function yesterdayKey(): string {
  return dayKeyOffset(-1)
}

/** Últimos `n` dias em ordem crescente, terminando em hoje. */
export function lastNDays(n: number): string[] {
  const dates: string[] = []
  for (let i = n - 1; i >= 0; i--) dates.push(dayKeyOffset(-i))
  return dates
}
