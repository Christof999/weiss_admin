import { useCallback, useEffect, useRef, useState } from 'react'
import { UploadCloud, Trash2, Images, RefreshCw, X, AlertCircle, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  fetchGalleryImages,
  uploadGalleryImage,
  deleteGalleryImage,
  saveGalleryOrder,
} from '../lib/firebase'
import { useNotifications } from '../context/NotificationContext'

/** Einzelnes, per Drag-Griff sortierbares Galerie-Bild. */
function SortableImage({ img, onPreview, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: img.fullPath,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 2 : undefined,
  }

  return (
    <figure className="gallery-item" ref={setNodeRef} style={style}>
      <img src={img.url} alt={img.name} loading="lazy" onClick={() => onPreview(img)} />
      <button
        className="gallery-drag"
        aria-label="Zum Verschieben ziehen"
        title="Ziehen, um die Reihenfolge zu ändern"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <button
        className="gallery-del"
        onClick={() => onDelete(img)}
        aria-label="Bild löschen"
        title="Löschen"
      >
        <Trash2 size={16} />
      </button>
    </figure>
  )
}

export default function Galerie() {
  const { showToast } = useNotifications()
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [preview, setPreview] = useState(null)
  const fileRef = useRef(null)

  // Maus: erst ab 8px Bewegung ziehen (Klick öffnet weiterhin die Vorschau).
  // Touch: kurzes Halten startet den Drag, Tippen bleibt ein Tap.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setImages(await fetchGalleryImages())
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'))
    if (!files.length) return

    setUploading(true)
    setProgress({ done: 0, total: files.length })
    let ok = 0
    const failed = []

    for (let i = 0; i < files.length; i++) {
      try {
        await uploadGalleryImage(files[i])
        ok++
      } catch (err) {
        console.error('Upload fehlgeschlagen:', files[i].name, err)
        failed.push(files[i].name)
      }
      setProgress({ done: i + 1, total: files.length })
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    await load()

    if (failed.length === 0) {
      showToast(`${ok} Bild(er) hochgeladen.`, 'success')
    } else {
      showToast(`${ok} hochgeladen, ${failed.length} fehlgeschlagen.`, 'error', 6000)
    }
  }

  const handleDelete = async (img) => {
    if (!window.confirm(`Bild "${img.name}" wirklich löschen?`)) return
    try {
      await deleteGalleryImage(img.fullPath)
      const next = images.filter((x) => x.fullPath !== img.fullPath)
      setImages(next)
      setPreview(null)
      // Reihenfolge ohne das gelöschte Bild persistieren
      saveGalleryOrder(next.map((x) => x.fullPath)).catch((err) =>
        console.error('Reihenfolge speichern fehlgeschlagen:', err),
      )
      showToast('Bild gelöscht.', 'success')
    } catch (err) {
      console.error(err)
      showToast('Löschen fehlgeschlagen.', 'error', 6000)
    }
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = images.findIndex((x) => x.fullPath === active.id)
    const newIndex = images.findIndex((x) => x.fullPath === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(images, oldIndex, newIndex)
    const previous = images
    setImages(reordered)

    setSavingOrder(true)
    try {
      await saveGalleryOrder(reordered.map((x) => x.fullPath))
      showToast('Reihenfolge gespeichert.', 'success', 2000)
    } catch (err) {
      console.error('Reihenfolge speichern fehlgeschlagen:', err)
      setImages(previous) // bei Fehler zurückrollen
      showToast('Reihenfolge konnte nicht gespeichert werden.', 'error', 6000)
    } finally {
      setSavingOrder(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    if (!uploading) handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="container page stack">
      <header className="page-head row spread">
        <div>
          <h1>Galerie</h1>
          <p className="muted">
            {images.length} Bilder{savingOrder ? ' · speichert Reihenfolge …' : ''}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Aktualisieren
        </button>
      </header>

      {/* Upload-Zone */}
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="dropzone-inner">
            <span className="spinner" style={{ color: 'var(--primary)' }} />
            <p>
              Lädt hoch … {progress.done}/{progress.total}
            </p>
            <progress value={progress.done} max={progress.total} className="upload-progress" />
          </div>
        ) : (
          <div className="dropzone-inner">
            <UploadCloud size={32} className="muted" />
            <p>
              <strong>Bilder hierher ziehen</strong> oder klicken zum Auswählen
            </p>
            <small className="muted">Mehrfachauswahl möglich · JPG, PNG, WebP, AVIF</small>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} /> Galerie konnte nicht geladen werden. Bitte Storage-Konfiguration
          und Security Rules prüfen (SETUP.md).
        </div>
      )}

      {/* Galerie-Grid */}
      {loading ? (
        <div className="empty-state">
          <span className="spinner" style={{ color: 'var(--primary)' }} /> Lädt …
        </div>
      ) : images.length === 0 ? (
        <div className="empty-state">
          <Images size={36} className="muted" />
          <p className="muted">Noch keine Bilder vorhanden.</p>
        </div>
      ) : (
        <>
          <p className="muted gallery-hint">
            <GripVertical size={14} /> Am Griff ziehen, um die Reihenfolge zu ändern – sie gilt auch
            auf der Website.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={images.map((x) => x.fullPath)} strategy={rectSortingStrategy}>
              <div className="gallery-grid">
                {images.map((img) => (
                  <SortableImage
                    key={img.fullPath}
                    img={img}
                    onPreview={setPreview}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {/* Lightbox */}
      {preview && (
        <div className="popup-overlay" onClick={() => setPreview(null)}>
          <div className="lightbox" onClick={(e) => e.stopPropagation()}>
            <button
              className="popup-close"
              onClick={() => setPreview(null)}
              aria-label="Schließen"
            >
              <X size={18} />
            </button>
            <img src={preview.url} alt={preview.name} />
            <div className="row spread lightbox-bar">
              <span className="text-ellipsis muted">{preview.name}</span>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(preview)}>
                <Trash2 size={16} /> Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
