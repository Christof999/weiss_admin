import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { watchAnfragen } from '../lib/firebase'
import { enablePush as enablePushSubscription, getNotificationPermission } from '../lib/push'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null)

let toastCounter = 0

export function NotificationProvider({ children }) {
  const { user } = useAuth()

  const [anfragen, setAnfragen] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [toasts, setToasts] = useState([])
  const [newRequestPopup, setNewRequestPopup] = useState(null)
  const [pushPermission, setPushPermission] = useState(getNotificationPermission())
  const [pushError, setPushError] = useState('')

  const knownIds = useRef(new Set())
  const primed = useRef(false)

  /* ───────── Toast-API ───────── */
  const dismissToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const showToast = useCallback(
    (message, type = 'info', timeout = 4000) => {
      const id = ++toastCounter
      setToasts((t) => [...t, { id, message, type }])
      if (timeout) setTimeout(() => dismissToast(id), timeout)
      return id
    },
    [dismissToast],
  )

  /* ───────── Ton bei neuer Anfrage ───────── */
  const playChime = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const notes = [880, 1175]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        const start = ctx.currentTime + i * 0.16
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32)
        osc.connect(gain).connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.34)
      })
      setTimeout(() => ctx.close().catch(() => {}), 1200)
    } catch {
      /* Audio nicht verfügbar – ignorieren */
    }
  }, [])

  /* ───────── Live-Abo der Anfragen + Erkennung neuer Anfragen ───────── */
  useEffect(() => {
    if (!user) {
      // ausgeloggt: zurücksetzen
      setAnfragen([])
      setLoading(false)
      knownIds.current = new Set()
      primed.current = false
      return
    }

    setLoading(true)
    const unsub = watchAnfragen(
      (items) => {
        setAnfragen(items)
        setError(null)
        setLoading(false)

        if (!primed.current) {
          // erster Snapshot: nur Bestand merken, nicht benachrichtigen
          items.forEach((a) => knownIds.current.add(a.id))
          primed.current = true
          return
        }

        const fresh = items.filter((a) => !knownIds.current.has(a.id))
        fresh.forEach((a) => knownIds.current.add(a.id))

        if (fresh.length > 0) {
          handleNewRequests(fresh)
        }
      },
      (err) => {
        console.error('Anfragen-Abo fehlgeschlagen:', err)
        setError(err)
        setLoading(false)
      },
    )
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleNewRequests = useCallback(
    (fresh) => {
      playChime()
      // Großes Popup für die erste/aktuellste neue Anfrage
      const latest = fresh[0]
      setNewRequestPopup(latest)
      if (fresh.length > 1) {
        showToast(`${fresh.length} neue Anfragen eingegangen.`, 'success', 6000)
      }

      // Falls App im Hintergrund-Tab: System-Notification (sofern erlaubt)
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden' &&
        getNotificationPermission() === 'granted'
      ) {
        try {
          new Notification('Neue Anfrage', {
            body: `${latest.name || 'Unbekannt'}: ${(latest.message || '').slice(0, 80)}`,
            icon: '/icons/icon-192.png',
            tag: 'neue-anfrage',
          })
        } catch {
          /* ignore */
        }
      }
    },
    [playChime, showToast],
  )

  /* ───────── Push aktivieren (natives Web Push / VAPID) ───────── */
  const enablePush = useCallback(async () => {
    setPushError('')
    try {
      const ok = await enablePushSubscription()
      setPushPermission(getNotificationPermission())
      if (ok) {
        showToast('Push-Benachrichtigungen aktiviert.', 'success')
        return true
      }
      if (getNotificationPermission() === 'denied') {
        setPushError('Berechtigung im Gerät/Browser blockiert.')
        showToast('Benachrichtigungen sind blockiert.', 'error', 6000)
      }
      return false
    } catch (err) {
      console.error('Push-Aktivierung fehlgeschlagen:', err)
      const msg = String(err?.message || err)
      const friendly =
        msg === 'NO_VAPID_KEY'
          ? 'Kein VAPID-Key konfiguriert (Vercel-Env + Redeploy).'
          : msg === 'PUSH_UNSUPPORTED'
            ? 'Dieser Browser unterstützt keine Push-Benachrichtigungen.'
            : msg === 'NOT_AUTHENTICATED'
              ? 'Nicht angemeldet – bitte neu einloggen und erneut versuchen.'
              : /permission.denied/i.test(msg)
                ? 'Firestore-Zugriff verweigert – Security Rules für adminPushSubscriptions prüfen (SETUP.md §3.2).'
                : 'Push konnte nicht aktiviert werden.'
      // Genaue technische Meldung für die On-Screen-Diagnose festhalten
      setPushError(err?.message ? String(err.message) : String(err))
      showToast(friendly, 'error', 6000)
      return false
    }
  }, [showToast])

  const value = {
    anfragen,
    loading,
    error,
    toasts,
    showToast,
    dismissToast,
    newRequestPopup,
    dismissNewRequestPopup: () => setNewRequestPopup(null),
    pushPermission,
    pushError,
    enablePush,
    neuCount: anfragen.filter((a) => a.status === 'neu').length,
  }

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications muss innerhalb von <NotificationProvider> stehen')
  return ctx
}
