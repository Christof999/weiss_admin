import { CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'

const ICON = {
  success: CheckCircle2,
  info: Info,
  error: AlertTriangle,
}

export default function Toasts() {
  const { toasts, dismissToast } = useNotifications()
  if (!toasts.length) return null

  return (
    <div className="toast-stack" role="region" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICON[t.type] || Info
        return (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon size={20} className="toast-icon" />
            <span className="grow">{t.message}</span>
            <button
              className="toast-close"
              onClick={() => dismissToast(t.id)}
              aria-label="Schließen"
            >
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
