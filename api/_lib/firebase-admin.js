/**
 * Gemeinsame Firebase-Admin-Initialisierung für Vercel-Serverless-Funktionen.
 *
 * Unterstützt drei Varianten (in dieser Reihenfolge):
 *  1. FIREBASE_SERVICE_ACCOUNT_JSON – gesamtes Dienstkonto-JSON (empfohlen)
 *  2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + Private Key
 *  3. GOOGLE_APPLICATION_CREDENTIALS (lokal)
 */
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app'

function getPrivateKey() {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_BASE64
  if (b64) {
    try {
      return Buffer.from(b64, 'base64').toString('utf8')
    } catch {
      /* fällt unten zurück */
    }
  }
  let key = (process.env.FIREBASE_PRIVATE_KEY || '').trim()
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1)
  }
  return key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n')
}

function parseServiceAccountJson() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.client_email && parsed?.private_key) return parsed
  } catch {
    /* ungültiges JSON */
  }
  return null
}

export function missingFirebaseEnv() {
  const json = parseServiceAccountJson()
  if (json) return []

  const miss = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL'].filter((k) => !process.env[k])
  if (!process.env.FIREBASE_PRIVATE_KEY && !process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    miss.push('FIREBASE_PRIVATE_KEY oder FIREBASE_PRIVATE_KEY_BASE64')
  }
  return miss
}

export function ensureFirebaseAdmin() {
  if (getApps().length) return

  const serviceAccount = parseServiceAccountJson()
  if (serviceAccount) {
    initializeApp({ credential: cert(serviceAccount) })
    return
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = getPrivateKey()

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    })
    return
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({ credential: applicationDefault() })
    return
  }

  throw new Error(
    'Firebase Admin nicht konfiguriert: FIREBASE_SERVICE_ACCOUNT_JSON oder ' +
      'FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY setzen.',
  )
}
