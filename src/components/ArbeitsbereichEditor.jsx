import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, Polygon, Polyline, Marker, useJsApiLoader } from '@react-google-maps/api'
import {
  Pencil,
  Trash2,
  MapPinned,
  Plus,
  Check,
  X,
  Undo2,
  AlertCircle,
  Crosshair,
} from 'lucide-react'

/**
 * Editor für Arbeitsbereiche (mehrere Polygone) auf einer Google-Map.
 *
 * Zeichnen über eigene Klick-Logik, da die Google Drawing Library
 * (DrawingManager) seit Maps JS 3.65 entfernt wurde. Editierbare Polygone
 * (google.maps.Polygon) gehören zum Kern und funktionieren weiterhin.
 *
 * UX:
 *  - Mehrere Bereiche möglich; jeder Bereich eigene Farbe + Flächengröße.
 *  - Beim Zeichnen Eckpunkte antippen; erster Punkt schließt die Fläche.
 *  - Bereich per Karte/Liste auswählen → nur dieser ist editierbar.
 *  - Jede Änderung wird sofort in den State zurückgeschrieben (kein Datenverlust).
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

const PALETTE = ['#ffd24a', '#4ad0ff', '#ff7a59', '#b388ff', '#7cff8a', '#ff5da2']
const colorFor = (i) => PALETTE[i % PALETTE.length]

function pathToCoords(path) {
  const coords = []
  for (let i = 0; i < path.getLength(); i++) {
    const p = path.getAt(i)
    coords.push({ lat: p.lat(), lng: p.lng() })
  }
  return coords
}

function dedupe(points) {
  const out = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.lat - p.lat) < 1e-7 && Math.abs(last.lng - p.lng) < 1e-7) continue
    out.push(p)
  }
  return out
}

function formatArea(coords) {
  if (!coords || coords.length < 3 || !window.google?.maps?.geometry) return null
  const path = coords.map((c) => new window.google.maps.LatLng(c.lat, c.lng))
  const m2 = window.google.maps.geometry.spherical.computeArea(path)
  if (m2 >= 10000) return `${(m2 / 10000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} ha`
  return `${Math.round(m2).toLocaleString('de-DE')} m²`
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
  const [draft, setDraft] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const mapRef = useRef(null)
  const polygonRefs = useRef(new Map())

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

  const fitToCoords = useCallback((map, coordsList) => {
    if (!map || !window.google) return
    const bounds = new window.google.maps.LatLngBounds()
    let any = false
    coordsList.forEach((coords) =>
      coords?.forEach((c) => {
        bounds.extend(c)
        any = true
      }),
    )
    if (any && !bounds.isEmpty()) map.fitBounds(bounds, 60)
  }, [])

  const onMapLoad = useCallback(
    (map) => {
      mapRef.current = map
      fitToCoords(
        map,
        bereiche.filter((b) => b.coordinates?.length >= 3).map((b) => b.coordinates),
      )
    },
    [bereiche, fitToCoords],
  )

  /* ───────── Zeichnen ───────── */
  const startDrawing = () => {
    setSelectedId(null)
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
      if (!e.latLng) return
      if (drawing) {
        setDraft((d) => [...d, { lat: e.latLng.lat(), lng: e.latLng.lng() }])
      } else {
        setSelectedId(null) // Klick ins Leere hebt Auswahl auf
      }
    },
    [drawing],
  )

  const finishDrawing = useCallback(() => {
    const coordinates = dedupe(draft)
    setDraft([])
    setDrawing(false)
    if (coordinates.length < 3) return
    const id = `bereich_${Date.now()}`
    commit([
      ...bereiche,
      { id, name: `Arbeitsbereich ${bereiche.length + 1}`, coordinates },
    ])
    setSelectedId(id)
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
    if (selectedId === id) setSelectedId(null)
  }

  const selectBereich = (id) => {
    if (drawing) return
    setSelectedId(id)
    const b = bereiche.find((x) => x.id === id)
    if (b?.coordinates?.length >= 3) fitToCoords(mapRef.current, [b.coordinates])
  }

  const mapOptions = useMemo(
    () => ({ ...BASE_MAP_OPTIONS, draggableCursor: drawing ? 'crosshair' : undefined }),
    [drawing],
  )

  const draftClean = useMemo(() => dedupe(draft), [draft])

  const vertexIcon = (first) =>
    isLoaded && window.google
      ? {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: first ? 8 : 6,
          fillColor: first ? '#556b2f' : '#d8a51d',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        }
      : undefined

  /* ───────── Fehlerzustände ───────── */
  if (!apiKey) {
    return (
      <div className="map-fallback">
        <AlertCircle size={20} />
        <div>
          <strong>Karte nicht verfügbar.</strong>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Es ist kein Google-Maps-API-Key gesetzt (<code>VITE_GOOGLE_MAPS_API_KEY</code>).
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
              <Plus size={16} /> {bereiche.length ? 'Weiteren Bereich zeichnen' : 'Bereich zeichnen'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() =>
                fitToCoords(
                  mapRef.current,
                  bereiche.filter((b) => b.coordinates?.length >= 3).map((b) => b.coordinates),
                )
              }
              disabled={!bereiche.some((b) => b.coordinates?.length >= 3)}
            >
              <MapPinned size={16} /> Alle anzeigen
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={finishDrawing}
              disabled={draftClean.length < 3}
            >
              <Check size={16} /> Fertig ({draftClean.length})
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
          <Crosshair size={14} /> Tippe die Eckpunkte der Fläche an (mind. 3). Den{' '}
          <strong>ersten Punkt</strong> antippen oder „Fertig" schließt den Bereich.
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
          {bereiche.map((b, i) => {
            if (!(b.coordinates?.length >= 2)) return null
            const active = selectedId === b.id
            return (
              <Polygon
                key={b.id}
                path={b.coordinates}
                editable={active && !drawing}
                draggable={active && !drawing}
                onClick={() => selectBereich(b.id)}
                onLoad={(poly) => registerPolygon(b.id, poly)}
                onUnmount={() => registerPolygon(b.id, null)}
                onMouseUp={() => active && syncPolygon(b.id)}
                onDragEnd={() => active && syncPolygon(b.id)}
                options={{
                  clickable: !drawing,
                  strokeColor: colorFor(i),
                  strokeWeight: active ? 3 : 2,
                  fillColor: colorFor(i),
                  fillOpacity: active ? 0.4 : 0.22,
                  zIndex: active ? 2 : 1,
                }}
              />
            )
          })}

          {/* Entwurf */}
          {drawing && draftClean.length >= 3 && (
            <Polygon
              path={draftClean}
              options={{
                clickable: false,
                strokeColor: '#556b2f',
                strokeWeight: 2,
                fillColor: '#556b2f',
                fillOpacity: 0.25,
              }}
            />
          )}
          {drawing && draftClean.length >= 1 && (
            <Polyline
              path={draftClean}
              options={{ clickable: false, strokeColor: '#556b2f', strokeWeight: 2 }}
            />
          )}
          {drawing &&
            draftClean.map((p, idx) => (
              <Marker
                key={idx}
                position={p}
                icon={vertexIcon(idx === 0)}
                onClick={() => idx === 0 && draftClean.length >= 3 && finishDrawing()}
                cursor={idx === 0 ? 'pointer' : 'default'}
              />
            ))}
        </GoogleMap>
      </div>

      {/* Liste der Bereiche */}
      <div className="ab-list">
        {bereiche.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Noch keine Arbeitsbereiche. Tippe auf „Bereich zeichnen" und setze die Eckpunkte auf der
            Karte.
          </p>
        ) : (
          bereiche.map((b, i) => {
            const active = selectedId === b.id
            const area = formatArea(b.coordinates)
            return (
              <div
                className={`ab-item ${active ? 'active' : ''}`}
                key={b.id}
                onClick={() => selectBereich(b.id)}
              >
                <span className="ab-swatch" style={{ background: colorFor(i) }} />
                <div className="field grow">
                  <div className="row" style={{ gap: 6 }}>
                    <Pencil size={13} className="muted" />
                    <input
                      className="input ab-name"
                      value={b.name}
                      onChange={(e) => renameBereich(b.id, e.target.value)}
                      onFocus={() => selectBereich(b.id)}
                      placeholder={`Arbeitsbereich ${i + 1}`}
                    />
                  </div>
                  <small className="muted">
                    {b.coordinates?.length || 0} Punkte
                    {area ? ` · ${area}` : b.coordinates?.length < 3 ? ' · unvollständig' : ''}
                    {active ? ' · ausgewählt (editierbar)' : ''}
                  </small>
                </div>
                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeBereich(b.id)
                  }}
                  aria-label="Bereich löschen"
                  title="Bereich löschen"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
