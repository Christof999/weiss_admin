/**
 * Firebase Cloud Messaging (Web Push) für die Admin-App.
 *
 * Zwei Ebenen von Benachrichtigungen:
 *   1. App geöffnet  → Firestore `onSnapshot` zeigt sofort ein In-App-Popup
 *      (siehe NotificationContext). Funktioniert ohne FCM/Cloud Function.
 *   2. App geschlossen → echte Push-Notification via FCM.
 *      Voraussetzung: eine Cloud Function, die bei neuen `contactRequests`
 *      eine FCM-Nachricht an das Topic "neue-anfragen" sendet (siehe SETUP.md).
 *
 * Diese Datei kapselt die Client-Seite: SW registrieren, Token holen,
 * Vordergrund-Nachrichten empfangen.
 */
import { app, isFirebaseConfigured } from './firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

let messagingPromise = null

/** Lädt das Messaging-Modul nur, wenn der Browser es unterstützt. */
async function getMessagingInstance() {
  if (!isFirebaseConfigured || !app) return null
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null

  if (!messagingPromise) {
    messagingPromise = (async () => {
      const { getMessaging, isSupported } = await import('firebase/messaging')
      if (!(await isSupported())) return null
      return getMessaging(app)
    })().catch(() => null)
  }
  return messagingPromise
}

/** Registriert den FCM-Service-Worker (teilt sich Scope mit dem PWA-SW).
 *  Die Firebase-Config wird als Query übergeben, da ein SW kein import.meta.env hat. */
export async function registerMessagingServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  const qs = new URLSearchParams({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    senderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  }).toString()
  try {
    return await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${qs}`, {
      scope: '/',
    })
  } catch (err) {
    console.warn('[FCM] Service-Worker-Registrierung fehlgeschlagen:', err)
    return null
  }
}

/**
 * Fragt die Benachrichtigungs-Berechtigung an und holt den FCM-Token.
 * @returns {Promise<string|null>} Token oder null
 */
export async function enablePushNotifications() {
  if (!VAPID_KEY) {
    console.warn('[FCM] VITE_FIREBASE_VAPID_KEY fehlt – Push deaktiviert.')
    return null
  }
  if (!('Notification' in window)) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const messaging = await getMessagingInstance()
  if (!messaging) return null

  const swReg = await registerMessagingServiceWorker()
  const { getToken } = await import('firebase/messaging')

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg || undefined,
    })
    return token || null
  } catch (err) {
    console.warn('[FCM] Token konnte nicht geholt werden:', err)
    return null
  }
}

export function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

/** Vordergrund-Nachrichten (App offen) – Callback erhält das Payload. */
export async function onForegroundMessage(callback) {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}
  const { onMessage } = await import('firebase/messaging')
  return onMessage(messaging, callback)
}
