// Hooks dos lembretes: carregar preferências e disparar o que vencer.

import { useEffect, useRef, useState } from 'react'
import { getReminderPrefs, type ReminderPrefs } from './db'
import {
  DEFAULT_REMINDER_PREFS, buildSchedule, runDueReminders, SCAN_INTERVAL_MS,
  type DayState, type HabitReminderInfo,
} from './reminders'

/** Preferências da nuvem, caindo no padrão enquanto não houver nada salvo. */
export function useReminderPrefs(userId: string | undefined) {
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_REMINDER_PREFS)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getReminderPrefs().then(cloud => {
      if (!cancelled && cloud) setPrefs({ ...DEFAULT_REMINDER_PREFS, ...cloud })
    })
    return () => { cancelled = true }
  }, [userId])

  return [prefs, setPrefs] as const
}

/**
 * Varre a agenda a cada minuto e dispara o que venceu.
 *
 * `getState` fica numa ref para o intervalo enxergar sempre o estado atual do
 * dia sem precisar ser recriado a cada marcação de hábito. A varredura roda
 * também ao voltar para a aba: o navegador estrangula timers em segundo plano,
 * e sem isso um lembrete das 8h só sairia quando a aba fosse reaberta por acaso.
 */
export function useReminderScheduler(
  prefs: ReminderPrefs,
  habits: HabitReminderInfo[],
  todayKey: string,
  getState: () => DayState,
) {
  const stateRef = useRef(getState)
  stateRef.current = getState

  const habitsKey = habits.map(h => `${h.id}:${h.icon}:${h.label}`).join('|')
  const prefsKey = JSON.stringify(prefs)

  useEffect(() => {
    if (!prefs.enabled) return

    const schedule = buildSchedule(prefs, habits)
    if (schedule.length === 0) return

    const scan = () => runDueReminders({ schedule, getState: () => stateRef.current(), todayKey })

    scan()
    const id = setInterval(scan, SCAN_INTERVAL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') scan() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsKey, habitsKey, todayKey])
}
