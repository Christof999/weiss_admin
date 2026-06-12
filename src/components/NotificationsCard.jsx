import { useCallback, useEffect, useState } from 'react'
import { BellRing, Check, X, RefreshCw, Smartphone, AlertTriangle } from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'
import { getPushStatus } from '../lib/push'

function StatusRow({ ok, warn, label, hint }) {
  const Icon = ok ? Check : warn ? AlertTriangle : X
  const cls = ok ? 'ok' : warn ? 'warn' : 'bad'
  return (
    <div className={`push-row ${cls}`}>
      <Icon size={16} />
      <span className="grow">{label}</span>
      {hint && <small className="muted">{hint}</small>}
    </div>
  )
}

/**
 * Immer sichtbares Panel für Push-Benachrichtigungen mit On-Screen-Status –
 * funktioniert auch in der installierten PWA, wo keine Konsole verfügbar ist.
 */
export default function NotificationsCard() {
  const { enablePush, pushError } = useNotifications()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setStatus(await getPushStatus())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const activate = async () => {
    setBusy(true)
    try {
      await enablePush()
    } finally {
      await refresh()
      setBusy(false)
    }
  }

  if (!status) return null

  const allGood = status.supported && status.vapidConfigured && status.permission === 'granted' && status.subscribed
  const iosNeedsInstall = status.ios && !status.standalone

  return (
    <div className="card push-panel">
      <div className="row spread" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 12 }}>
          <span className={`push-cta-icon ${allGood ? 'on' : ''}`}>
            <BellRing size={20} />
          </span>
          <div>
            <h3 style={{ marginBottom: 2 }}>Benachrichtigungen</h3>
            <p className="muted" style={{ margin: 0 }}>
              {allGood
                ? 'Aktiv – du wirst bei neuen Anfragen benachrichtigt.'
                : 'Aktiviere Push, um neue Anfragen sofort zu erhalten – auch bei geschlossener App.'}
            </p>
          </div>
        </div>
        <button className="icon-btn" onClick={refresh} title="Status aktualisieren" aria-label="Aktualisieren">
          <RefreshCw size={16} className={busy ? 'spin' : ''} />
        </button>
      </div>

      {iosNeedsInstall && (
        <div className="alert alert-warn" style={{ marginTop: 14 }}>
          <Smartphone size={18} />
          <span>
            Auf dem iPhone zuerst über <strong>Teilen → „Zum Home-Bildschirm"</strong> installieren
            und die App <strong>aus dem Icon</strong> öffnen. Push geht auf iOS nur in der
            installierten App.
          </span>
        </div>
      )}

      <div className="push-status">
        <StatusRow ok={status.supported} label="Browser unterstützt Push" />
        <StatusRow
          ok={status.vapidConfigured}
          label="VAPID-Schlüssel konfiguriert"
          hint={status.vapidConfigured ? '' : 'VITE_PUSH_VAPID_PUBLIC_KEY fehlt + Redeploy'}
        />
        <StatusRow
          ok={status.permission === 'granted'}
          warn={status.permission === 'default'}
          label="Berechtigung erteilt"
          hint={
            status.permission === 'denied'
              ? 'im Browser blockiert'
              : status.permission === 'default'
                ? 'noch nicht angefragt'
                : ''
          }
        />
        <StatusRow ok={status.subscribed} label="Dieses Gerät ist abonniert" />
      </div>

      {pushError && (
        <div className="alert alert-error" style={{ marginTop: 12, wordBreak: 'break-word' }}>
          <AlertTriangle size={18} />
          <span>
            <strong>Details:</strong> {pushError}
          </span>
        </div>
      )}

      {status.permission === 'denied' ? (
        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Benachrichtigungen sind blockiert. Bitte in den <strong>Website-/App-Einstellungen</strong>{' '}
          deines Geräts für diese App auf „Erlauben" stellen und erneut versuchen.
        </p>
      ) : (
        <button
          className="btn btn-primary"
          onClick={activate}
          disabled={busy || !status.supported || !status.vapidConfigured}
          style={{ marginTop: 14 }}
        >
          {busy ? <span className="spinner" /> : <BellRing size={18} />}
          {status.subscribed ? 'Erneut aktivieren' : 'Benachrichtigungen aktivieren'}
        </button>
      )}
    </div>
  )
}
