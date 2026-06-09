let scheduled: ReturnType<typeof setTimeout>[] = []

export function notificationsSupported(): boolean {
  return 'Notification' in window
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export function show(title: string, body: string) {
  if (Notification.permission !== 'granted') return
  new Notification(title, { body, icon: '/rise-plan-logo.svg', badge: '/rise-plan-logo.svg' })
}

export function scheduleDaily(hour: number, minute: number, title: string, body: string) {
  clearAll()
  const now = new Date()
  const next = new Date()
  next.setHours(hour, minute, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  const delay = next.getTime() - now.getTime()

  function fire() {
    show(title, body)
    const t = setTimeout(fire, 86_400_000)
    scheduled.push(t)
  }
  const t = setTimeout(fire, delay)
  scheduled.push(t)
}

export function clearAll() {
  scheduled.forEach(t => clearTimeout(t))
  scheduled = []
}

const STORAGE_KEY = 'notification_prefs'

export interface NotifPrefs {
  enabled: boolean
  hour: number
  minute: number
}

export function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as NotifPrefs
  } catch { /* silent */ }
  return { enabled: false, hour: 8, minute: 0 }
}

export function savePrefs(prefs: NotifPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

export function applyPrefs(prefs: NotifPrefs) {
  if (!prefs.enabled) { clearAll(); return }
  scheduleDaily(prefs.hour, prefs.minute, '⚡ Rise Plan', 'Hora de verificar seus hábitos e tarefas do dia!')
}
