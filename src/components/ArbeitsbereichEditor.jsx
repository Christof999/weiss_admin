import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, Polygon, Polyline, useJsApiLoader } from '@react-google-maps/api'
import {
  Pencil,
  Trash2,
  MapPinned,
  Plus,
  Check,
  X,
  Undo2,
  AlertCircle,
} from 'lucide-react'

/**
 * Gehärteter Editor für Arbeitsbereiche (Polygone) auf einer Google-Map.
 *
 * Zeichnen erfolgt über eine eigene Klick-zum-Zeichnen-Logik, da die
 * Google-Maps Drawing Library (DrawingManager) seit Maps JS 3.65 entfernt
 * wurde. Editierbare Polygone (google.maps.Polygon) gehören zum Kern und
 * funktionieren weiterhin.
 *
 * Eigenschaften:
 *  - Läuft komplett in React (kein globaler Mutable-State, keine verwaisten Polygone).
 *  - Defensive Behandlung fehlender API-Keys / Ladefehler.
 *  - Jede Polygon-Bearbeitung (Punkt ziehen/hinzufügen, verschieben) wird sofort
 *    in den State zurückgeschrieben → kein Datenverlust beim Speichern.
 *  - Stabile IDs, deterministische Farben, Validierung (≥ 3 Punkte), Auto-Fit.
 */

const LIBRARIES = ['geometry']
const DEFAULT_CENTER = { lat: 51.1657, lng: 10.4515 } // Mitte Deutschlands
const BASE_MAP_OPTIONS = {
  mapTypeId: 'hybrid',
  streetViewControl: false,
  fullscreenControl: true,
  mapTypeControl: true,
  gestureHandling: 'greedy',
  disableDoubleClickZoom: true,
}

// Stabile Farbpalette – pro Index deterministisch
const PALETTE = ['#556b2f', '#d8a51d', '#6b8e23', '#3e4f24', '#89b869', '#a0522d']
const colorFor = (i) => PALETTE[i % PALETTE.length]

function pathToCoords(path) {
  const coords = []
  for (let i = 0; i < path.getLength(); i++) {
    const p = path.getAt(i)
    coords.push({ lat: p.lat(), lng: p.lng() })
  }
  return coords
}

// Entfernt direkt aufeinanderfolgende (Doppelklick-)Duplikate
function dedupe(points) {
  const out = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.lat - p.lat) < 1e-7 && Math.abs(last.lng - p.lng) < 1e-7) continue
    out.push(p)
  }
  return out
}

