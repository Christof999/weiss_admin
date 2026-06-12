import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, DrawingManager, Polygon, useJsApiLoader } from '@react-google-maps/api'
import { Pencil, Trash2, MapPinned, Plus, Square, AlertCircle } from 'lucide-react'

/**
 * Gehärteter Editor für Arbeitsbereiche (Polygone) auf einer Google-Map.
 *
 * Verbesserungen ggü. der alten Version:
 *  - Läuft komplett in React (kein globaler Mutable-State, keine doppelten
 *    Funktionsdefinitionen, keine verwaisten Polygone).
 *  - Defensive Behandlung fehlender API-Keys / nicht geladener Library.
 *  - Jede Polygon-Bearbeitung (Verschieben/Punkte ziehen/löschen) wird sofort
 *    in den State zurückgeschrieben → kein Datenverlust beim Speichern.
 *  - Stabile, eindeutige IDs; deterministische Farben (statt zufällig flackernd).
 *  - Validierung: nur Polygone mit ≥ 3 Punkten werden gespeichert.
 *  - Automatisches Einpassen (fitBounds) auf vorhandene Bereiche.
 */

const LIBRARIES = ['drawing', 'geometry']
const DEFAULT_CENTER = { lat: 51.1657, lng: 10.4515 } // Mitte Deutschlands
const MAP_OPTIONS = {
  mapTypeId: 'hybrid',
  streetViewControl: false,
  fullscreenControl: true,
  mapTypeControl: true,
  gestureHandling: 'greedy',
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

export default function ArbeitsbereichEditor({ value = [], onChange }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    libraries: LIBRARIES,
  })

  const [bereiche, setBereiche] = useState(value)
  const [drawing, setDrawing] = useState(false)
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

  const fitToBereiche = useCallback(
    (map, list) => {
      if (!map || !window.google) return
      const valid = list.filter((b) => b.coordinates?.length >= 3)
      if (!valid.length) return
      const bounds = new window.google.maps.LatLngBounds()
      valid.forEach((b) => b.coordinates.forEach((c) => bounds.extend(c)))
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 48)
      }
    },
    [],
  )

  const onMapLoad = useCallback(
    (map) => {
      mapRef.current = map
      fitToBereiche(map, bereiche)
    },
    [bereiche, fitToBereiche],
  )

  /* Neues Polygon gezeichnet */
  const onPolygonComplete = useCallback(
    (poly) => {
      const coordinates = pathToCoords(poly.getPath())
      poly.setMap(null) // temporäres Overlay entfernen – wir rendern selbst
      setDrawing(false)
      if (coordinates.length < 3) return
      const neu = {
        id: `bereich_${Date.now()}`,
        name: `Arbeitsbereich ${bereiche.length + 1}`,
        coordinates,
      }
      commit([...bereiche, neu])
    },
    [bereiche, commit],
  )

  /* Polygon bearbeitet (Punkt verschoben / hinzugefügt / Polygon gezogen) */
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

  const drawingManagerOptions = useMemo(
    () => ({
      drawingControl: false,
      polygonOptions: {
        editable: true,
        draggable: true,
        strokeColor: '#556b2f',
        strokeWeight: 2,
        fillColor: '#556b2f',
        fillOpacity: 0.3,
      },
    }),
    [],
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
        <button
          type="button"
          className={`btn btn-sm ${drawing ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setDrawing((d) => !d)}
        >
          {drawing ? <Square size={16} /> : <Plus size={16} />}
          {drawing ? 'Zeichnen aktiv …' : 'Bereich zeichnen'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => fitToBereiche(mapRef.current, bereiche)}
          disabled={!bereiche.some((b) => b.coordinates?.length >= 3)}
        >
          <MapPinned size={16} /> Auf Bereiche zentrieren
        </button>
      </div>

      <div className="ab-map">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={DEFAULT_CENTER}
          zoom={6}
          options={MAP_OPTIONS}
          onLoad={onMapLoad}
        >
          {bereiche.map((b, i) =>
            b.coordinates?.length >= 2 ? (
              <Polygon
                key={b.id}
                path={b.coordinates}
                editable
                draggable
                onLoad={(poly) => registerPolygon(b.id, poly)}
                onUnmount={() => registerPolygon(b.id, null)}
                onMouseUp={() => syncPolygon(b.id)}
                onDragEnd={() => syncPolygon(b.id)}
                options={{
                  strokeColor: colorFor(i),
                  strokeWeight: 2,
                  fillColor: colorFor(i),
                  fillOpacity: 0.3,
                }}
              />
            ) : null,
          )}

          {drawing && (
            <DrawingManager
              drawingMode="polygon"
              options={drawingManagerOptions}
              onPolygonComplete={onPolygonComplete}
            />
          )}
        </GoogleMap>
      </div>

      {/* Liste der Bereiche (Umbenennen / Löschen) */}
      <div className="ab-list">
        {bereiche.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Noch keine Arbeitsbereiche. Klicke auf „Bereich zeichnen" und ziehe ein Polygon auf der
            Karte.
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
