// Importação de métricas de recuperação a partir de um CSV exportado.
//
// Por que CSV e não integração direta: WHOOP, Oura e Garmin só liberam as APIs
// de leitura para parceiros aprovados — não é algo que se resolve com uma chave
// de API. Enquanto isso, todos eles exportam CSV, e um importador tolerante a
// formatos cobre os três (mais planilha manual) sem depender de aprovação.

import { getMentalHistory, saveMental, type MentalEntry } from './db'

export interface HealthRow {
  date: string
  sleepHours?: number
  hrvMs?: number
  restingHr?: number
}

export interface ImportResult {
  imported: number
  skipped: number
  /** Colunas reconhecidas, para o usuário conferir se acertou o arquivo. */
  matchedColumns: string[]
  firstDate?: string
  lastDate?: string
}

// Cada métrica aceita vários nomes: os apps exportam com rótulos diferentes e
// em idiomas diferentes.
const COLUMN_PATTERNS: Array<{ field: keyof Omit<HealthRow, 'date'>; pattern: RegExp }> = [
  { field: 'hrvMs',     pattern: /\b(hrv|rmssd|vfc|variabilidade)\b/i },
  { field: 'restingHr', pattern: /(resting.*(hr|heart|bpm|freq)|(fc|hr).*repouso|\brhr\b)/i },
  { field: 'sleepHours', pattern: /(sleep|sono)/i },
]

const DATE_PATTERN = /\b(date|data|day|dia|timestamp)\b/i

function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      // "" dentro de aspas é uma aspa literal.
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      out.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  out.push(current.trim())
  return out
}

function detectDelimiter(headerLine: string): string {
  const counts = [',', ';', '\t'].map(d => ({ d, n: headerLine.split(d).length }))
  return counts.reduce((a, b) => (b.n > a.n ? b : a)).d
}

/** Aceita YYYY-MM-DD, DD/MM/YYYY e ISO com hora. Devolve sempre "YYYY-MM-DD". */
function normalizeDate(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const br = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(value)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
  }
  return null
}

function parseNumber(raw: string): number | null {
  // Exportações em pt-BR usam vírgula decimal.
  const value = Number(raw.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : null
}

/** Sono vem em horas ("7.5"), em minutos ("450") ou como "7h30". */
function parseSleep(raw: string): number | null {
  const hm = /^(\d{1,2})\s*h\s*(\d{1,2})?/i.exec(raw.trim())
  if (hm) return Math.round((Number(hm[1]) + (Number(hm[2] ?? 0) / 60)) * 10) / 10

  const value = parseNumber(raw)
  if (value === null) return null
  // Acima de 20 só pode ser minutos — ninguém dorme 450 horas.
  const hours = value > 20 ? value / 60 : value
  return hours >= 1 && hours <= 20 ? Math.round(hours * 10) / 10 : null
}

export function parseHealthCsv(text: string): { rows: HealthRow[]; matchedColumns: string[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { rows: [], matchedColumns: [] }

  const delimiter = detectDelimiter(lines[0])
  const headers = splitLine(lines[0], delimiter)

  const dateIndex = headers.findIndex(h => DATE_PATTERN.test(h))
  if (dateIndex === -1) return { rows: [], matchedColumns: [] }

  const fieldIndexes = new Map<keyof Omit<HealthRow, 'date'>, number>()
  const matchedColumns: string[] = []
  for (const { field, pattern } of COLUMN_PATTERNS) {
    const index = headers.findIndex(h => pattern.test(h))
    if (index !== -1) {
      fieldIndexes.set(field, index)
      matchedColumns.push(headers[index])
    }
  }
  if (fieldIndexes.size === 0) return { rows: [], matchedColumns: [] }

  // Um mesmo dia pode aparecer várias vezes (medições repetidas) — a última
  // linha vence, que é o comportamento esperado de um export cronológico.
  const byDate = new Map<string, HealthRow>()

  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delimiter)
    const date = normalizeDate(cells[dateIndex] ?? '')
    if (!date) continue

    const row: HealthRow = { ...(byDate.get(date) ?? { date }) }

    const hrvIndex = fieldIndexes.get('hrvMs')
    if (hrvIndex !== undefined) {
      const value = parseNumber(cells[hrvIndex] ?? '')
      if (value !== null && value >= 5 && value <= 300) row.hrvMs = Math.round(value)
    }

    const rhrIndex = fieldIndexes.get('restingHr')
    if (rhrIndex !== undefined) {
      const value = parseNumber(cells[rhrIndex] ?? '')
      if (value !== null && value >= 28 && value <= 120) row.restingHr = Math.round(value)
    }

    const sleepIndex = fieldIndexes.get('sleepHours')
    if (sleepIndex !== undefined) {
      const value = parseSleep(cells[sleepIndex] ?? '')
      if (value !== null) row.sleepHours = value
    }

    if (row.hrvMs || row.restingHr || row.sleepHours) byDate.set(date, row)
  }

  return {
    rows: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    matchedColumns,
  }
}

const EMPTY_ENTRY: MentalEntry = { mood: 0, energy: 0, gratitude: ['', '', ''], note: '' }

/**
 * Grava as linhas nas entradas diárias, PRESERVANDO o que já existe.
 * Um humor registrado à mão nunca é apagado por um CSV de relógio.
 */
export async function importHealthRows(rows: HealthRow[]): Promise<ImportResult> {
  if (rows.length === 0) {
    return { imported: 0, skipped: 0, matchedColumns: [] }
  }

  const dates = rows.map(r => r.date)
  const existing = await getMentalHistory(dates)

  let imported = 0
  for (const row of rows) {
    const current = existing[row.date] ?? EMPTY_ENTRY
    const next: MentalEntry = {
      ...current,
      ...(row.hrvMs !== undefined ? { hrvMs: row.hrvMs } : {}),
      ...(row.restingHr !== undefined ? { restingHr: row.restingHr } : {}),
      ...(row.sleepHours !== undefined ? { sleepHours: row.sleepHours } : {}),
    }
    await saveMental(row.date, next)
    imported++
  }

  return {
    imported,
    skipped: 0,
    matchedColumns: [],
    firstDate: rows[0].date,
    lastDate: rows[rows.length - 1].date,
  }
}