export default function ArbeitsbereichEditor({ value = [], onChange }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    libraries: LIBRARIES,
  })

  const [bereiche, setBereiche] = useState(value)
  const [drawing, setDrawing] = useState(false)
  const [draft, setDraft] = useState([]) // Punkte des aktuell gezeichneten Bereichs
  const mapRef = useRef(null)
  const polygonRefs = useRef(new Map())

  // Eingehende Werte übernehmen (z. B. nach Laden der Anfrage)
  useEffect(() => {
    setBereiche(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const commit = useCallback(
    (next) => {
      setBereiche(next)
      onChange?.(next)
    },
    [onChange],
  )

  const fitToBereiche = useCallback((map, list) => {
    if (!map || !window.google) return
    const valid = list.filter((b) => b.coordinates?.length >= 3)
    if (!valid.length) return
    const bounds = new window.google.maps.LatLngBounds()
    valid.forEach((b) => b.coordinates.forEach((c) => bounds.extend(c)))
    if (!bounds.isEmpty()) map.fitBounds(bounds, 48)
  }, [])

  const onMapLoad = useCallback(
    (map) => {
      mapRef.current = map
      fitToBereiche(map, bereiche)
    },
    [bereiche, fitToBereiche],
  )

  /* ───────── Zeichnen (eigene Logik statt DrawingManager) ───────── */
  const startDrawing = () => {
    setDraft([])
    setDrawing(true)
  }

  const cancelDrawing = () => {
    setDraft([])
    setDrawing(false)
  }

  const undoLastPoint = () => setDraft((d) => d.slice(0, -1))

  const onMapClick = useCallback(
    (e) => {
      if (!drawing || !e.latLng) return
      const point = { lat: e.latLng.lat(), lng: e.latLng.lng() }
      setDraft((d) => [...d, point])
    },
    [drawing],
  )

  const finishDrawing = useCallback(() => {
    const coordinates = dedupe(draft)
    setDraft([])
    setDrawing(false)
    if (coordinates.length < 3) return
    const neu = {
      id: `bereich_${Date.now()}`,
      name: `Arbeitsbereich ${bereiche.length + 1}`,
      coordinates,
    }
    commit([...bereiche, neu])
  }, [draft, bereiche, commit])

  /* ───────── Bestehende Polygone bearbeiten ───────── */
  const syncPolygon = useCallback(
    (id) => {
      const poly = polygonRefs.current.get(id)
      if (!poly) return
      const coordinates = pathToCoords(poly.getPath())
      commit(bereiche.map((b) => (b.id === id ? { ...b, coordinates } : b)))
    },
    [bereiche, commit],
  )

  const registerPolygon = useCallback((id, poly) => {
    if (poly) polygonRefs.current.set(id, poly)
    else polygonRefs.current.delete(id)
  }, [])

  const renameBereich = (id, name) =>
    commit(bereiche.map((b) => (b.id === id ? { ...b, name } : b)))

  const removeBereich = (id) => {
    polygonRefs.current.delete(id)
    commit(bereiche.filter((b) => b.id !== id))
  }

  const mapOptions = useMemo(
    () => ({
      ...BASE_MAP_OPTIONS,
      draggableCursor: drawing ? 'crosshair' : undefined,
    }),
    [drawing],
  )

  /* ───────── Fehlerzustände defensiv behandeln ───────── */
  if (!apiKey) {
    return (
      <div className="map-fallback">
        <AlertCircle size={20} />
        <div>
          <strong>Karte nicht verfügbar.</strong>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Es ist kein Google-Maps-API-Key gesetzt (<code>VITE_GOOGLE_MAPS_API_KEY</code>).
            Arbeitsbereiche können trotzdem unten als Liste verwaltet werden.
          </p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="map-fallback">
        <AlertCircle size={20} />
        <div>
          <strong>Karte konnte nicht geladen werden.</strong>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Bitte API-Key und aktivierte Maps-JavaScript-API prüfen.
          </p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="map-loading">
        <span className="spinner" style={{ color: 'var(--primary)' }} /> Karte wird geladen …
      </div>
    )
  }

  return (
    <div className="ab-editor">
      <div className="ab-toolbar">
        {!drawing ? (
          <>
            <button type="button" className="btn btn-sm btn-primary" onClick={startDrawing}>
              <Plus size={16} /> Bereich zeichnen
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => fitToBereiche(mapRef.current, bereiche)}
              disabled={!bereiche.some((b) => b.coordinates?.length >= 3)}
            >
              <MapPinned size={16} /> Auf Bereiche zentrieren
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={finishDrawing}
              disabled={dedupe(draft).length < 3}
            >
              <Check size={16} /> Fertig ({dedupe(draft).length})
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={undoLastPoint}
              disabled={draft.length === 0}
            >
              <Undo2 size={16} /> Punkt zurück
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={cancelDrawing}>
              <X size={16} /> Abbrechen
            </button>
          </>
        )}
      </div>

      {drawing && (
        <p className="ab-hint">
          Tippe nacheinander auf die Eckpunkte der Fläche (mind. 3) und dann auf „Fertig".
        </p>
      )}

      <div className="ab-map">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={DEFAULT_CENTER}
          zoom={6}
          options={mapOptions}
          onLoad={onMapLoad}
          onClick={onMapClick}
        >
          {/* Bestehende Bereiche */}
          {bereiche.map((b, i) =>
            b.coordinates?.length >= 2 ? (
              <Polygon
                key={b.id}
                path={b.coordinates}
                editable={!drawing}
                draggable={!drawing}
                options={{
                  clickable: !drawing, // beim Zeichnen Klicks zur Karte durchlassen
                  strokeColor: colorFor(i),
                  strokeWeight: 2,
                  fillColor: colorFor(i),
                  fillOpacity: 0.3,
                }}
                onLoad={(poly) => registerPolygon(b.id, poly)}
                onUnmount={() => registerPolygon(b.id, null)}
                onMouseUp={() => syncPolygon(b.id)}
                onDragEnd={() => syncPolygon(b.id)}
              />
            ) : null,
          )}

          {/* Aktuell gezeichneter Entwurf */}
          {drawing && draft.length >= 3 && (
            <Polygon
              path={draft}
              options={{
                clickable: false,
                strokeColor: '#d8a51d',
                strokeWeight: 2,
                fillColor: '#d8a51d',
                fillOpacity: 0.25,
              }}
            />
          )}
          {drawing && draft.length >= 1 && (
            <Polyline
              path={draft}
              options={{ clickable: false, strokeColor: '#d8a51d', strokeWeight: 2 }}
            />
          )}
        </GoogleMap>
      </div>

      {/* Liste der Bereiche (Umbenennen / Löschen) */}
      <div className="ab-list">
        {bereiche.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Noch keine Arbeitsbereiche. Klicke auf „Bereich zeichnen" und tippe die Eckpunkte auf
            der Karte.
          </p>
        ) : (
          bereiche.map((b, i) => (
            <div className="ab-item" key={b.id}>
              <span className="ab-swatch" style={{ background: colorFor(i) }} />
              <div className="field grow">
                <div className="row" style={{ gap: 6 }}>
                  <Pencil size={13} className="muted" />
                  <input
                    className="input ab-name"
                    value={b.name}
                    onChange={(e) => renameBereich(b.id, e.target.value)}
                    placeholder={`Arbeitsbereich ${i + 1}`}
                  />
                </div>
                <small className="muted">
                  {b.coordinates?.length || 0} Punkte
                  {b.coordinates?.length < 3 ? ' – unvollständig' : ''}
                </small>
              </div>
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => removeBereich(b.id)}
                aria-label="Bereich löschen"
                title="Bereich löschen"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
