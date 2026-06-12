/**
 * Vercel Serverless Function: Push-Subscriptions verwalten.
 *
 * POST /api/push/subscription
 *   Header: Authorization: Bearer <Firebase ID Token>  (eingeloggter Admin)
 *   Body:   { action: 'upsert' | 'disable', subscription: <PushSubscriptionJSON>, meta }
 *
 * Speichert in Firestore-Collection `adminPushSubscriptions`.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

const COLLECTION = 'adminPushSubscriptions'

function ensureAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    })
  }
}

function docIdFromEndpoint(endpoint) {
  return Buffer.from(endpoint).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 120)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    ensureAdmin()

    // Admin authentifizieren
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Missing token' })

    let decoded
    try {
      decoded = await getAuth().verifyIdToken(token)
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { action = 'upsert', subscription, meta = {} } = body

    if (!subscription?.endpoint) {
      return res.status(400).json({ error: 'Missing subscription endpoint' })
    }

    const db = getFirestore()
    const ref = db.collection(COLLECTION).doc(docIdFromEndpoint(subscription.endpoint))

    if (action === 'disable') {
      await ref.set(
        { active: false, disabledAt: new Date().toISOString() },
        { merge: true },
      )
      return res.status(200).json({ ok: true })
    }

    await ref.set(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys || null,
        expirationTime: subscription.expirationTime || null,
        active: true,
        adminUid: decoded.uid,
        adminEmail: decoded.email || '',
        userAgent: meta.userAgent || '',
        isStandalone: Boolean(meta.isStandalone),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[subscription] Fehler:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
