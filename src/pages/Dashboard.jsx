import { Link } from 'react-router-dom'
import { Inbox, Images, ChevronRight, CheckCircle2, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { greeting } from '../lib/utils'
import NotificationsCard from '../components/NotificationsCard'

export default function Dashboard() {
  const { user } = useAuth()
  const { anfragen, neuCount } = useNotifications()

  const inBearbeitung = anfragen.filter((a) => a.status === 'bearbeitung').length
  const erledigt = anfragen.filter((a) => a.status === 'erledigt').length
  const name = (user?.email || '').split('@')[0]

  return (
    <div className="container page stack">
      <header className="dash-hero">
        <h1>
          {greeting()}
          {name ? `, ${name}` : ''}!
        </h1>
        <p className="muted">Willkommen im Adminbereich der Weiß Forst GbR.</p>
      </header>

      <NotificationsCard />

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-num">{neuCount}</span>
          <span className="stat-label">
            <Inbox size={15} /> Neue Anfragen
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{inBearbeitung}</span>
          <span className="stat-label">
            <Clock size={15} /> In Bearbeitung
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{erledigt}</span>
          <span className="stat-label">
            <CheckCircle2 size={15} /> Erledigt
          </span>
        </div>
      </div>

      <div className="dash-grid">
        <Link to="/anfragen" className="card card-hover dash-card">
          <span className="dash-card-icon">
            <Inbox size={24} />
          </span>
          <div className="grow">
            <h3>Anfragen verwalten</h3>
            <p className="muted">Kundenanfragen einsehen, Status setzen, Arbeitsbereiche planen.</p>
          </div>
          {neuCount > 0 && <span className="badge badge-neu">{neuCount} neu</span>}
          <ChevronRight className="muted" size={20} />
        </Link>

        <Link to="/galerie" className="card card-hover dash-card">
          <span className="dash-card-icon">
            <Images size={24} />
          </span>
          <div className="grow">
            <h3>Galerie verwalten</h3>
            <p className="muted">Bilder der Website hochladen und löschen.</p>
          </div>
          <ChevronRight className="muted" size={20} />
        </Link>
      </div>
    </div>
  )
}
