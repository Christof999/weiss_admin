import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Inbox, ChevronRight, MapPinned, AlertCircle } from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'
import StatusBadge from '../components/StatusBadge'
import { relativeTime } from '../lib/utils'

const FILTERS = [
  { key: 'alle', label: 'Alle' },
  { key: 'neu', label: 'Neu' },
  { key: 'bearbeitung', label: 'In Bearbeitung' },
  { key: 'erledigt', label: 'Erledigt' },
]

export default function Anfragen() {
  const { anfragen, loading, error } = useNotifications()
  const [filter, setFilter] = useState('alle')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return anfragen.filter((a) => {
      if (filter !== 'alle' && a.status !== filter) return false
      if (!term) return true
      return (
        a.name.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term) ||
        a.phone.toLowerCase().includes(term) ||
        a.message.toLowerCase().includes(term)
      )
    })
  }, [anfragen, filter, search])

  const countFor = (key) =>
    key === 'alle' ? anfragen.length : anfragen.filter((a) => a.status === key).length

  return (
    <div className="container page stack">
      <header className="page-head">
        <h1>Anfragen</h1>
        <p className="muted">{anfragen.length} Anfragen insgesamt</p>
      </header>

      <div className="search-bar">
        <Search size={18} className="muted" />
        <input
          className="input"
          type="search"
          placeholder="Suche nach Name, E-Mail, Telefon oder Text …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`filter-tab ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
            role="tab"
            aria-selected={filter === f.key}
          >
            {f.label}
            <span className="filter-count">{countFor(f.key)}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} /> Anfragen konnten nicht geladen werden. Bitte Konfiguration und
          Security Rules prüfen (SETUP.md).
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <span className="spinner" style={{ color: 'var(--primary)' }} /> Lädt …
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Inbox size={36} className="muted" />
          <p className="muted">
            {anfragen.length === 0 ? 'Noch keine Anfragen vorhanden.' : 'Keine Treffer.'}
          </p>
        </div>
      ) : (
        <ul className="anfrage-list">
          {filtered.map((a) => (
            <li key={a.id}>
              <Link to={`/anfragen/${a.id}`} className="anfrage-row card card-hover">
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row spread" style={{ gap: 10 }}>
                    <strong className="text-ellipsis">{a.name || 'Ohne Namen'}</strong>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="anfrage-preview muted">{a.message || 'Keine Nachricht'}</p>
                  <div className="anfrage-meta muted">
                    <span>{relativeTime(a.createdAt)}</span>
                    {a.arbeitsbereiche?.length > 0 && (
                      <span className="row" style={{ gap: 4 }}>
                        <MapPinned size={13} /> {a.arbeitsbereiche.length}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="muted" size={20} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
