import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Save,
  Trash2,
  CalendarPlus,
  MapPinned,
  Clock,
} from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'
import { getAnfrage, updateAnfrage, deleteAnfrage } from '../lib/firebase'
import StatusBadge from '../components/StatusBadge'

// Karten-Editor (Google Maps) nur bei Bedarf laden – spart Initial-Bundle
const ArbeitsbereichEditor = lazy(() => import('../components/ArbeitsbereichEditor'))
import { formatDateTime } from '../lib/utils'

const EMPTY_FORM = {
  status: 'neu',
  bearbeiter: '',
  notizen: '',
  appointmentDate: '',
  appointmentTime: '',
  arbeitsbereiche: [],
}

function toForm(a) {
  return {
    status: a.status || 'neu',
    bearbeiter: a.bearbeiter || '',
    notizen: a.notizen || '',
    appointmentDate: a.appointmentDate || '',
    appointmentTime: a.appointmentTime || '',
    arbeitsbereiche: a.arbeitsbereiche || [],
  }
}

export default function AnfrageDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { anfragen, showToast } = useNotifications()

  // Anfrage bevorzugt aus der Live-Liste, sonst direkt laden
  const fromList = useMemo(() => anfragen.find((a) => a.id === id), [anfragen, id])
  const [anfrage, setAnfrage] = useState(fromList || null)
  const [loading, setLoading] = useState(!fromList)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // Anfrage laden, falls nicht in der Liste
  useEffect(() => {
    let active = true
    if (fromList) {
      setAnfrage(fromList)
      setLoading(false)
      return
    }
    setLoading(true)
    getAnfrage(id)
      .then((a) => {
        if (!active) return
        if (a) setAnfrage(a)
        else setNotFound(true)
      })
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id, fromList])

  // Formular initialisieren, sobald die Anfrage da ist (solange nicht „dirty")
  useEffect(() => {
    if (anfrage && !dirty) setForm(toForm(anfrage))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anfrage])

  const setField = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateAnfrage(id, form)
      setDirty(false)
      showToast('Änderungen gespeichert.', 'success')
    } catch (err) {
      console.error(err)
      showToast('Speichern fehlgeschlagen.', 'error', 6000)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Diese Anfrage wirklich endgültig löschen?')) return
    try {
      await deleteAnfrage(id)
      showToast('Anfrage gelöscht.', 'success')
      navigate('/anfragen', { replace: true })
    } catch {
      showToast('Löschen fehlgeschlagen.', 'error', 6000)
    }
  }

  const addToCalendar = () => {
    if (!form.appointmentDate) {
      showToast('Bitte zuerst ein Termindatum wählen.', 'info')
      return
    }
    const time = form.appointmentTime || '08:00'
    const start = new Date(`${form.appointmentDate}T${time}`)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const title = encodeURIComponent(`Termin: ${anfrage?.name || 'Anfrage'}`)
    const details = encodeURIComponent(
      [anfrage?.message, anfrage?.phone && `Tel: ${anfrage.phone}`, anfrage?.email]
        .filter(Boolean)
        .join('\n'),
    )
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(
      start,
    )}/${fmt(end)}&details=${details}`
    window.open(url, '_blank', 'noopener')
  }

  if (loading) {
    return (
      <div className="container page empty-state">
        <span className="spinner" style={{ color: 'var(--primary)' }} /> Lädt …
      </div>
    )
  }
  if (notFound || !anfrage) {
    return (
      <div className="container page stack">
        <Link to="/anfragen" className="back-link">
          <ArrowLeft size={18} /> Zurück
        </Link>
        <div className="empty-state">
          <p className="muted">Diese Anfrage wurde nicht gefunden.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container page stack detail">
      <div className="row spread">
        <Link to="/anfragen" className="back-link">
          <ArrowLeft size={18} /> Zurück zur Übersicht
        </Link>
        <StatusBadge status={form.status} />
      </div>

      {/* Kundendaten */}
      <section className="card">
        <h1 className="detail-name">{anfrage.name || 'Ohne Namen'}</h1>
        <p className="muted detail-time">
          <Clock size={14} /> Eingegangen am {formatDateTime(anfrage.createdAt)}
        </p>

        <div className="contact-actions">
          {anfrage.email && (
            <a className="btn btn-ghost btn-sm" href={`mailto:${anfrage.email}`}>
              <Mail size={16} /> {anfrage.email}
            </a>
          )}
          {anfrage.phone && (
            <a className="btn btn-ghost btn-sm" href={`tel:${anfrage.phone}`}>
              <Phone size={16} /> {anfrage.phone}
            </a>
          )}
        </div>

        {anfrage.message && (
          <div className="message-box">
            <span className="label">Nachricht</span>
            <p>{anfrage.message}</p>
          </div>
        )}
      </section>

      {/* Bearbeitung */}
      <section className="card stack">
        <h2>Bearbeitung</h2>

        <div className="form-grid">
          <label className="field">
            <span className="label">Status</span>
            <select
              className="select"
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
            >
              <option value="neu">Neu</option>
              <option value="bearbeitung">In Bearbeitung</option>
              <option value="erledigt">Erledigt</option>
            </select>
          </label>

          <label className="field">
            <span className="label">Bearbeiter</span>
            <input
              className="input"
              value={form.bearbeiter}
              onChange={(e) => setField('bearbeiter', e.target.value)}
              placeholder="z. B. Lukas"
            />
          </label>

          <label className="field">
            <span className="label">Termin – Datum</span>
            <input
              className="input"
              type="date"
              value={form.appointmentDate}
              onChange={(e) => setField('appointmentDate', e.target.value)}
            />
          </label>

          <label className="field">
            <span className="label">Termin – Uhrzeit</span>
            <input
              className="input"
              type="time"
              value={form.appointmentTime}
              onChange={(e) => setField('appointmentTime', e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span className="label">Interne Notizen</span>
          <textarea
            className="textarea"
            value={form.notizen}
            onChange={(e) => setField('notizen', e.target.value)}
            placeholder="Notizen zur Anfrage …"
          />
        </label>

        <div className="row row-wrap" style={{ gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={addToCalendar} type="button">
            <CalendarPlus size={16} /> Zum Kalender hinzufügen
          </button>
        </div>
      </section>

      {/* Arbeitsbereiche */}
      <section className="card stack">
        <div className="row spread">
          <h2 className="row" style={{ gap: 8 }}>
            <MapPinned size={20} /> Arbeitsbereiche
          </h2>
          {form.arbeitsbereiche.length > 0 && (
            <span className="badge badge-neu">{form.arbeitsbereiche.length} Bereich(e)</span>
          )}
        </div>
        <p className="muted" style={{ marginTop: -6 }}>
          Plane die Einsatzflächen für diese Anfrage direkt auf der Karte.
        </p>
        <Suspense
          fallback={
            <div className="map-loading">
              <span className="spinner" style={{ color: 'var(--primary)' }} /> Editor wird geladen …
            </div>
          }
        >
          <ArbeitsbereichEditor
            value={form.arbeitsbereiche}
            onChange={(list) => setField('arbeitsbereiche', list)}
          />
        </Suspense>
      </section>

      {/* Aktionen */}
      <div className="detail-actions">
        <button className="btn btn-danger" onClick={handleDelete} type="button">
          <Trash2 size={18} /> Löschen
        </button>
        <button className="btn btn-primary grow" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? <span className="spinner" /> : <Save size={18} />}
          {dirty ? 'Änderungen speichern' : 'Gespeichert'}
        </button>
      </div>

      {/* Sticky Save-Hinweis bei ungespeicherten Änderungen */}
      {dirty && <div className="dirty-hint">Ungespeicherte Änderungen</div>}
    </div>
  )
}
