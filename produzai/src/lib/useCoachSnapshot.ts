// Hooks que mantêm o coaching proativo abastecido.
//
// Nada disso bloqueia a UI: são efeitos de fundo que rodam uma vez por sessão
// e falham em silêncio — se o snapshot não subir, o pior que acontece é o cron
// não ter o que notificar naquele dia.

import { useEffect } from 'react'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { useAthleteStore } from '../store/useAthleteStore'
import { usePlanStore } from '../store/usePlanStore'
import { getMentalHistory, linkStravaAthlete } from './db'
import { publishCoachSnapshot } from './coachSnapshot'
import { getStravaStatus } from './strava'

const BASELINE_DAYS = 30

function lastDates(n: number): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/**
 * Publica o snapshot do atleta ao abrir o app.
 *
 * Roda depois que os stores hidrataram da nuvem: publicar com a lista de
 * treinos ainda vazia diria ao cron que o usuário sumiu há semanas.
 */
export function useCoachSnapshot(uid: string | null, displayName: string | null) {
  const workoutsLoaded = useWorkoutStore(s => s.workouts.length)

  useEffect(() => {
    if (!uid) return
    let cancelled = false

    // Pequeno atraso para os stores terminarem de hidratar.
    const timer = setTimeout(async () => {
      const mentalHistory = await getMentalHistory(lastDates(BASELINE_DAYS))
      if (cancelled) return
      await publishCoachSnapshot({
        workouts: useWorkoutStore.getState().workouts,
        profile: useAthleteStore.getState().profile,
        plan: usePlanStore.getState().plan,
        mentalHistory,
        displayName,
      })
    }, 2500)

    return () => { cancelled = true; clearTimeout(timer) }
    // `workoutsLoaded` entra como gatilho: quando a nuvem devolve os treinos,
    // vale republicar com os dados completos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, workoutsLoaded > 0])
}

/**
 * Registra o mapeamento id do atleta no Strava → uid.
 * Sem ele o webhook recebe a atividade e não sabe de quem é.
 */
export function useStravaLink(uid: string | null) {
  useEffect(() => {
    if (!uid) return
    let cancelled = false

    getStravaStatus().then(status => {
      if (cancelled || !status.connected || !status.athlete?.id) return
      linkStravaAthlete(status.athlete.id)
    })

    return () => { cancelled = true }
  }, [uid])
}
