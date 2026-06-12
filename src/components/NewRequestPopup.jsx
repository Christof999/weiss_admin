import { useNavigate } from 'react-router-dom'
import { BellRing, X, Mail, Phone } from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'

/** Großes, prominentes Popup, das bei einer neu eingegangenen Anfrage erscheint. */
export default function NewRequestPopup() {
  const { newRequestPopup, dismissNewRequestPopup } = useNotifications()
  const navigate = useNavigate()

  if (!newRequestPopup) return null
  const a = newRequestPopup

  const open = () => {
    dismissNewRequestPopup()
    navigate(`/anfragen/${a.id}`)
  }

  return (
    <div className="popup-overlay" onClick={dismissNewRequestPopup}>
      <div
        className="popup-card"
        role="alertdialog"
        aria-label="Neue Anfrage"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="popup-close" onClick={dismissNewRequestPopup} aria-label="Schließen">
          <X size={18} />
        </button>
        <div className="popup-icon">
          <BellRing size={26} />
        </div>
        <h2 className="popup-title">Neue Anfrage!</h2>
        <p className="popup-name">{a.name || 'Unbekannter Absender'}</p>

        {a.message && <p className="popup-message">{a.message}</p>}

        <div className="popup-meta">
          {a.email && (
            <span className="row" style={{ gap: 6 }}>
              <Mail size={15} /> {a.email}
            </span>
          )}
          {a.phone && (
            <span className="row" style={{ gap: 6 }}>
              <Phone size={15} /> {a.phone}
            </span>
          )}
        </div>

        <div className="row" style={{ gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost grow" onClick={dismissNewRequestPopup}>
            Später
          </button>
          <button className="btn btn-primary grow" onClick={open}>
            Anfrage öffnen
          </button>
        </div>
      </div>
    </div>
  )
}
