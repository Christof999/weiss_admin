/**
 * Firebase-Anbindung der Admin-App.
 *
 * Verwaltet GENAU dieselben Daten wie die öffentliche Website:
 *   - Firestore-Collection `contactRequests`  (Anfragen aus dem Kontaktformular)
 *   - Firebase Storage  `gallery/` + Root      (Galerie-Bilder)
 *
 * Die Website schreibt Anfragen mit den Feldern:
 *   { name, phone, email, message, createdAt: serverTimestamp(), handled: false }
 * Die Admin-App ergänzt redaktionelle Felder (status, notizen, arbeitsbereiche …)
 * und hält das von der Website genutzte `handled`-Flag synchron.
 */
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import {
  getStorage,
  ref,
  listAll,
  getDownloadURL,
  uploadBytes,
  deleteObject,
} from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
)

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
export const storage = app ? getStorage(app) : null

if (auth) {
  // Login über Neustarts / PWA-Schließen hinweg behalten
  setPersistence(auth, browserLocalPersistence).catch(() => {})
}

/* ──────────────────────────── Auth ──────────────────────────── */

export function login(email, password) {
  if (!auth) return Promise.reject(new Error('NOT_CONFIGURED'))
  return signInWithEmailAndPassword(auth, email.trim(), password)
}

export function logout() {
  if (!auth) return Promise.resolve()
  return fbSignOut(auth)
}

