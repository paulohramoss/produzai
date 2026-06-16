// Push notifications via Service Worker.
// setTimeout-based reminders die when the tab closes — this module uses:
//   1. Periodic Background Sync (Chrome 80+ / Android) for offline-capable daily reminders.
//   2. Web Push (VAPID) for server-triggered push when VITE_VAPID_PUBLIC_KEY is set.

const PERIODIC_TAG = 'rise-daily-reminder'

// ── Permission ────────────────────────────────────────────────────────────────

export function notificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

// ── Local (foreground) notification ──────────────────────────────────────────

export function show(title: string, body: string) {
  if (Notification.permission !== 'granted') return
  new Notification(title, { body, icon: '/favicon.svg', badge: '/favicon.svg' })
}

// ── Periodic Background Sync ──────────────────────────────────────────────────
// Browser wakes the SW ~once per day and fires 'periodicsync'.
// sw-push.js (loaded into the workbox SW via importScripts) handles the event.

async function swReady(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try { return await navigator.serviceWorker.ready } catch { return null }
}

export async function registerPeriodicSync(): Promise<boolean> {
  const reg = await swReady()
  if (!reg || !('periodicSync' in reg)) return false
  try {
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync' as PermissionName,
    })
    if (status.state !== 'granted') return false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (reg as any).periodicSync.register(PERIODIC_TAG, {
      minInterval: 24 * 60 * 60 * 1000,
    })
    return true
  } catch {
    return false
  }
}

export async function unregisterPeriodicSync(): Promise<void> {
  const reg = await swReady()
  if (!reg || !('periodicSync' in reg)) return
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (reg as any).periodicSync.unregister(PERIODIC_TAG)
  } catch { /* silent */ }
}

// ── Web Push (VAPID) ──────────────────────────────────────────────────────────
// Requires VITE_VAPID_PUBLIC_KEY in env.
// Generate keys: npx web-push generate-vapid-keys
// Then set VITE_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (server-only) in .env + Vercel.

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) return null
  if (!('PushManager' in window)) return null
  const reg = await swReady()
  if (!reg) return null
  try {
    const existing = await reg.pushManager.getSubscription()
    if (existing) return existing
    return reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  } catch {
    return null
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await swReady()
  if (!reg) return
  try {
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
  } catch { /* silent */ }
}

// ── Preferences ───────────────────────────────────────────────────────────────

export interface NotifPrefs {
  enabled: boolean
  hour: number    // preferred hour (stored for future server-side cron scheduling)
  minute: number  // preferred minute
}

const STORAGE_KEY = 'notification_prefs'

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

export async function applyPrefs(prefs: NotifPrefs): Promise<void> {
  savePrefs(prefs)
  if (!prefs.enabled) {
    await unregisterPeriodicSync()
    await unsubscribeFromPush()
    return
  }
  const perm = await requestPermission()
  if (perm !== 'granted') return

  // Try Periodic Background Sync first (no server needed)
  await registerPeriodicSync()

  // Try Web Push subscription (needs VITE_VAPID_PUBLIC_KEY + api/push/send.js)
  const sub = await subscribeToPush()
  if (sub) {
    try {
      const { savePushSubscription } = await import('./db')
      await savePushSubscription(sub.toJSON())
    } catch { /* silent — push still works via periodicSync */ }
  }
}
