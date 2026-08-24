import { getDoc, setDoc } from 'firebase/firestore'
import { dataRef, fireWrite, getDbUid, logDbError, monthlyRef, subRef } from './client'

// ── Daily (hábitos + foco) ────────────────────────────────────────────────────

export interface Habit { id: string; icon: string; label: string; done: boolean }
export interface FocusItem { id: string; text: string; done: boolean }

/** Check-in de prontidão da manhã — quatro toques que dizem como o corpo acordou. */
export interface ReadinessEntry {
  /** Horas dormidas (aceita meia hora: 7.5). */
  sleepHours: number
  /** Qualidade do sono, 1 (péssima) a 5 (ótima). */
  sleepQuality: number
  /** Dor muscular / DOMS, 1 (nenhuma) a 5 (muita). */
  soreness: number
  /** Disposição para treinar hoje, 1 (zero) a 5 (de sobra). */
  drive: number
  /** FC de repouso em bpm — opcional, só quem mede de manhã preenche. */
  restingHr?: number
  /** Unix ms do registro. */
  loggedAt: number
}

export interface DailyData {
  habits?: Habit[]
  focus?: FocusItem[]
  waterMl?: number
  readiness?: ReadinessEntry
}

export async function getDaily(date: string): Promise<DailyData | null> {
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(subRef('daily', date))
    return snap.exists() ? (snap.data() as DailyData) : null
  } catch (e) { logDbError('getDaily', e); return null }
}

export async function saveDaily(date: string, data: Partial<DailyData>) {
  if (!getDbUid()) return

  // `setDoc` com merge faz merge PROFUNDO de mapas, então gravar
  // { '2026-06-16': { waterMl: 500 } } preserva os hábitos e o foco do mesmo dia
  // — e funciona tanto se o documento do mês já existir quanto se não existir.
  // (O par updateDoc-com-dot-notation + setDoc-no-catch que havia aqui dependia
  // de uma rejeição vinda do servidor, que offline nunca chega.)
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) clean[k] = v
  }
  if (Object.keys(clean).length === 0) return

  const ym = date.slice(0, 7)
  fireWrite(setDoc(monthlyRef('dailyMonthly', ym), { [date]: clean }, { merge: true }), 'saveDaily/monthly')
  // Documento individual mantido enquanto houver dados antigos lidos por ele.
  fireWrite(setDoc(subRef('daily', date), clean, { merge: true }), 'saveDaily/individual')
}

export async function getDailyHistory(dates: string[]): Promise<Record<string, DailyData>> {
  if (!getDbUid() || dates.length === 0) return {}
  try {
    // 35 days spans at most 2 calendar months → 1-2 reads instead of 35
    const months = [...new Set(dates.map(d => d.slice(0, 7)))]
    const snaps = await Promise.all(months.map(ym => getDoc(monthlyRef('dailyMonthly', ym))))
    const result: Record<string, DailyData> = {}
    for (const snap of snaps) {
      if (snap.exists()) Object.assign(result, snap.data() as Record<string, DailyData>)
    }
    // Fall back to individual docs for dates not yet in monthly docs (pre-migration data)
    const missing = dates.filter(d => !result[d])
    if (missing.length > 0) {
      await Promise.all(missing.map(async d => {
        const e = await getDaily(d)
        if (e) result[d] = e
      }))
    }
    return result
  } catch (e) { logDbError('getDailyHistory', e); return {} }
}

// ── Habit definitions ─────────────────────────────────────────────────────────

export interface HabitDef {
  id: string
  icon: string
  label: string
  /** O "porquê" — intenção/valor por trás do hábito */
  why?: string
  createdAt?: number
  /**
   * Quantas vezes por semana o hábito vale. 7 (ou ausente) = diário; 1 a 6 = de
   * frequência, cobrado na semana e não no dia — dia de descanso planejado deixa
   * de contar como falha. Ver lib/streaks.ts.
   */
  targetPerWeek?: number
}

export async function getHabitDefs(): Promise<HabitDef[] | null> {
  if (!getDbUid()) return null
  try {
    const snap = await getDoc(dataRef('habitDefs'))
    return snap.exists() ? ((snap.data().items as HabitDef[]) ?? []) : null
  } catch (e) { logDbError('getHabitDefs', e); return null }
}

export async function saveHabitDefs(defs: HabitDef[]) {
  if (!getDbUid()) return
  fireWrite(setDoc(dataRef('habitDefs'), { items: defs }), 'saveHabitDefs')
}
