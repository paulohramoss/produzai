import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { CoachConversation } from '../../store/useCoachStore'
import { dataRef, fireWrite, getDbUid, logDbError } from './client'

// ── Link read-only do treinador ──────────────────────────────────────────────
// Um documento em `coachShares/{token}` com um RESUMO — nunca uma chave para os
// dados do usuário. Quem tem o link lê só esse resumo; as coleções de
// `users/{uid}` continuam fechadas. O token é o segredo, então o link é privado
// por obscuridade: revogar apaga o documento e o link morre na hora.

export interface CoachShareWorkout {
  date: string
  name: string
  type: string
  time: string
  dist: number
  cal: number
  /** Tonelagem em kg, quando o treino tem exercícios de força. */
  volumeKg?: number
  notes?: string
  painLevel?: number
  painArea?: string
}

export interface CoachShareDay {
  date: string
  readinessScore?: number
  sleepHours?: number
  soreness?: number
  waterMl?: number
  dietStatus?: string
}

export interface CoachShareSnapshot {
  uid: string
  athleteName: string
  updatedAt: number
  /** Primeiro e último dia da janela do resumo. */
  from: string
  to: string
  workouts: CoachShareWorkout[]
  days: CoachShareDay[]
  weekSummary: {
    workouts: number
    km: number
    minutes: number
    avgReadiness: number | null
    painFlags: number
  }
}

export async function saveCoachShare(token: string, snapshot: CoachShareSnapshot) {
  if (!getDbUid()) return
  fireWrite(setDoc(doc(db, 'coachShares', token), snapshot), 'saveCoachShare')
}

/** Leitura pública — usada pela página do treinador, sem login. */
export async function getCoachShare(token: string): Promise<CoachShareSnapshot | null> {
  try {
    const snap = await getDoc(doc(db, 'coachShares', token))
    return snap.exists() ? (snap.data() as CoachShareSnapshot) : null
  } catch (e) { logDbError('getCoachShare', e); return null }
}

export async function deleteCoachShare(token: string) {
  if (!getDbUid()) return
  fireWrite(deleteDoc(doc(db, 'coachShares', token)), 'deleteCoachShare')
}

// ── Coach conversations ──────────────────────────────────────────────────────
// O histórico do Coach é espelhado no Firestore para que nunca dependa apenas do
// localStorage (que some ao limpar o navegador, trocar de aparelho ou navegar
// anônimo). É a fonte durável; o localStorage é só o cache local.

/** `items: null` = o documento ainda não existe. `ok: false` = falha de leitura
 *  (rede/permissão) — nesse caso o chamador NÃO deve sobrescrever a nuvem. */
export type CoachConversationsRead =
  | { ok: true; items: CoachConversation[] | null }
  | { ok: false }

export async function getCoachConversations(): Promise<CoachConversationsRead> {
  if (!getDbUid()) return { ok: false }
  try {
    const snap = await getDoc(dataRef('coachConversations'))
    return { ok: true, items: snap.exists() ? ((snap.data().items as CoachConversation[]) ?? []) : null }
  } catch (e) { logDbError('getCoachConversations', e); return { ok: false } }
}

// Um documento acima de 1 MiB é rejeitado inteiro pelo Firestore — o que
// perderia TODAS as conversas de uma vez. Guardamos folga sobre esse limite.
const COACH_DOC_MAX_BYTES = 900_000

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

export async function saveCoachConversations(conversations: CoachConversation[]) {
  if (!getDbUid()) return

  // O base64 dos anexos (vários MB) nunca vai para o Firestore — só o nome e o
  // tipo, o suficiente para a bolha continuar mostrando o arquivo depois.
  // Campos `undefined` são rejeitados pelo Firestore, por isso montamos o
  // objeto explicitamente em vez de espalhar a mensagem original.
  let items = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(c => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messages: c.messages.map(m => m.attachment
        ? {
            role: m.role,
            content: m.content,
            attachment: { name: m.attachment.name, mediaType: m.attachment.mediaType, data: '' },
          }
        : { role: m.role, content: m.content }),
    }))

  // Válvula de segurança: se ainda assim estourar, corta as conversas mais
  // antigas apenas da cópia na nuvem — o histórico completo continua local.
  while (items.length > 1 && byteLength(JSON.stringify(items)) > COACH_DOC_MAX_BYTES) {
    items = items.slice(0, -1)
  }

  fireWrite(setDoc(dataRef('coachConversations'), { items }), 'saveCoachConversations')
}
