/**
 * Natives Web Push (VAPID) – Client-Seite.
 *
 * Ablauf (wie in der Zeiterfassungs-App):
 *  1. Service Worker `/sw.js` registrieren.
 *  2. Notification-Permission anfragen.
 *  3. `pushManager.subscribe()` mit dem VAPID-Public-Key.
 *  4. Subscription per `/api/push/subscription` in Firestore
 *     (`adminPushSubscriptions`) ablegen – serverseitig per firebase-admin.
 *
 * Den Versand übernimmt die Vercel-Funktion `/api/push/notify`, die die
 * Website nach dem Absenden des Kontaktformulars aufruft.
 */
import { auth } from './firebase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_PUSH_VAPID_PUBLIC_KEY

export function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (err) {
    console.warn('[Push] SW-Registrierung fehlgeschlagen:', err)
    return null
  }
}

async function postSubscription(action, subscription) {
  const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null
  if (!idToken) throw new Error('NOT_AUTHENTICATED')

  const res = await fetch('/api/push/subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      action,
      subscription: subscription.toJSON(),
      meta: {
        userAgent: navigator.userAgent,
        isStandalone:
          window.matchMedia?.('(display-mode: standalone)').matches ||
          window.navigator.standalone === true,
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Subscription fehlgeschlagen (${res.status}): ${text}`)
  }
}

/**
 * Aktiviert Push für dieses Gerät. Gibt true zurück, wenn erfolgreich.
 */
export async function enablePush() {
  if (!isPushSupported()) throw new Error('PUSH_UNSUPPORTED')
  if (!VAPID_PUBLIC_KEY) throw new Error('NO_VAPID_KEY')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const registration = (await registerServiceWorker()) || (await navigator.serviceWorker.ready)
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  await postSubscription('upsert', subscription)
  return true
}

/** Deaktiviert Push für dieses Gerät. */
export async function disablePush() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  try {
    await postSubscription('disable', subscription)
  } catch {
    /* trotzdem lokal abmelden */
  }
  await subscription.unsubscribe()
}
