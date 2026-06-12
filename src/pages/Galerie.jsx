import { useCallback, useEffect, useRef, useState } from 'react'
import { UploadCloud, Trash2, Images, RefreshCw, X, AlertCircle } from 'lucide-react'
import {
  fetchGalleryImages,
  uploadGalleryImage,
  deleteGalleryImage,
} from '../lib/firebase'
import { useNotifications } from '../context/NotificationContext'

export default function Galerie() {
  const { showToast } = useNotifications()
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [preview, setPreview] = useState(null)
  const fileRef = useRef(null)

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
      setImages((prev) => prev.filter((x) => x.fullPath !== img.fullPath))
      setPreview(null)
      showToast('Bild gelöscht.', 'success')
    } catch (err) {
      console.error(err)
      showToast('Löschen fehlgeschlagen.', 'error', 6000)
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
          <p className="muted">{images.length} Bilder</p>
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
        <div className="gallery-grid">
          {images.map((img) => (
            <figure className="gallery-item" key={img.fullPath}>
              <img
                src={img.url}
                alt={img.name}
                loading="lazy"
                onClick={() => setPreview(img)}
              />
              <button
                className="gallery-del"
                onClick={() => handleDelete(img)}
                aria-label="Bild löschen"
                title="Löschen"
              >
                <Trash2 size={16} />
              </button>
            </figure>
          ))}
        </div>
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