export function watchAuth(callback) {
  if (!auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}

/* ─────────────────────── Anfragen (contactRequests) ─────────────────────── */

export const ANFRAGEN_COLLECTION = 'contactRequests'
export const PUSH_SUBS_COLLECTION = 'adminPushSubscriptions'

/** Stabile Dokument-ID aus Push-Endpoint (identisch zur Server-Logik). */
export function pushSubscriptionDocId(endpoint) {
  const base64 = btoa(endpoint)
  return base64.replace(/[^a-zA-Z0-9]/g, '').slice(0, 120)
}

/**
 * Speichert die Web-Push-Subscription dieses Geräts in Firestore.
 * Erfordert eingeloggten Admin (Security Rules prüfen adminUid).
 */
export async function savePushSubscription(subscription, meta = {}) {
  if (!db || !auth?.currentUser) throw new Error('NOT_AUTHENTICATED')
  const json = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription
  if (!json?.endpoint) throw new Error('Missing subscription endpoint')

  const docId = pushSubscriptionDocId(json.endpoint)
  await setDoc(
    doc(db, PUSH_SUBS_COLLECTION, docId),
    {
      endpoint: json.endpoint,
      keys: json.keys || null,
      expirationTime: json.expirationTime || null,
      active: true,
      adminUid: auth.currentUser.uid,
      adminEmail: auth.currentUser.email || '',
      userAgent: meta.userAgent || '',
      isStandalone: Boolean(meta.isStandalone),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
}

/** Deaktiviert eine gespeicherte Push-Subscription (Gerät abmelden). */
export async function disablePushSubscription(subscription) {
  if (!db || !auth?.currentUser) throw new Error('NOT_AUTHENTICATED')
  const json = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription
  if (!json?.endpoint) return

  const docId = pushSubscriptionDocId(json.endpoint)
  await setDoc(
    doc(db, PUSH_SUBS_COLLECTION, docId),
    { active: false, disabledAt: new Date().toISOString() },
    { merge: true },
  )
}

const VALID_STATUS = ['neu', 'bearbeitung', 'erledigt']

/**
 * Live-Abo aller Anfragen, neueste zuerst.
 * @returns {Function} unsubscribe
 */
export function watchAnfragen(onData, onError) {
  if (!db) {
    onError?.(new Error('NOT_CONFIGURED'))
    return () => {}
  }
  const q = query(collection(db, ANFRAGEN_COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => normalizeAnfrage(d.id, d.data()))
      onData(items)
    },
    (err) => onError?.(err),
  )
}

export async function getAnfrage(id) {
  if (!db) throw new Error('NOT_CONFIGURED')
  const snap = await getDoc(doc(db, ANFRAGEN_COLLECTION, id))
  if (!snap.exists()) return null
  return normalizeAnfrage(snap.id, snap.data())
}

/**
 * Aktualisiert redaktionelle Felder einer Anfrage.
 * Nur explizit erlaubte Felder werden geschrieben (kein Überschreiben der
 * Kundendaten name/email/phone/message).
 */
export async function updateAnfrage(id, patch) {
  if (!db) throw new Error('NOT_CONFIGURED')
  if (!id) throw new Error('Keine Anfrage-ID angegeben')

  const data = {}

  if (patch.status !== undefined) {
    const status = String(patch.status)
    if (!VALID_STATUS.includes(status)) {
      throw new Error(`Ungültiger Status: ${status}`)
    }
    data.status = status
    // `handled` für die Website synchron halten
    data.handled = status === 'erledigt'
  }
  if (patch.bearbeiter !== undefined) data.bearbeiter = String(patch.bearbeiter || '')
  if (patch.notizen !== undefined) data.notizen = String(patch.notizen || '')
  if (patch.appointmentDate !== undefined)
    data.appointmentDate = patch.appointmentDate ? String(patch.appointmentDate) : ''
  if (patch.appointmentTime !== undefined)
    data.appointmentTime = patch.appointmentTime ? String(patch.appointmentTime) : ''
  if (patch.arbeitsbereiche !== undefined) {
    data.arbeitsbereiche = sanitizeArbeitsbereiche(patch.arbeitsbereiche)
  }

  data.updatedAt = serverTimestamp()

  await updateDoc(doc(db, ANFRAGEN_COLLECTION, id), data)
  return data
}

export async function deleteAnfrage(id) {
  if (!db) throw new Error('NOT_CONFIGURED')
  await deleteDoc(doc(db, ANFRAGEN_COLLECTION, id))
}

/**
 * Bringt ein rohes Firestore-Dokument in eine stabile Form für die UI.
 * Robust gegenüber fehlenden/legacy Feldern.
 */
function normalizeAnfrage(id, raw = {}) {
  const status = VALID_STATUS.includes(raw.status)
    ? raw.status
    : raw.handled
      ? 'erledigt'
      : 'neu'

  return {
    id,
    name: raw.name || '',
    email: raw.email || '',
    phone: raw.phone || '',
    message: raw.message || '',
    status,
    handled: Boolean(raw.handled),
    bearbeiter: raw.bearbeiter || '',
    notizen: raw.notizen || '',
    appointmentDate: raw.appointmentDate || '',
    appointmentTime: raw.appointmentTime || '',
    arbeitsbereiche: sanitizeArbeitsbereiche(raw.arbeitsbereiche),
    createdAt: toMillis(raw.createdAt),
    updatedAt: toMillis(raw.updatedAt),
  }
}

function toMillis(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis() // Firestore Timestamp
  if (value.seconds) return value.seconds * 1000
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? 0 : t
}

/**
 * Validiert/normalisiert Arbeitsbereiche, damit nur sauberes GeoJSON-nahes
 * Format in Firestore landet: [{ id, name, coordinates:[{lat,lng}, …] }]
 */
export function sanitizeArbeitsbereiche(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((b, i) => {
      const coordinates = Array.isArray(b?.coordinates)
        ? b.coordinates
            .map((c) => ({ lat: Number(c?.lat), lng: Number(c?.lng) }))
            .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
        : []
      if (coordinates.length < 3) return null // kein gültiges Polygon
      return {
        id: b?.id || `bereich_${Date.now()}_${i}`,
        name: (b?.name && String(b.name).trim()) || `Arbeitsbereich ${i + 1}`,
        coordinates,
      }
    })
    .filter(Boolean)
}

/* ─────────────────────────── Galerie (Storage) ─────────────────────────── */

const GALLERY_FOLDERS = ['gallery', '']
const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i
// Neue Uploads landen immer im `gallery/`-Ordner (wie von der Website erwartet)
const UPLOAD_FOLDER = 'gallery'

// Firestore-Dokument, das die manuelle Galerie-Reihenfolge hält.
// Liegt unter `gallery/` (bereits öffentlich lesbar / admin-schreibbar laut Rules),
// damit auch die Website die Reihenfolge ohne neue Security-Rule lesen kann.
const GALLERY_ORDER_COLLECTION = 'gallery'
const GALLERY_ORDER_DOC = '_order'

/**
 * Liest die gespeicherte Galerie-Reihenfolge (Liste von Storage-`fullPath`s).
 * Fehlt das Dokument, wird eine leere Liste zurückgegeben.
 * @returns {Promise<string[]>}
 */
export async function fetchGalleryOrder() {
  if (!db) return []
  try {
    const snap = await getDoc(doc(db, GALLERY_ORDER_COLLECTION, GALLERY_ORDER_DOC))
    const order = snap.exists() ? snap.data()?.order : null
    return Array.isArray(order) ? order.filter((p) => typeof p === 'string') : []
  } catch {
    return []
  }
}

/**
 * Speichert die Galerie-Reihenfolge als Liste von `fullPath`s.
 * Die Website kann dasselbe Dokument lesen und ihre Anzeige danach sortieren.
 */
export async function saveGalleryOrder(order) {
  if (!db) throw new Error('NOT_CONFIGURED')
  const clean = Array.isArray(order) ? order.filter((p) => typeof p === 'string') : []
  await setDoc(
    doc(db, GALLERY_ORDER_COLLECTION, GALLERY_ORDER_DOC),
    { order: clean, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/**
 * Sortiert Bilder nach gespeicherter Reihenfolge.
 * In `order` enthaltene Bilder kommen zuerst (in dieser Reihenfolge), danach alle
 * übrigen (z. B. frische Uploads) wie zuvor nach Name absteigend (neueste zuerst).
 */
function applyGalleryOrder(images, order) {
  if (!Array.isArray(order) || order.length === 0) return images
  const rank = new Map(order.map((fullPath, i) => [fullPath, i]))
  return [...images].sort((a, b) => {
    const ra = rank.has(a.fullPath) ? rank.get(a.fullPath) : Infinity
    const rb = rank.has(b.fullPath) ? rank.get(b.fullPath) : Infinity
    if (ra !== rb) return ra - rb
    return b.name.localeCompare(a.name)
  })
}

/**
 * Listet alle Galerie-Bilder (identische Logik wie die Website: Root + gallery/),
 * angewandt auf die in Firestore gespeicherte manuelle Reihenfolge.
 * @returns {Promise<Array<{id,name,url,fullPath}>>}
 */
export async function fetchGalleryImages() {
  if (!storage) return []

  const [lists, order] = await Promise.all([
    Promise.allSettled(GALLERY_FOLDERS.map((path) => listAll(ref(storage, path)))),
    fetchGalleryOrder(),
  ])

  const seen = new Set()
  const items = []
  for (const result of lists) {
    if (result.status !== 'fulfilled') continue
    for (const item of result.value.items) {
      if (seen.has(item.fullPath)) continue
      seen.add(item.fullPath)
      if (IMAGE_RE.test(item.name)) items.push(item)
    }
  }
  items.sort((a, b) => b.name.localeCompare(a.name))

  const urls = await Promise.all(
    items.map(async (item) => {
      try {
        return {
          id: item.fullPath,
          name: item.name,
          fullPath: item.fullPath,
          url: await getDownloadURL(item),
        }
      } catch {
        return null
      }
    }),
  )
  return applyGalleryOrder(urls.filter(Boolean), order)
}

/** Lädt eine Datei in den gallery/-Ordner hoch (eindeutiger Name gegen Kollisionen). */
export async function uploadGalleryImage(file) {
  if (!storage) throw new Error('NOT_CONFIGURED')
  const safe = file.name.replace(/[^\w.\-]+/g, '_')
  const name = `${Date.now()}_${safe}`
  const objectRef = ref(storage, `${UPLOAD_FOLDER}/${name}`)
  await uploadBytes(objectRef, file, { contentType: file.type || 'image/jpeg' })
  return { name, fullPath: objectRef.fullPath, url: await getDownloadURL(objectRef) }
}

/** Löscht ein Bild anhand seines vollständigen Storage-Pfads. */
export async function deleteGalleryImage(fullPath) {
  if (!storage) throw new Error('NOT_CONFIGURED')
  await deleteObject(ref(storage, fullPath))
}
